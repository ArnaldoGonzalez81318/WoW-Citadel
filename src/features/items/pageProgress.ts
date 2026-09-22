import { formatNumber } from "@/lib/format";

/**
 * "page 1 of 2" for a paged search whose response carries a page count but
 * no total (Blizzard's `/search/*` past the first page). Undefined when the
 * page count is unknown or there is a single page, in which case the count
 * itself is exact and the summary needs no page copy.
 */
export const formatPageProgress = (
  loadedPages: number,
  pageCount: number | undefined,
): string | undefined =>
  pageCount !== undefined && pageCount > 1 && loadedPages > 0
    ? `page ${formatNumber(Math.min(loadedPages, pageCount))} of ${formatNumber(
        pageCount,
      )}`
    : undefined;
