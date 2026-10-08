import type { GridColumns } from "@/components/common/gridColumns";
import type { ExternalLinkKind } from "@/lib/externalLinks";
import type {
  MediaLayout,
  MediaScope,
  MediaTagId,
} from "@/features/mediaSearch/types";

/* ------------------------------------------------------------------ */
/* Tags (the kind picker)                                              */
/* ------------------------------------------------------------------ */

export type MediaTagConfig = {
  id: MediaScope;
  /** Plural, for the picker and the grid heading. */
  label: string;
  /** The label mid-sentence ("PvP tiers", "media"). */
  noun: string;
  /** One line under the grid heading. */
  about: string;
  layout: MediaLayout;
  /**
   * The search index's `id` is the id in each record's path, so Blizzard can
   * sort the tag and range-filter it by the ids on its cards. Journal
   * instances, covenants and tech talents carry no index id, an Azerite
   * essence carries its first major power's spell id and a talent tree's
   * specialization art its tree's id: those small tags (504 records at
   * most) are loaded whole, sorted and looked up here instead.
   */
  sortable: boolean;
  /** `/data/wow/media/{tag}/…` 404s for every record: only the search serves them. */
  searchOnly?: boolean;
};

/**
 * Every tag Blizzard's media search answers to, largest first (counts on
 * US, autumn 2026: six tags pass the 1,000-result cap). "Everything" is the
 * untagged search, the only way to reach guild crest emblems and borders.
 */
export const MEDIA_TAGS: readonly MediaTagConfig[] = [
  {
    id: "all",
    label: "Everything",
    noun: "media",
    about: "Every media record of every kind, guild crest emblems and borders included (Blizzard tags those with nothing, so no other filter reaches them). Journal instances, covenants and tech talents carry no id in the index, so they only appear under their own kinds or in a lookup; Azerite essences and talent tree specialization art sort by a spell's or a tree's id instead of their own.",
    layout: "icon",
    sortable: true,
  },
  {
    id: "item",
    label: "Items",
    noun: "items",
    about: "Inventory icons, keyed by item id.",
    layout: "icon",
    sortable: true,
  },
  {
    id: "spell",
    label: "Spells",
    noun: "spells",
    about: "Spell and ability icons, keyed by spell id.",
    layout: "icon",
    sortable: true,
  },
  {
    id: "achievement",
    label: "Achievements",
    noun: "achievements",
    about: "Achievement icons, keyed by achievement id.",
    layout: "icon",
    sortable: true,
  },
  {
    id: "creature-display",
    label: "Creature renders",
    noun: "creature renders",
    about: "600 × 600 portrait renders of creature models, keyed by display id (one creature can have several displays, and a display id is not an NPC id).",
    layout: "render",
    sortable: true,
  },
  {
    id: "pet",
    label: "Battle pets",
    noun: "battle pets",
    about: "Battle pet icons, keyed by pet species id.",
    layout: "icon",
    sortable: true,
  },
  {
    id: "recipe",
    label: "Recipes",
    noun: "recipes",
    about: "Profession recipe icons, keyed by recipe id.",
    layout: "icon",
    sortable: true,
  },
  {
    id: "pet-ability",
    label: "Pet abilities",
    noun: "pet abilities",
    about: "Pet battle ability icons.",
    layout: "icon",
    sortable: true,
  },
  {
    id: "glyph",
    label: "Glyphs",
    noun: "glyphs",
    about: "Glyph icons. Most glyphs retired over the years and Blizzard lists them without an image.",
    layout: "icon",
    sortable: true,
    searchOnly: true,
  },
  {
    id: "tech-talent",
    label: "Tech talents",
    noun: "tech talents",
    about: "Icons for tech talents: the covenant, mission table and renown talent trees.",
    layout: "icon",
    sortable: false,
  },
  {
    id: "journal-instance",
    label: "Journal instances",
    noun: "journal instances",
    about: "600 × 300 zone tiles for every dungeon and raid in the Encounter Journal; each also comes in 2400 × 1200.",
    layout: "tile",
    sortable: false,
  },
  {
    id: "profession",
    label: "Professions",
    noun: "professions",
    about: "Profession and skill tier icons.",
    layout: "icon",
    sortable: true,
  },
  {
    id: "creature-family",
    label: "Creature families",
    noun: "creature families",
    about: "Creature family icons, the hunter pet families among them.",
    layout: "icon",
    sortable: true,
  },
  {
    id: "keystone-affix",
    label: "Keystone affixes",
    noun: "keystone affixes",
    about: "Mythic+ affix icons.",
    layout: "icon",
    sortable: true,
  },
  {
    id: "pvp-tier",
    label: "PvP tiers",
    noun: "PvP tiers",
    about: "Rated PvP tier badges.",
    layout: "icon",
    sortable: true,
  },
  {
    id: "playable-specialization",
    label: "Specializations",
    noun: "specializations",
    about: "Class specialization icons.",
    layout: "icon",
    sortable: true,
  },
  {
    id: "talent-tree",
    label: "Talent trees",
    noun: "talent trees",
    about: "Hero talent tree art and the specialization icons used by talent trees.",
    layout: "icon",
    sortable: false,
    searchOnly: true,
  },
  {
    id: "azerite-essence",
    label: "Azerite essences",
    noun: "Azerite essences",
    about: "Heart of Azeroth essence icons.",
    layout: "icon",
    sortable: false,
  },
  {
    id: "playable-class",
    label: "Classes",
    noun: "classes",
    about: "Class icons.",
    layout: "icon",
    sortable: true,
  },
  {
    id: "covenant",
    label: "Covenants",
    noun: "covenants",
    about: "Shadowlands covenant sigils.",
    layout: "icon",
    sortable: false,
  },
];

