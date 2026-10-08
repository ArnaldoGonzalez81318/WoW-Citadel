import { blizzardClient } from "@/lib/blizzardClient";
import {
  cleanMarkup,
  localized,
  namespace,
  optional404,
} from "@/lib/blizzardHelpers";
import { formatNumber } from "@/lib/format";
import type {
  LocalizedString,
  NamedRef,
  Quest,
  QuestBrowseMode,
  QuestFaction,
  QuestGroup,
  QuestGroupSummary,
  QuestRepeat,
  QuestRewardAmount,
  QuestRewardItem,
  QuestRewards,
  QuestSort,
} from "@/features/quests/types";

/*
 * Blizzard files quests three ways, each an index plus one lookup per entry:
 *
 *   quest/area/index      440 zones    -> quest/area/{id}      { area, quests }
 *   quest/category/index  184 groups   -> quest/category/{id}  { category, quests }
 *   quest/type/index      9 types      -> quest/type/{id}      { type, quests }
 *
 * A group lists its quests by id and title only (Elwynn Forest 47, Dungeon
 * 787); everything else is one more lookup per quest (quest/{id}). There is
 * no quest search endpoint (search/quest is a 404), so the only other way in
 * is a quest's id.
 */

type Reference = { id: number; name?: LocalizedString };

/** Blizzard's path segment for each browse mode: a "zone" is an area. */
const MODE_PATH: Readonly<Record<QuestBrowseMode, string>> = {
  zone: "area",
  category: "category",
  type: "type",
};

type GroupIndexResponse = {
  areas?: Reference[];
  categories?: Reference[];
  types?: Reference[];
};

type GroupResponse = {
  id: number;
  area?: LocalizedString;
  category?: LocalizedString;
  type?: LocalizedString;
  quests?: Reference[];
};

type QuestResponse = {
  id: number;
  title?: LocalizedString;
  area?: Reference;
  category?: Reference;
  type?: Reference;
  description?: LocalizedString;
  requirements?: {
    min_character_level?: number;
    max_character_level?: number;
    faction?: { type?: string };
    classes?: Reference[];
    races?: Reference[];
    reputations?: Array<{
      faction?: Reference;
      min_reputation?: number;
      max_reputation?: number;
    }>;
  };
  rewards?: {
    experience?: number;
    money?: { value?: number };
    items?: {
      items?: Array<{ item?: Reference }>;
      choice_of?: Array<{
        item?: Reference;
        requirements?: { playable_specializations?: Reference[] };
      }>;
    };
    reputations?: Array<{ reward?: Reference; value?: number }>;
    currency?: Array<{ reward?: Reference; value?: number }>;
    spell?: Reference;
  };
  is_daily?: boolean;
  is_weekly?: boolean;
  is_repeatable?: boolean;
};

type MediaResponse = {
  assets?: Array<{ key?: string; value?: string }>;
};

/* ------------------------------------------------------------------ */
/* Indexes and groups                                                  */
/* ------------------------------------------------------------------ */

const toNamed = (
  entry: Reference | undefined,
  fallback: (id: number) => string,
): NamedRef | undefined =>
  entry && typeof entry.id === "number"
    ? { id: entry.id, name: localized(entry.name) || fallback(entry.id) }
    : undefined;

const MODE_NOUN: Readonly<Record<QuestBrowseMode, string>> = {
  zone: "Zone",
  category: "Category",
  type: "Type",
};

/** "Zone #12", for an entry Blizzard left unnamed. */
export const unnamedGroup = (mode: QuestBrowseMode, id: number): string =>
  `${MODE_NOUN[mode]} #${id}`;

/** Every zone, category or type, in Blizzard's order (the picker sorts). */
export const fetchQuestGroupIndex = async (
  mode: QuestBrowseMode,
  signal?: AbortSignal,
): Promise<QuestGroupSummary[]> => {
  const path = MODE_PATH[mode];
  const response = await blizzardClient.get<GroupIndexResponse>(
    `/data/wow/quest/${path}/index`,
    { namespace: namespace("static") },
    { signal },
  );
  const entries =
    mode === "zone"
      ? response.areas
      : mode === "category"
        ? response.categories
        : response.types;

  return (entries ?? [])
    .map((entry) => toNamed(entry, (id) => unnamedGroup(mode, id)))
    .filter((entry): entry is QuestGroupSummary => entry !== undefined);
};

