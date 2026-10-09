import type { LocalizedString } from "@/lib/blizzardHelpers";

export type { LocalizedString };

/** A toy as the index lists it: toy id (not its item id) and name. */
export type ToyRef = {
  id: number;
  name: string;
};

/** Blizzard's source code ("VENDOR") with its localized name ("Vendor"). */
export type ToySource = {
  type: string;
  name: string;
};

/** One "Vendor: Pogg" line of a toy's source text; `label` is absent on bare lines ("Promotion"). */
export type SourceLine = {
  label?: string;
  value: string;
};

/**
 * One toy record: the item it teaches, where it comes from and Blizzard's
 * own wording of that ("Vendor: Pogg / Zone: Tol Barad Peninsula"), split
 * into blocks (a toy sold by two vendors has two).
 */
export type ToyRecord = {
  id: number;
  /** The item's name, as the record carries it. */
  name: string;
  itemId: number;
  source?: ToySource;
  sourceBlocks: SourceLine[][];
  /** Blizzard keeps it out of collection lists unless a character has it. */
  excludeIfUncollected: boolean;
};

/**
 * The item's "Use:" text, split the way the game draws it: the line that
 * files the toy away ("Use: Adds this toy to your Toy Box."), then what the
 * toy does, with an English "(1 Hr Cooldown)" lifted out of it.
 */
export type ToyUseText = {
  learn?: string;
  effect: string[];
  cooldown?: string;
};

/** The parts of a toy's item record the page shows. */
export type ToyItem = {
  id: number;
  name: string;
  /** Item quality code ("RARE") and its localized name. */
  quality?: ToySource;
  binding?: string;
  /** "Unique": a character can carry one. */
  unique?: string;
  uses: ToyUseText[];
  /** The gold flavour line under the tooltip. */
  description?: string;
  requirements: string[];
  /** Copper a vendor pays for it, when it can be sold. */
  sellPrice?: number;
};

/** "match" only applies while a name is searched. */
export type ToySort = "newest" | "name" | "match";

export type ToySourceOption = {
  type: string;
  /** Blizzard's localized name once a record has carried it, else the English one. */
  name: string;
  /** Toys with this source; only known once every toy has been checked. */
  count?: number;
};
