import { fetchItemMediaUrl, itemKeys } from "@/features/items/services/itemService";
import {
  fetchCategoryIndex,
  fetchCategoryItems,
  fetchSlotType,
  fetchSlotTypeIndex,
} from "@/features/modifiedCrafting/services/modifiedCraftingService";
import { createPriorityLimiter } from "@/features/modifiedCrafting/services/priorityLimiter";
import type { Priority } from "@/features/modifiedCrafting/services/priorityLimiter";
import { env } from "@/lib/env";

/** Slot types and categories change with patches, not days. */
export const MODIFIED_CRAFTING_STALE_MS = 24 * 60 * 60_000;

/** The language the theme rules read (see slotThemes). */
export const THEME_LOCALE = "en_US";

/** Reagents a card asks for: enough for its icon and an exact count for most categories. */
export const CARD_ITEM_PAGE_SIZE = 6;
/** Reagents the dialog lists; a category with more says so. */
export const DIALOG_ITEM_PAGE_SIZE = 50;

/*
 * Six requests at a time for the whole page, what is on screen first (see
 * priorityLimiter): the slot-link map's 389 records never hold up a card's
 * reagent search or icon, and never add to the total.
 */
const MAX_IN_FLIGHT = 6;
const limit = createPriorityLimiter(MAX_IN_FLIGHT);

export const modifiedCraftingKeys = {
  slotIndex: (locale: string) =>
    ["modified-crafting", "slot-type-index", env.region, locale] as const,
  categoryIndex: () =>
    ["modified-crafting", "category-index", env.region, env.locale] as const,
  slotType: (slotTypeId: number) =>
    ["modified-crafting", "slot-type", slotTypeId, env.region, env.locale] as const,
  categoryItems: (categoryId: number, pageSize: number) =>
    [
      "modified-crafting",
      "category-items",
      categoryId,
      pageSize,
      env.region,
      env.locale,
    ] as const,
};

/** The slot type index in `locale` (the app's for display, English for the themes). */
export const slotTypeIndexQuery = (locale: string = env.locale) => ({
  queryKey: modifiedCraftingKeys.slotIndex(locale),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchSlotTypeIndex(locale, signal),
  staleTime: MODIFIED_CRAFTING_STALE_MS,
});

export const categoryIndexQuery = () => ({
  queryKey: modifiedCraftingKeys.categoryIndex(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchCategoryIndex(signal),
  staleTime: MODIFIED_CRAFTING_STALE_MS,
});

const slotTypeTaskKey = (slotTypeId: number): string => `slot-${slotTypeId}`;

/**
 * One slot type record. Shared by the cards, the dialog and the slot-link
 * map, so each costs one request however many places show it, and kept for
 * a day once read (the map needs all 389; leaving the view must not lose
 * them). The map asks at low priority; whoever starts a fetch sets its turn,
 * so a card or dialog that finds its record already queued by the map moves
 * it up with `promoteSlotType`.
 */
export const slotTypeQuery = (slotTypeId: number, priority: Priority = "high") => ({
  queryKey: modifiedCraftingKeys.slotType(slotTypeId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limit(
      () => fetchSlotType(slotTypeId, signal),
      signal,
      priority,
      slotTypeTaskKey(slotTypeId),
    ),
  staleTime: MODIFIED_CRAFTING_STALE_MS,
  gcTime: MODIFIED_CRAFTING_STALE_MS,
});

/** Puts a slot type record the map queued at low priority ahead of the rest. */
export const promoteSlotType = (slotTypeId: number): void =>
  limit.promote(slotTypeTaskKey(slotTypeId));

/** A category's reagents from the item search, newest first. */
export const categoryItemsQuery = (categoryId: number, pageSize: number) => ({
  queryKey: modifiedCraftingKeys.categoryItems(categoryId, pageSize),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limit(() => fetchCategoryItems(categoryId, pageSize, signal), signal, "high"),
  staleTime: MODIFIED_CRAFTING_STALE_MS,
});

/** The Items explorer's own cache entry: an icon seen there costs nothing here. */
export const reagentIconQuery = (itemId: number) => ({
  queryKey: itemKeys.media(itemId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    limit(() => fetchItemMediaUrl(itemId, signal), signal, "high"),
  staleTime: Infinity,
  gcTime: MODIFIED_CRAFTING_STALE_MS,
});