/**
 * One zone, category or type and its quests, or null when Blizzard has no
 * such group (an old or foreign link). A group may list a quest twice (the
 * World Quest category does), so ids are de-duplicated here once.
 */
export const fetchQuestGroup = async (
  mode: QuestBrowseMode,
  groupId: number,
  signal?: AbortSignal,
): Promise<QuestGroup | null> => {
  const response = await optional404(() =>
    blizzardClient.get<GroupResponse>(
      `/data/wow/quest/${MODE_PATH[mode]}/${groupId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  if (!response) {
    return null;
  }

  const seen = new Set<number>();
  const quests = (response.quests ?? []).filter((quest) => {
    if (typeof quest.id !== "number" || seen.has(quest.id)) {
      return false;
    }
    seen.add(quest.id);
    return true;
  });
  const rawName =
    mode === "zone"
      ? response.area
      : mode === "category"
        ? response.category
        : response.type;

  return {
    id: response.id,
    name: localized(rawName) || unnamedGroup(mode, response.id),
    quests: quests.map((quest) => ({
      id: quest.id,
      name: localized(quest.name) || `Quest #${quest.id}`,
    })),
  };
};

/* ------------------------------------------------------------------ */
/* One quest                                                           */
/* ------------------------------------------------------------------ */

const isFaction = (value: string | undefined): value is QuestFaction =>
  value === "ALLIANCE" || value === "HORDE";

const finiteNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const namedList = (
  entries: Reference[] | undefined,
  fallback: (id: number) => string,
): NamedRef[] =>
  (entries ?? [])
    .map((entry) => toNamed(entry, fallback))
    .filter((entry): entry is NamedRef => entry !== undefined);

const toAmounts = (
  entries: Array<{ reward?: Reference; value?: number }> | undefined,
  fallback: (id: number) => string,
): QuestRewardAmount[] =>
  (entries ?? []).flatMap((entry) => {
    const ref = toNamed(entry.reward, fallback);
    const value = finiteNumber(entry.value);
    return ref && value !== undefined ? [{ ref, value }] : [];
  });

const itemName = (id: number): string => `Item #${id}`;

/**
 * Descriptions arrive as "\r\n\r\n"-separated paragraphs. cleanMarkup folds
 * every line break into a space, so the text is split first and each
 * paragraph cleaned on its own.
 */
const toParagraphs = (value: LocalizedString | undefined): string[] =>
  localized(value)
    .split(/(?:\r?\n){1,}/u)
    .map((paragraph) => cleanMarkup(paragraph))
    .filter((paragraph) => paragraph.length > 0);

/**
 * A quest record cleaned up for the list row and the dialog, or null when
 * Blizzard has no such quest: ids in a group can outlive their quest, and a
 * looked-up id may never have existed.
 */
export const fetchQuest = async (
  questId: number,
  signal?: AbortSignal,
): Promise<Quest | null> => {
  const response = await optional404(() =>
    blizzardClient.get<QuestResponse>(
      `/data/wow/quest/${questId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  if (!response) {
    return null;
  }

  const requirements = response.requirements ?? {};
  const rewards = response.rewards ?? {};
  const factionType = requirements.faction?.type;
  const faction = isFaction(factionType) ? factionType : undefined;
  const money = finiteNumber(rewards.money?.value);
  const experience = finiteNumber(rewards.experience);

  const items: QuestRewardItem[] = (rewards.items?.items ?? []).flatMap((entry) => {
    const item = toNamed(entry.item, itemName);
    return item ? [{ item, specs: [] }] : [];
  });
  const choices: QuestRewardItem[] = (rewards.items?.choice_of ?? []).flatMap(
    (entry) => {
      const item = toNamed(entry.item, itemName);
      // Spec names repeat across classes (Paladin and Warrior both have
      // Protection), so each is listed once.
      return item
        ? [
            {
              item,
              specs: [
                ...new Set(
                  namedList(
                    entry.requirements?.playable_specializations,
                    (id) => `Specialization #${id}`,
                  ).map((spec) => spec.name),
                ),
              ],
            },
          ]
        : [];
    },
  );

  const repeats: QuestRepeat[] = [];
  if (response.is_daily) {
    repeats.push("daily");
  }
  if (response.is_weekly) {
    repeats.push("weekly");
  }
  if (response.is_repeatable && repeats.length === 0) {
    repeats.push("repeatable");
  }

  return {
    id: response.id,
    title: localized(response.title) || `Quest #${response.id}`,
    area: toNamed(response.area, (id) => unnamedGroup("zone", id)),
    category: toNamed(response.category, (id) => unnamedGroup("category", id)),
    type: toNamed(response.type, (id) => unnamedGroup("type", id)),
    paragraphs: toParagraphs(response.description),
    requirements: {
      minLevel: finiteNumber(requirements.min_character_level),
      maxLevel: finiteNumber(requirements.max_character_level),
      faction,
      classes: namedList(requirements.classes, (id) => `Class #${id}`),
      races: namedList(requirements.races, (id) => `Race #${id}`),
      reputations: (requirements.reputations ?? []).flatMap((entry) => {
        const factionRef = toNamed(entry.faction, (id) => `Faction #${id}`);
        return factionRef
          ? [
              {
                faction: factionRef,
                min: finiteNumber(entry.min_reputation),
                max: finiteNumber(entry.max_reputation),
              },
            ]
          : [];
      }),
    },
    rewards: {
      experience: experience && experience > 0 ? experience : undefined,
      money: money && money > 0 ? money : undefined,
      items,
      choices,
      reputations: toAmounts(rewards.reputations, (id) => `Faction #${id}`),
      currencies: toAmounts(rewards.currency, (id) => `Currency #${id}`),
      spell: toNamed(rewards.spell, (id) => `Spell #${id}`),
    },
    repeats,
  };
};

