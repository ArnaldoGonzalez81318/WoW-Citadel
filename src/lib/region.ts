/**
 * Region and proxy-path helpers shared by the browser (`src/lib/env.ts`) and
 * the server proxy (`server/blizzardProxy.ts`).
 *
 * This module must stay dependency-free: no `import.meta`, no Node globals and
 * no `@/` alias imports. The proxy imports it through a relative path and is
 * bundled by both Vite's config loader and Netlify's esbuild, neither of which
 * knows the app's alias or the Vite client types.
 */

export const SUPPORTED_REGIONS = ["us", "eu", "kr", "tw"] as const;

export type Region = (typeof SUPPORTED_REGIONS)[number];

export const FALLBACK_REGION: Region = "us";

export const DEFAULT_PROXY_PATH = "/api/blizzard";

/** Matches the namespaces the proxy will forward (game data only, no `profile-*`). */
export const NAMESPACE_PATTERN =
  /^(static|dynamic)(-classic(1x|-era)?)?-(us|eu|kr|tw)$/;

const REGION_FROM_NAMESPACE_PATTERN =
  /^(static|dynamic|profile)(?:-classic(?:1x|-era)?)?-(us|eu|kr|tw)$/i;

const REGION_FROM_HOST_PATTERN = /https?:\/\/(\w+)\.api\.blizzard\.com/i;

export const isRegion = (value: string): value is Region =>
  (SUPPORTED_REGIONS as readonly string[]).includes(value);

export const normalize = (value: string | undefined): string =>
  (value ?? "").trim();

export const withFallback = (
  value: string | undefined,
  fallback: string,
): string => normalize(value) || fallback;

export const trimTrailingSlash = (value: string): string =>
  value === "/" ? value : value.replace(/\/+$/, "") || "/";

/** Normalises a proxy prefix: trimmed, defaulted, no trailing slash. */
export const normalizeProxyPrefix = (value: string | undefined): string =>
  trimTrailingSlash(withFallback(value, DEFAULT_PROXY_PATH));

/**
 * Resolves a region from an explicit value, then from the host of an API base
 * URL (`https://eu.api.blizzard.com` -> `eu`), then falls back to `us`.
 */
export const parseRegion = (
  value: string | undefined,
  apiBaseUrl?: string,
): Region => {
  const normalized = normalize(value).toLowerCase();
  if (isRegion(normalized)) {
    return normalized;
  }

  if (apiBaseUrl) {
    const match = REGION_FROM_HOST_PATTERN.exec(apiBaseUrl);
    const host = match?.[1]?.toLowerCase();
    if (host && isRegion(host)) {
      return host;
    }
  }

  return FALLBACK_REGION;
};

export const apiHostForRegion = (region: Region): string =>
  `https://${region}.api.blizzard.com`;

/**
 * Extracts the region suffix from a Blizzard namespace
 * (`static-eu`, `dynamic-classic1x-kr`, `profile-us`), or `undefined` when the
 * value is not a recognised namespace.
 */
export const regionFromNamespace = (
  namespace: string | undefined,
): Region | undefined => {
  if (!namespace) {
    return undefined;
  }

  const match = REGION_FROM_NAMESPACE_PATTERN.exec(namespace.trim());
  const region = match?.[2]?.toLowerCase();
  return region && isRegion(region) ? region : undefined;
};
