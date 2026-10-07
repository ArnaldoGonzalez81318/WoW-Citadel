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
// client, so auction dumps are not buffered in the function and are bound by
// the 20 MB / 60 s streamed-response limits, not the 6 MB buffered limit.

/** Statuses that must not carry a body (`new Response` throws otherwise). */
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304])

/**
 * Netlify cuts a streamed response at 20 MB, and the browser then reports a
 * network error and drops bytes it had already received. Ending the stream
 * just short of that instead gives a clean (truncated) end, which the auction
 * index reader treats as "searched the first N listings". Only the regional
 * commodities dump (about 23 MB) is this large.
 */
const STREAM_BYTE_LIMIT = 19_900_000

const capStream = (body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> => {
  let sent = 0
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        const room = STREAM_BYTE_LIMIT - sent
        if (chunk.byteLength < room) {
          sent += chunk.byteLength
          controller.enqueue(chunk)
          return
        }
        controller.enqueue(chunk.subarray(0, room))
        sent = STREAM_BYTE_LIMIT
        // Closes the readable side and cancels the upstream body.
        controller.terminate()
      },
    })
  )
}

const toResponse = (proxied: BlizzardProxyResponse, method: string): Response => {
  const headers = new Headers(proxied.headers)
  // netlify.toml [[headers]] rules are not applied to function responses.
  headers.set("x-content-type-options", "nosniff")

  if (NULL_BODY_STATUSES.has(proxied.status) || method === "HEAD") {
    return new Response(null, { status: proxied.status, headers })
  }

  const body = typeof proxied.body === "string" ? proxied.body : capStream(proxied.body)
  return new Response(body, { status: proxied.status, headers })
}

/** The part of Netlify's `Context` this function reads (avoids a @netlify/functions dependency). */
type NetlifyContext = { ip?: string }

// `context.ip` is the documented client address; the headers are fallbacks.
const readClientIp = (headers: Headers, context?: NetlifyContext): string | undefined =>
  context?.ip ||
  headers.get("x-nf-client-connection-ip") ||
  headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  undefined

export default async (request: Request, context?: NetlifyContext): Promise<Response> => {
  const method = request.method.toUpperCase()

  try {
    const url = new URL(request.url)
    // Routed by `config.path` below. Netlify stops serving the function at
    // NETLIFY_PROXY_FUNCTION_PATH once `path` is set, so that branch only
    // matters if `path` is removed.
    const path =
      getProxySubpath(url.pathname, NETLIFY_PROXY_FUNCTION_PATH) ??
      getProxySubpath(url.pathname, DEFAULT_PROXY_PATH)

    if (!path) {
      return new Response(JSON.stringify({ message: "Not found." }), {
        status: 404,
        headers: {
          "cache-control": "no-store",
          "content-type": "application/json; charset=utf-8",
          "x-content-type-options": "nosniff",
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
      clientIp: readClientIp(request.headers, context),
      signal: request.signal,
    })

    return toResponse(proxied, method)
  } catch (error) {
    return toResponse(toProxyErrorResponse(error), method)
  }
}

// Routed here directly instead of through a netlify.toml rewrite: functions
// with a `path` run before redirects (the SPA fallback cannot shadow them) and
// are no longer reachable at /.netlify/functions/blizzard-proxy, so the edge
// rate limit below has no bypass. It counts CDN cache hits too and is enforced
// across all instances, unlike the in-memory limiter in server/blizzardProxy.ts.
// Keep `path` in sync with DEFAULT_PROXY_PATH (src/lib/region.ts).
export const config = {
  path: "/api/blizzard/*",
  rateLimit: {
    windowLimit: 600,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
}
