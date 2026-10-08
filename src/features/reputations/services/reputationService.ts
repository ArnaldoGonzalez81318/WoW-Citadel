import { blizzardClient } from "@/lib/blizzardClient";
import {
  cleanMarkup,
  localized,
  namespace,
  optional404,
} from "@/lib/blizzardHelpers";
import { formatNumber } from "@/lib/format";
import type {
  Faction,
  FactionIndex,
  FactionRef,
  LadderKind,
  LocalizedString,
  RenownLevel,
  StandingLadder,
  StandingLadderSummary,
  StandingTier,
} from "@/features/reputations/types";

/*
 * Blizzard keeps reputations as a tree only one level at a time:
 *
 *   reputation-faction/index       every faction (flat) + the 14 root groups
 *     -> reputation-faction/{id}    one faction; a header lists its children
 *     -> reputation-tiers/{id}      the standing ladder it climbs
 *
 * so the expansion groups come from the 14 root records, a group's factions
 * from its record, and a sub-group's (The Tillers, Horde Forces) only from
 * that faction's own record. Renown factions carry their levels and rewards
 * inline and have no ladder record. There is no faction media endpoint, and
 * `reputation-faction/reward/{id}` 404s, so rewards are names only.
 */

type Reference = { id: number; name?: LocalizedString };

type FactionIndexResponse = {
  factions?: Reference[];
  root_factions?: Reference[];
};

type FactionResponse = {
  id: number;
  name?: LocalizedString;
  description?: LocalizedString;
  reputation_tiers?: { id?: number };
  factions?: Reference[];
  is_header?: boolean;
  header_shows_bar?: boolean;
  is_renown?: boolean;
  can_paragon?: boolean;
  renown_tiers?: Array<{
    level?: number;
    name?: LocalizedString;
    rewards?: Reference[];
  }>;
  player_faction?: { type?: string; name?: LocalizedString };
};

type LadderResponse = {
  id: number;
  tiers?: Array<{
    id?: number;
    name?: LocalizedString;
    min_value?: number;
    max_value?: number;
  }>;
  faction?: Reference;
};

type LadderIndexResponse = {
  reputation_tiers?: Reference[];
};

/** The shared Hated…Exalted ladder most factions climb. */
export const STANDARD_LADDER_ID = 0;

const toRef = (entry: Reference, fallback: string): FactionRef => ({
  id: entry.id,
  name: localized(entry.name) || `${fallback} #${entry.id}`,
});

const toRefs = (entries: Reference[] | undefined, fallback: string): FactionRef[] =>
  (entries ?? [])
    .filter((entry) => typeof entry.id === "number")
    .map((entry) => toRef(entry, fallback));

/* ------------------------------------------------------------------ */
/* Index                                                               */
/* ------------------------------------------------------------------ */

/** Every faction and the root groups, both in Blizzard's (in-game pane) order. */
export const fetchFactionIndex = async (signal?: AbortSignal): Promise<FactionIndex> => {
  const response = await blizzardClient.get<FactionIndexResponse>(
    "/data/wow/reputation-faction/index",
    { namespace: namespace("static") },
    { signal },
  );
  return {
    factions: toRefs(response.factions, "Faction"),
    roots: toRefs(response.root_factions, "Group"),
  };
};

/* ------------------------------------------------------------------ */
/* One faction                                                         */
/* ------------------------------------------------------------------ */

/**
 * Not every folder says so: Barracks Bodyguards lists seven factions but has
 * no `is_header` at all, so folding factions counts as being a header too.
 */
const foldsFactions = (response: FactionResponse): boolean =>
  response.is_header === true || (response.factions?.length ?? 0) > 0;

/**
 * Renown first: a renown header (The Cartels of Undermine) is a track of its
 * own. A header without a bar (Horde, Barracks Bodyguards, each expansion)
 * still names ladder 0 in its record, but nobody earns standing with it.
 */
const ladderKindOf = (response: FactionResponse): LadderKind => {
  if (response.is_renown === true) {
    return "renown";
  }
  if (foldsFactions(response) && response.header_shows_bar !== true) {
    return "group";
  }
  const ladderId = response.reputation_tiers?.id;
  if (ladderId === STANDARD_LADDER_ID) {
    return "standard";
  }
  return typeof ladderId === "number" ? "friendship" : "none";
};

const toRenownLevels = (raw: FactionResponse["renown_tiers"]): RenownLevel[] =>
  (raw ?? [])
    .filter((entry): entry is NonNullable<typeof entry> & { level: number } =>
      typeof entry.level === "number",
    )
    .map((entry) => ({
      level: entry.level,
      name: localized(entry.name) || `Renown ${entry.level}`,
      rewards: toRefs(entry.rewards, "Reward"),
    }))
    .sort((left, right) => left.level - right.level);

/**
 * One faction record, or null when Blizzard has no such faction (404): a
 * shared link to a removed faction then shows "not found" instead of
 * retrying. Any other failure throws, so react-query retries it.
 */
