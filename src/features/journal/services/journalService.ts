import { blizzardClient } from "@/lib/blizzardClient";
import {
  cleanMarkup,
  localized,
  namespace,
  optional404,
} from "@/lib/blizzardHelpers";
import { formatNumber, humanizeEnum } from "@/lib/format";
import type {
  JournalBodyBlock,
  JournalCreature,
  JournalEncounter,
  JournalInstance,
  JournalLootItem,
  JournalMode,
  JournalRef,
  JournalSection,
  JournalTier,
  JournalTierSummary,
  LocalizedString,
} from "@/features/journal/types";

/*
 * The Encounter Journal is four static layers, one request each:
 *
 *   journal-expansion/index      13 tiers (12 expansions + "Current Season")
 *   journal-expansion/{id}       that tier's dungeons and raids, by name
 *   journal-instance/{id}        description, location, modes, bosses
 *     + media/journal-instance   600×300 zone tile
 *   journal-encounter/{id}       creatures, loot and the ability tree
 *
 * Every layer is fetched only when the page shows it. Name search reads the
 * encounter and instance indexes (1,159 and 213 names, one request each)
 * and matches prefixes locally: Blizzard's own journal-encounter search
 * only matches whole words and returns every locale of every ability
 * section, about 23 KB per hit.
 */

type Reference = { id?: number; name?: LocalizedString };

type TierIndexResponse = { tiers?: Reference[] };

type TierResponse = {
  id: number;
  name?: LocalizedString;
  dungeons?: Reference[];
  raids?: Reference[];
};

type InstanceResponse = {
  id: number;
  name?: LocalizedString;
  description?: LocalizedString;
  encounters?: Reference[];
  expansion?: Reference;
  location?: Reference;
  modes?: Array<{
    mode?: { type?: string; name?: LocalizedString };
    players?: number;
  }>;
  minimum_level?: number;
  category?: { type?: string };
};

type MediaResponse = {
  assets?: Array<{ key?: string; value?: string }>;
};

type RawSection = {
  id?: number;
  title?: LocalizedString;
  body_text?: LocalizedString;
  sections?: RawSection[];
  spell?: Reference;
  creature_display?: { id?: number };
};

type EncounterResponse = {
  id: number;
  name?: LocalizedString;
  description?: LocalizedString;
  creatures?: Array<Reference & { creature_display?: { id?: number } }>;
  items?: Array<{ id?: number; item?: Reference }>;
  sections?: RawSection[];
  instance?: Reference;
  category?: { type?: string };
  modes?: Array<{ type?: string; name?: LocalizedString }>;
};

type EncounterIndexResponse = { encounters?: Reference[] };

type InstanceIndexResponse = { instances?: Reference[] };

/**
 * Blizzard's index files a "Current Season" pseudo-tier among the
 * expansions: it re-lists this season's raids and dungeons from several
 * expansions (Kings' Rest next to Midnight's), plus a Keystone Dungeons
 * primer that belongs to no expansion. Its id sits between Dragonflight and
 * The War Within, so sorting by id alone would file it as an expansion, and
 * its name is localized, so the id is the only stable way to tell it apart.
 */
export const CURRENT_SEASON_TIER_ID = 505;

const toRef = (reference: Reference | undefined, fallback: string): JournalRef | undefined =>
  typeof reference?.id === "number"
    ? { id: reference.id, name: localized(reference.name) || `${fallback} #${reference.id}` }
    : undefined;

const toRefs = (references: Reference[] | undefined, fallback: string): JournalRef[] =>
  (references ?? [])
    .map((reference) => toRef(reference, fallback))
    .filter((reference): reference is JournalRef => reference !== undefined);

const positiveNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;

/* ------------------------------------------------------------------ */
/* Tiers                                                               */
/* ------------------------------------------------------------------ */

/**
 * Every tier: the Current Season first, then the expansions newest first.
 * Blizzard's own order is arbitrary (Mists of Pandaria leads); expansion ids
 * grow with each release, so they sort chronologically.
 */