export const DEFAULT_SCOPE: MediaScope = "item";

const TAGS_BY_ID = new Map(MEDIA_TAGS.map((tag) => [tag.id, tag]));

export const isMediaScope = (value: string): value is MediaScope =>
  TAGS_BY_ID.has(value as MediaScope);

export const isMediaTag = (value: string): value is MediaTagId =>
  value !== "all" && isMediaScope(value);

export const tagConfig = (scope: MediaScope): MediaTagConfig =>
  TAGS_BY_ID.get(scope) ?? MEDIA_TAGS[0];

/** The real tags (the ones a summary query can count). */
export const MEDIA_TAG_IDS: readonly MediaTagId[] = MEDIA_TAGS.map(
  (tag) => tag.id,
).filter((id): id is MediaTagId => id !== "all");

/* ------------------------------------------------------------------ */
/* Grid layouts                                                        */
/* ------------------------------------------------------------------ */

export type LayoutConfig = {
  columns: GridColumns;
  /** The image stage: a fixed height (icons) or the art's aspect ratio. */
  stage: { height: number } | { aspect: "1 / 1" | "2 / 1"; ratioPercent: number };
};

/*
 * 96 per page fills whole rows at every breakpoint of every layout (3, 4,
 * 6 and 8 columns; 2, 3, 4 and 6; 1 to 4), and one Blizzard page is one
 * request however many images it holds; the images themselves load lazily
 * from the render CDN.
 */
export const LAYOUTS: Record<MediaLayout, LayoutConfig> = {
  icon: {
    columns: { xs: 3, sm: 4, md: 6, lg: 8 },
    stage: { height: 88 },
  },
  render: {
    columns: { xs: 2, sm: 3, md: 4, lg: 6 },
    stage: { aspect: "1 / 1", ratioPercent: 100 },
  },
  tile: {
    columns: { xs: 1, sm: 2, md: 3, lg: 4 },
    stage: { aspect: "2 / 1", ratioPercent: 50 },
  },
};

/* ------------------------------------------------------------------ */
/* Kinds (what a record belongs to, and where to read more)             */
/* ------------------------------------------------------------------ */

export type WorkbenchTarget = {
  /** API catalog family slug (`/api-explorer/{family}`). */
  family: string;
  /** The family's media endpoint id. */
  endpoint: string;
  /** The endpoint's path parameter key. */
  param: string;
};

