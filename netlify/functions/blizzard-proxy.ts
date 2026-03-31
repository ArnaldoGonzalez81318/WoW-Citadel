import {
  NETLIFY_PROXY_FUNCTION_PATH,
  getProxySubpath,
  proxyBlizzardRequest,
  resolveBlizzardServerConfig,
  toProxyErrorResponse,
} from "../../server/blizzardProxy"

type NetlifyHandlerEvent = {
  path: string
  httpMethod: string
  rawQuery?: string
  headers?: Record<string, string | undefined>
}

type NetlifyHandlerResponse = {
  statusCode: number
  headers?: Record<string, string>
  body: string
}

export const handler = async (
  event: NetlifyHandlerEvent
): Promise<NetlifyHandlerResponse> => {
  try {
    const path = getProxySubpath(event.path, NETLIFY_PROXY_FUNCTION_PATH)

    if (!path) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ message: "Not found." }),
      }
    }

    const response = await proxyBlizzardRequest({
      config: resolveBlizzardServerConfig(process.env),
      path,
      search: event.rawQuery ?? "",
      method: event.httpMethod,
      acceptHeader: event.headers?.accept,
    })

    return {
      statusCode: response.status,
      headers: response.headers,
      body: response.body,
    }
  } catch (error) {
    const response = toProxyErrorResponse(error)

    return {
      statusCode: response.status,
      headers: response.headers,
      body: response.body,
    }
  }
}