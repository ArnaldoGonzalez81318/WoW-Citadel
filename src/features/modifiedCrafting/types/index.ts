/** A reagent slot type as the index lists it; a few have no name at all. */
export type SlotTypeRef = {
  id: number;
  /** Null when Blizzard gives the slot type no name. */
  name: string | null;
};

/** A reagent category as the index (or a slot type's record) names it. */
export type CategoryRef = {
  id: number;
  /** Null when Blizzard gives the category no name. */
  name: string | null;
};

/** One reagent slot type's record: the categories of reagent it accepts. */
export type SlotType = {
  id: number;
  name: string | null;
  /** In API order (Blizzard's own, not sorted). */
  categories: CategoryRef[];
};

/**
 * Every category id that carries one name (twelve are called "Increase Item
 * Level"), collapsed into one entry. Unnamed categories stay one per id.
 */
export type CategoryGroup = {
  /** Stable across renders: the normalized name, or `#id` when unnamed. */
  key: string;
  name: string | null;
  /** Newest (highest) id first. */
  ids: number[];
  newestId: number;
};

/** A reagent item that belongs to a category, from Blizzard's item search. */
export type ReagentItem = {
  id: number;
  name: string;
  /** Lowercase quality key ("rare"), for `qualityColor`; null when unknown. */
  quality: string | null;
  /** The modifier's effect in words, placeholders resolved; null when unusable. */
  effect: string | null;
  /** `effect` has an "X" standing in for a value the game fills in. */
  effectHasValue: boolean;
};

/** One page of a category's reagent items, newest first. */
export type CategoryItems = {
  items: ReagentItem[];
  /** More items exist than this page holds. */
  more: boolean;
};

/** The two things a dialog can show. */
export type ModifierTarget =
  | { kind: "slot"; id: number }
  | { kind: "category"; id: number };
