import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import {
  getProxySubpath,
  normalizeProxyPrefix,
  proxyBlizzardRequest,
  resolveBlizzardServerConfig,
  toProxyErrorResponse,
} from "./server/blizzardProxy.ts";
import type { BlizzardProxyResponse } from "./server/blizzardProxy.ts";

const blizzardDevProxyPlugin = (env: Record<string, string>): Plugin => {
  // Same normalization src/lib/env.ts applies, so the browser and the
  // middleware agree on the prefix when VITE_BNET_PROXY_PATH is customised.
  const proxyPrefix = normalizeProxyPrefix(env.VITE_BNET_PROXY_PATH);

  return {
    name: "blizzard-dev-proxy",
    configureServer(server) {
      server.config.logger.info(
        `  blizzard-dev-proxy: forwarding ${proxyPrefix}/* to Blizzard`,
      );

      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url;

        if (!rawUrl || !rawUrl.startsWith(proxyPrefix)) {
          next();
          return;
        }

        const requestUrl = new URL(rawUrl, "http://localhost");
        const path = getProxySubpath(requestUrl.pathname, proxyPrefix);

        if (!path) {
          next();
          return;
        }

        const send = (response: BlizzardProxyResponse): void => {
          res.statusCode = response.status;
          Object.entries(response.headers).forEach(([header, value]) => {
            res.setHeader(header, value);
          });
          res.end(response.body);
        };

        try {
          // Resolved per request so missing credentials surface as a 500 JSON
          // body instead of crashing the dev server at startup.
          send(
            await proxyBlizzardRequest({
              config: resolveBlizzardServerConfig(env),
              path,
              search: requestUrl.search,
              method: req.method,
              requestHeaders: req.headers,
              clientIp: req.socket?.remoteAddress,
            }),
          );
        } catch (error) {
          send(toProxyErrorResponse(error));
        }
      });
    },
  };
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), blizzardDevProxyPlugin(env)],
    build: {
      rollupOptions: {
        output: {
          // Vendor-only splitting. Route-level chunks come from the lazy()
          // boundaries in the app, so nothing here references src/ paths.
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return undefined;
            }

            if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
              return "react-vendor";
            }

            if (
              /node_modules\/(react-router|react-router-dom|@remix-run\/router)\//.test(
                id,
              )
            ) {
              return "router-vendor";
            }

            if (/node_modules\/@tanstack\//.test(id)) {
              return "query-vendor";
            }

            if (id.includes("/node_modules/@mui/icons-material/")) {
              return "mui-icons";
            }

            if (/node_modules\/(@mui|@emotion)\//.test(id)) {
              return "mui-core";
            }

            return "vendor";
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
  };
});