export type MediaKindConfig = {
  /** Singular label: "Item", "Guild crest emblem". */
  label: string;
  /** The record this media belongs to, for its name (`/data/wow/{path}/{id}`, static). */
  ownerPath?: string;
  /** What "Belongs to" says when `ownerPath` has no record at this id, if a 404 there is expected. */
  missingOwnerNote?: string;
  /** Wowhead addresses these kinds by the same id. */
  wowhead?: ExternalLinkKind;
  /** The media endpoint in the API workbench, pre-filled with the id. */
  workbench?: WorkbenchTarget;
  /** The nav slug of the matching explorer page. */
  explorerSlug?: string;
  /** A query key that explorer reads to open this record (`?profession=164`). */
  explorerParam?: string;
  /** Labels for the numeric segments before the id ("Talent tree"). */
  parentLabels?: string[];
};

const workbench = (
  family: string,
  endpoint: string,
  param: string,
): WorkbenchTarget => ({ family, endpoint, param });

/**
 * Keyed by `MediaRecord.kind`. The owner paths, workbench endpoints and
 * Wowhead kinds were each checked against a live record; kinds without an
 * entry in the API catalog (glyphs, talent tree art) only get a label.
 */
export const MEDIA_KINDS: Readonly<Record<string, MediaKindConfig>> = {
  item: {
    label: "Item",
    ownerPath: "item",
    wowhead: "item",
    workbench: workbench("items", "item-media", "itemId"),
    explorerSlug: "items",
  },
  spell: {
    label: "Spell",
    ownerPath: "spell",
    wowhead: "spell",
    workbench: workbench("spells", "spell-media", "spellId"),
    explorerSlug: "spells",
  },
  achievement: {
    label: "Achievement",
    ownerPath: "achievement",
    wowhead: "achievement",
    workbench: workbench("achievement", "achievement-media", "achievementId"),
    explorerSlug: "achievement",
  },
  "creature-display": {
    label: "Creature display",
    workbench: workbench("creatures", "creature-display-media", "creatureDisplayId"),
    explorerSlug: "creatures",
  },
  "creature-family": {
    label: "Creature family",
    ownerPath: "creature-family",
    workbench: workbench("creatures", "creature-family-media", "creatureFamilyId"),
    explorerSlug: "creatures",
  },
  pet: {
    label: "Battle pet",
    ownerPath: "pet",
    workbench: workbench("pet", "pet-media", "petId"),
    explorerSlug: "pet",
  },
  "pet-ability": {
    label: "Pet ability",
    ownerPath: "pet-ability",
    workbench: workbench("pet", "pet-ability-media", "petAbilityId"),
    explorerSlug: "pet",
  },
  recipe: {
    label: "Recipe",
    ownerPath: "recipe",
    workbench: workbench("profession", "recipe-media", "recipeId"),
    explorerSlug: "profession",
  },
  // Only 26 of the tag's 183 ids are professions (164 Blacksmithing); the
  // rest are skill tiers (2500 Legion Engineering), which Blizzard files
  // under their profession (`/profession/202/skill-tier/2500`), and the media
  // record does not say which one.
  profession: {
    label: "Profession",
    ownerPath: "profession",
    missingOwnerNote:
      "No profession has this id: most profession media belong to skill tiers (one expansion's recipes, such as Legion Engineering), and the media index does not say whose",
    workbench: workbench("profession", "profession-media", "professionId"),
    explorerSlug: "profession",
    explorerParam: "profession",
  },
  glyph: {
    label: "Glyph",
  },
  "tech-talent": {
    label: "Tech talent",
    ownerPath: "tech-talent",
    workbench: workbench("tech-talent", "tech-talent-media", "techTalentId"),
    explorerSlug: "tech-talent",
  },
  "journal-instance": {
    label: "Journal instance",
    ownerPath: "journal-instance",
    workbench: workbench("journal", "journal-instance-media", "journalInstanceId"),
    explorerSlug: "journal",
  },
  "keystone-affix": {
    label: "Keystone affix",
    ownerPath: "keystone-affix",
    workbench: workbench("mythic-keystone-affix", "keystone-affix-media", "keystoneAffixId"),
    explorerSlug: "mythic-keystone-affix",
  },
  "pvp-tier": {
    label: "PvP tier",
    ownerPath: "pvp-tier",
    workbench: workbench("pvp-tier", "pvp-tier-media", "pvpTierId"),
    explorerSlug: "pvp-tier",
  },
  "playable-specialization": {
    label: "Specialization",
    ownerPath: "playable-specialization",
    workbench: workbench("playable-specialization", "playable-specialization-media", "specId"),
    explorerSlug: "playable-specialization",
  },
  "playable-class": {
    label: "Class",
    ownerPath: "playable-class",
    workbench: workbench("playable-class", "playable-class-media", "playableClassId"),
    explorerSlug: "playable-class",
  },
  "azerite-essence": {
    label: "Azerite essence",
    ownerPath: "azerite-essence",
    workbench: workbench("azerite-essence", "azerite-essence-media", "azeriteEssenceId"),
    explorerSlug: "azerite-essence",
  },
  covenant: {
    label: "Covenant",
    ownerPath: "covenant",
    workbench: workbench("covenant", "covenant-media", "covenantId"),
    explorerSlug: "covenant",
  },
  "talent-tree/hero-talent": {
    label: "Hero talent tree",
    explorerSlug: "talent",
    parentLabels: ["Talent tree"],
  },
  // The specialization's own record names it ("Windwalker").
  "talent-tree/playable-specialization": {
    label: "Talent tree specialization",
    ownerPath: "playable-specialization",
    explorerSlug: "talent",
    parentLabels: ["Talent tree"],
  },
  "guild-crest/emblem": {
    label: "Guild crest emblem",
    workbench: workbench("guild-crest", "guild-crest-emblem-media", "emblemId"),
    explorerSlug: "guild-crest",
  },
  "guild-crest/border": {
    label: "Guild crest border",
    workbench: workbench("guild-crest", "guild-crest-border-media", "borderId"),
    explorerSlug: "guild-crest",
  },
};