/**
 * A playable class's 56px icon, or null when Blizzard has none (404 or no
 * assets). Never `undefined`: react-query rejects a queryFn resolving to it.
 */
export const fetchClassIcon = async (
  classId: number,
  signal?: AbortSignal,
): Promise<string | null> => {
  const media = await optional404(() =>
    blizzardClient.get<MediaResponse>(
      `/data/wow/media/playable-class/${classId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  const assets = media?.assets ?? [];
  return assets.find((asset) => asset.key === "icon")?.value ?? assets[0]?.value ?? null;
};

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** "Level 30", "Levels 10–30", "Level 10+" or undefined. */
export const formatLevelRange = (
  minLevel: number | undefined,
  maxLevel: number | undefined,
): string | undefined => {
  const min = minLevel !== undefined && minLevel > 0 ? minLevel : undefined;
  const max = maxLevel !== undefined && maxLevel > 0 ? maxLevel : undefined;
  if (min !== undefined && max !== undefined) {
    return min === max ? `Level ${min}` : `Levels ${min}–${max}`;
  }
  if (min !== undefined) {
    return `Level ${min}+`;
  }
  return max !== undefined ? `Up to level ${max}` : undefined;
};

export const isQuestSort = (value: string): value is QuestSort =>
  value === "name" || value === "newest";

/** Anything worth a Rewards section: Blizzard lists none for many breadcrumb quests. */
export const hasRewards = (rewards: QuestRewards): boolean =>
  rewards.experience !== undefined ||
  rewards.money !== undefined ||
  rewards.items.length > 0 ||
  rewards.choices.length > 0 ||
  rewards.reputations.length > 0 ||
  rewards.currencies.length > 0 ||
  rewards.spell !== undefined;

export const REPEAT_LABELS: Readonly<Record<QuestRepeat, string>> = {
  daily: "Daily",
  weekly: "Weekly",
  repeatable: "Repeatable",
};

/*
 * Classic reputation in raw points from Neutral: Friendly starts 3,000 in,
 * Exalted 42,000. Renown and friendship tracks use other scales, so the
 * standing name only ever accompanies the number, never replaces it.
 */
const STANDINGS: ReadonlyArray<[number, string]> = [
  [42_000, "Exalted"],
  [21_000, "Revered"],
  [9_000, "Honored"],
  [3_000, "Friendly"],
  [0, "Neutral"],
  [-3_000, "Unfriendly"],
  [-6_000, "Hostile"],
  [-42_000, "Hated"],
];

/** 7_900 -> "Friendly". */
export const standingName = (value: number): string =>
  STANDINGS.find(([threshold]) => value >= threshold)?.[1] ?? "Hated";

/** "1 quest", "47 quests". */
export const pluralize = (count: number, one: string, many: string): string =>
  `${formatNumber(count)} ${count === 1 ? one : many}`;
