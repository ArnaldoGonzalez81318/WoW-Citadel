export type { LocalizedString } from "@/lib/blizzardHelpers";

/** One entry of Blizzard's profession index (26 on US, internal lines included). */
export type ProfessionSummary = {
  id: number;
  name: string;
};

/**
 * One expansion's slice of a profession ("Midnight Alchemy"). Blizzard lists
 * them in no useful order; `sortSkillTiers` puts the newest first.
 */
export type SkillTierSummary = {
  id: number;
  /** "Kul Tiran Alchemy / Zandalari Alchemy" */
  name: string;
  /** The name without the profession's: "Kul Tiran / Zandalari". */
  label: string;
};

/**
 * How the gallery files a profession. Blizzard only says PRIMARY or
 * SECONDARY, and calls the twelve internal crafting lines (Soul Cyphering,
 * Tuskarr Fishing Gear…) PRIMARY too; they are the ones without skill tiers.
 */
export type ProfessionGroupKey = "crafting" | "gathering" | "secondary" | "other";

export type Profession = {
  id: number;
  name: string;
  description?: string;
  /** Blizzard's type: "PRIMARY" or "SECONDARY". */
  type: string;
  /** Its localized name ("Primary"). */
  typeName?: string;
  /** Newest expansion first; empty for Archaeology and the internal lines. */
  skillTiers: SkillTierSummary[];
  /** Archaeology reports one skill range instead of tiers. */
  minimumSkill?: number;
  maximumSkill?: number;
};

export type RecipeRef = {
  id: number;
  name: string;
};

export type RecipeCategory = {
  name: string;
  recipes: RecipeRef[];
};

/** One expansion's recipes for one profession, by in-game category. */
export type SkillTier = {
  id: number;
  professionId: number;
  name: string;
  minimumSkill?: number;
  maximumSkill?: number;
  /** In Blizzard's order (the in-game book's). */
  categories: RecipeCategory[];
  recipeCount: number;
};

export type ItemRef = {
  id: number;
  name: string;
};

export type Reagent = {
  item: ItemRef;
  quantity: number;
};

export type CraftedQuantity = {
  min: number;
  max: number;
};

/**
 * A recipe in full. Recipes from Dragonflight on usually name no crafted
 * item and list their quality reagents as `reagentSlots` (no quantities).
 */
export type Recipe = {
  id: number;
  name: string;
  /** Paragraphs, markup removed. */
  description: string[];
  craftedItem?: ItemRef;
  /** Battle for Azeroth faction recipes craft a different item per faction. */
  allianceCraftedItem?: ItemRef;
  hordeCraftedItem?: ItemRef;
  craftedQuantity?: CraftedQuantity;
  reagents: Reagent[];
  /** "Sunglass Vial", "Peacebloom"… in the crafting window's order. */
  reagentSlots: string[];
  /** Legion / Battle for Azeroth recipe rank (1–3). */
  rank?: number;
};
