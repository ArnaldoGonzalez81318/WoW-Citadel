import { blizzardClient } from "@/lib/blizzardClient";
import { localized, namespace, optional404 } from "@/lib/blizzardHelpers";
import type {
  LocalizedString,
  Neighborhood,
  NeighborhoodMap,
} from "@/features/neighborhoods/types";

/*
 * Everything Blizzard's neighborhood API holds (checked on US, EU, KR, TW):
 *
 *   neighborhood-map/index                    the maps: id and name only
 *   neighborhood-map/{map}/neighborhood/{n}   one neighborhood: name and map
 *
 * Both live in the DYNAMIC namespace (static answers 404, whatever the API
 * catalog says). There is no list or search of neighborhoods, no media,
 * and nothing about plots, houses or residents.
 *
 * Neighborhoods are numbered from 1 per region across every map at once
 * (No. 2001 is in Razorwind Shores, No. 2002 in Founder's Point), and the
 * numbers run almost without gaps up to the newest: about 45,700 on US in
 * October 2026, with every sampled number below that taken. A number asked
 * of the wrong map is a 404, exactly like one nobody has founded yet, so
 * telling the two apart means asking every map.
 */

type Reference = { id?: number; name?: LocalizedString };

type MapIndexResponse = {
  maps?: Reference[];
};

type NeighborhoodResponse = {
  id?: number;
  neighborhood_name?: LocalizedString;
  neighborhood_map?: Reference;
};

/** One register page: 25 consecutive numbers. */
export const NUMBERS_PER_PAGE = 25;

/** "77-19-75": a name Blizzard returns as a code. (A player could type one, too; rare enough.) */
const NAME_CODE = /^\d+(?:-\d+)+$/u;

/* ------------------------------------------------------------------ */
/* Requests                                                            */
/* ------------------------------------------------------------------ */

/** Every neighborhood map, in id order (the order Blizzard added them). */
export const fetchNeighborhoodMaps = async (
  signal?: AbortSignal,
): Promise<NeighborhoodMap[]> => {
  const response = await blizzardClient.get<MapIndexResponse>(
    "/data/wow/neighborhood-map/index",
    { namespace: namespace("dynamic") },
    { signal },
  );

  return (response.maps ?? [])
    .filter((entry): entry is Reference & { id: number } => typeof entry.id === "number")
    .map((entry) => ({
      id: entry.id,
      name: localized(entry.name) || `Map ${entry.id}`,
    }))
    .sort((left, right) => left.id - right.id);
};

/**
 * Neighborhood `number` if it is on map `mapId`, else null. The 404 is the
 * common answer (half of all numbers are on the other map), so it is data
 * here; every other failure propagates for the app's retry policy.
 */
export const fetchNeighborhood = async (
  mapId: number,
  number: number,
  signal?: AbortSignal,
): Promise<Neighborhood | null> => {
  const response = await optional404(() =>
    blizzardClient.get<NeighborhoodResponse | undefined>(
      `/data/wow/neighborhood-map/${mapId}/neighborhood/${number}`,
      { namespace: namespace("dynamic") },
      { signal },
    ),
  );
  if (!response) {
    return null;
  }

  const name = localized(response.neighborhood_name).trim();
  const map = response.neighborhood_map;
  return {
    id: number,
    name: name || "Unnamed neighborhood",
    nameIsCode: NAME_CODE.test(name),
    mapId: typeof map?.id === "number" ? map.id : mapId,
    mapName: localized(map?.name) || `Map ${mapId}`,
  };
};

/* ------------------------------------------------------------------ */
/* Register pages                                                      */
/* ------------------------------------------------------------------ */

/** The register page holding `number` (pages count up from No. 1). */
export const pageOf = (number: number): number =>
  Math.max(1, Math.ceil(number / NUMBERS_PER_PAGE));

/** The first and last number on register page `page`. */
export const pageRange = (page: number): { first: number; last: number } => {
  const first = (Math.max(1, page) - 1) * NUMBERS_PER_PAGE + 1;
  return { first, last: first + NUMBERS_PER_PAGE - 1 };
};

/** The 25 numbers on register page `page`, in order. */
export const pageNumbers = (page: number): number[] => {
  const { first } = pageRange(page);
  return Array.from({ length: NUMBERS_PER_PAGE }, (_, index) => first + index);
};