export const fetchFaction = async (
  factionId: number,
  signal?: AbortSignal,
): Promise<Faction | null> => {
  const response = await optional404(() =>
    blizzardClient.get<FactionResponse>(
      `/data/wow/reputation-faction/${factionId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  if (!response) {
    return null;
  }

  const kind = ladderKindOf(response);
  const ladderId = response.reputation_tiers?.id;
  const sideType = response.player_faction?.type;
  return {
    id: response.id,
    name: localized(response.name) || `Faction #${response.id}`,
    description: cleanMarkup(localized(response.description)) || undefined,
    kind,
    // A folder's ladder 0 is a placeholder (see ladderKindOf), not a ladder to draw.
    ladderId:
      kind === "standard" || kind === "friendship"
        ? (ladderId ?? null)
        : null,
    renownLevels: toRenownLevels(response.renown_tiers),
    isHeader: foldsFactions(response),
    headerShowsBar: response.header_shows_bar === true,
    canParagon: response.can_paragon === true,
    side: sideType
      ? {
          type: sideType,
          name: localized(response.player_faction?.name) || sideType,
        }
      : undefined,
    children: toRefs(response.factions, "Faction"),
  };
};

/* ------------------------------------------------------------------ */
/* Ladders                                                             */
/* ------------------------------------------------------------------ */

export const fetchLadderIndex = async (
  signal?: AbortSignal,
): Promise<StandingLadderSummary[]> => {
  const response = await blizzardClient.get<LadderIndexResponse>(
    "/data/wow/reputation-tiers/index",
    { namespace: namespace("static") },
    { signal },
  );
  return (response.reputation_tiers ?? [])
    .filter((entry) => typeof entry.id === "number")
    .map((entry) => ({ id: entry.id, name: localized(entry.name) || undefined }));
};

/** A standing ladder, lowest standing first; null when Blizzard has none (404). */
export const fetchLadder = async (
  ladderId: number,
  signal?: AbortSignal,
): Promise<StandingLadder | null> => {
  const response = await optional404(() =>
    blizzardClient.get<LadderResponse>(
      `/data/wow/reputation-tiers/${ladderId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  if (!response) {
    return null;
  }

  const tiers: StandingTier[] = (response.tiers ?? [])
    .filter(
      (tier): tier is { id: number; name?: LocalizedString; min_value: number; max_value: number } =>
        typeof tier.id === "number" &&
        typeof tier.min_value === "number" &&
        typeof tier.max_value === "number",
    )
    .map((tier) => ({
      id: tier.id,
      name: localized(tier.name) || `Rank ${tier.id + 1}`,
      min: tier.min_value,
      max: tier.max_value,
    }))
    .sort((left, right) => left.min - right.min || left.id - right.id);

  return {
    id: response.id,
    tiers,
    faction: response.faction ? toRef(response.faction, "Faction") : undefined,
  };
};

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

/** Badge labels: one word each. */
export const KIND_LABEL: Readonly<Record<LadderKind, string>> = {
  standard: "Standard",
  friendship: "Friendship",
  renown: "Renown",
  group: "Group",
  none: "No ladder",
};

/** Longer names for the dialog and the guide. */
export const KIND_TITLE: Readonly<Record<LadderKind, string>> = {
  standard: "Standard reputation",
  friendship: "Friendship reputation",
  renown: "Renown",
  group: "Group of factions",
  none: "No standing ladder",
};

export const pluralize = (count: number, one: string, many: string): string =>
  `${formatNumber(count)} ${count === 1 ? one : many}`;

/** The final standing has no ceiling: Exalted is 42,000–42,000. */
export const isFinalTier = (tier: StandingTier): boolean => tier.max <= tier.min;

/** Points from the first standing's floor to the last one's. */
export const ladderSpan = (ladder: StandingLadder): number => {
  const first = ladder.tiers[0];
  const last = ladder.tiers[ladder.tiers.length - 1];
  return first && last ? last.min - first.min : 0;
};

/** Ranks in a friendship ladder, standings in the standard one. */
export const tierNoun = (kind: LadderKind, count: number): string =>
  kind === "standard"
    ? pluralize(count, "standing", "standings")
    : pluralize(count, "rank", "ranks");

/** "8 standings · Hated to Exalted" */
export const ladderSummary = (kind: LadderKind, ladder: StandingLadder): string => {
  const first = ladder.tiers[0];
  const last = ladder.tiers[ladder.tiers.length - 1];
  if (!first || !last) {
    return "No standings listed";
  }
  return first === last
    ? tierNoun(kind, 1)
    : `${tierNoun(kind, ladder.tiers.length)} · ${first.name} to ${last.name}`;
};

export const rewardCount = (levels: readonly RenownLevel[]): number =>
  levels.reduce((total, level) => total + level.rewards.length, 0);

/** "40 renown levels · 52 rewards" */
export const renownSummary = (levels: readonly RenownLevel[]): string => {
  if (levels.length === 0) {
    return "No renown levels listed";
  }
  const top = levels[levels.length - 1].level;
  const rewards = rewardCount(levels);
  return [
    pluralize(top, "renown level", "renown levels"),
    rewards > 0 ? pluralize(rewards, "reward", "rewards") : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
};
