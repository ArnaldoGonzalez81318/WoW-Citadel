<div align="center">

# 🏰 WoW Citadel

Search anything in Azeroth with a modern, data-driven World of Warcraft companion.

</div>

## ✨ Features

- Real-time lookups against Blizzard's official World of Warcraft Game Data APIs
- Multi-category search covering items, spells, achievements, and mounts
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

2. **Configure environment**

	Copy the sample configuration and add your Blizzard API credentials:

	```bash
	cp .env.example .env
	```

 | Variable                   | Description                                    |
 | -------------------------- | ---------------------------------------------- |
 | `VITE_BNET_CLIENT_ID`      | OAuth client id from Blizzard Developer Portal |
 | `VITE_BNET_CLIENT_SECRET`  | OAuth client secret                            |
 | `VITE_BNET_REGION`         | API region (e.g. `us`, `eu`, `kr`, `tw`)       |
 | `VITE_BNET_LOCALE`         | Locale for localized strings (e.g. `en_US`)    |
 | `VITE_BNET_OAUTH_BASE_URL` | Optional override for OAuth host               |

3. **Run the development server**

	```bash
	npm run dev
	```

4. **Build for production**

	```bash
	npm run build
	```

## 📚 Useful Links

- [World of Warcraft Game Data APIs](https://community.developer.battle.net/documentation/world-of-warcraft/game-data-apis)
- [Blizzard Developer Portal](https://develop.battle.net/)
- [Material UI Documentation](https://mui.com/)

## 🛡️ Disclaimer

World of Warcraft ® is a registered trademark of Blizzard Entertainment, Inc. All data is powered by the Blizzard Game Data APIs.
