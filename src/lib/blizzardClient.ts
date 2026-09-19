import {
  env,
  getApiBaseUrl,
  hasStaticAccessToken,
  shouldUseBlizzardProxy,
} from "@/lib/env";

/** Why a request failed, beyond the HTTP status. */
export type BlizzardErrorReason =
  | "http"
  | "timeout"
  | "invalid-json"
  | "network";

export type BlizzardRequestErrorExtra = {
  /** Blizzard's numeric error code from the JSON envelope (`{ code, type, detail }`). */
  code?: number;
  /** Human-readable detail from the envelope (`detail`, or the dev proxy's `message`). */
  detail?: string;
  /** Parsed `Retry-After` header, in milliseconds. */
  retryAfterMs?: number;
  reason?: BlizzardErrorReason;
};

/**
 * Error thrown for every failed Blizzard request.
 *
 * `status` is the HTTP status (0 for timeouts / transport failures) and
 * `details` is the raw response body, both kept for existing callers.
 */
export class BlizzardRequestError extends Error {
  public readonly status: number;
  public readonly details?: string;
  public readonly code?: number;
  public readonly detail?: string;
  public readonly retryAfterMs?: number;
  public readonly reason: BlizzardErrorReason;

  constructor(
    message: string,
    status: number,
    details?: string,
    extra: BlizzardRequestErrorExtra = {},
  ) {
    super(message);
    this.name = "BlizzardRequestError";
    this.status = status;
    this.details = details;
    this.code = extra.code;
    this.detail = extra.detail;
    this.retryAfterMs = extra.retryAfterMs;
    this.reason = extra.reason ?? "http";
  }

  /** 404, or a 204 "no content" answer that a caller chose to treat as missing. */
  get isNotFound(): boolean {
    return this.status === 404 || this.status === 204;
  }

  /** 401 / 403: credentials missing, expired or lacking the scope. */
  get isAuth(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /** 429: Blizzard's per-second or per-hour quota was exceeded. */
  get isRateLimited(): boolean {
    return this.status === 429;
  }

  get isTimeout(): boolean {
    return this.reason === "timeout";
  }

  /** 5xx, or an unparsable body from a 2xx: worth retrying. */
  get isServerError(): boolean {
    return this.status >= 500 || this.reason === "invalid-json";
  }
}

export type QueryParamValue = string | number | boolean | null | undefined;

export type QueryParams = Record<string, QueryParamValue>;

export type RequestOptions = Omit<RequestInit, "headers" | "signal"> & {
  params?: QueryParams;
  headers?: HeadersInit;
  /** react-query's `signal`; aborting cancels the underlying fetch. */
  signal?: AbortSignal | null;
  /** Per-request timeout. Defaults to 30s; `0` disables it (large dumps). */
  timeoutMs?: number;
};

export type GetOptions = Pick<RequestOptions, "signal" | "timeoutMs">;

export const DEFAULT_TIMEOUT_MS = 30_000;

const withLeadingSlash = (path: string): string =>
  path.startsWith("/") ? path : `/${path}`;

const trimTrailingSlash = (value: string): string =>
  value === "/" ? value : value.replace(/\/+$/, "");

const buildQuery = (params: QueryParams | undefined): string => {
  const searchParams = new URLSearchParams();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.set(key, String(value));
      }
    });
  }

  if (!searchParams.has("locale")) {
    searchParams.set("locale", env.locale);
  }

  return searchParams.toString();
};

const buildRequestUrl = (
  path: string,
  params: QueryParams | undefined,
): string => {
  const query = buildQuery(params);

  if (shouldUseBlizzardProxy()) {
    const proxiedPath = `${trimTrailingSlash(env.proxyPath)}${withLeadingSlash(path)}`;
    return query.length > 0 ? `${proxiedPath}?${query}` : proxiedPath;
  }

  const url = new URL(withLeadingSlash(path), getApiBaseUrl());

  if (query.length > 0) {
    url.search = query;
  }

  return url.toString();
};

const buildHeaders = (headers: HeadersInit | undefined): HeadersInit => {
  if (!hasStaticAccessToken()) {
    return headers ?? {};
  }

  return {
    Authorization: `Bearer ${env.staticAccessToken}`,
    ...headers,
  };
};

type CombinedSignal = {
  signal: AbortSignal | undefined;
  cleanup: () => void;
};

const noop = (): void => undefined;

const createTimeoutReason = (): DOMException =>
  new DOMException("Request timed out", "TimeoutError");

/**
 * Combines the caller's signal with a timeout. Uses `AbortSignal.any` /
 * `AbortSignal.timeout` when the browser has them, otherwise a manual
 * AbortController that forwards the caller's abort and fires the timeout.
 */
