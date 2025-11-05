import { env, assertClientCredentials, getApiBaseUrl, hasStaticAccessToken } from "@/lib/env"

export class BlizzardRequestError extends Error {
  public readonly status: number
  public readonly details?: string

  constructor(message: string, status: number, details?: string) {
    super(message)
    this.name = "BlizzardRequestError"
    this.status = status
    this.details = details
  }
}

type QueryParams = Record<string, string | number | undefined>

type RequestOptions = Omit<RequestInit, "headers"> & {
  params?: QueryParams
  headers?: HeadersInit
}

type NodeBuffer = {
  from(data: string, encoding?: string): { toString(encoding: string): string }
}

let cachedAccessToken = env.staticAccessToken
let tokenExpiresAt = hasStaticAccessToken() ? Number.POSITIVE_INFINITY : 0
let preferStaticToken = hasStaticAccessToken()

const withLeadingSlash = (path: string): string =>
  path.startsWith("/") ? path : `/${path}`

const buildQuery = (params: QueryParams | undefined): string => {
  const searchParams = new URLSearchParams()

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.set(key, String(value))
      }
    })
  }

  if (!searchParams.has("locale")) {
    searchParams.set("locale", env.locale)
  }

  return searchParams.toString()
}

const encodeCredentials = (value: string): string => {
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(value)
  }

  const nodeBuffer = (globalThis as { Buffer?: NodeBuffer }).Buffer

  if (nodeBuffer?.from) {
    return nodeBuffer.from(value).toString("base64")
  }

  throw new Error("Unable to encode credentials; missing base64 encoder in current runtime")
}

const fetchAccessToken = async (): Promise<string> => {
  if (preferStaticToken && hasStaticAccessToken()) {
    cachedAccessToken = env.staticAccessToken
    return cachedAccessToken
  }

  assertClientCredentials()

  const now = Date.now()
  if (cachedAccessToken && tokenExpiresAt - 60000 > now) {
    return cachedAccessToken
  }

  const credentials = `${env.clientId}:${env.clientSecret}`
  const response = await fetch(`${env.oauthBaseUrl}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodeCredentials(credentials)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new BlizzardRequestError(
      `Unable to acquire Blizzard access token (${response.status})`,
      response.status,
      body
    )
  }

  const data: { access_token: string; expires_in: number } = await response.json()
  cachedAccessToken = data.access_token
  tokenExpiresAt = Date.now() + Math.max(data.expires_in - 60, 60) * 1000

  return cachedAccessToken
}

const request = async <T>(
  path: string,
  options: RequestOptions = {},
  attempt = 0
): Promise<T> => {
  const { params, headers, ...init } = options
  const token = await fetchAccessToken()
  const url = new URL(withLeadingSlash(path), getApiBaseUrl())
  const query = buildQuery(params)

  if (query.length > 0) {
    url.search = query
  }

  const defaultHeaders: HeadersInit = {
    Authorization: `Bearer ${token}`,
  }

  const response = await fetch(url.toString(), {
    ...init,
    method: init.method ?? "GET",
    headers: {
      ...defaultHeaders,
      ...headers,
    },
  })

  if (!response.ok) {
    if (response.status === 401 && attempt === 0) {
      if (preferStaticToken) {
        preferStaticToken = false
      }

      cachedAccessToken = ""
      tokenExpiresAt = 0

      return request<T>(path, options, attempt + 1)
    }

    const body = await response.text()
    throw new BlizzardRequestError(
      `Blizzard API request failed with status ${response.status}`,
      response.status,
      body
    )
  }

  return (await response.json()) as T
}

export const blizzardClient = {
  request,
  get: <T>(path: string, params?: QueryParams): Promise<T> => request<T>(path, { params }),
}
