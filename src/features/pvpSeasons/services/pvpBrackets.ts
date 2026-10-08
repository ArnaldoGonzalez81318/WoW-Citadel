import { titleFromSlug } from "@/features/mythicLeaderboard/services/leaderboardService";
import type { PvpBoardRef, PvpBracketGroup } from "@/features/pvpSeasons/types";
import { humanizeEnum } from "@/lib/format";

/*
 * Blizzard names a season's leaderboards by slug only: "2v2", "3v3", "rbg",
 * "shuffle-overall", "blitz-overall", and "shuffle-<class>-<spec>" /
 * "blitz-<class>-<spec>" for the per-spec boards (85 on Midnight Season 2).
 * The index carries no specialization ids, so the per-spec boards are
 * matched to Blizzard's specialization ids here. Those ids have been stable
 * since Mists of Pandaria (new specs get new ids); a spec this table does not
 * know yet still gets its board, labelled from its slug with a letter icon.
 */
const SPEC_IDS: Readonly<Record<string, number>> = {
  "deathknight-blood": 250,
  "deathknight-frost": 251,
  "deathknight-unholy": 252,
  "demonhunter-havoc": 577,
  "demonhunter-vengeance": 581,
  "demonhunter-devourer": 1480,
  "druid-balance": 102,
  "druid-feral": 103,
  "druid-guardian": 104,
  "druid-restoration": 105,
  "evoker-devastation": 1467,
  "evoker-preservation": 1468,
  "evoker-augmentation": 1473,
  "hunter-beastmastery": 253,
  "hunter-marksmanship": 254,
  "hunter-survival": 255,
  "mage-arcane": 62,
  "mage-fire": 63,
  "mage-frost": 64,
  "monk-brewmaster": 268,
  "monk-windwalker": 269,
  "monk-mistweaver": 270,
  "paladin-holy": 65,
  "paladin-protection": 66,
  "paladin-retribution": 70,
  "priest-discipline": 256,
  "priest-holy": 257,
  "priest-shadow": 258,
  "rogue-assassination": 259,
  "rogue-outlaw": 260,
  "rogue-subtlety": 261,
  "shaman-elemental": 262,
  "shaman-enhancement": 263,
  "shaman-restoration": 264,
  "warlock-affliction": 265,
  "warlock-demonology": 266,
  "warlock-destruction": 267,
  "warrior-arms": 71,
  "warrior-fury": 72,
  "warrior-protection": 73,
};

/** Slugs that do not title-case into their in-game names. */
const SLUG_LABELS: Readonly<Record<string, string>> = {
  deathknight: "Death Knight",
  demonhunter: "Demon Hunter",
  beastmastery: "Beast Mastery",
};

const labelFromSlug = (slug: string): string => SLUG_LABELS[slug] ?? titleFromSlug(slug);

const SOLO_GROUPS: ReadonlySet<string> = new Set(["shuffle", "blitz"]);

/** "shuffle-mage-frost" -> { group: "shuffle", specSlug: "mage-frost", specId: 64 }. */
export const parseBoard = (slug: string): PvpBoardRef => {
  if (slug === "2v2" || slug === "3v3" || slug === "rbg") {
    return { slug, group: slug };
  }
  const [prefix, ...rest] = slug.split("-");
  if (SOLO_GROUPS.has(prefix) && rest.length > 0) {
    const group = prefix as "shuffle" | "blitz";
    const specSlug = rest.join("-");
    if (specSlug === "overall") {
      return { slug, group };
    }
    return { slug, group, specSlug, specId: SPEC_IDS[specSlug] };
  }
  return { slug, group: "other" };
};

/**
 * A season's boards in a reading order: the team and overall boards first,
 * as Blizzard lists them (the picker orders its tiles itself), then the
 * per-spec boards by bracket and class-then-spec slug. Blizzard's own order
 * is alphabetical from season 37 on, but the earlier Dragonflight seasons
 * list their spec boards in no order at all (season 34 opens on Vengeance
 * Demon Hunter, then Fury Warrior, then Brewmaster Monk), which would
 * shuffle the specialization select and the board a Shuffle tile opens.
 * Ordinal comparison: slugs are ASCII, and a locale collation could weigh
 * the hyphens differently from one browser to the next.
 */
export const sortBoards = (boards: readonly PvpBoardRef[]): PvpBoardRef[] => {
  const teams = boards.filter((board) => board.specSlug === undefined);
  const specs = boards
    .filter((board) => board.specSlug !== undefined)
    .sort((left, right) => (left.slug < right.slug ? -1 : left.slug > right.slug ? 1 : 0));
  return [...teams, ...specs];
};

export type BracketGroupInfo = {
  /** The tile's value: the group, or the slug of a board the page does not know. */
  key: string;
  group: PvpBracketGroup;
  label: string;
  caption: string;
};

