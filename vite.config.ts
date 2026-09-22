import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { createRequire } from "node:module";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import {
  getProxySubpath,
  normalizeProxyPrefix,
  proxyBlizzardRequest,
  resolveBlizzardServerConfig,
  toProxyErrorResponse,
} from "./server/blizzardProxy.ts";
import type { BlizzardProxyResponse } from "./server/blizzardProxy.ts";

// createRequire rather than a JSON import: tsconfig.node.json has no
// resolveJsonModule, and the footer only needs the version string.
const nodeRequire = createRequire(import.meta.url);
const { version: appVersion } = nodeRequire("./package.json") as {
  version: string;
};

const blizzardDevProxyPlugin = (env: Record<string, string>): Plugin => {
  // Same normalization src/lib/env.ts applies, so the browser and the
  // middleware agree on the prefix when VITE_BNET_PROXY_PATH is customised.
  const proxyPrefix = normalizeProxyPrefix(env.VITE_BNET_PROXY_PATH);

  // Every dev request comes from the loopback address, so the per-IP limiter
  // would throttle all local tabs and tools together. It stays off in dev
  // unless BNET_PROXY_RATE_LIMIT is set explicitly; Netlify keeps the default.
  const serverEnv: Record<string, string> = {
    ...env,
    BNET_PROXY_RATE_LIMIT: env.BNET_PROXY_RATE_LIMIT ?? "0",
  };

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

        // Cancels the upstream fetch when the browser aborts (react-query
        // signal, auction stream cancelled at its byte cap, tab closed).
        const abort = new AbortController();
        res.on("close", () => {
          if (!res.writableFinished) {
            abort.abort();
          }
        });

        const send = (response: BlizzardProxyResponse): void => {
          res.statusCode = response.status;
          Object.entries(response.headers).forEach(([header, value]) => {
            res.setHeader(header, value);
          });

          if (typeof response.body === "string") {
            res.end(response.body);
            return;
          }

          // Pipe the upstream stream through so bytes reach the browser as
          // they arrive instead of after the whole document is buffered.
          const stream = Readable.fromWeb(
            response.body as unknown as NodeReadableStream<Uint8Array>,
          );
          stream.on("error", () => {
            if (!res.writableEnded) {
              res.destroy();
            }
          });
          stream.pipe(res);
        };

        try {
          // Resolved per request so missing credentials surface as a 500 JSON
          // body instead of crashing the dev server at startup.
          send(
            await proxyBlizzardRequest({
              config: resolveBlizzardServerConfig(serverEnv),
              path,
              search: requestUrl.search,
              method: req.method,
              requestHeaders: req.headers,
              clientIp: req.socket?.remoteAddress,
              signal: abort.signal,
            }),
          );
        } catch (error) {
          if (abort.signal.aborted) {
            // The client is gone; nothing to answer.
            res.destroy();
            return;
          }
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
    define: {
      // Surfaces package.json's version to the footer (Footer.tsx).
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
    },
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
