const SUPPORTED_REGIONS = ["us", "eu", "kr", "tw"] as const

type Region = (typeof SUPPORTED_REGIONS)[number]

const FALLBACK_REGION: Region = "us"
const FALLBACK_LOCALE = "en_US"

const normalize = (value: string | undefined): string => (value ?? "").trim()

const parseRegion = (value: string | undefined, apiUri?: string | undefined): Region => {
  const normalized = normalize(value).toLowerCase() as Region | ""
  if (SUPPORTED_REGIONS.includes(normalized as Region)) {
    return normalized as Region
  }

  if (apiUri) {
    const match = /https?:\/\/(\w+)\.api\.blizzard\.com/i.exec(apiUri)
    if (match && SUPPORTED_REGIONS.includes(match[1].toLowerCase() as Region)) {
      return match[1].toLowerCase() as Region
    }
  }

  return FALLBACK_REGION
}

const withFallback = (value: string | undefined, fallback: string): string => {
  const normalized = normalize(value)
  return normalized.length > 0 ? normalized : fallback
}

const legacyApiUri = normalize(import.meta.env.VITE_REACT_APP_API_URI)

const clientId = normalize(
  import.meta.env.VITE_BNET_CLIENT_ID ?? import.meta.env.VITE_REACT_APP_CLIENT_ID
)

const clientSecret = normalize(
  import.meta.env.VITE_BNET_CLIENT_SECRET ?? import.meta.env.VITE_REACT_APP_CLIENT_SECRET
)

const staticAccessToken = normalize(
  import.meta.env.VITE_BNET_ACCESS_TOKEN ?? import.meta.env.VITE_REACT_APP_ACCESS_TOKEN
)

const region = parseRegion(import.meta.env.VITE_BNET_REGION, legacyApiUri)

export const env = {
  clientId,
  clientSecret,
  staticAccessToken,
  region,
  locale: withFallback(import.meta.env.VITE_BNET_LOCALE, FALLBACK_LOCALE),
  oauthBaseUrl: withFallback(import.meta.env.VITE_BNET_OAUTH_BASE_URL, "https://oauth.battle.net"),
  apiBaseUrl: legacyApiUri,
}

export const getApiBaseUrl = (): string =>
  env.apiBaseUrl || `https://${env.region}.api.blizzard.com`

export const hasStaticAccessToken = (): boolean => env.staticAccessToken.length > 0

export const assertClientCredentials = (): void => {
  if (hasStaticAccessToken()) {
    return
  }

  if (!env.clientId || !env.clientSecret) {
    throw new Error(
      "Missing Blizzard API client credentials. Ensure VITE_BNET_CLIENT_ID and VITE_BNET_CLIENT_SECRET are set."
    )
  }
}
