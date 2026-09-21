export type { LocalizedString } from "@/lib/blizzardHelpers";
import type { ItemQuality } from "@/features/search/types";

export type LinkReference = {
  href: string;
};

export type AuctionItemReference = {
  id: number;
  context?: number;
  bonus_lists?: number[];
  pet_breed_id?: number;
  pet_level?: number;
  pet_quality_id?: number;
  pet_species_id?: number;
};

export type AuctionTimeLeft = "SHORT" | "MEDIUM" | "LONG" | "VERY_LONG";

export const TIME_LEFT_HINTS: Record<AuctionTimeLeft, string> = {
  SHORT: "Less than 30 minutes",
  MEDIUM: "30 minutes to 2 hours",
  LONG: "2 to 12 hours",
  VERY_LONG: "12 to 48 hours",
};

export type AuctionListing = {
  id: number;
  item: AuctionItemReference;
  quantity: number;
  time_left: AuctionTimeLeft;
  bid?: number;
  buyout?: number;
  unit_price?: number;
};

export type AuctionHouseResponse = {
  connected_realm?: LinkReference;
  auctions: AuctionListing[];
};

export type AuctionItemSummary = {
  id: number;
  href: string;
  name: string;
  quality?: string;
  /** `quality.type` lowercased when it is a known quality key. */
  qualityKey?: ItemQuality;
  itemClass?: string;
  itemSubclass?: string;
  inventoryType?: string;
  mediaUrl?: string;
};

/** One aggregated (commodities) or single (realm) listing. */
export type AuctionRow = {
  key: string;
  itemId: number;
  quantity: number;
  /** Unit price (commodities) or buyout (realm auctions), in copper. */
  priceCopper: number;
  /** Listings folded into this row (1 for realm auctions). */
  listingCount: number;
  timeLeft: AuctionTimeLeft;
  timeLeftLabel: string;
  timeLeftHint: string;
};

export type AuctionSnapshot = {
  rows: AuctionRow[];
  /** Listings read from the dump before the cap. */
  scannedListings: number;
  bytesRead: number;
  /** The whole dump was read (no cap was hit). */
  complete: boolean;
  /** Rows kept after sorting. */
  limit: number;
};

export type AuctionScanProgress = {
  bytesRead: number;
  scannedListings: number;
};

export type AuctionMarketView = "commodities" | "realm";

/** URL `sort` values for the auction table. */
export type AuctionSortKey =
  | "price-desc"
  | "price-asc"
  | "quantity-desc"
  | "name-asc";

export const AUCTION_SORT_KEYS: readonly AuctionSortKey[] = [
  "price-desc",
  "price-asc",
  "quantity-desc",
  "name-asc",
];

export const isAuctionSortKey = (value: unknown): value is AuctionSortKey =>
  typeof value === "string" &&
  (AUCTION_SORT_KEYS as readonly string[]).includes(value);

/** A snapshot row merged with its (optional, per-row) item summary and icon. */
export type AuctionTableRow = AuctionRow &
  Partial<
    Pick<
      AuctionItemSummary,
      "name" | "quality" | "qualityKey" | "itemClass" | "itemSubclass" | "mediaUrl"
    >
  > & {
    /** The item summary has not resolved yet (name/class cells show a skeleton). */
    summaryPending: boolean;
  };
