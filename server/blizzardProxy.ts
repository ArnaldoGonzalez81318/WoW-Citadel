import {
  DEFAULT_PROXY_PATH,
  NAMESPACE_PATTERN,
  apiHostForRegion,
  normalize,
  normalizeProxyPrefix,
  parseRegion,
  regionFromNamespace,
  withFallback,
  type Region,
} from "../src/lib/region"

export { DEFAULT_PROXY_PATH, normalizeProxyPrefix }

type ServerEnvSource = Record<string, string | undefined>

export type BlizzardServerConfig = {
  clientId: string
  clientSecret: string
  region: Region
  oauthBaseUrl: string
  apiBaseUrl: string
  /** True when `BNET_API_BASE_URL` was set; the namespace region is then ignored. */
  apiBaseUrlIsExplicit: boolean
  /** Requests per client per minute; 0 disables the limiter. */
  rateLimitPerMinute: number
}

type HeaderValue = string | string[] | undefined

export type BlizzardProxyRequest = {
  config: BlizzardServerConfig
  path: string
  search?: string
  method?: string
  /** Incoming request headers; `if-none-match` / `if-modified-since` are forwarded upstream. */
  requestHeaders?: Record<string, HeaderValue>
  /** Client address used as the rate-limit key. */
  clientIp?: string
}

export type BlizzardProxyResponse = {
  status: number
  headers: Record<string, string>
  body: string
}

export const NETLIFY_PROXY_FUNCTION_PATH = "/.netlify/functions/blizzard-proxy"

const DEFAULT_OAUTH_BASE_URL = "https://oauth.battle.net"
const DEFAULT_RATE_LIMIT_PER_MINUTE = 300
const DEFAULT_TOKEN_TTL_SECONDS = 3600
const TOKEN_ATTEMPTS = 2
const TOKEN_RETRY_DELAY_MS = 300

const ALLOWED_PATH = /^\/data\/wow\/[A-Za-z0-9._~-]+(\/[A-Za-z0-9._~-]+)*$/
const ALLOWED_QUERY_KEY =
  /^(namespace|locale|orderby|_page|_pageSize|[a-z][a-z0-9_]*(\.[A-Za-z0-9_]+)*)$/
const BLOCKED_QUERY_KEYS = new Set(["access_token"])
const MAX_PAGE_SIZE = 100
const DEFAULT_PAGE_SIZE = 50
const MAX_QUERY_KEYS = 16
const MAX_QUERY_VALUE = 256

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_PRUNE_THRESHOLD = 1000

const JSON_CONTENT_TYPE = "application/json; charset=utf-8"
const NO_STORE: Record<string, string> = { "cache-control": "no-store" }

// Token cache. Module-level so a warm instance (Netlify) or the single Vite
// dev process reuses one token across requests.
let cachedAccessToken = ""
let tokenExpiresAt = 0
let cachedTokenKey = ""
let pendingTokenRequest: Promise<string> | null = null
let pendingTokenKey = ""

// Best-effort rate limiter. State lives per process: Netlify function
// instances do not share it, so the limit is per warm instance, not global.
const rateLimitBuckets = new Map<string, { count: number; windowStart: number }>()

export class BlizzardProxyConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BlizzardProxyConfigurationError"
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const jsonResponse = (
  status: number,
  message: string,
  extraHeaders: Record<string, string> = {}
): BlizzardProxyResponse => ({
  status,
  headers: {
    ...NO_STORE,
    "content-type": JSON_CONTENT_TYPE,
    ...extraHeaders,
  },
  body: JSON.stringify({ message }),
})

const readHeader = (headers: Record<string, HeaderValue> | undefined, name: string): string | undefined => {
  if (!headers) {
    return undefined
  }

  let value: HeaderValue = headers[name]
  if (value === undefined) {
    const lower = name.toLowerCase()
    const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === lower)
    value = key ? headers[key] : undefined
  }

  if (Array.isArray(value)) {
    return value.join(", ")
  }

  return value
}

export const getProxySubpath = (pathname: string, prefix = DEFAULT_PROXY_PATH): string | null => {
  if (!pathname.startsWith(prefix)) {
    return null
  }

  const stripped = pathname.slice(prefix.length)
  if (stripped !== "" && !stripped.startsWith("/")) {
    // "/api/blizzardfoo" is not under "/api/blizzard".
    return null
  }

  if (!stripped || stripped === "/") {
    return "/"
  }

  return stripped
}

const parseRateLimit = (value: string | undefined): number => {
  const raw = normalize(value)
  if (!raw) {
    return DEFAULT_RATE_LIMIT_PER_MINUTE
  }

  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : DEFAULT_RATE_LIMIT_PER_MINUTE
}