/* ------------------------------------------------------------------ */
/* The newest number                                                   */
/* ------------------------------------------------------------------ */

/**
 * Probes per round. Each asks every map (two today), so a round is six
 * requests: the page's whole in-flight budget, spent at once.
 */
const PROBES_PER_ROUND = 3;
/** US sits between the last two; a younger region misses all three. */
const FIRST_GUESSES: readonly number[] = [16_384, 32_768, 65_536];
const GUESS_GROWTH = 8;
/** Far beyond any region; stops a misbehaving API from galloping forever. */
const MAX_NUMBER = 2 ** 24;

/*
 * Each round folds into the bracket the same way: the highest hit becomes
 * the floor, the first miss above it the ceiling. Using the highest hit
 * (not the first miss) keeps a gap left by a deleted neighborhood from
 * pulling the answer down.
 */
const highestHit = (
  points: readonly number[],
  hits: readonly boolean[],
  floor: number,
): number =>
  points.reduce((best, point, index) => (hits[index] && point > best ? point : best), floor);

const firstMissAbove = (
  points: readonly number[],
  hits: readonly boolean[],
  floor: number,
): number | undefined => points.find((point, index) => !hits[index] && point > floor);

/** A number that exists (0: none yet) and one above it that does not; null when nothing misses. */
const bracketNewest = async (
  exists: (number: number) => Promise<boolean>,
): Promise<[number, number | null]> => {
  let low = 0;
  let guesses = [...FIRST_GUESSES];
  while (guesses[0] <= MAX_NUMBER) {
    const hits = await Promise.all(guesses.map(exists));
    low = highestHit(guesses, hits, low);
    const high = firstMissAbove(guesses, hits, low);
    if (high !== undefined) {
      return [low, high];
    }
    guesses = guesses.map((guess) => guess * GUESS_GROWTH);
  }
  return [low, null];
};

/**
 * The highest number any map has a neighborhood for (0 when none), which is
 * also how many neighborhoods a region has, give or take a few gaps.
 * Blizzard publishes no count, so this brackets it with three guesses, then
 * splits the bracket into quarters each round: about nine rounds on US
 * where a plain binary search would take eighteen, one after another.
 */
export const findNewestNumber = async (
  exists: (number: number) => Promise<boolean>,
): Promise<number> => {
  const [floor, ceiling] = await bracketNewest(exists);
  if (ceiling === null) {
    return floor;
  }

  let low = floor;
  let high = ceiling;
  while (high - low > 1) {
    const bottom = low;
    const top = high;
    const span = top - bottom;
    const points = Array.from(
      new Set(
        Array.from(
          { length: PROBES_PER_ROUND },
          (_, index) => bottom + Math.floor((span * (index + 1)) / (PROBES_PER_ROUND + 1)),
        ),
      ),
    ).filter((point) => point > bottom && point < top);
    const hits = await Promise.all(points.map(exists));
    low = highestHit(points, hits, bottom);
    high = firstMissAbove(points, hits, low) ?? top;
  }

  return low;
};

/** Numbers checked at once while walking down to a map's newest neighborhood. */
const NEWEST_SCAN_BATCH = 5;
/** Half of all numbers are on each map; this far down without a hit, give up. */
const NEWEST_SCAN_LIMIT = 100;

/**
 * The highest-numbered neighborhood on one map at or below `from` (the
 * region's newest number), walking down five numbers at a time. With the
 * maps sharing the numbers about evenly, the first batch almost always has
 * one; the last register page asks for the same numbers, so they are often
 * already cached.
 */
export const findNewestInMap = async (
  lookup: (number: number) => Promise<Neighborhood | null>,
  from: number,
): Promise<Neighborhood | null> => {
  const bottom = Math.max(1, from - NEWEST_SCAN_LIMIT + 1);
  for (let top = from; top >= bottom; top -= NEWEST_SCAN_BATCH) {
    const numbers: number[] = [];
    for (let number = top; number > top - NEWEST_SCAN_BATCH && number >= bottom; number -= 1) {
      numbers.push(number);
    }
    const records = await Promise.all(numbers.map(lookup));
    const found = records.find((record) => record !== null);
    if (found) {
      return found;
    }
  }
  return null;
};
