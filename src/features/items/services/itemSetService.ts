import { blizzardClient } from "@/lib/blizzardClient";
import { cleanMarkup, localized, namespace, optional404 } from "@/lib/blizzardHelpers";
import type { LocalizedString } from "@/lib/blizzardHelpers";
import type { ItemSet, ItemSetSummary, NamedRef } from "@/features/items/types";

/*
 *   item-set/index   every set's name and id (960 on US, ~140 KB)
 *   item-set/{id}    its pieces (names and ids) and its bonuses
 *
 * The index has no dates; set ids grow patch by patch, so the highest id
 * first is (roughly) the newest first.
 */

type Reference = {
  id?: number;
  name?: LocalizedString;
};

type SetIndexResponse = {
  item_sets?: Reference[];
};

type SetResponse = {
  id: number;
  name?: LocalizedString;
  items?: Reference[];
  effects?: Array<{ display_string?: LocalizedString; required_count?: number }>;
};

const toRef = (reference: Reference | undefined, fallback: string): NamedRef | undefined =>
  reference && typeof reference.id === "number"
    ? { id: reference.id, name: localized(reference.name) || `${fallback} #${reference.id}` }
    : undefined;

/** Every item set, highest id (newest) first. */
export const fetchItemSetIndex = async (signal?: AbortSignal): Promise<ItemSetSummary[]> => {
  const response = await blizzardClient.get<SetIndexResponse>(
    "/data/wow/item-set/index",
    { namespace: namespace("static") },
    { signal },
  );
  return (response.item_sets ?? [])
    .map((entry) => toRef(entry, "Item set"))
    .filter((entry): entry is ItemSetSummary => entry !== undefined)
    .sort((left, right) => right.id - left.id);
};

/** A set's pieces and bonuses (fewest pieces first), or null when Blizzard has none (404). */
export const fetchItemSet = async (setId: number, signal?: AbortSignal): Promise<ItemSet | null> => {
  const raw = await optional404(() =>
    blizzardClient.get<SetResponse>(
      `/data/wow/item-set/${setId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  if (!raw) {
    return null;
  }
  return {
    id: raw.id,
    name: localized(raw.name) || `Item set #${raw.id}`,
    pieces: (raw.items ?? [])
      .map((entry) => toRef(entry, "Item"))
      .filter((entry): entry is NamedRef => entry !== undefined),
    bonuses: (raw.effects ?? [])
      .map((effect) => ({
        requiredCount: effect.required_count ?? 0,
        text: cleanMarkup(localized(effect.display_string)),
      }))
      .filter((bonus) => bonus.text.length > 0)
      .sort((left, right) => left.requiredCount - right.requiredCount),
  };
};
