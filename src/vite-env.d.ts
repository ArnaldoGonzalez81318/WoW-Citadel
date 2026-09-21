/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Dev-only browser bearer token; ignored by production builds, which always
   * go through the server proxy.
   */
  readonly VITE_BNET_ACCESS_TOKEN?: string;
  /** Client region used for namespace generation (`us`, `eu`, `kr`, `tw`). */
  readonly VITE_BNET_REGION?: string;
  /** Client locale for localised strings (e.g. `en_US`). */
  readonly VITE_BNET_LOCALE?: string;
  /** Proxy prefix the browser calls; defaults to `/api/blizzard`. */
  readonly VITE_BNET_PROXY_PATH?: string;
  /** @deprecated Legacy CRA name, still read as a fallback for `VITE_BNET_ACCESS_TOKEN`. */
  readonly VITE_REACT_APP_ACCESS_TOKEN?: string;
  /** @deprecated Legacy CRA name, still read to derive the region and API host. */
  readonly VITE_REACT_APP_API_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
