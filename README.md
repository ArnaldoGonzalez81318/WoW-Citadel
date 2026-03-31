<div align="center">

# 🏰 WoW Citadel

Search anything in Azeroth with a modern, data-driven World of Warcraft companion.

</div>

## ✨ Features

- Real-time lookups against Blizzard's official World of Warcraft Game Data APIs
- Multi-category search covering items, spells, mounts, and creatures
- Rich summaries with quick links back to Blizzard resources
- Responsive Material UI design inspired by WoW's arcane aesthetic
- Global state, caching, and request deduplication powered by React Query

## 🧱 Tech Stack

- React 18 + Vite 5 + TypeScript 5
- Material UI v6 for theming and layout
- @tanstack/react-query for async data orchestration
- Zod-powered Transformers for safe API consumption

## 🚀 Getting Started

1. **Install dependencies**

 ```bash
 npm install
 ```

1. **Configure environment**

Copy the sample configuration:

```bash
cp .env.example .env
```

Choose one local development mode:

### Option A: temporary browser token for quick local work

Use this when you only need short-lived local development and do not want to run the server-side proxy.

| Variable                 | Description                                 |
| ------------------------ | ------------------------------------------- |
| `VITE_BNET_ACCESS_TOKEN` | Temporary Blizzard access token             |
| `VITE_BNET_REGION`       | API region (e.g. `us`, `eu`, `kr`, `tw`)    |
| `VITE_BNET_LOCALE`       | Locale for localized strings (e.g. `en_US`) |

### Option B: server-side proxy for local dev and Netlify

Use this for the safe, production-ready path. The browser never sees your client secret.

- `BNET_CLIENT_ID`: Blizzard OAuth client id
- `BNET_CLIENT_SECRET`: Blizzard OAuth client secret
- `BNET_REGION`: Optional server region override
- `BNET_API_BASE_URL`: Optional override for the Blizzard API host
- `BNET_OAUTH_BASE_URL`: Optional override for the OAuth host
- `VITE_BNET_REGION`: Client-side region for namespace generation
- `VITE_BNET_LOCALE`: Client-side locale for localized strings
- `VITE_BNET_PROXY_PATH`: Optional proxy path override

`VITE_BNET_PROXY_PATH` defaults to `/api/blizzard`.

Do not put `VITE_BNET_CLIENT_SECRET` in the frontend. Any `VITE_` variable is exposed to the browser.

1. **Run the development server**

 ```bash
 npm run dev
 ```

When `BNET_CLIENT_ID` and `BNET_CLIENT_SECRET` are present, the Vite dev server exposes a local proxy at `/api/blizzard/*`.

1. **Build for production**

 ```bash
 npm run build
 ```

## Netlify Deployment

- Set `BNET_CLIENT_ID` and `BNET_CLIENT_SECRET` in the Netlify site environment.
- Keep `VITE_BNET_REGION` and `VITE_BNET_LOCALE` as frontend env vars if you need non-default values.
- The included `netlify.toml` routes `/api/blizzard/*` to the Netlify function proxy.

## Security Notes

- Rotate any Blizzard client secret that was previously placed in a `VITE_` env var.
- `VITE_BNET_ACCESS_TOKEN` is acceptable for short-lived local development only.
- Production deployments should use the server-side proxy.

## 📚 Useful Links

- [World of Warcraft Game Data APIs](https://community.developer.battle.net/documentation/world-of-warcraft/game-data-apis)
- [Blizzard Developer Portal](https://develop.battle.net/)
- [Material UI Documentation](https://mui.com/)

## 🛡️ Disclaimer

World of Warcraft ® is a registered trademark of Blizzard Entertainment, Inc. All data is powered by the Blizzard Game Data APIs.
