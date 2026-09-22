import {
  DEFAULT_PROXY_PATH,
  NETLIFY_PROXY_FUNCTION_PATH,
  getProxySubpath,
  proxyBlizzardRequest,
  resolveBlizzardServerConfig,
  toProxyErrorResponse,
} from "../../server/blizzardProxy"
import type { BlizzardProxyResponse } from "../../server/blizzardProxy"

// Netlify Functions 2.0 signature (web `Request` in, `Response` out). Unlike the
// v1 handler, a `Response` whose body is a `ReadableStream` is streamed to the
// client, so auction dumps are neither buffered in the function nor subject to
// the 6 MB synchronous response limit.

/** Statuses that must not carry a body (`new Response` throws otherwise). */
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304])

const toResponse = (proxied: BlizzardProxyResponse, method: string): Response => {
  const headers = new Headers(proxied.headers)

  if (NULL_BODY_STATUSES.has(proxied.status) || method === "HEAD") {
    return new Response(null, { status: proxied.status, headers })
  }

  return new Response(proxied.body, { status: proxied.status, headers })
}

const readClientIp = (headers: Headers): string | undefined =>
  headers.get("x-nf-client-connection-ip") ??
  headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  undefined

export default async (request: Request): Promise<Response> => {
  const method = request.method.toUpperCase()

  try {
    const url = new URL(request.url)
    // Reached through the netlify.toml rewrite (function path) or directly.
    const path =
      getProxySubpath(url.pathname, NETLIFY_PROXY_FUNCTION_PATH) ??
      getProxySubpath(url.pathname, DEFAULT_PROXY_PATH)

    if (!path) {
      return new Response(JSON.stringify({ message: "Not found." }), {
        status: 404,
        headers: {
          "cache-control": "no-store",
          "content-type": "application/json; charset=utf-8",
        },
      })
    }

    const requestHeaders: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      requestHeaders[key] = value
    })

    const proxied = await proxyBlizzardRequest({
      config: resolveBlizzardServerConfig(process.env),
      path,
      search: url.search,
      method,
      requestHeaders,
      clientIp: readClientIp(request.headers),
      signal: request.signal,
    })

    return toResponse(proxied, method)
  } catch (error) {
    return toResponse(toProxyErrorResponse(error), method)
  }
}