export const resolveBlizzardServerConfig = (envSource: ServerEnvSource): BlizzardServerConfig => {
  const clientId = normalize(envSource.BNET_CLIENT_ID)
  const clientSecret = normalize(envSource.BNET_CLIENT_SECRET)

  if (!clientId || !clientSecret) {
    throw new BlizzardProxyConfigurationError(
      "Missing Blizzard proxy server credentials. Set BNET_CLIENT_ID and BNET_CLIENT_SECRET on the server, or use VITE_BNET_ACCESS_TOKEN for local-only browser calls."
    )
  }

  const explicitApiBaseUrl = normalize(envSource.BNET_API_BASE_URL)
  const region = parseRegion(envSource.BNET_REGION, explicitApiBaseUrl)

  return {
    clientId,
    clientSecret,
    region,
    oauthBaseUrl: withFallback(envSource.BNET_OAUTH_BASE_URL, DEFAULT_OAUTH_BASE_URL),
    apiBaseUrl: withFallback(explicitApiBaseUrl, apiHostForRegion(region)),
    apiBaseUrlIsExplicit: explicitApiBaseUrl.length > 0,
    rateLimitPerMinute: parseRateLimit(envSource.BNET_PROXY_RATE_LIMIT),
  }
}

const getCachedTokenKey = (config: BlizzardServerConfig): string =>
  `${config.clientId}:${config.clientSecret}:${config.oauthBaseUrl}`

type TokenResponse = { access_token: string; expires_in?: number }

const requestAccessToken = async (config: BlizzardServerConfig, tokenKey: string): Promise<string> => {
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`, "utf8").toString(
    "base64"
  )

  for (let attempt = 1; attempt <= TOKEN_ATTEMPTS; attempt += 1) {
    const canRetry = attempt < TOKEN_ATTEMPTS
    let response: Response

    try {
      response = await fetch(`${config.oauthBaseUrl}/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
      })
    } catch (error) {
      if (canRetry) {
        await sleep(TOKEN_RETRY_DELAY_MS)
        continue
      }
      throw error
    }

    if (!response.ok) {
      if (response.status >= 500 && canRetry) {
        await sleep(TOKEN_RETRY_DELAY_MS)
        continue
      }

      const body = await response.text()
      throw new Error(
        `Unable to acquire a Blizzard access token (${response.status}). ${body || "Check the server credentials."}`
      )
    }

    const data = (await response.json()) as TokenResponse
    const ttlSeconds = Math.max((data.expires_in ?? DEFAULT_TOKEN_TTL_SECONDS) - 60, 60)

    cachedAccessToken = data.access_token
    cachedTokenKey = tokenKey
    tokenExpiresAt = Date.now() + ttlSeconds * 1000

    return cachedAccessToken
  }

  throw new Error("Unable to acquire a Blizzard access token.")
}

const fetchAccessToken = async (config: BlizzardServerConfig): Promise<string> => {
  const now = Date.now()
  const tokenKey = getCachedTokenKey(config)

  if (cachedAccessToken && cachedTokenKey === tokenKey && tokenExpiresAt - 60000 > now) {
    return cachedAccessToken
  }

  // Single flight: concurrent cold-start requests share one POST /token.
  if (pendingTokenRequest && pendingTokenKey === tokenKey) {
    return pendingTokenRequest
  }

  pendingTokenKey = tokenKey
  pendingTokenRequest = requestAccessToken(config, tokenKey).finally(() => {
    if (pendingTokenKey === tokenKey) {
      pendingTokenRequest = null
      pendingTokenKey = ""
    }
  })

  return pendingTokenRequest
}

const pruneRateLimitBuckets = (now: number): void => {
  if (rateLimitBuckets.size <= RATE_LIMIT_PRUNE_THRESHOLD) {
    return
  }

  const cutoff = now - RATE_LIMIT_WINDOW_MS * 2
  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.windowStart < cutoff) {
      rateLimitBuckets.delete(key)
    }
  }
}

/** Returns seconds until the window resets when the client is over the limit, otherwise null. */
const checkRateLimit = (clientIp: string | undefined, limit: number): number | null => {
  if (limit <= 0) {
    return null
  }

  const now = Date.now()
  const key = clientIp || "anonymous"
  const bucket = rateLimitBuckets.get(key)

  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitBuckets.set(key, { count: 1, windowStart: now })
    pruneRateLimitBuckets(now)
    return null
  }

  if (bucket.count >= limit) {
    return Math.max(1, Math.ceil((bucket.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000))
  }

  bucket.count += 1
  return null
}

type QueryValidation =
  | { ok: true; params: URLSearchParams }
  | { ok: false; response: BlizzardProxyResponse }

