import { formatNumber } from "@/lib/format";
import { MIN_FUZZY_QUERY_LENGTH, rankByName } from "@/lib/fuzzyMatch";
import type {
  DecorEntry,
  DecorSort,
  Fixture,
  FixtureFamily,
  FixtureKind,
  FixtureMember,
  Room,
  RoomShape,
  RoomSize,
} from "@/features/housingDecor/types";

/*
 * Everything here is pure: the decor orderings and name search, the fixture
 * families and kinds, and the room shapes. Fixtures and rooms come from
 * Blizzard's search endpoints, whose hits carry every locale's name, so the
 * structure is read from the English names (where the words are known) and
 * the page shows the visitor's locale.
 */

/** Cards per page: 2, 3, 4 and 6 columns all end on a full row. */
export const DECOR_PAGE_SIZE = 24;

/** "1 decor", "2,131 fixtures" with grouped digits. */
export const pluralize = (count: number, one: string, many: string): string =>
  `${formatNumber(count)} ${count === 1 ? one : many}`;

/** Names as Blizzard writes them, with stray and doubled spaces ("Large Tower -  Crimson") tidied. */
export const tidyName = (value: string): string => value.replace(/\s+/g, " ").trim();

const compareNames = (left: string, right: string): number =>
  left.localeCompare(right, undefined, { sensitivity: "base" });

/* ------------------------------------------------------------------ */
/* Decor                                                               */
/* ------------------------------------------------------------------ */

/**
 * Paintings are named in quotes (`"Autumnal Eversong" Painting`): A to Z
 * reads past them, and so does a letter tile standing in for a missing icon.
 */
export const leadingWord = (name: string): string =>
  name.replace(/^[^\p{L}\p{N}]+/u, "") || name;

/**
 * Newest first is the highest decor id first: the index carries no dates,
 * but on US the top ids are the latest additions (the BlizzCon Doormat) and
 * the lowest the basics. A to Z breaks ties by id.
 */
export const sortDecor = (entries: readonly DecorEntry[], sort: DecorSort): DecorEntry[] =>
  [...entries].sort((left, right) =>
    sort === "newest"
      ? right.id - left.id
      : compareNames(leadingWord(left.name), leadingWord(right.name)) || left.id - right.id,
  );

/**
 * Every decor whose name answers `query`, best first (typos and half-typed
 * words included); a number also finds the decor with that id, ahead of
 * any name.
 */
