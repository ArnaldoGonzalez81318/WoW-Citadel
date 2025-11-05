/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BNET_CLIENT_ID?: string
  readonly VITE_BNET_CLIENT_SECRET?: string
  readonly VITE_BNET_ACCESS_TOKEN?: string
  readonly VITE_BNET_REGION?: string
  readonly VITE_BNET_LOCALE?: string
  readonly VITE_BNET_OAUTH_BASE_URL?: string
  readonly VITE_REACT_APP_CLIENT_ID?: string
  readonly VITE_REACT_APP_CLIENT_SECRET?: string
  readonly VITE_REACT_APP_ACCESS_TOKEN?: string
  readonly VITE_REACT_APP_API_URI?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}