import {
  env,
  getApiBaseUrl,
  hasStaticAccessToken,
  shouldUseBlizzardProxy,
} from "@/lib/env";

export class BlizzardRequestError extends Error {
  public readonly status: number;
  public readonly details?: string;

  constructor(message: string, status: number, details?: string) {
    super(message);
    this.name = "BlizzardRequestError";
    this.status = status;
    this.details = details;
  }
}

type QueryParams = Record<string, string | number | undefined>;

type RequestOptions = Omit<RequestInit, "headers"> & {
  params?: QueryParams;
  headers?: HeadersInit;
};

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

const request = async <T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> => {
  const { params, headers, ...init } = options;
  const response = await fetch(buildRequestUrl(path, params), {
    ...init,
    method: init.method ?? "GET",
    headers: buildHeaders(headers),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new BlizzardRequestError(
      `Blizzard API request failed with status ${response.status}`,
      response.status,
      body,
    );
  }

  return (await response.json()) as T;
};

export const blizzardClient = {
  request,
  get: <T>(path: string, params?: QueryParams): Promise<T> =>
    request<T>(path, { params }),
};
