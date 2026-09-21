import {
  apiHostForRegion,
  normalize,
  normalizeProxyPrefix,
  parseRegion,
  withFallback,
} from "./region";

export const FALLBACK_LOCALE = "en_US";

const legacyApiUri = normalize(import.meta.env.VITE_REACT_APP_API_URI);

/**
 * A browser-side bearer token is a dev-only shortcut. Production builds ignore
 * it so a token left in `.env` can never be inlined into the public bundle.
 */
const staticAccessToken = import.meta.env.DEV
  ? normalize(
      import.meta.env.VITE_BNET_ACCESS_TOKEN ??
        import.meta.env.VITE_REACT_APP_ACCESS_TOKEN,
    )
  : "";

if (import.meta.env.DEV && staticAccessToken) {
  console.warn(
    "[WoW Citadel] VITE_BNET_ACCESS_TOKEN is being sent from the browser. This only works in `vite dev`; production builds ignore it and use the proxy.",
  );
}

const region = parseRegion(import.meta.env.VITE_BNET_REGION, legacyApiUri);
const apiBaseUrl = withFallback(legacyApiUri, apiHostForRegion(region));
const proxyPath = normalizeProxyPrefix(import.meta.env.VITE_BNET_PROXY_PATH);

/**
 * Build-time environment, inlined by Vite.
 *
 * - `staticAccessToken`: `VITE_BNET_ACCESS_TOKEN` (legacy `VITE_REACT_APP_ACCESS_TOKEN`);
 *   only honoured by `vite dev`, always empty in production builds.
 * - `region`: `VITE_BNET_REGION`, falling back to the host of
 *   `VITE_REACT_APP_API_URI`, then `us`.
 * - `locale`: `VITE_BNET_LOCALE`, default `en_US`.
 * - `apiBaseUrl`: `VITE_REACT_APP_API_URI` (legacy), otherwise
 *   `https://{region}.api.blizzard.com`. Only used when a static token bypasses the proxy.
 * - `proxyPath`: `VITE_BNET_PROXY_PATH`, default `/api/blizzard`, no trailing slash.
 */
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
