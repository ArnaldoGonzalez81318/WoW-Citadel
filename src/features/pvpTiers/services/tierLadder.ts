import type {
  PvpBracketLadder,
  PvpBracketMeta,
  PvpRatingScale,
  PvpTier,
  PvpTierMatrix,
  PvpTierMatrixRow,
} from "@/features/pvpTiers/types";
import { humanizeEnum } from "@/lib/format";

/*
 * Blizzard lists every rank once per bracket (45 tiers on US: nine ranks for
 * each of five brackets) and nothing in the index says which bracket a tier
 * belongs to: that only comes with each tier's record. These helpers turn
 * the loaded records into one ladder per bracket and a rank × bracket matrix.
 *
 * Two quirks shape them:
 *   - the top tier (Elite) reports `max_rating: 0`: it has no ceiling;
 *   - neighbouring ranges overlap (Combatant I 975–1200, Combatant II
 *     1175–1400), so tiers sort by floor, then ceiling.
 */

/**
 * The brackets the page knows by name, in Blizzard's own bracket-id order
 * (0, 1, 3, 6, 8). A type Blizzard adds later still shows, after these,
 * under its humanised enum name.
 */
export const KNOWN_BRACKETS: readonly PvpBracketMeta[] = [
  { type: "ARENA_2v2", slug: "2v2", label: "2v2", title: "2v2 Arena" },
  { type: "ARENA_3v3", slug: "3v3", label: "3v3", title: "3v3 Arena" },
  {
    type: "BATTLEGROUNDS",
    slug: "rbg",
    label: "Rated BGs",
    title: "Rated Battlegrounds",
  },
  { type: "SHUFFLE", slug: "shuffle", label: "Solo Shuffle", title: "Solo Shuffle" },
  { type: "BLITZ", slug: "blitz", label: "Blitz", title: "Battleground Blitz" },
];

/** Tiers Blizzard sends without a bracket. */
const NO_BRACKET = "UNKNOWN";

export const bracketMeta = (type: string): PvpBracketMeta => {
  const known = KNOWN_BRACKETS.find((bracket) => bracket.type === type);
  if (known) {
    return known;
  }
  const label = type === NO_BRACKET ? "Other" : humanizeEnum(type) || type;
  return { type, slug: type.toLowerCase(), label, title: label };
};

const bracketOrder = (type: string): number => {
  const index = KNOWN_BRACKETS.findIndex((bracket) => bracket.type === type);
  return index === -1 ? KNOWN_BRACKETS.length : index;
};

const byBracket = (left: string, right: string): number =>
  bracketOrder(left) - bracketOrder(right) || left.localeCompare(right);

export const bracketTypeOf = (tier: PvpTier): string =>
  tier.bracketType || NO_BRACKET;

/** No ceiling: Elite reports `max_rating: 0`. */
export const isOpenEnded = (
  tier: Pick<PvpTier, "minRating" | "maxRating">,
): boolean => tier.maxRating <= tier.minRating;

const ceilingOf = (tier: PvpTier): number =>
  isOpenEnded(tier) ? Number.POSITIVE_INFINITY : tier.maxRating;

const byRating = (left: PvpTier, right: PvpTier): number =>
  left.minRating - right.minRating ||
  ceilingOf(left) - ceilingOf(right) ||
  left.name.localeCompare(right.name);

/** Blizzard's rating type 0 is the unrated starting tier. */
export const isUnrated = (tier: PvpTier): boolean => tier.ratingType === 0;

/* ------------------------------------------------------------------ */
/* Ladders                                                             */
/* ------------------------------------------------------------------ */

const SCALE_STEP = 100;
/** Room past the top edge so an open-ended tier's bar has length to fade out in. */
const OPEN_HEADROOM = 0.12;

const ratingScale = (tiers: readonly PvpTier[]): PvpRatingScale => {
  if (tiers.length === 0) {
    return { min: 0, max: SCALE_STEP, top: SCALE_STEP, openEnded: false };
  }
  const min = Math.min(...tiers.map((tier) => tier.minRating));
  const top = Math.max(
    ...tiers.flatMap((tier) =>
      isOpenEnded(tier) ? [tier.minRating] : [tier.minRating, tier.maxRating],
    ),
  );
  const openEnded = tiers.some(isOpenEnded);
  const span = Math.max(top - min, SCALE_STEP);
  const max = openEnded
    ? Math.ceil((top + span * OPEN_HEADROOM) / SCALE_STEP) * SCALE_STEP
    : top;
  return { min, max: Math.max(max, min + SCALE_STEP), top, openEnded };
};

/** Where `value` sits on the scale, 0–100. */
export const scalePercent = (value: number, scale: PvpRatingScale): number => {
  const span = scale.max - scale.min;
  if (span <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, ((value - scale.min) / span) * 100));
};

