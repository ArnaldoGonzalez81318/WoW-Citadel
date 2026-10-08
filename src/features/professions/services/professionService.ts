import { blizzardClient } from "@/lib/blizzardClient";
import {
  cleanMarkup,
  localized,
  namespace,
  optional404,
  sortByName,
} from "@/lib/blizzardHelpers";
import { formatNumber } from "@/lib/format";
import type {
  CraftedQuantity,
  ItemRef,
  LocalizedString,
  Profession,
  ProfessionGroupKey,
  ProfessionSummary,
  Reagent,
  Recipe,
  RecipeCategory,
  SkillTier,
  SkillTierSummary,
} from "@/features/professions/types";

/*
 * Blizzard models professions in three layers, each its own static lookup:
 *
 *   profession/{id}                       type, description, skill tiers
 *     -> profession/{id}/skill-tier/{id}  one expansion's recipe book (~8 KB,
 *                                         up to ~300 recipes by category)
 *       -> recipe/{id}                    reagents, crafted item, rank
 *
 * with every icon one more media lookup away. The index mixes the fourteen
 * real professions with twelve internal crafting lines (Soul Cyphering,
 * Hungry Tortollan…) that Blizzard also calls PRIMARY; those have no skill
 * tiers, which is what tells them apart.
 */

type Reference = { id: number; name?: LocalizedString };

type ProfessionIndexResponse = {
  professions?: Reference[];
};

type ProfessionResponse = {
  id: number;
  name?: LocalizedString;
  description?: LocalizedString;
  type?: { type?: string; name?: LocalizedString };
  skill_tiers?: Reference[];
  minimum_skill_level?: number;
  maximum_skill_level?: number;
};

type SkillTierResponse = {
  id: number;
  name?: LocalizedString;
  minimum_skill_level?: number;
  maximum_skill_level?: number;
  categories?: Array<{
    name?: LocalizedString;
    recipes?: Reference[];
  }>;
};

type RecipeResponse = {
  id: number;
  name?: LocalizedString;
  description?: LocalizedString;
  crafted_item?: Reference;
  alliance_crafted_item?: Reference;
  horde_crafted_item?: Reference;
  crafted_quantity?: { value?: number; minimum?: number; maximum?: number };
  reagents?: Array<{ reagent?: Reference; quantity?: number }>;
  modified_crafting_slots?: Array<{
    slot_type?: Reference;
    display_order?: number;
  }>;
  rank?: number;
};

type MediaResponse = {
  assets?: Array<{ key?: string; value?: string }>;
};

const iconOf = (media: MediaResponse | undefined): string | null =>
  media?.assets?.find((asset) => asset.key === "icon")?.value ??
  media?.assets?.[0]?.value ??
  null;

/* ------------------------------------------------------------------ */
/* Skill tier order and labels                                         */
/* ------------------------------------------------------------------ */

/**
 * Newest expansion first. Tier ids cannot order them on their own: the
 * Battle for Azeroth revamp created the eight older tiers in one batch,
 * newest first (Kul Tiran 2478 … Classic 2485 for Alchemy), and every tier
 * since then counts up (Shadowlands 2750 … Midnight 2906).
 */
const EXPANSION_PATTERNS: readonly RegExp[] = [
  /\bmidnight\b/iu,
  /\bkhaz algar\b/iu,
  /\bdragon isles\b/iu,
  /\bshadowlands\b/iu,
  /\b(?:kul tiran|zandalari)\b/iu,
  /\blegion\b/iu,
  /\bdraenor\b/iu,
  /\bpandaria\b/iu,
  /\bcataclysm\b/iu,
  /\bnorthrend\b/iu,
  /\boutland\b/iu,
  /\bclassic\b/iu,
];

/** The tiers Battle for Azeroth created at once, Kul Tiran to Classic. */
const LEGACY_TIER_COUNT = 8;

/**
 * Order by id alone: later tiers by descending id, then the legacy batch by
 * ascending id, which is newest first for that batch. Matches the English
 * name order for every profession on US (checked against all thirteen with
 * tiers), and puts a tier newer than this list first.
 */
const sortByTierId = <T extends { id: number }>(tiers: readonly T[]): T[] => {
  const ascending = [...tiers].sort((left, right) => left.id - right.id);
  if (ascending.length <= LEGACY_TIER_COUNT) {
    return ascending.reverse();
  }
  return [
    ...ascending.slice(LEGACY_TIER_COUNT).reverse(),
    ...ascending.slice(0, LEGACY_TIER_COUNT),
  ];
};

/**
 * Newest expansion first, by the expansion each name mentions when every
 * name mentions one, by id otherwise. Partial matches are the norm outside
 * English (es_MX keeps "Legion" and "Khaz Algar" but says "Islas Dragón"
 * and "clásica"), and ranking only some names would scatter the rest, so a
 * single unrecognised name (another locale, or an expansion newer than this
 * list) switches the whole profession to the id rule.
 */
