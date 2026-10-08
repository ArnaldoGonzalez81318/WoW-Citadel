export type { LocalizedString } from "@/lib/blizzardHelpers";

/**
 * The three ways Blizzard files quests. Most have a zone (Blizzard's
 * "area"); many also have a category (holiday, class, profession…) and a
 * few a type (Dungeon, Raid, PvP…). Some class, campaign and dungeon quests
 * have no zone and are listed only under their category or type.
 */
export type QuestBrowseMode = "zone" | "category" | "type";

/** One entry of a zone, category or type index. */
export type QuestGroupSummary = {
  id: number;
  name: string;
};

/** A quest as a group lists it: id and title only. */
export type QuestRef = {
  id: number;
  name: string;
};

/** One zone, category or type with its quests (ids unique, Blizzard's order). */
export type QuestGroup = {
  id: number;
  name: string;
  quests: QuestRef[];
};

export type QuestFaction = "ALLIANCE" | "HORDE";

export type NamedRef = {
  id: number;
  name: string;
};

/** A reputation the quest asks for, in raw standing points (Neutral is 0). */
export type QuestReputationRequirement = {
  faction: NamedRef;
  min?: number;
  max?: number;
};

export type QuestRequirements = {
  minLevel?: number;
  maxLevel?: number;
  faction?: QuestFaction;
  classes: NamedRef[];
  races: NamedRef[];
  reputations: QuestReputationRequirement[];
};

/** An item the quest hands out, or offers as one of several choices. */
export type QuestRewardItem = {
  item: NamedRef;
  /** A choice limited to some specializations (the gear choice of a class quest). */
  specs: string[];
};

export type QuestRewardAmount = {
  ref: NamedRef;
  value: number;
};

export type QuestRewards = {
  experience?: number;
  /** Copper. */
  money?: number;
  items: QuestRewardItem[];
  /** "Choose one of": usually gear, one piece per armour type or spec. */
  choices: QuestRewardItem[];
  reputations: QuestRewardAmount[];
  currencies: QuestRewardAmount[];
  spell?: NamedRef;
};

export type QuestRepeat = "daily" | "weekly" | "repeatable";

/** A list's order: by title, or newest first (by id, which grows with every patch). */
export type QuestSort = "name" | "newest";

/** A quest record, cleaned up for display. */
export type Quest = {
  id: number;
  title: string;
  area?: NamedRef;
  category?: NamedRef;
  type?: NamedRef;
  /** Blank-line separated paragraphs, markup removed; `{name}` style placeholders kept. */
  paragraphs: string[];
  requirements: QuestRequirements;
  rewards: QuestRewards;
  repeats: QuestRepeat[];
};