export const searchDecor = (entries: readonly DecorEntry[], query: string): DecorEntry[] => {
  const trimmed = query.trim().replace(/^#/, "");
  const byId = /^\d+$/.test(trimmed)
    ? entries.filter((entry) => String(entry.id) === trimmed)
    : [];
  const byName =
    trimmed.length >= MIN_FUZZY_QUERY_LENGTH
      ? rankByName(entries, query, (entry) => entry.name, entries.length)
      : [];
  return byId.length > 0
    ? [...byId, ...byName.filter((entry) => !byId.includes(entry))]
    : byName;
};

/**
 * The proxy refuses a query value longer than 256 characters, and a search
 * ORs ids written `1||2||3`: ids are packed into as few values as fit.
 */
export const packIds = (ids: readonly number[], maxLength = 256): string[] => {
  const values: string[] = [];
  let current = "";
  ids.forEach((id) => {
    const next = current === "" ? String(id) : `${current}||${id}`;
    if (next.length > maxLength && current !== "") {
      values.push(current);
      current = String(id);
    } else {
      current = next;
    }
  });
  if (current !== "") {
    values.push(current);
  }
  return values;
};

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

/** Sections in this order: the house's body, its roof, then what attaches to them. */
export const FIXTURE_KINDS: readonly FixtureKind[] = [
  "base",
  "roof",
  "dormer",
  "window",
  "fortification",
  "door",
  "tower",
  "chimney",
  "unnamed",
];

export const FIXTURE_KIND_LABEL: Readonly<Record<FixtureKind, string>> = {
  base: "House bases",
  roof: "Roofs",
  dormer: "Dormers",
  window: "Windows",
  fortification: "Fortifications",
  door: "Doors and entries",
  tower: "Towers and spires",
  chimney: "Chimneys",
  unnamed: "Unnamed",
};

/** A card's caption: what one family is. */
export const FIXTURE_KIND_SINGULAR: Readonly<Record<FixtureKind, string>> = {
  base: "House base",
  roof: "Roof",
  dormer: "Dormer",
  window: "Window",
  fortification: "Fortification",
  door: "Door or entry",
  tower: "Tower or spire",
  chimney: "Chimney",
  unnamed: "Unnamed",
};

export const isFixtureKind = (value: string): value is FixtureKind =>
  (FIXTURE_KINDS as readonly string[]).includes(value);

/*
 * The part word in an English family name says what it is ("Woodland
 * Dormer", "Bell Chimney"). Fortification first: "Stone Window
 * Fortification" is one, not a window. Names with no part word are a
 * material or style ("Stone", "Cottage", "Stucco"); their records hold the
 * door, window, chimney and tower hooks, which is why they read as bases.
 */
const KIND_PATTERNS: ReadonlyArray<readonly [FixtureKind, RegExp]> = [
  ["fortification", /\bfortification\b/i],
  ["roof", /\broof\b/i],
  ["dormer", /\bdormer\b/i],
  ["window", /\bwindow\b/i],
  ["door", /\b(door|entry|entryway)\b/i],
  ["tower", /\b(tower|spire)\b/i],
  ["chimney", /\bchimney\b/i],
];

const kindOf = (englishFamily: string): FixtureKind => {
  if (englishFamily === "") {
    return "unnamed";
  }
  return KIND_PATTERNS.find(([, pattern]) => pattern.test(englishFamily))?.[0] ?? "base";
};

/** "Woodland Dormer - Forest" → ["Woodland Dormer", "Forest"]; French writes an en dash. */
const VARIANT_SEPARATOR = /\s+[-–]\s+/g;

const splitVariant = (name: string): [string, string | null] => {
  let last: RegExpExecArray | null = null;
  VARIANT_SEPARATOR.lastIndex = 0;
  for (let match = VARIANT_SEPARATOR.exec(name); match; match = VARIANT_SEPARATOR.exec(name)) {
    last = match;
  }
  if (!last || last.index === 0) {
    return [name, null];
  }
  const variant = name.slice(last.index + last[0].length).trim();
  return variant ? [name.slice(0, last.index).trim(), variant] : [name, null];
};

/**
 * Fixtures grouped into families by their English names, each family
 * labelled in the visitor's locale and sorted by name within its kind.
 * Unnamed fixtures (six on US) share one family.
 */
export const groupFixtures = (fixtures: readonly Fixture[]): FixtureFamily[] => {
  const families = new Map<string, { kind: FixtureKind; name: string; members: FixtureMember[] }>();

  fixtures.forEach((fixture) => {
    const [englishFamily, englishVariant] = splitVariant(fixture.englishName);
    const key = englishFamily.toLowerCase();
    const [localFamily, localVariant] = splitVariant(fixture.name);
    // A locale that writes the name without the separator keeps it whole as the variant.
    const variant = englishVariant === null ? null : (localVariant ?? fixture.name);
    const member: FixtureMember = { ...fixture, variant };
    const existing = families.get(key);
    if (existing) {
      existing.members.push(member);
      return;
    }
    let name = localVariant !== null || englishVariant === null ? localFamily : englishFamily;
    if (key === "") {
      name = "Unnamed fixtures";
    }
    families.set(key, { kind: kindOf(englishFamily), name, members: [member] });
  });

  return [...families.entries()]
    .map(([key, family]): FixtureFamily => {
      const members = [...family.members].sort(
        (left, right) =>
          compareNames(left.variant ?? "", right.variant ?? "") || left.id - right.id,
      );
      return {
        key,
        name: family.name,
        kind: family.kind,
        members,
        hasVariants: members.some((member) => member.variant !== null),
        searchText: [family.name, ...members.map((member) => member.variant ?? "")]
          .filter(Boolean)
          .join(" "),
      };
    })
    .sort(
      (left, right) =>
        FIXTURE_KINDS.indexOf(left.kind) - FIXTURE_KINDS.indexOf(right.kind) ||
        compareNames(left.name, right.name),
    );
};

/**
 * Families whose names answer `query`, best first; a number also finds the
 * family holding that fixture id, ahead of any name.
 */
export const searchFamilies = (
  families: readonly FixtureFamily[],
  query: string,
): FixtureFamily[] => {
  const trimmed = query.trim().replace(/^#/, "");
  const byId = /^\d+$/.test(trimmed)
    ? families.filter((family) => family.members.some((member) => String(member.id) === trimmed))
    : [];
  const byName =
    trimmed.length >= MIN_FUZZY_QUERY_LENGTH
      ? rankByName(families, query, (family) => family.searchText, families.length)
      : [];
  return byId.length > 0
    ? [...byId, ...byName.filter((family) => !byId.includes(family))]
    : byName;
};

/** "Window 16 · Door 8": hook counts as one line. */
export const formatHookCounts = (counts: readonly { type: string; count: number }[]): string =>
  counts.map((entry) => `${entry.type} ${formatNumber(entry.count)}`).join(" · ");

/**
 * What a family's members are called: colour variants, same-named versions,
 * or (for the unnamed ones, which share nothing but a missing name) fixtures.
 */
export const familyMemberNoun = (family: FixtureFamily): [one: string, many: string] => {
  if (family.hasVariants) {
    return ["variant", "variants"];
  }
  return family.kind === "unnamed" ? ["fixture", "fixtures"] : ["version", "versions"];
};

/** How a family's members read on a card: "18 versions", "6 fixtures". */
export const familyCountLabel = (family: FixtureFamily): string => {
  const count = family.members.length;
  if (count === 1) {
    return "1 fixture";
  }
  const [one, many] = familyMemberNoun(family);
  return pluralize(count, one, many);
};

/** A member's own label: its variant, or its id when the family shares one name. */
export const memberLabel = (member: FixtureMember): string =>
  member.variant ?? (member.name ? `Fixture ${member.id}` : `Unnamed fixture ${member.id}`);

/* ------------------------------------------------------------------ */
/* Rooms                                                               */
/* ------------------------------------------------------------------ */

export type RoomGroupKey = "shapes" | "connectors" | "plots" | "themed";

export type RoomGroup = {
  key: RoomGroupKey;
  title: string;
  description: string;
  rooms: Room[];
};

export const ROOM_SHAPE_LABEL: Readonly<Record<RoomShape, string>> = {
  square: "Square",
  octagon: "Octagon",
  "t-shaped": "T-shaped",
  "l-shaped": "L-shaped",
  cross: "Cross-shaped",
  circle: "Circle",
  hallway: "Hallway",
  closet: "Closet",
  entry: "Entry",
  stairwell: "Stairwell",
  plot: "Plot",
  themed: "Themed",
};

const SHAPE_ORDER: readonly RoomShape[] = [
  "square",
  "octagon",
  "t-shaped",
  "l-shaped",
  "cross",
  "circle",
  "hallway",
  "closet",
  "entry",
  "stairwell",
  "plot",
  "themed",
];

const SHAPE_PATTERNS: ReadonlyArray<readonly [RoomShape, RegExp]> = [
  ["square", /^square room\b/i],
  ["octagon", /^octagon room\b/i],
  ["t-shaped", /^t-shaped room\b/i],
  ["l-shaped", /^l-shaped room\b/i],
  ["cross", /^cross-shaped room\b/i],
  // "Daylight Circle Room": the theme word comes first, the shape after it.
  ["circle", /\bcircle room\b/i],
  ["hallway", /^hallway\b/i],
  ["closet", /^closet\b/i],
  ["entry", /^entry\b/i],
  ["stairwell", /^stairwell\b/i],
  ["plot", /\bplot\b/i],
];

const SIZES: readonly RoomSize[] = ["tiny", "small", "medium", "large"];

export const ROOM_SIZE_LABEL: Readonly<Record<RoomSize, string>> = {
  tiny: "Tiny",
  small: "Small",
  medium: "Medium",
  large: "Large",
};

/** A room's shape, size and stairwell hand from its English name; the bracketed words from its own. */
export const classifyRoom = (id: number, name: string, englishName: string): Room => {
  const shape = SHAPE_PATTERNS.find(([, pattern]) => pattern.test(englishName))?.[0] ?? "themed";
  const sizeWord = /\b(tiny|small|medium|large)\b/i.exec(englishName)?.[1]?.toLowerCase();
  const size = SIZES.find((entry) => entry === sizeWord);
  const hand = /\(left\)/i.test(englishName)
    ? "left"
    : /\(right\)/i.test(englishName)
      ? "right"
      : undefined;
  const qualifier = /\(([^)]+)\)\s*$/.exec(name)?.[1]?.trim();
  return {
    id,
    name,
    englishName,
    shape,
    // A themed room's name may hold a size word that is not its size ("Small Study").
    size: shape === "themed" ? undefined : size,
    hand,
    qualifier: qualifier || undefined,
  };
};

/** The bracketed words, else the size word: what tells a room from its siblings. */
export const roomQualifier = (room: Room): string | undefined =>
  room.qualifier ?? (room.size ? ROOM_SIZE_LABEL[room.size] : undefined);

const compareRooms = (left: Room, right: Room): number =>
  SHAPE_ORDER.indexOf(left.shape) - SHAPE_ORDER.indexOf(right.shape) ||
  (left.size ? SIZES.indexOf(left.size) : -1) - (right.size ? SIZES.indexOf(right.size) : -1) ||
  compareNames(left.name, right.name) ||
  left.id - right.id;

const GROUP_OF: Readonly<Record<RoomShape, RoomGroupKey>> = {
  square: "shapes",
  octagon: "shapes",
  "t-shaped": "shapes",
  "l-shaped": "shapes",
  cross: "shapes",
  circle: "shapes",
  hallway: "connectors",
  closet: "connectors",
  entry: "connectors",
  stairwell: "connectors",
  plot: "plots",
  themed: "themed",
};

const GROUP_COPY: ReadonlyArray<Omit<RoomGroup, "rooms">> = [
  {
    key: "shapes",
    title: "Room shapes",
    description: "Rooms by the shape their names give, each shape smallest first.",
  },
  {
    key: "connectors",
    title: "Halls, closets, entries and stairs",
    description: "Hallways, the closet, entries and stairwells, read from their names.",
  },
  {
    key: "plots",
    title: "Plots",
    description: "Blizzard lists a plot among its rooms.",
  },
  {
    key: "themed",
    title: "Themed rooms",
    description: "Rooms with a name of their own, A to Z.",
  },
];

/** Rooms in their groups (empty groups left out), each sorted for reading. */
export const groupRooms = (rooms: readonly Room[]): RoomGroup[] => {
  const sorted = [...rooms].sort(compareRooms);
  return GROUP_COPY.map((group) => ({
    ...group,
    rooms: sorted.filter((room) => GROUP_OF[room.shape] === group.key),
  })).filter((group) => group.rooms.length > 0);
};

/** The other rooms of a plain shape (the four squares), smallest first. */
export const siblingRooms = (rooms: readonly Room[], room: Room): Room[] =>
  room.shape === "themed"
    ? []
    : rooms.filter((entry) => entry.shape === room.shape).sort(compareRooms);
