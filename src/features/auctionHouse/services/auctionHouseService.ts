import { SearchResult } from "@/features/search/types";
import { env } from "@/lib/env";
import { BlizzardRequestError, blizzardClient } from "@/lib/blizzardClient";
import {
  AuctionHouseResponse,
  AuctionItemSummary,
  AuctionListing,
  LocalizedString,
} from "@/features/auctionHouse/types";

const DYNAMIC_NAMESPACE = `dynamic-${env.region}`;
const STATIC_NAMESPACE = `static-${env.region}`;
const DEFAULT_COMMODITY_SAMPLE_SIZE = 9;
const DEFAULT_AUCTION_SAMPLE_SIZE = 9;
const MAX_COMMODITY_SCAN = 250;
const MAX_AUCTION_SCAN = 120;

const localized = (value: LocalizedString | undefined): string => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return (
    value[env.locale] ??
    value.en_US ??
    Object.values(value).find(
      (entry) => typeof entry === "string" && entry.length > 0,
    ) ??
    ""
  );
};

const safeText = (value: string | undefined, fallback: string): string => {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : fallback;
};

export const formatCopper = (value: number | undefined): string => {
  const amount = Math.max(0, Math.trunc(value ?? 0));
  const gold = Math.floor(amount / 10000);
  const silver = Math.floor((amount % 10000) / 100);
  const copper = amount % 100;

  const parts = [] as string[];
  if (gold > 0) {
    parts.push(`${gold.toLocaleString()}g`);
  }

  if (silver > 0 || gold > 0) {
    parts.push(`${silver}s`);
  }

  parts.push(`${copper}c`);
  return parts.join(" ");
};

const fetchAuctionHouse = (path: string): Promise<AuctionHouseResponse> =>
  blizzardClient.get<AuctionHouseResponse>(path, {
    namespace: DYNAMIC_NAMESPACE,
  });

type ItemDetailResponse = {
  _links?: { self?: { href?: string } };
  id: number;
  name: LocalizedString;
  quality?: { name?: LocalizedString };
  item_class?: { name?: LocalizedString };
  item_subclass?: { name?: LocalizedString };
  inventory_type?: { name?: LocalizedString };
};

const fetchItemSummary = async (
  itemId: number,
): Promise<AuctionItemSummary | null> => {
  try {
    const response = await blizzardClient.get<ItemDetailResponse>(
      `/data/wow/item/${itemId}`,
      {
        namespace: STATIC_NAMESPACE,
      },
    );

    return {
      id: response.id,
      href: safeText(
        response._links?.self?.href,
        `https://${env.region}.api.blizzard.com/data/wow/item/${itemId}`,
      ),
      name: localized(response.name) || `Item #${itemId}`,
      quality: localized(response.quality?.name) || undefined,
      itemClass: localized(response.item_class?.name) || undefined,
      itemSubclass: localized(response.item_subclass?.name) || undefined,
      inventoryType: localized(response.inventory_type?.name) || undefined,
    };
  } catch (error) {
    if (
      error instanceof BlizzardRequestError &&
      (error.status === 404 || error.status === 204)
    ) {
      return null;
    }

    throw error;
  }
};

const fetchItemSummaryMap = async (
  itemIds: number[],
): Promise<Map<number, AuctionItemSummary>> => {
  const uniqueIds = Array.from(
    new Set(itemIds.filter((id) => typeof id === "number" && id > 0)),
  );

  if (uniqueIds.length === 0) {
    return new Map<number, AuctionItemSummary>();
  }

  const results = await Promise.all(
    uniqueIds.map((itemId) => fetchItemSummary(itemId)),
  );

  return new Map(
    results
      .filter((entry): entry is AuctionItemSummary => Boolean(entry))
      .map((entry) => [entry.id, entry]),
  );
};

const normalizeAuctionResult = (
  listing: AuctionListing,
  itemSummary: AuctionItemSummary | undefined,
  valueLabel: string,
): SearchResult => {
  const itemClass = itemSummary?.itemClass;
  const itemSubclass = itemSummary?.itemSubclass;
  const inventoryType = itemSummary?.inventoryType;

  const details = [
    `Qty ${listing.quantity.toLocaleString()}`,
    itemClass,
    itemSubclass && itemSubclass !== itemClass ? itemSubclass : undefined,
    inventoryType,
  ].filter(Boolean) as string[];

  return {
    id: listing.id,
    name: itemSummary?.name ?? `Item #${listing.item.id}`,
    href:
      itemSummary?.href ??
      `https://${env.region}.api.blizzard.com/data/wow/item/${listing.item.id}`,
    summary: valueLabel,
    details: details.join(" • "),
    tag: listing.time_left,
    typeLabel: itemSummary?.quality ?? "Auction Listing",
  };
};

export const fetchCommoditySnapshots = async (
  limit = DEFAULT_COMMODITY_SAMPLE_SIZE,
): Promise<SearchResult[]> => {
  const response = await fetchAuctionHouse("/data/wow/auctions/commodities");
  const aggregated = new Map<number, AuctionListing>();

  response.auctions.slice(0, MAX_COMMODITY_SCAN).forEach((listing) => {
    const itemId = listing.item.id;
    const current = aggregated.get(itemId);

    if (!current) {
      aggregated.set(itemId, { ...listing });
      return;
    }

    current.quantity += listing.quantity;
    current.unit_price = Math.min(
      current.unit_price ?? Number.MAX_SAFE_INTEGER,
      listing.unit_price ?? Number.MAX_SAFE_INTEGER,
    );
    current.time_left =
      current.time_left === "SHORT" || listing.time_left === "SHORT"
        ? "SHORT"
        : current.time_left;
  });

  const normalizedListings = Array.from(aggregated.values())
    .filter((listing) => typeof listing.unit_price === "number")
    .sort((left, right) => (right.unit_price ?? 0) - (left.unit_price ?? 0))
    .slice(0, limit);

  const itemSummaryMap = await fetchItemSummaryMap(
    normalizedListings.map((listing) => listing.item.id),
  );

  return normalizedListings.map((listing) =>
    normalizeAuctionResult(
      listing,
      itemSummaryMap.get(listing.item.id),
      `${formatCopper(listing.unit_price)} each`,
    ),
  );
};

export const fetchConnectedRealmAuctionSnapshots = async (
  connectedRealmId: number,
  limit = DEFAULT_AUCTION_SAMPLE_SIZE,
): Promise<SearchResult[]> => {
  const response = await fetchAuctionHouse(
    `/data/wow/connected-realm/${connectedRealmId}/auctions`,
  );
  const listings = response.auctions
    .slice(0, MAX_AUCTION_SCAN)
    .filter(
      (listing) => typeof listing.buyout === "number" && listing.buyout > 0,
    )
    .sort((left, right) => (right.buyout ?? 0) - (left.buyout ?? 0))
    .slice(0, limit);

  const itemSummaryMap = await fetchItemSummaryMap(
    listings.map((listing) => listing.item.id),
  );

  return listings.map((listing) =>
    normalizeAuctionResult(
      listing,
      itemSummaryMap.get(listing.item.id),
      formatCopper(listing.buyout),
    ),
  );
};