/** 25 when every neighbouring pair overlaps by 25; null when they differ or do not overlap. */
const overlapOf = (tiers: readonly PvpTier[]): number | null => {
  const overlaps = tiers.slice(1).map((tier, index) => {
    const previous = tiers[index];
    return isOpenEnded(previous) ? 0 : previous.maxRating - tier.minRating;
  });
  const [first] = overlaps;
  return first !== undefined &&
    first > 0 &&
    overlaps.every((overlap) => overlap === first)
    ? first
    : null;
};

/** One ladder per bracket, brackets in Blizzard's order, tiers lowest first. */
export const buildLadders = (tiers: readonly PvpTier[]): PvpBracketLadder[] => {
  const groups = new Map<string, PvpTier[]>();
  tiers.forEach((tier) => {
    const type = bracketTypeOf(tier);
    const group = groups.get(type);
    if (group) {
      group.push(tier);
    } else {
      groups.set(type, [tier]);
    }
  });

  return Array.from(groups.keys())
    .sort(byBracket)
    .map((type) => {
      const sorted = [...(groups.get(type) ?? [])].sort(byRating);
      return {
        meta: bracketMeta(type),
        tiers: sorted,
        scale: ratingScale(sorted),
        uniformOverlap: overlapOf(sorted),
      };
    });
};

/**
 * A `bracket` URL value -> Blizzard's type, for known and discovered
 * brackets. Case-insensitive, and Blizzard's own type ("SHUFFLE") works too;
 * the page then rewrites the URL to the short slug.
 */
export const bracketTypeFromSlug = (
  slug: string,
  ladders: readonly PvpBracketLadder[],
): string | null => {
  const wanted = slug.trim().toLowerCase();
  if (wanted === "") {
    return null;
  }
  const matches = (meta: PvpBracketMeta): boolean =>
    meta.slug === wanted || meta.type.toLowerCase() === wanted;
  return (
    KNOWN_BRACKETS.find(matches)?.type ??
    ladders.find((ladder) => matches(ladder.meta))?.meta.type ??
    null
  );
};

/* ------------------------------------------------------------------ */
/* Rank × bracket matrix                                               */
/* ------------------------------------------------------------------ */

/** `rating_type` is the rank itself (1 = Combatant I in every bracket). */
const rankKey = (tier: PvpTier): string =>
  typeof tier.ratingType === "number"
    ? `rating-type-${tier.ratingType}`
    : `name-${tier.name}`;

const rangeSignature = (tier: PvpTier): string =>
  `${tier.minRating}:${isOpenEnded(tier) ? "open" : tier.maxRating}`;

/** Cells whose range is not the row's most common one (none when they all agree). */
const outliersOf = (cells: ReadonlyMap<string, PvpTier>): Set<string> => {
  const counts = new Map<string, number>();
  cells.forEach((tier) => {
    const signature = rangeSignature(tier);
    counts.set(signature, (counts.get(signature) ?? 0) + 1);
  });
  if (counts.size < 2) {
    return new Set();
  }
  const [common] = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
  return new Set(
    [...cells.entries()]
      .filter(([, tier]) => rangeSignature(tier) !== common)
      .map(([type]) => type),
  );
};

export const buildMatrix = (
  ladders: readonly PvpBracketLadder[],
): PvpTierMatrix => {
  const rows = new Map<
    string,
    { name: string; floor: number; cells: Map<string, PvpTier> }
  >();

  ladders.forEach((ladder) => {
    ladder.tiers.forEach((tier) => {
      const key = rankKey(tier);
      const row = rows.get(key);
      if (row) {
        row.cells.set(ladder.meta.type, tier);
        row.floor = Math.min(row.floor, tier.minRating);
      } else {
        rows.set(key, {
          name: tier.name,
          floor: tier.minRating,
          cells: new Map([[ladder.meta.type, tier]]),
        });
      }
    });
  });

  const matrixRows: PvpTierMatrixRow[] = [...rows.entries()]
    .sort(
      ([, left], [, right]) =>
        left.floor - right.floor || left.name.localeCompare(right.name),
    )
    .map(([key, row]) => ({
      key,
      name: row.name,
      cells: row.cells,
      outliers: outliersOf(row.cells),
    }));

  return {
    brackets: ladders.map((ladder) => ladder.meta),
    rows: matrixRows,
    uniform:
      matrixRows.length > 0 &&
      matrixRows.every(
        (row) => row.cells.size === ladders.length && row.outliers.size === 0,
      ),
  };
};

/**
 * The tier whose icon stands for a matrix row: the selected bracket's, so
 * the row shares the icon the ladder above already fetched (Blizzard gives a
 * rank the same icon in every bracket), else the first bracket listing it.
 */
export const rowIconTier = (
  row: PvpTierMatrixRow,
  selectedType: string | null,
): PvpTier | undefined =>
  (selectedType !== null ? row.cells.get(selectedType) : undefined) ??
  Array.from(row.cells.values())[0];
