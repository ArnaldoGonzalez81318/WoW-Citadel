import { env } from "@/lib/env";

/*
 * The WoW Token price's shared settings. The price itself is fetched by the
 * Regions page's `regionTokenQuery`, which every token view reads (the home
 * page's token card, the Regions page and the WoW Token page); for the
 * app's own region its key is this one, so they all share one entry.
 */

/** Polling interval; every "checks every N min" copy reads this. */
export const TOKEN_REFRESH_MINUTES = 5;

export const WOW_TOKEN_QUERY_KEY = ["wow-token-price", env.region] as const;
