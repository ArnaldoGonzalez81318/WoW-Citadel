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

- **Single-flight OAuth.** The client-credentials token is cached per process and concurrent cold-start requests share a single `POST /token` (with one retry on 5xx or network failure).
- **Allow-list.** Only `GET`/`HEAD` on `/data/wow/...` paths are forwarded; dot segments and protocol-relative paths are rejected with 404. Query keys are filtered to `namespace`, `locale`, `orderby`, `_page`, `_pageSize` and dotted field filters such as `name.en_US`; `profile-*` namespaces are refused with 400 and `_pageSize` is clamped to 100.
- **Per-region upstream host.** The region suffix of the `namespace` parameter (`static-eu`, `dynamic-kr`, ...) selects `https://<region>.api.blizzard.com`, unless `BNET_API_BASE_URL` pins a host.
- **Caching tiers.** Responses carry `Cache-Control` for the browser and `Netlify-CDN-Cache-Control` for the CDN: media and static-namespace documents cache for a day (durable for a week on the CDN), static searches for an hour, dynamic namespaces for a minute. `ETag` / `Last-Modified` are forwarded and conditional requests return 304.
- **Rate limit.** A best-effort per-client-IP limiter (`BNET_PROXY_RATE_LIMIT`, default 300/min) returns 429 with `Retry-After`. State lives in the process, so on Netlify it is per warm instance, not global.

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
| `BNET_PROXY_RATE_LIMIT`        | server       | Requests per client per minute, per instance (default `300`, `0` disables)               |
| `VITE_BNET_REGION`             | dev + prod   | Client region used to build namespaces (default `us`)                                    |
| `VITE_BNET_LOCALE`             | dev + prod   | Client locale for localised strings (default `en_US`)                                    |
| `VITE_BNET_ACCESS_TOKEN`       | dev only     | Browser bearer token that bypasses the proxy in `vite dev`; ignored by `vite build`      |
| `VITE_BNET_PROXY_PATH`         | dev (+ prod) | Proxy prefix (default `/api/blizzard`); in production `netlify.toml` must be changed too |
| `VITE_REACT_APP_ACCESS_TOKEN`  | dev only     | Deprecated alias of `VITE_BNET_ACCESS_TOKEN`                                             |
| `VITE_REACT_APP_API_URI`       | dev + prod   | Deprecated; derives the client region and direct API host                                |

## Getting started

1. Install dependencies

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

- Set `BNET_CLIENT_ID` and `BNET_CLIENT_SECRET` (and optionally `BNET_REGION`, `BNET_PROXY_RATE_LIMIT`) in the site environment. Add `VITE_BNET_REGION` / `VITE_BNET_LOCALE` only if you need non-default values.
- `netlify.toml` declares two redirects, in this order: `/api/blizzard/*` to the proxy function (forced), then the `/*` to `/index.html` SPA fallback (not forced, so `/assets/*` keeps serving).
- Functions are bundled with esbuild (`[functions] node_bundler = "esbuild"`), which resolves the shared `src/lib/region.ts` import.
- If you customise `VITE_BNET_PROXY_PATH` for a production build, change the `from` of the proxy redirect to match.

## Security notes

- `VITE_BNET_ACCESS_TOKEN` is honoured only by `vite dev`; production builds ignore it and always use the proxy, so a token left in `.env` cannot ship in the bundle.
- Rotate any Blizzard secret that was ever committed or placed in a `VITE_` variable: anything prefixed `VITE_` is public.
- Never commit `.env`; it is git-ignored. Commit only `.env.example` with placeholders.
- The proxy forwards only WoW game-data paths and refuses profile namespaces, so the deployed site cannot be used as an open relay for the app's credentials.

## Useful links

- [World of Warcraft Game Data APIs](https://community.developer.battle.net/documentation/world-of-warcraft/game-data-apis)
- [Blizzard Developer Portal](https://develop.battle.net/)
- [Material UI Documentation](https://mui.com/)

## Disclaimer

World of Warcraft is a registered trademark of Blizzard Entertainment, Inc. All data is powered by the Blizzard Game Data APIs.