export const sortSkillTiers = <T extends { id: number; name: string }>(
  tiers: readonly T[],
): T[] => {
  const ranked = tiers.map((tier) => ({
    tier,
    rank: EXPANSION_PATTERNS.findIndex((pattern) => pattern.test(tier.name)),
  }));
  if (ranked.some((entry) => entry.rank < 0)) {
    return sortByTierId(tiers);
  }

  return ranked
    .sort((left, right) => left.rank - right.rank || right.tier.id - left.tier.id)
    .map((entry) => entry.tier);
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/**
 * "Midnight Alchemy" -> "Midnight"; "Kul Tiran Alchemy / Zandalari Alchemy"
 * -> "Kul Tiran / Zandalari". Only a trailing profession name is removed
 * (English word order); any other shape keeps the full name.
 */
export const tierLabel = (tierName: string, professionName: string): string => {
  const profession = professionName.trim();
  if (profession.length === 0) {
    return tierName;
  }
  const trailing = new RegExp(`\\s+${escapeRegExp(profession)}$`, "iu");
  const parts = tierName.split("/").map((part) => part.trim());
  const stripped = parts.map((part) => part.replace(trailing, "").trim());
  return stripped.every((part, index) => part.length > 0 && part !== parts[index])
    ? stripped.join(" / ")
    : tierName;
};

/* ------------------------------------------------------------------ */
/* Grouping and formatting                                             */
/* ------------------------------------------------------------------ */

/**
 * Herbalism, Mining and Skinning. The API does not separate gathering from
 * crafting; these skill-line ids have been stable since 2004.
 */
const GATHERING_IDS: ReadonlySet<number> = new Set([182, 186, 393]);

export const professionGroup = (profession: Profession): ProfessionGroupKey => {
  if (profession.type === "SECONDARY") {
    return "secondary";
  }
  if (profession.skillTiers.length === 0) {
    return "other";
  }
  return GATHERING_IDS.has(profession.id) ? "gathering" : "crafting";
};

/** "Skill 1–100", or undefined when Blizzard gives no range. */
export const formatSkillRange = (
  minimum: number | undefined,
  maximum: number | undefined,
): string | undefined =>
  typeof minimum === "number" && typeof maximum === "number" && maximum > 0
    ? `Skill ${formatNumber(minimum)}–${formatNumber(maximum)}`
    : undefined;

/** "×1", "×2–4". */
export const formatQuantity = (quantity: CraftedQuantity): string =>
  quantity.min === quantity.max
    ? `×${formatNumber(quantity.min)}`
    : `×${formatNumber(quantity.min)}–${formatNumber(quantity.max)}`;

export const pluralize = (count: number, one: string, many: string): string =>
  `${formatNumber(count)} ${count === 1 ? one : many}`;

/* ------------------------------------------------------------------ */
/* Professions                                                         */
/* ------------------------------------------------------------------ */

/** Every profession in the index, by name. */
export const fetchProfessionIndex = async (
  signal?: AbortSignal,
): Promise<ProfessionSummary[]> => {
  const response = await blizzardClient.get<ProfessionIndexResponse>(
    "/data/wow/profession/index",
    { namespace: namespace("static") },
    { signal },
  );

  return sortByName(
    (response?.professions ?? [])
      .filter((entry) => typeof entry.id === "number")
      .map((entry) => ({
        id: entry.id,
        name: localized(entry.name) || `Profession #${entry.id}`,
      })),
  );
};

/** One profession, its tiers newest first; null when Blizzard has no such id. */
export const fetchProfession = async (
  professionId: number,
  signal?: AbortSignal,
): Promise<Profession | null> => {
  const response = await optional404(() =>
    blizzardClient.get<ProfessionResponse>(
      `/data/wow/profession/${professionId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  if (!response) {
    return null;
  }

  const name = localized(response.name) || `Profession #${professionId}`;
  const tiers = (response.skill_tiers ?? [])
    .filter((tier) => typeof tier.id === "number")
    .map((tier): SkillTierSummary => {
      const tierName = localized(tier.name) || `Skill tier #${tier.id}`;
      return { id: tier.id, name: tierName, label: tierLabel(tierName, name) };
    });

  return {
    id: response.id ?? professionId,
    name,
    description: cleanMarkup(localized(response.description)) || undefined,
    type: response.type?.type ?? "",
    typeName: localized(response.type?.name) || undefined,
    skillTiers: sortSkillTiers(tiers),
    minimumSkill: response.minimum_skill_level,
    maximumSkill: response.maximum_skill_level,
  };
};

/** A profession's 56px icon, or null when Blizzard has none. */
export const fetchProfessionIcon = async (
  professionId: number,
  signal?: AbortSignal,
): Promise<string | null> => {
  const media = await optional404(() =>
    blizzardClient.get<MediaResponse>(
      `/data/wow/media/profession/${professionId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  return iconOf(media);
};

/* ------------------------------------------------------------------ */
/* Skill tiers                                                         */
/* ------------------------------------------------------------------ */

/**
 * One expansion's recipe book. Categories keep Blizzard's order; empty ones
 * (gathering tiers before Dragonflight list none at all) are dropped.
 */
export const fetchSkillTier = async (
  professionId: number,
  tierId: number,
  signal?: AbortSignal,
): Promise<SkillTier | null> => {
  const response = await optional404(() =>
    blizzardClient.get<SkillTierResponse>(
      `/data/wow/profession/${professionId}/skill-tier/${tierId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  if (!response) {
    return null;
  }

  const categories = (response.categories ?? [])
    .map((category, index): RecipeCategory => ({
      name: localized(category.name) || `Category ${index + 1}`,
      recipes: (category.recipes ?? [])
        .filter((recipe) => typeof recipe.id === "number")
        .map((recipe) => ({
          id: recipe.id,
          name: localized(recipe.name) || `Recipe #${recipe.id}`,
        })),
    }))
    .filter((category) => category.recipes.length > 0);

  return {
    id: response.id ?? tierId,
    professionId,
    name: localized(response.name) || `Skill tier #${tierId}`,
    minimumSkill: response.minimum_skill_level,
    maximumSkill: response.maximum_skill_level,
    categories,
    recipeCount: categories.reduce(
      (total, category) => total + category.recipes.length,
      0,
    ),
  };
};

/* ------------------------------------------------------------------ */
/* Recipes                                                             */
/* ------------------------------------------------------------------ */

const toItem = (reference: Reference | undefined): ItemRef | undefined =>
  typeof reference?.id === "number"
    ? { id: reference.id, name: localized(reference.name) || `Item #${reference.id}` }
    : undefined;

const toQuantity = (
  raw: RecipeResponse["crafted_quantity"],
): CraftedQuantity | undefined => {
  const min = raw?.minimum ?? raw?.value;
  const max = raw?.maximum ?? raw?.value ?? min;
  if (typeof min !== "number" || typeof max !== "number" || max <= 0) {
    return undefined;
  }
  return { min, max: Math.max(min, max) };
};

/** Recipe text separates paragraphs with blank lines (`\r\n\r\n` or `|n|n`). */
const toParagraphs = (raw: string): string[] =>
  raw
    .split(/(?:[ \t]*(?:\r?\n|\|n)){2,}/u)
    .map((paragraph) => cleanMarkup(paragraph))
    .filter((paragraph) => paragraph.length > 0);

/** One recipe in full; null when Blizzard has no such id. */
export const fetchRecipe = async (
  recipeId: number,
  signal?: AbortSignal,
): Promise<Recipe | null> => {
  const response = await optional404(() =>
    blizzardClient.get<RecipeResponse>(
      `/data/wow/recipe/${recipeId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  if (!response) {
    return null;
  }

  return {
    id: response.id ?? recipeId,
    name: localized(response.name) || `Recipe #${recipeId}`,
    description: toParagraphs(localized(response.description)),
    craftedItem: toItem(response.crafted_item),
    allianceCraftedItem: toItem(response.alliance_crafted_item),
    hordeCraftedItem: toItem(response.horde_crafted_item),
    craftedQuantity: toQuantity(response.crafted_quantity),
    reagents: (response.reagents ?? [])
      .map((entry): Reagent | undefined => {
        const item = toItem(entry.reagent);
        return item && typeof entry.quantity === "number"
          ? { item, quantity: entry.quantity }
          : undefined;
      })
      .filter((entry): entry is Reagent => entry !== undefined),
    reagentSlots: [...(response.modified_crafting_slots ?? [])]
      .sort(
        (left, right) => (left.display_order ?? 0) - (right.display_order ?? 0),
      )
      .map((slot) => localized(slot.slot_type?.name))
      .filter((name) => name.length > 0),
    rank: typeof response.rank === "number" ? response.rank : undefined,
  };
};

/**
 * A recipe's icon, or null. Recipes since Dragonflight mostly answer with
 * their profession's icon; that is Blizzard's data, shown as is.
 */
export const fetchRecipeIcon = async (
  recipeId: number,
  signal?: AbortSignal,
): Promise<string | null> => {
  const media = await optional404(() =>
    blizzardClient.get<MediaResponse>(
      `/data/wow/media/recipe/${recipeId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  return iconOf(media);
};

/** An item's icon (crafted items and reagents in the recipe dialog), or null. */
export const fetchItemIcon = async (
  itemId: number,
  signal?: AbortSignal,
): Promise<string | null> => {
  const media = await optional404(() =>
    blizzardClient.get<MediaResponse>(
      `/data/wow/media/item/${itemId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  return iconOf(media);
};