const combineSignals = (
  signal: AbortSignal | null | undefined,
  timeoutMs: number,
): CombinedSignal => {
  const callerSignal = signal ?? undefined;

  if (timeoutMs <= 0) {
    return { signal: callerSignal, cleanup: noop };
  }

  if (
    typeof AbortSignal.any === "function" &&
    typeof AbortSignal.timeout === "function"
  ) {
    const signals = [AbortSignal.timeout(timeoutMs)];
    if (callerSignal) {
      signals.push(callerSignal);
    }
    return { signal: AbortSignal.any(signals), cleanup: noop };
  }

  const controller = new AbortController();
  const timer: ReturnType<typeof setTimeout> = setTimeout(
    () => controller.abort(createTimeoutReason()),
    timeoutMs,
  );
  const forwardAbort = (): void => {
    clearTimeout(timer);
    controller.abort(callerSignal?.reason);
  };

  if (callerSignal) {
    if (callerSignal.aborted) {
      forwardAbort();
    } else {
      callerSignal.addEventListener("abort", forwardAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      callerSignal?.removeEventListener("abort", forwardAbort);
    },
  };
};

const hasErrorName = (error: unknown, name: string): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { name?: unknown }).name === name;

const isTimeoutError = (error: unknown): boolean =>
  hasErrorName(error, "TimeoutError");

const timeoutError = (): BlizzardRequestError =>
  new BlizzardRequestError("Request timed out", 0, undefined, {
    reason: "timeout",
  });

type ErrorEnvelope = {
  code?: unknown;
  detail?: unknown;
  message?: unknown;
};

const parseErrorEnvelope = (
  body: string,
): Pick<BlizzardRequestErrorExtra, "code" | "detail"> => {
  if (body.trim().length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(body) as ErrorEnvelope | null;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const code =
      typeof parsed.code === "number" && Number.isFinite(parsed.code)
        ? parsed.code
        : undefined;
    const detailSource =
      typeof parsed.detail === "string" && parsed.detail.length > 0
        ? parsed.detail
        : typeof parsed.message === "string" && parsed.message.length > 0
          ? parsed.message
          : undefined;

    return { code, detail: detailSource };
  } catch {
    return {};
  }
};

/** `Retry-After` is either delta-seconds or an HTTP-date. */
export const parseRetryAfter = (
  header: string | null,
  now: number = Date.now(),
): number | undefined => {
  if (!header) {
    return undefined;
  }

  const value = header.trim();
  if (value.length === 0) {
    return undefined;
  }

  if (/^\d+$/.test(value)) {
    return Number(value) * 1000;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  return Math.max(0, timestamp - now);
};

const readBodyText = async (response: Response): Promise<string> => {
  try {
    return await response.text();
  } catch {
    return "";
  }
};

/**
 * Low-level request. Resolves with the parsed JSON body, or `undefined` for a
 * 204 / empty response (callers that can receive one must null-check).
 *
 * Throws `BlizzardRequestError` for HTTP failures, timeouts and non-JSON
 * bodies. A caller-initiated abort rejects with the original `AbortError` so
 * react-query can cancel silently.
 */
const request = async <T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> => {
  const {
    params,
    headers,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    ...init
  } = options;
  const combined = combineSignals(signal, timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetch(buildRequestUrl(path, params), {
        ...init,
        method: init.method ?? "GET",
        headers: buildHeaders(headers),
        signal: combined.signal,
      });
    } catch (error) {
      // Timeouts become a typed error; a real AbortError (react-query
      // cancellation) and transport TypeErrors propagate untouched.
      throw isTimeoutError(error) ? timeoutError() : error;
    }

    if (!response.ok) {
      const body = await readBodyText(response);
      const envelope = parseErrorEnvelope(body);
      throw new BlizzardRequestError(
        `Blizzard API request failed with status ${response.status}`,
        response.status,
        body,
        {
          ...envelope,
          retryAfterMs: parseRetryAfter(response.headers.get("retry-after")),
        },
      );
    }

    if (
      response.status === 204 ||
      response.headers.get("content-length") === "0"
    ) {
      return undefined as T;
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      if (isTimeoutError(error)) {
        throw timeoutError();
      }
      if (hasErrorName(error, "AbortError")) {
        throw error;
      }
      throw new BlizzardRequestError(
        "Blizzard returned a non-JSON response",
        response.status,
        undefined,
        { reason: "invalid-json" },
      );
    }
  } finally {
    combined.cleanup();
  }
};

export const blizzardClient = {
  request,
  /**
   * `get(path, params)` is unchanged; pass `{ signal, timeoutMs }` as the
   * third argument to cancel or to lift the 30s timeout (`timeoutMs: 0`).
   */
  get: <T>(
    path: string,
    params?: QueryParams,
    options?: GetOptions,
  ): Promise<T> => request<T>(path, { params, ...options }),
};