const GROUP_INFO: Record<Exclude<PvpBracketGroup, "other">, Omit<BracketGroupInfo, "key" | "group">> = {
  "2v2": { label: "Arena 2v2", caption: "Arena · teams of two" },
  "3v3": { label: "Arena 3v3", caption: "Arena · teams of three" },
  rbg: { label: "Rated Battlegrounds", caption: "Battlegrounds · 10 players" },
  shuffle: { label: "Solo Shuffle", caption: "Solo arena · by spec" },
  blitz: { label: "Blitz", caption: "Solo battlegrounds · by spec" },
};

/** The order the picker lists brackets in, smallest team first. */
const GROUP_ORDER: readonly PvpBracketGroup[] = ["2v2", "3v3", "rbg", "shuffle", "blitz"];

/** A tile per bracket present in the season, plus one per board the page does not recognise. */
export const bracketGroupsOf = (boards: readonly PvpBoardRef[]): BracketGroupInfo[] => {
  const known = GROUP_ORDER.filter((group) => boards.some((board) => board.group === group)).map(
    (group): BracketGroupInfo => ({
      key: group,
      group,
      ...GROUP_INFO[group as Exclude<PvpBracketGroup, "other">],
    }),
  );
  const others = boards
    .filter((board) => board.group === "other")
    .map(
      (board): BracketGroupInfo => ({
        key: board.slug,
        group: "other",
        label: labelFromSlug(board.slug),
        caption: "Leaderboard",
      }),
    );
  return [...known, ...others];
};

/** The tile a board belongs to (its group, or its own slug for an unknown board). */
export const groupKeyOf = (board: PvpBoardRef): string =>
  board.group === "other" ? board.slug : board.group;

/** "Arena 3v3", "Solo Shuffle", … for a board's group. */
export const groupLabelOf = (board: PvpBoardRef): string =>
  board.group === "other"
    ? labelFromSlug(board.slug)
    : GROUP_INFO[board.group].label;

/** "Frost Mage" from "mage-frost", while the localized specialization loads. */
export const specLabelFromSlug = (specSlug: string): { spec: string; className: string } => {
  const [classSlug = "", ...specParts] = specSlug.split("-");
  return {
    spec: labelFromSlug(specParts.join("-")),
    className: labelFromSlug(classSlug),
  };
};

/**
 * The board to show for a requested slug: the slug itself when the season
 * has it. A Solo Shuffle or Blitz board the season lacks stays in its
 * bracket: the overall board, or, for the Dragonflight seasons that rank
 * by spec only (no "-overall" board before season 38), the bracket's first
 * spec board. Anything else falls back to Arena 3v3, then the first board.
 */
export const resolveBoard = (
  requested: string,
  boards: readonly PvpBoardRef[],
): PvpBoardRef | null => {
  const exact = boards.find((board) => board.slug === requested);
  if (exact) {
    return exact;
  }
  const parsed = parseBoard(requested);
  if (SOLO_GROUPS.has(parsed.group)) {
    const inGroup = boards.filter((board) => board.group === parsed.group);
    const fallback = inGroup.find((board) => board.specSlug === undefined) ?? inGroup[0];
    if (fallback) {
      return fallback;
    }
  }
  return boards.find((board) => board.slug === "3v3") ?? boards[0] ?? null;
};

/**
 * The board to open when the viewer picks another bracket: the same spec
 * there if it has one (Frost Mage in Shuffle -> Frost Mage in Blitz), else
 * the bracket's overall board, else its first (boards come sorted by spec
 * slug, see `sortBoards`, so that is Blood Death Knight, not whichever spec
 * Blizzard happened to list first).
 */
export const boardForGroup = (
  groupKey: string,
  current: PvpBoardRef | null,
  boards: readonly PvpBoardRef[],
): PvpBoardRef | undefined => {
  const members = boards.filter((board) => groupKeyOf(board) === groupKey);
  if (current?.specSlug) {
    const sameSpec = members.find((board) => board.specSlug === current.specSlug);
    if (sameSpec) {
      return sameSpec;
    }
  }
  return members.find((board) => board.specSlug === undefined) ?? members[0];
};

const BRACKET_TYPE_LABELS: Readonly<Record<string, string>> = {
  ARENA_2v2: "Arena 2v2",
  ARENA_3v3: "Arena 3v3",
  ARENA_5v5: "Arena 5v5",
  BATTLEGROUNDS: "Rated Battlegrounds",
  SHUFFLE: "Solo Shuffle",
  BLITZ: "Blitz",
};

/** The order the rating cutoffs list brackets in, matching the picker. */
export const BRACKET_TYPE_ORDER: readonly string[] = [
  "ARENA_2v2",
  "ARENA_3v3",
  "ARENA_5v5",
  "BATTLEGROUNDS",
  "SHUFFLE",
  "BLITZ",
];

/** "ARENA_3v3" -> "Arena 3v3"; an unknown type is humanized. */
export const bracketTypeLabel = (type: string): string =>
  BRACKET_TYPE_LABELS[type] ?? humanizeEnum(type);