export const fetchJournalTiers = async (
  signal?: AbortSignal,
): Promise<JournalTierSummary[]> => {
  const response = await blizzardClient.get<TierIndexResponse>(
    "/data/wow/journal-expansion/index",
    { namespace: namespace("static") },
    { signal },
  );

  return toRefs(response.tiers, "Expansion")
    .map((tier) => ({ ...tier, isCurrentSeason: tier.id === CURRENT_SEASON_TIER_ID }))
    .sort(
      (left, right) =>
        Number(right.isCurrentSeason) - Number(left.isCurrentSeason) ||
        right.id - left.id,
    );
};

/** The newest real expansion: what the page opens on. */
export const newestExpansion = (
  tiers: readonly JournalTierSummary[],
): JournalTierSummary | undefined => tiers.find((tier) => !tier.isCurrentSeason);

/** One tier's dungeons and raids, or null when Blizzard has no such tier (404). */
export const fetchJournalTier = async (
  tierId: number,
  signal?: AbortSignal,
): Promise<JournalTier | null> => {
  const response = await optional404(() =>
    blizzardClient.get<TierResponse>(
      `/data/wow/journal-expansion/${tierId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  if (!response) {
    return null;
  }
  return {
    id: response.id,
    name: localized(response.name) || `Expansion #${response.id}`,
    raids: toRefs(response.raids, "Raid"),
    dungeons: toRefs(response.dungeons, "Dungeon"),
  };
};

/** Whether a tier lists the instance, as a raid or a dungeon. */
export const tierListsInstance = (tier: JournalTier, instanceId: number): boolean =>
  tier.raids.some((entry) => entry.id === instanceId) ||
  tier.dungeons.some((entry) => entry.id === instanceId);

/* ------------------------------------------------------------------ */
/* Instances                                                           */
/* ------------------------------------------------------------------ */

const toModes = (modes: InstanceResponse["modes"]): JournalMode[] =>
  (modes ?? [])
    .filter((entry) => typeof entry.mode?.type === "string")
    .map((entry) => ({
      type: entry.mode?.type ?? "",
      name: localized(entry.mode?.name) || humanizeEnum(entry.mode?.type),
      players: positiveNumber(entry.players),
    }));

/**
 * An instance and its art, fetched together. The art may 404 (the card
 * keeps its letter tile); a missing instance resolves to null; any other
 * failure fails the query so react-query retries it instead of caching an
 * instance without art for a day.
 */
export const fetchJournalInstance = async (
  instanceId: number,
  signal?: AbortSignal,
): Promise<JournalInstance | null> => {
  const [instance, media] = await Promise.all([
    optional404(() =>
      blizzardClient.get<InstanceResponse>(
        `/data/wow/journal-instance/${instanceId}`,
        { namespace: namespace("static") },
        { signal },
      ),
    ),
    optional404(() =>
      blizzardClient.get<MediaResponse>(
        `/data/wow/media/journal-instance/${instanceId}`,
        { namespace: namespace("static") },
        { signal },
      ),
    ),
  ]);
  if (!instance) {
    return null;
  }

  const assets = media?.assets ?? [];
  const tile = assets.find((asset) => asset.key === "tile")?.value ?? assets[0]?.value;

  return {
    id: instance.id,
    name: localized(instance.name) || `Instance #${instance.id}`,
    description: cleanMarkup(localized(instance.description)) || undefined,
    category: instance.category?.type || undefined,
    expansion: toRef(instance.expansion, "Expansion"),
    location: localized(instance.location?.name) || undefined,
    minimumLevel: positiveNumber(instance.minimum_level),
    modes: toModes(instance.modes),
    encounters: toRefs(instance.encounters, "Encounter"),
    imageUrl: tile ?? null,
  };
};

/* ------------------------------------------------------------------ */
/* Encounters                                                          */
/* ------------------------------------------------------------------ */

const BULLET = /^\$bullet;\s*/i;
/** Text macros other than `$bullet;` (none seen so far) are dropped, not shown raw. */
const LEFTOVER_MACRO = /\$[A-Za-z]+;/g;

/**
 * Blizzard's ability text: lines split by CRLF (or `|n`), bullets as a
 * `$bullet;` prefix, spells as `[Spell Name]`. Each line becomes a paragraph
 * and each run of bullet lines one list; the brackets are kept for the
 * renderer, which marks them as spell names.
 */
export const toBodyBlocks = (raw: string | undefined): JournalBodyBlock[] => {
  const blocks: JournalBodyBlock[] = [];
  (raw ?? "").split(/\r?\n|\|n/).forEach((line) => {
    const trimmed = line.trim();
    const bullet = BULLET.test(trimmed);
    const text = cleanMarkup(trimmed.replace(BULLET, "").replace(LEFTOVER_MACRO, ""));
    if (!text) {
      return;
    }
    const last = blocks[blocks.length - 1];
    if (bullet && last?.kind === "list") {
      last.items.push(text);
    } else if (bullet) {
      blocks.push({ kind: "list", items: [text] });
    } else {
      blocks.push({ kind: "paragraph", text });
    }
  });
  return blocks;
};

/** A section with no title, spell, text or add of its own: a bare wrapper. */
const isBareWrapper = (raw: RawSection): boolean =>
  !localized(raw.title) &&
  toRef(raw.spell, "Spell") === undefined &&
  !localized(raw.body_text) &&
  positiveNumber(raw.creature_display?.id) === undefined;

/**
 * Sections with bare wrappers replaced by their children. The Affixes primer
 * (encounter 2870) files its "Mythic Level N" notes under one untitled,
 * empty section; shown as is, that is an accordion called "Untitled section"
 * the visitor has to open to reach anything. A wrapper with no children at
 * all is dropped.
 */
const liftBareWrappers = (raws: readonly RawSection[] | undefined): RawSection[] =>
  (raws ?? []).flatMap((raw) => (isBareWrapper(raw) ? liftBareWrappers(raw.sections) : [raw]));

const toSections = (raws: readonly RawSection[] | undefined): JournalSection[] =>
  // Lift first, so a fallback id counts the siblings actually shown.
  liftBareWrappers(raws).map(toSection);

const toSection = (raw: RawSection, index: number): JournalSection => {
  const spell = toRef(raw.spell, "Spell");
  return {
    // Ids key the accordions; a section without one still gets a stable key.
    id: typeof raw.id === "number" ? raw.id : -(index + 1),
    title: localized(raw.title) || spell?.name || "Untitled section",
    body: toBodyBlocks(localized(raw.body_text)),
    spell,
    displayId: positiveNumber(raw.creature_display?.id),
    sections: toSections(raw.sections),
  };
};

const toCreatures = (creatures: EncounterResponse["creatures"]): JournalCreature[] =>
  (creatures ?? [])
    .filter((creature) => typeof creature.id === "number")
    .map((creature) => ({
      id: creature.id as number,
      name: localized(creature.name) || `Creature #${creature.id}`,
      displayId: positiveNumber(creature.creature_display?.id),
    }));

const toLoot = (items: EncounterResponse["items"]): JournalLootItem[] =>
  (items ?? [])
    .filter((entry) => typeof entry.item?.id === "number")
    .map((entry, index) => ({
      id: typeof entry.id === "number" ? entry.id : -(index + 1),
      itemId: entry.item?.id as number,
      name: localized(entry.item?.name) || `Item #${entry.item?.id}`,
    }));

/** One encounter, or null when Blizzard has no such encounter (404). */
export const fetchJournalEncounter = async (
  encounterId: number,
  signal?: AbortSignal,
): Promise<JournalEncounter | null> => {
  const response = await optional404(() =>
    blizzardClient.get<EncounterResponse>(
      `/data/wow/journal-encounter/${encounterId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  if (!response) {
    return null;
  }
  return {
    id: response.id,
    name: localized(response.name) || `Encounter #${response.id}`,
    description: cleanMarkup(localized(response.description)) || undefined,
    instance: toRef(response.instance, "Instance"),
    category: response.category?.type || undefined,
    modes: (response.modes ?? [])
      .filter((mode) => typeof mode.type === "string")
      .map((mode) => ({
        type: mode.type ?? "",
        name: localized(mode.name) || humanizeEnum(mode.type),
      })),
    creatures: toCreatures(response.creatures),
    loot: toLoot(response.items),
    sections: toSections(response.sections),
  };
};

/** Every encounter's name and id, for the name search (one ~170 KB request). */
export const fetchJournalEncounterIndex = async (
  signal?: AbortSignal,
): Promise<JournalRef[]> => {
  const response = await blizzardClient.get<EncounterIndexResponse>(
    "/data/wow/journal-encounter/index",
    { namespace: namespace("static") },
    { signal },
  );
  return toRefs(response.encounters, "Encounter");
};

/** Every dungeon and raid's name and id, for the name search (one ~30 KB request). */
export const fetchJournalInstanceIndex = async (
  signal?: AbortSignal,
): Promise<JournalRef[]> => {
  const response = await blizzardClient.get<InstanceIndexResponse>(
    "/data/wow/journal-instance/index",
    { namespace: namespace("static") },
    { signal },
  );
  return toRefs(response.instances, "Instance");
};

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

/**
 * Lower-case words without accents or apostrophes, so "al'ar", "Alar" and
 * "Al'ar" agree, and "Ra-den" is "ra" and "den".
 */
const searchWords = (value: string): string[] =>
  value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase()
    .replace(/['\u2019]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/** Chinese, Japanese and Korean names have no spaces to split words on. */
const UNSPACED_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/**
 * Every typed word starts some word of the name, in any order ("lich",
 * "king lich", a half-typed "averz"). Only the typed word may be the
 * shorter one: the shared `matchesTypedName` also lets a name's word be a
 * prefix of the typed one (Blizzard's analyser stems plurals), which over
 * a whole local index lets "averz" match "M.O.M.M.A." by its "a".
 */
const matchesName = (nameWords: readonly string[], typedWords: readonly string[]): boolean =>
  typedWords.every((typed) =>
    nameWords.some((word) =>
      UNSPACED_SCRIPT.test(typed) ? word.includes(typed) : word.startsWith(typed),
    ),
  );

/** Each index's names split once (an index is one cached query result), not per keystroke. */
const wordsCache = new WeakMap<readonly JournalRef[], string[][]>();

const matchRank = (name: string, query: string): number => {
  if (name === query) {
    return 0;
  }
  if (name.startsWith(query)) {
    return 1;
  }
  return name.includes(query) ? 2 : 3;
};

/**
 * Index entries whose name holds every typed word, the closest names first:
 * exact, then starting with the query, then containing it, then any word
 * order. Ties go to the newer entry, since ids grow with each release.
 */
export const searchByName = (
  index: readonly JournalRef[],
  query: string,
): JournalRef[] => {
  const typedWords = searchWords(query);
  if (typedWords.length === 0) {
    return [];
  }
  const typed = typedWords.join(" ");
  let indexWords = wordsCache.get(index);
  if (!indexWords) {
    indexWords = index.map((entry) => searchWords(entry.name));
    wordsCache.set(index, indexWords);
  }
  const words = indexWords;
  return index
    .map((entry, position) => ({ entry, words: words[position] }))
    .filter(({ words: nameWords }) => matchesName(nameWords, typedWords))
    .map(({ entry, words: nameWords }) => ({ entry, rank: matchRank(nameWords.join(" "), typed) }))
    .sort((left, right) => left.rank - right.rank || right.entry.id - left.entry.id)
    .map(({ entry }) => entry);
};

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

export const pluralize = (count: number, one: string, many: string): string =>
  `${formatNumber(count)} ${count === 1 ? one : many}`;

/** "RAID" -> "Raid", "WORLD_BOSS" -> "World boss". */
export const categoryLabel = (category: string | undefined): string | undefined =>
  category ? humanizeEnum(category) : undefined;

/** "20–30 players" across an instance's modes, or "5 players". */
export const playersLabel = (modes: readonly JournalMode[]): string | undefined => {
  const counts = modes
    .map((mode) => mode.players)
    .filter((players): players is number => players !== undefined);
  if (counts.length === 0) {
    return undefined;
  }
  const low = Math.min(...counts);
  const high = Math.max(...counts);
  return low === high
    ? `${formatNumber(low)} players`
    : `${formatNumber(low)}–${formatNumber(high)} players`;
};

export const hasKeystoneMode = (modes: readonly JournalMode[]): boolean =>
  modes.some((mode) => mode.type === "MYTHIC_KEYSTONE");

/** The raw records behind a view, in the API workbench (catalog slug and endpoint id). */
export const workbenchUrl = (
  endpoint: "journal-instance" | "journal-encounter",
  id: number,
): string =>
  `/api-explorer/journal?${new URLSearchParams(
    endpoint === "journal-instance"
      ? { endpoint, journalInstanceId: String(id) }
      : { endpoint, journalEncounterId: String(id) },
  ).toString()}`;
