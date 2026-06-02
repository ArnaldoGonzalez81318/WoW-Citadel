const SUPPORTED_REGIONS = ["us", "eu", "kr", "tw"] as const;

type Region = (typeof SUPPORTED_REGIONS)[number];

const FALLBACK_REGION: Region = "us";
const FALLBACK_LOCALE = "en_US";
const DEFAULT_PROXY_PATH = "/api/blizzard";

const normalize = (value: string | undefined): string => (value ?? "").trim();

const parseRegion = (
  value: string | undefined,
  apiUri?: string | undefined,
): Region => {
  const normalized = normalize(value).toLowerCase() as Region | "";
  if (SUPPORTED_REGIONS.includes(normalized as Region)) {
    return normalized as Region;
  }

  if (apiUri) {
    const match = /https?:\/\/(\w+)\.api\.blizzard\.com/i.exec(apiUri);
    if (match && SUPPORTED_REGIONS.includes(match[1].toLowerCase() as Region)) {
      return match[1].toLowerCase() as Region;
    }
  }

  return FALLBACK_REGION;
};

const withFallback = (value: string | undefined, fallback: string): string => {
  const normalized = normalize(value);
  return normalized.length > 0 ? normalized : fallback;
};

const trimTrailingSlash = (value: string): string => {
  if (value === "/") {
    return value;
  }

  return value.replace(/\/+$/, "") || "/";
};

const legacyApiUri = normalize(import.meta.env.VITE_REACT_APP_API_URI);

const staticAccessToken = normalize(
  import.meta.env.VITE_BNET_ACCESS_TOKEN ??
    import.meta.env.VITE_REACT_APP_ACCESS_TOKEN,
);

const region = parseRegion(import.meta.env.VITE_BNET_REGION, legacyApiUri);
const apiBaseUrl = withFallback(
  legacyApiUri,
  `https://${region}.api.blizzard.com`,
);
const proxyPath = trimTrailingSlash(
  withFallback(import.meta.env.VITE_BNET_PROXY_PATH, DEFAULT_PROXY_PATH),
);

export const env = {
  staticAccessToken,
  region,
  locale: withFallback(import.meta.env.VITE_BNET_LOCALE, FALLBACK_LOCALE),
  apiBaseUrl,
  proxyPath,
};

export const getApiBaseUrl = (): string => env.apiBaseUrl;

export const hasStaticAccessToken = (): boolean =>
  env.staticAccessToken.length > 0;

export const shouldUseBlizzardProxy = (): boolean => !hasStaticAccessToken();