/** "creature-display" -> "Creature display" for a kind this table does not know yet. */
const fallbackKindLabel = (kind: string): string => {
  const words = kind.replace(/[/-]+/g, " ").trim();
  return words.length > 0
    ? `${words.charAt(0).toUpperCase()}${words.slice(1)}`
    : "Media";
};

/**
 * A label mid-sentence: "Item" -> "item", but "PvP tier" keeps its capitals
 * (only a plain capitalised first word is lowered).
 */
export const lowerFirst = (label: string): string =>
  /^[A-Z][a-z]*(?:\s|$)/u.test(label)
    ? `${label.charAt(0).toLowerCase()}${label.slice(1)}`
    : label;

export const kindConfig = (kind: string): MediaKindConfig =>
  MEDIA_KINDS[kind] ?? { label: fallbackKindLabel(kind) };

/** `/api-explorer/items?endpoint=item-media&itemId=19019`. */
export const workbenchUrl = (target: WorkbenchTarget, id: number): string =>
  `/api-explorer/${target.family}?${new URLSearchParams({
    endpoint: target.endpoint,
    [target.param]: String(id),
  }).toString()}`;

/* ------------------------------------------------------------------ */
/* Asset keys                                                          */
/* ------------------------------------------------------------------ */

/** What each asset key Blizzard uses actually is. */
const ASSET_KEY_LABELS: Readonly<Record<string, string>> = {
  icon: "Icon",
  zoom: "Model render",
  tile: "Zone tile",
  image: "Crest image",
  atlas: "Atlas icon",
};

/** "zoom" -> "Model render"; an unknown key reads as itself ("splash" -> "Splash"). */
export const assetKeyLabel = (key: string): string =>
  ASSET_KEY_LABELS[key] ?? fallbackKindLabel(key);
