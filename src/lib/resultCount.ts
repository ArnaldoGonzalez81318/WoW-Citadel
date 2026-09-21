import { formatNumber } from "@/lib/format";

/**
 * Blizzard's search endpoints (`/data/wow/search/*`) page through at most
 * this many results; past it the response carries `resultCountCapped: true`
 * and `pageCount` stops growing.
 */
export const SEARCH_RESULT_CAP = 1000;

/** The paging fields a Blizzard search response may carry. */
export type SearchPageMeta = {
  pageCount?: number;
  resultCountTotal?: number;
  resultCountCapped?: boolean;
};

export type ResultCount = {
  /** Exact number of results, only when the response lets us know it. */
  total?: number;
  /** Blizzard truncated the result set at SEARCH_RESULT_CAP. */
  capped: boolean;
};

/**
 * What a search response lets us say about the size of its result set.
 *
 * Blizzard sends `pageCount` but (apart from the occasional
 * `resultCountTotal`) no total, so the count is exact only when the page is
 * the whole result set. Multi-page responses leave `total` undefined rather
 * than guessing; the UI then says "more available" or, when `capped`,
 * "1,000+".
 */
export const describeResultCount = (
  meta: SearchPageMeta,
  pageLength: number,
): ResultCount => ({
  total:
    typeof meta.resultCountTotal === "number"
      ? meta.resultCountTotal
      : (meta.pageCount ?? 1) <= 1
        ? pageLength
        : undefined,
  capped: meta.resultCountCapped === true,
});

export type ResultCountCopyInput = {
  /** Results rendered so far. */
  loaded: number;
  /** Exact result count when known (see describeResultCount). */
  total?: number;
  /** Blizzard truncated the result set (SEARCH_RESULT_CAP). */
  capped?: boolean;
  /** More pages exist beyond `loaded`. */
  hasMore: boolean;
  /** Plural noun for the status line, e.g. "items". */
  noun: string;
};

/**
 * The result-set size as it can honestly be stated: the exact total when
 * known (or once every page is loaded), "1,000+" while Blizzard's cap hides
 * the real size, otherwise undefined.
 */
export const formatResultTotal = ({
  loaded,
  total,
  capped = false,
  hasMore,
}: Omit<ResultCountCopyInput, "noun">): string | undefined => {
  if (typeof total === "number") {
    return formatNumber(total);
  }
  if (loaded === 0) {
    return undefined;
  }
  if (!hasMore) {
    return formatNumber(loaded);
  }
  return capped ? `${formatNumber(SEARCH_RESULT_CAP)}+` : undefined;
};

/** Filter-bar summary: "Showing 24 of 1,204", or "Showing 48" when the total is unknown. */
export const formatResultSummary = (
  input: Omit<ResultCountCopyInput, "noun">,
): string => {
  const total = formatResultTotal(input);
  const loaded = formatNumber(input.loaded);
  return total ? `Showing ${loaded} of ${total}` : `Showing ${loaded}`;
};

/**
 * Infinite-scroll status: "48 of 1,204 items loaded",
 * "48 items loaded · more available", or "All 96 items loaded".
 */
export const formatLoadedStatus = (input: ResultCountCopyInput): string => {
  const loaded = formatNumber(input.loaded);
  if (!input.hasMore) {
    return `All ${loaded} ${input.noun} loaded`;
  }
  const total = formatResultTotal(input);
  return total
    ? `${loaded} of ${total} ${input.noun} loaded`
    : `${loaded} ${input.noun} loaded · more available`;
};
