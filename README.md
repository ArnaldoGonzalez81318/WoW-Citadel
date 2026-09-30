# WoW Citadel

A dense, dark reference tool for World of Warcraft game data, built on Blizzard's official Game Data APIs.

## Overview

- Search items, spells, mounts and creatures across categories
- Browse achievements, connected realms and item classes
- Explore every Game Data API family with live requests
- React 18, Vite 5, TypeScript 5 (strict), Material UI v6, @tanstack/react-query v5, react-router-dom v6

## Architecture

The browser never talks to Blizzard directly and never holds a client secret.

```
browser  ->  /api/blizzard/*  ->  Vite middleware (dev) / Netlify function (prod)  ->  <region>.api.blizzard.com
```

Both entry points (`vite.config.ts` and `netlify/functions/blizzard-proxy.ts`) share one module, `server/blizzardProxy.ts`:

- **Single-flight OAuth.** The client-credentials token is cached per process and concurrent cold-start requests share a single `POST /token` (with one retry on 5xx, network failure or a 10 s timeout). If Blizzard rejects a cached token with a 401, it is refreshed once and the request retried (at most once a minute).
- **Allow-list.** Only `GET`/`HEAD` on `/data/wow/...` paths are forwarded; dot segments and protocol-relative paths are rejected with 404. Query keys are filtered to `namespace`, `locale`, `orderby`, `_page`, `_pageSize` and dotted field filters such as `name.en_US`; `profile-*` namespaces are refused with 400 and `_pageSize` is clamped to 1000 (Blizzard's own maximum; the realm directory relies on a whole region fitting in one page).
- **Per-region upstream host.** The region suffix of the `namespace` parameter (`static-eu`, `dynamic-kr`, ...) selects `https://<region>.api.blizzard.com`, unless `BNET_API_BASE_URL` pins a host.
- **Streaming bodies.** Successful upstream bodies are piped through as they arrive rather than buffered; in `vite dev` a client disconnect aborts the upstream fetch (on Netlify the function passes `request.signal`, whose disconnect behaviour Netlify does not document). The auction house reads the multi-megabyte dumps as a stream and stops at its byte cap, so the proxy must not hold the whole document; the Netlify function uses the Functions 2.0 (`Request` -> `Response`) signature, which streams and is bound by the 20 MB / 60 s streamed-response limits instead of the 6 MB buffered limit.
- **Caching tiers.** Responses carry `Cache-Control` for the browser and `Netlify-CDN-Cache-Control` for the CDN: media and static-namespace documents cache for a day in the browser and a week on the CDN, static searches for an hour and a day, dynamic namespaces for a minute and five minutes; anything else is `no-store`. The static tiers are `durable` on the CDN and served stale while it revalidates. `ETag` / `Last-Modified` are forwarded and conditional requests return 304.
- **Rate limit.** A best-effort per-client-IP limiter (`BNET_PROXY_RATE_LIMIT`, default 600/min, matching Blizzard's own 36,000/hour quota) returns 429 with `Retry-After` and `x-proxy-rate-limited: 1`. The app fans out about two requests per card (detail + media), so a 24-card gallery page costs roughly 50 requests. State lives in the process, so on Netlify it is per warm instance, not global. In `vite dev` every request comes from the loopback address, so the limiter is off unless `BNET_PROXY_RATE_LIMIT` is set explicitly; it is enforced by the Netlify function by default. On Netlify the function also declares an edge rate limit (`config.rateLimit`: 600 requests/min per IP, counted across all instances and including CDN cache hits); its 429s do not carry `x-proxy-rate-limited`.

Region-and-path helpers shared by the browser and the proxy live in `src/lib/region.ts`, which is deliberately dependency-free.

## Routes

| Route                    | Page                                 |
| ------------------------ | ------------------------------------ |
| `/`                      | Home                                 |
| `/search`                | Cross-category search                |
| `/category/:slug`        | Category explorer (items, spells...) |
| `/achievements`          | Achievements                         |
| `/connected-realms`      | Connected realms                     |
| `/api-explorer/:family?` | API explorer, optionally by family   |
| `*`                      | Not found                            |

The app uses browser history routing. Vite serves `index.html` for unknown paths in dev and preview; on Netlify the SPA fallback redirect in `netlify.toml` does the same, so deep links and refreshes render the app (and its own Not Found page).

## Environment variables

Copy `.env.example` to `.env`. Variables prefixed `VITE_` are inlined into the browser bundle at build time; everything else stays on the server.

| Variable                       | Scope        | Description                                                                              |
| ------------------------------ | ------------ | ---------------------------------------------------------------------------------------- |
| `BNET_CLIENT_ID`               | server       | Blizzard OAuth client id (required for the proxy)                                        |
| `BNET_CLIENT_SECRET`           | server       | Blizzard OAuth client secret (required for the proxy)                                    |
| `BNET_REGION`                  | server       | Default upstream region when the namespace does not name one (`us`, `eu`, `kr`, `tw`)    |
| `BNET_API_BASE_URL`            | server       | Pins the upstream API host and disables per-region routing                               |
| `BNET_OAUTH_BASE_URL`          | server       | OAuth host override (default `https://oauth.battle.net`)                                 |
| `BNET_PROXY_RATE_LIMIT`        | server       | Requests per client per minute for the function's own per-instance limiter (default `600`, `0` disables it; off in dev unless set). Netlify's edge limit (`config.rateLimit`, 600/min per IP) is separate and not set here |
| `VITE_BNET_REGION`             | dev + prod   | Client region used to build namespaces (default `us`)                                    |
| `VITE_BNET_LOCALE`             | dev + prod   | Client locale for localised strings (default `en_US`)                                    |
| `VITE_BNET_ACCESS_TOKEN`       | dev only     | Browser bearer token that bypasses the proxy in `vite dev`; ignored by `vite build`      |
| `VITE_BNET_PROXY_PATH`         | dev (+ prod) | Proxy prefix (default `/api/blizzard`); also inlined into production builds, so leave it unset on Netlify |
| `VITE_REACT_APP_ACCESS_TOKEN`  | dev only     | Deprecated alias of `VITE_BNET_ACCESS_TOKEN`                                             |
| `VITE_REACT_APP_API_URI`       | dev + prod   | Deprecated; derives the client region and direct API host                                |

## Getting started

1. Install dependencies (`nvm use` picks the Node.js version Netlify builds with, from `.nvmrc`)

   ```bash
   npm install
   ```

2. Configure the environment

   ```bash
   cp .env.example .env
   ```

   Fill in `BNET_CLIENT_ID` and `BNET_CLIENT_SECRET` from the [Blizzard Developer Portal](https://develop.battle.net/).

3. Run the dev server

   ```bash
   npm run dev
   ```

   The Vite dev server exposes the proxy at `/api/blizzard/*` and logs the active prefix at startup.

4. Type-check and build

   ```bash
   npm run typecheck        # app (tsconfig.json)
   npm run typecheck:node   # vite.config.ts, server/, netlify/ (tsconfig.node.json)
   npm run build            # both type-checks, then vite build
   npm run preview          # serve dist/ locally
   ```

## Netlify deployment

1. **Connect the repository** (*Add new project > Import an existing project*). Build settings come from `netlify.toml` (`npm run build`, publish `dist`, functions `netlify/functions`) and the Node.js version from `.nvmrc`. Do not set `NODE_ENV`: `production` skips the devDependencies the build needs (TypeScript, Vite; `netlify.toml` passes `NPM_FLAGS=--include=dev` as a guard), and `development` makes Vite emit a development bundle that honours `VITE_BNET_ACCESS_TOKEN`.
2. **Set environment variables** under *Project configuration > Environment variables* (or `netlify env:set`), not in `netlify.toml`: variables declared there never reach functions.
   - `BNET_CLIENT_ID` and `BNET_CLIENT_SECRET` are required. If your plan has scopes, both need **Functions** (the build does not read them). If you mark the secret as *Contains secret values*, Netlify makes you pick its deploy contexts explicitly: include Production, and Deploy Previews / Branch deploys if those should reach the API.
   - Optional: `BNET_REGION`, `BNET_PROXY_RATE_LIMIT`, and `VITE_BNET_REGION` / `VITE_BNET_LOCALE` for non-default values (`VITE_` values are baked in at build time and need the **Builds** scope).
   - Never set `VITE_BNET_ACCESS_TOKEN` or `VITE_BNET_PROXY_PATH` on Netlify; drop them before using *Import from a .env file*.
   - Non-secret variables have one value for every deploy context unless you add per-context values. Deploy Previews and branch deploys then use the same Blizzard client, and its quota, as production.
3. **Deploy.** Variable changes only apply to the next deploy, so trigger one after editing them.
4. **Verify.**

   ```bash
   curl -i "https://<your-site>.netlify.app/api/blizzard/data/wow/token/index?namespace=dynamic-us"
   curl -I "https://<your-site>.netlify.app/achievements"
   ```

   The first should return `200` with a JSON body containing `price`, the second `200` with `text/html` (the SPA fallback).

The function writes proxy failures to its log in the Netlify UI. What the common responses mean:

| Proxy response                                          | Meaning                                                                                                                                                                             |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `500` `Missing Blizzard proxy server credentials. ...`  | The function cannot see `BNET_CLIENT_ID` / `BNET_CLIENT_SECRET`: unset, set only in `netlify.toml`, no Functions scope or no value for this deploy context, or not redeployed since |
| `502` `Unable to acquire a Blizzard access token (401)` | Blizzard rejected the client id or secret                                                                                                                                           |
| `429` with `x-proxy-rate-limited: 1`                    | The function's per-instance limit (`BNET_PROXY_RATE_LIMIT`)                                                                                                                         |
| `429` without that header                               | Netlify's edge rate limit (600 requests/min per IP) or Blizzard's own quota                                                                                                         |
| `404` `{"message":"Not found."}`                        | The path is not a `/data/wow/...` game-data path                                                                                                                                    |

- The proxy function routes itself to `/api/blizzard/*` (`config.path` in `netlify/functions/blizzard-proxy.ts`, with the edge rate limit above). Netlify runs path-routed functions before redirects, so `netlify.toml` only holds a `/assets/*` 404 rule (missing hashed chunks get a real 404) and the `/*` to `/index.html` SPA fallback; neither is forced, so real files keep serving.
- Keep the default `/api/blizzard` prefix in production: the function's `config.path` and the prefix it strips both assume it.
- The proxy is a Functions 2.0 handler (default export). Netlify always bundles these itself (nft tracing plus an esbuild transpile), which inlines the shared `server/` and `src/lib/region.ts` imports; no `[functions]` bundler setting is needed.
- `netlify.toml` adds security headers and a report-only Content-Security-Policy to static responses. Netlify does not apply them to function responses, so the function sets its own `nosniff`.
- The repository is public, so keep Netlify's default sensitive variable policy (*Require approval*): a Deploy Preview from a fork runs the fork's function code and must not get your Blizzard secret unreviewed.
- To emulate Netlify locally, run `npx netlify-cli@latest dev` (Node.js 22.13 or newer; old global installs predate Functions 2.0). It does not emulate the CDN cache, the edge rate limit or warm function instances.

## Security notes

- `VITE_BNET_ACCESS_TOKEN` is honoured only by `vite dev`; production builds ignore it and always use the proxy, so a token left in `.env` cannot ship in the bundle. The one exception is a build run with `NODE_ENV=development`, which inlines it, so never set `NODE_ENV` on Netlify.
- Rotate any Blizzard secret that was ever committed or placed in a `VITE_` variable: anything prefixed `VITE_` is public.
- Never commit `.env`; it is git-ignored. Commit only `.env.example` with placeholders.
- The proxy forwards only WoW game-data paths and refuses profile namespaces, so the deployed site cannot be used as an open relay for the app's credentials.

## Useful links

- [World of Warcraft Game Data APIs](https://community.developer.battle.net/documentation/world-of-warcraft/game-data-apis)
- [Blizzard Developer Portal](https://develop.battle.net/)
- [Material UI Documentation](https://mui.com/)

## Disclaimer

World of Warcraft is a registered trademark of Blizzard Entertainment, Inc. All data is powered by the Blizzard Game Data APIs.