const sanitizeQuery = (search: string): QueryValidation => {
  const incoming = new URLSearchParams(search.replace(/^\?/, ""))
  const params = new URLSearchParams()

  for (const [key, value] of incoming) {
    if (BLOCKED_QUERY_KEYS.has(key) || !ALLOWED_QUERY_KEY.test(key)) {
      continue
    }
    params.append(key, value)
  }

  const keys = new Set(params.keys())
  if (keys.size > MAX_QUERY_KEYS) {
    return { ok: false, response: jsonResponse(400, "Too many query parameters.") }
  }

  for (const value of params.values()) {
    if (value.length > MAX_QUERY_VALUE) {
      return { ok: false, response: jsonResponse(400, "Query parameter value too long.") }
    }
  }

  const namespace = params.get("namespace")
  if (namespace !== null && !NAMESPACE_PATTERN.test(namespace)) {
    return { ok: false, response: jsonResponse(400, "Unsupported namespace.") }
  }

  const pageSize = params.get("_pageSize")
  if (pageSize !== null) {
    const clamped = Math.min(Math.max(Number(pageSize) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE)
    params.set("_pageSize", String(Math.floor(clamped)))
  }

  return { ok: true, params }
}

const LONG_CACHE: Record<string, string> = {
  "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
  "netlify-cdn-cache-control": "public, s-maxage=604800, durable",
}

const MEDIUM_CACHE: Record<string, string> = {
  "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
  "netlify-cdn-cache-control": "public, s-maxage=86400",
}

const SHORT_CACHE: Record<string, string> = {
  "cache-control": "public, max-age=60, stale-while-revalidate=300",
  "netlify-cdn-cache-control": "public, s-maxage=300",
}

const cachePolicy = (path: string, params: URLSearchParams, status: number): Record<string, string> => {
  const cacheable = (status >= 200 && status < 300) || status === 304
  if (!cacheable) {
    return NO_STORE
  }

  const namespace = (params.get("namespace") ?? "").toLowerCase()
  const isStatic = namespace.startsWith("static-")
  const isDynamic = namespace.startsWith("dynamic-")
  const isSearch = path.startsWith("/data/wow/search/")
  const isMedia = path.startsWith("/data/wow/media/")

  if (isMedia || (isStatic && !isSearch)) {
    return LONG_CACHE
  }

  if (isStatic && isSearch) {
    return MEDIUM_CACHE
  }

  if (isDynamic) {
    return SHORT_CACHE
  }

  return NO_STORE
}

export const proxyBlizzardRequest = async ({
  config,
  path,
  search = "",
  method = "GET",
  requestHeaders,
  clientIp,
}: BlizzardProxyRequest): Promise<BlizzardProxyResponse> => {
  const normalizedMethod = method.toUpperCase()

  if (!["GET", "HEAD"].includes(normalizedMethod)) {
    return jsonResponse(405, "Method not allowed.")
  }

  // Allow-list: only WoW game-data paths, no dot segments.
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  if (
    !ALLOWED_PATH.test(normalizedPath) ||
    normalizedPath.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    return jsonResponse(404, "Not found.")
  }

  const query = sanitizeQuery(search)
  if (!query.ok) {
    return query.response
  }
  const { params } = query

  const retryAfterSeconds = checkRateLimit(clientIp, config.rateLimitPerMinute)
  if (retryAfterSeconds !== null) {
    return jsonResponse(429, "Too many requests.", { "retry-after": String(retryAfterSeconds) })
  }

  // Upstream host follows the namespace region unless BNET_API_BASE_URL pins one.
  const namespaceRegion = regionFromNamespace(params.get("namespace") ?? undefined)
  const base =
    config.apiBaseUrlIsExplicit || !namespaceRegion ? config.apiBaseUrl : apiHostForRegion(namespaceRegion)

  const url = new URL(normalizedPath, base)
  if (url.origin !== new URL(base).origin) {
    // Blocks protocol-relative paths such as "//evil.host/x".
    return jsonResponse(404, "Not found.")
  }
  url.search = params.toString()

  const token = await fetchAccessToken(config)

  const upstreamHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  }

  const ifNoneMatch = readHeader(requestHeaders, "if-none-match")
  if (ifNoneMatch) {
    upstreamHeaders["If-None-Match"] = ifNoneMatch
  }

  const ifModifiedSince = readHeader(requestHeaders, "if-modified-since")
  if (ifModifiedSince) {
    upstreamHeaders["If-Modified-Since"] = ifModifiedSince
  }

  const upstreamResponse = await fetch(url.toString(), {
    method: normalizedMethod,
    headers: upstreamHeaders,
  })

  const etag = upstreamResponse.headers.get("etag")
  const lastModified = upstreamResponse.headers.get("last-modified")

  const headers: Record<string, string> = {
    ...cachePolicy(normalizedPath, params, upstreamResponse.status),
    "content-type": upstreamResponse.headers.get("content-type") || JSON_CONTENT_TYPE,
    ...(etag ? { etag } : {}),
    ...(lastModified ? { "last-modified": lastModified } : {}),
  }

  if (upstreamResponse.status === 304) {
    return { status: 304, headers, body: "" }
  }

  return {
    status: upstreamResponse.status,
    headers,
    body: await upstreamResponse.text(),
  }
}

export const toProxyErrorResponse = (error: unknown): BlizzardProxyResponse => {
  const message =
    error instanceof Error
      ? error.message
      : "Unexpected Blizzard proxy failure. Check the server configuration."

  const status = error instanceof BlizzardProxyConfigurationError ? 500 : 502

  return jsonResponse(status, message)
}
