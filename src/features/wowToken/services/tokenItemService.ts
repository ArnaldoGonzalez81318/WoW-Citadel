import type { TokenItem } from "@/features/wowToken/types";
import { blizzardClient } from "@/lib/blizzardClient";
import { cleanMarkup, localized, namespace, optional404 } from "@/lib/blizzardHelpers";
import type { LocalizedString } from "@/lib/blizzardHelpers";

/*
 * Blizzard publishes two items named "WoW Token":
 *
 *   122270  "Can be sold for gold on the auction house. The auction buyer
 *            can redeem it for 30 days of game time."
 *   122284  "Use: Adds 30 days of game time to your World of Warcraft
 *            account."
 *
 * 122284 is the one the Regions page heads its prices with
 * (WOW_TOKEN_ITEM_ID); the page shows both, with Blizzard's own words.
 */

/** The token a seller lists on the auction house. */
export const LISTED_TOKEN_ITEM_ID = 122270;

/** Fallback when the item text names no day count (game knowledge). */
export const DEFAULT_GAME_TIME_DAYS = 30;

type ItemResponse = {
  id?: number;
  name?: LocalizedString;
  description?: LocalizedString;
};

/**
 * One token item's name and description in the app locale. A missing record
 * (404) resolves to `null`; every other failure propagates so the app-wide
 * retry policy handles it.
 */
export const fetchTokenItem = async (
  itemId: number,
  signal?: AbortSignal,
): Promise<TokenItem | null> => {
  const response = await optional404(() =>
    blizzardClient.get<ItemResponse>(
      `/data/wow/item/${itemId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  if (!response) {
    return null;
  }

  return {
    id: typeof response.id === "number" ? response.id : itemId,
    name: localized(response.name).trim(),
    description: cleanMarkup(localized(response.description)),
  };
};

/** The first whole number in the text, the way every locale writes "30 days". */
const DAY_COUNT = /\d{1,3}/u;

/**
 * Days of game time one token adds, read from the redeemable token's own
 * item text ("Adds 30 days of game time", "30 Tage", "30일"), so the
 * calculators follow Blizzard if the number ever changes. `null` when the
 * text names no plausible count.
 */
export const gameTimeDaysFrom = (description: string | undefined): number | null => {
  const match = DAY_COUNT.exec(description ?? "");
  const days = match ? Number(match[0]) : Number.NaN;
  return Number.isInteger(days) && days >= 1 && days <= 366 ? days : null;
};
