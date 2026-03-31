const SUPPORTED_REGIONS = ["us", "eu", "kr", "tw"] as const

type Region = (typeof SUPPORTED_REGIONS)[number]

type ServerEnvSource = Record<string, string | undefined>

type BlizzardServerConfig = {
  clientId: string
  clientSecret: string
  region: Region
  oauthBaseUrl: string
  apiBaseUrl: string
}

type BlizzardProxyRequest = {
  config: BlizzardServerConfig
  path: string
  search?: string
  method?: string
  acceptHeader?: string
}

export type BlizzardProxyResponse = {
  status: number
  headers: Record<string, string>
  body: string
}

export const DEFAULT_PROXY_PATH = "/api/blizzard"
export const NETLIFY_PROXY_FUNCTION_PATH = "/.netlify/functions/blizzard-proxy"

const FALLBACK_REGION: Region = "us"
const DEFAULT_OAUTH_BASE_URL = "https://oauth.battle.net"

let cachedAccessToken = ""
let tokenExpiresAt = 0
let cachedTokenKey = ""

const normalize = (value: string | undefined): string => (value ?? "").trim()

const withFallback = (value: string | undefined, fallback: string): string => {
  const normalized = normalize(value)
  return normalized.length > 0 ? normalized : fallback
}

const parseRegion = (value: string | undefined, apiBaseUrl?: string): Region => {
  const normalized = normalize(value).toLowerCase() as Region | ""
  if (SUPPORTED_REGIONS.includes(normalized as Region)) {
    return normalized as Region
  }

  if (apiBaseUrl) {
    const match = /https?:\/\/(\w+)\.api\.blizzard\.com/i.exec(apiBaseUrl)
    if (match && SUPPORTED_REGIONS.includes(match[1].toLowerCase() as Region)) {
      return match[1].toLowerCase() as Region
    }
  }

  return FALLBACK_REGION
}

export class BlizzardProxyConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BlizzardProxyConfigurationError"
  }
}

export const getProxySubpath = (pathname: string, prefix = DEFAULT_PROXY_PATH): string | null => {
  if (!pathname.startsWith(prefix)) {
    return null
  }

  const stripped = pathname.slice(prefix.length)
  if (!stripped || stripped === "/") {
    return "/"
  }

  return stripped.startsWith("/") ? stripped : `/${stripped}`
}

export const resolveBlizzardServerConfig = (envSource: ServerEnvSource): BlizzardServerConfig => {
  const clientId = normalize(envSource.BNET_CLIENT_ID)
  const clientSecret = normalize(envSource.BNET_CLIENT_SECRET)

  if (!clientId || !clientSecret) {
    throw new BlizzardProxyConfigurationError(
      "Missing Blizzard proxy server credentials. Set BNET_CLIENT_ID and BNET_CLIENT_SECRET on the server, or use VITE_BNET_ACCESS_TOKEN for local-only browser calls."
    )
  }

  const apiBaseUrl = normalize(envSource.BNET_API_BASE_URL)
  const region = parseRegion(envSource.BNET_REGION, apiBaseUrl)

  return {
    clientId,
    clientSecret,
    region,
    oauthBaseUrl: withFallback(envSource.BNET_OAUTH_BASE_URL, DEFAULT_OAUTH_BASE_URL),
    apiBaseUrl: withFallback(apiBaseUrl, `https://${region}.api.blizzard.com`),
  }
}

const getCachedTokenKey = (config: BlizzardServerConfig): string =>
  `${config.clientId}:${config.clientSecret}:${config.oauthBaseUrl}`

const fetchAccessToken = async (config: BlizzardServerConfig): Promise<string> => {
  const now = Date.now()
  const tokenKey = getCachedTokenKey(config)

  if (cachedAccessToken && cachedTokenKey === tokenKey && tokenExpiresAt - 60000 > now) {
    return cachedAccessToken
  }

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`, "utf8").toString(
    "base64"
  )

  const response = await fetch(`${config.oauthBaseUrl}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `Unable to acquire a Blizzard access token (${response.status}). ${body || "Check the server credentials."}`
    )
  }

  const data: { access_token: string; expires_in: number } = await response.json()
  cachedAccessToken = data.access_token
  cachedTokenKey = tokenKey
  tokenExpiresAt = Date.now() + Math.max(data.expires_in - 60, 60) * 1000

  return cachedAccessToken
}

export const proxyBlizzardRequest = async ({
  config,
  path,
  search = "",
  method = "GET",
  acceptHeader,
}: BlizzardProxyRequest): Promise<BlizzardProxyResponse> => {
  const normalizedMethod = method.toUpperCase()

  if (!["GET", "HEAD"].includes(normalizedMethod)) {
    return {
      status: 405,
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ message: "Method not allowed." }),
    }
  }

  const token = await fetchAccessToken(config)
  const url = new URL(path.startsWith("/") ? path : `/${path}`, config.apiBaseUrl)

  if (search.length > 0) {
    url.search = search.startsWith("?") ? search : `?${search}`
  }

  const upstreamResponse = await fetch(url.toString(), {
    method: normalizedMethod,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: acceptHeader || "application/json",
    },
  })

  return {
    status: upstreamResponse.status,
    headers: {
      "cache-control": upstreamResponse.headers.get("cache-control") || "no-store",
      "content-type": upstreamResponse.headers.get("content-type") || "application/json; charset=utf-8",
    },
    body: await upstreamResponse.text(),
  }
}

export const toProxyErrorResponse = (error: unknown): BlizzardProxyResponse => {
  const message =
    error instanceof Error
      ? error.message
      : "Unexpected Blizzard proxy failure. Check the server configuration."

  const status = error instanceof BlizzardProxyConfigurationError ? 500 : 502

  return {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ message }),
  }
}