import { BlizzardRequestError } from "@/lib/blizzardClient";

export type ErrorSeverity = "error" | "warning" | "info";

export type BlizzardErrorDescription = {
  /** Short heading, e.g. "Rate limit reached". */
  title: string;
  /** One or two plain sentences safe to show to users. */
  message: string;
  severity: ErrorSeverity;
  /** Whether a "Retry" action makes sense. */
  retryable: boolean;
  /** HTTP status when the error came from Blizzard (0 for transport errors). */
  status?: number;
};

const hasName = (error: unknown, name: string): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { name?: unknown }).name === name;

/** A caller-initiated cancellation (react-query, unmount, superseded search). */
export const isAbortError = (error: unknown): boolean =>
  hasName(error, "AbortError");

export const isTimeoutError = (error: unknown): boolean =>
  hasName(error, "TimeoutError") ||
  (error instanceof BlizzardRequestError && error.isTimeout);

/**
 * The client could not reach Blizzard at all (offline, DNS, proxy down).
 * `blizzardClient` converts fetch's transport `TypeError` into a
 * `BlizzardRequestError` with `reason: "network"`; other TypeErrors are
 * programming errors and must not be reported as connectivity problems.
 */
export const isNetworkError = (error: unknown): boolean =>
  error instanceof BlizzardRequestError && error.isNetwork;

const errorMessage = (error: unknown): string | undefined => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }
  return undefined;
};

const lead = (context: string | undefined): string =>
  context && context.trim().length > 0
    ? `We couldn't load ${context.trim()}.`
    : "We couldn't load this data.";

const formatSeconds = (ms: number): string => {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  return seconds === 1 ? "1 second" : `${seconds} seconds`;
};

/** Blizzard's `detail` strings rarely end in punctuation; make them a sentence. */
const asSentence = (text: string): string => {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

/**
 * Turns anything thrown by a Blizzard query into copy an ErrorState can show.
 *
 * @param context what was being loaded, as a noun phrase: "items",
 *   "the WoW Token price", "realm status". Used as "We couldn't load {context}."
 */
export const describeBlizzardError = (
  error: unknown,
  context?: string,
): BlizzardErrorDescription => {
  const intro = lead(context);

  if (error instanceof BlizzardRequestError) {
    if (error.isAuth) {
      // The env-var hint is for whoever runs the dev server, never for users.
      const hint = import.meta.env.DEV
        ? " Check the VITE_BNET_* values in .env and restart the dev server."
        : " Try again later.";
      return {
        title: "Blizzard credentials rejected",
        message: `${intro} Blizzard rejected the app's credentials (HTTP ${error.status}).${hint}`,
        severity: "error",
        retryable: false,
        status: error.status,
      };
    }

    if (error.isRateLimited) {
      const wait = error.retryAfterMs
        ? `Try again in ${formatSeconds(error.retryAfterMs)}.`
        : "Try again in a moment.";
      // The proxy caps requests per client address; that is not Blizzard's doing.
      const cause = error.isProxyRateLimited
        ? "Too many requests from your network."
        : "Blizzard is throttling requests right now.";
      return {
        title: error.isProxyRateLimited
          ? "Too many requests"
          : "Rate limit reached",
        message: `${intro} ${cause} ${wait}`,
        severity: "warning",
        retryable: true,
        status: error.status,
      };
    }

    if (error.isNotFound) {
      return {
        title: "Nothing found",
        message: `${
          context
            ? `Blizzard has no data for ${context.trim()}.`
            : "Blizzard has no data for this request."
        } It may not exist in this region, or the link may be out of date; try a different selection.`,
        severity: "info",
        retryable: false,
        status: error.status,
      };
    }

    if (error.isTimeout) {
      return {
        title: "Request timed out",
        message: `${intro} Blizzard took too long to answer. Check your connection and try again.`,
        severity: "warning",
        retryable: true,
        status: 0,
      };
    }

    if (error.isNetwork) {
      return {
        title: "You appear to be offline",
        message: `${intro} We couldn't reach Blizzard's API. Check your connection and try again.`,
        severity: "warning",
        retryable: true,
        status: 0,
      };
    }

    if (error.reason === "invalid-json") {
      return {
        title: "Unexpected response",
        message: `${intro} Blizzard answered with something that wasn't data. Try again in a moment.`,
        severity: "error",
        retryable: true,
        status: error.status,
      };
    }

    if (error.status >= 500 || error.status === 0) {
      return {
        title: "Blizzard is having trouble",
        message: `${intro} Blizzard's API returned an error${
          error.status > 0 ? ` (HTTP ${error.status})` : ""
        }. Try again shortly.`,
        severity: "error",
        retryable: true,
        status: error.status,
      };
    }

    return {
      title: "Request rejected",
      message: `${intro} ${
        error.detail
          ? asSentence(error.detail)
          : `Blizzard rejected the request (HTTP ${error.status}).`
      }`,
      severity: "error",
      retryable: false,
      status: error.status,
    };
  }

  if (isAbortError(error)) {
    return {
      title: "Request cancelled",
      message: "The request was cancelled before it finished.",
      severity: "info",
      retryable: true,
    };
  }

  if (isTimeoutError(error)) {
    return {
      title: "Request timed out",
      message: `${intro} The request took too long. Check your connection and try again.`,
      severity: "warning",
      retryable: true,
      status: 0,
    };
  }

  const detail = errorMessage(error);

  return {
    title: "Something went wrong",
    message: `${intro} ${
      detail ? asSentence(detail) : "An unexpected error occurred."
    }`,
    severity: "error",
    retryable: true,
  };
};
