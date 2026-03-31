import { defineConfig, loadEnv } from "vite"
import type { Plugin } from "vite"
import react from "@vitejs/plugin-react"
import { resolve } from "path"
import {
  DEFAULT_PROXY_PATH,
  getProxySubpath,
  proxyBlizzardRequest,
  resolveBlizzardServerConfig,
  toProxyErrorResponse,
} from "./server/blizzardProxy.ts"

const blizzardDevProxyPlugin = (env: Record<string, string>): Plugin => ({
  name: "blizzard-dev-proxy",
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const rawUrl = req.url

      if (!rawUrl) {
        next()
        return
      }

      const requestUrl = new URL(rawUrl, "http://localhost")
      const path = getProxySubpath(requestUrl.pathname, DEFAULT_PROXY_PATH)

      if (!path) {
        next()
        return
      }

      try {
        const response = await proxyBlizzardRequest({
          config: resolveBlizzardServerConfig(env),
          path,
          search: requestUrl.search,
          method: req.method,
          acceptHeader: Array.isArray(req.headers.accept)
            ? req.headers.accept.join(",")
            : req.headers.accept,
        })

        res.statusCode = response.status
        Object.entries(response.headers).forEach(([header, value]) => {
          res.setHeader(header, value)
        })
        res.end(response.body)
      } catch (error) {
        const response = toProxyErrorResponse(error)
        res.statusCode = response.status
        Object.entries(response.headers).forEach(([header, value]) => {
          res.setHeader(header, value)
        })
        res.end(response.body)
      }
    })
  },
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")

  return {
    plugins: [react(), blizzardDevProxyPlugin(env)],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("/src/features/search/components/SearchExperience.tsx") ||
              id.includes("/src/features/search/components/SearchQueryResults.tsx") ||
              id.includes("/src/features/search/components/SearchResults.tsx") ||
              id.includes("/src/features/search/components/SearchResultSection.tsx") ||
              id.includes("/src/features/search/hooks/useBlizzardSearch.ts") ||
              id.includes("/src/features/search/services/searchService.ts") ||
              id.includes("/src/features/search/categories.ts")) {
              return "search-experience"
            }

            if (!id.includes("node_modules")) {
              return undefined
            }

            if (
              id.includes("/react/") ||
              id.includes("react-dom") ||
              id.includes("scheduler")
            ) {
              return "react-vendor"
            }

            if (id.includes("react-router") || id.includes("@remix-run/router")) {
              return "router-vendor"
            }

            if (id.includes("@tanstack/react-query")) {
              return "query-vendor"
            }

            if (id.includes("@mui/icons-material")) {
              return "mui-icons"
            }

            if (id.includes("@mui/") || id.includes("@emotion/")) {
              return "mui-core"
            }

            return "vendor"
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
  }
})