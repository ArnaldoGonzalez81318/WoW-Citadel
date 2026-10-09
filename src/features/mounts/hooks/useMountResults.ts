import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";

import {
  PAGE_STALE_MS,
  STATIC_STALE_MS,
  mountIndexQuery,
  mountKeys,
} from "@/features/mounts/hooks/mountQueries";
import useHeldError from "@/features/mounts/hooks/useHeldError";
import {
  MOUNT_PAGE_SIZE,
  fetchMountRecords,
  isPlaceholderName,
  searchMountPage,
} from "@/features/mounts/services/mountService";
import type {
  MountFactionType,
  MountFilterCriteria,
  MountIndexEntry,
  MountSort,
  MountSummary,
} from "@/features/mounts/types";
import { sortByName } from "@/lib/blizzardHelpers";
import { rankByName } from "@/lib/fuzzyMatch";

/**
 * Closest names a search fetches records for: four pages, three requests
 * (an OR of ids fits about 40 to a request). Past that the names are fuzzy
 * long shots, and the summary says the list stops there.
 */
export const MATCH_LIMIT = 96;

export type MountResultsCriteria = {
  /** Trimmed, and either "" or long enough to rank names on. */
  query: string;
  source: string | null;
  faction: MountFactionType | null;
  sort: MountSort;
  /** As requested (1-based); the hook clamps what it shows. */
  page: number;
};

/** Where the visible page comes from. */
export type MountResultsMode = "index" | "matches" | "filtered";

type Plan =
  /** No search, no filter: a page of the sorted index, records by id. */
  | { kind: "page"; entries: MountIndexEntry[] }
  /** A name search: every match's record, filtered and paged here. */
  | { kind: "matches"; entries: MountIndexEntry[] }
  /** Source and/or faction: Blizzard filters, sorts and pages. */
  | { kind: "filtered"; criteria: MountFilterCriteria; page: number };

type ResultsData =
  | { kind: "page"; mounts: MountSummary[] }
  | { kind: "matches"; mounts: MountSummary[] }
  | { kind: "filtered"; mounts: MountSummary[]; pageCount: number };

const IDLE_KEY = ["mounts", "results", "idle"] as const;

const planKey = (plan: Plan | null) => {
  if (plan === null) {
    return IDLE_KEY;
  }
  if (plan.kind === "filtered") {
    return mountKeys.searchPage(plan.criteria, plan.page);
  }
  return mountKeys.records(
    plan.kind,
    plan.entries.map((entry) => entry.id),
  );
};

const runPlan = async (plan: Plan, signal: AbortSignal): Promise<ResultsData> => {
  if (plan.kind === "filtered") {
    const page = await searchMountPage(plan.criteria, plan.page, signal);
    return { kind: "filtered", mounts: page.mounts, pageCount: page.pageCount };
  }
  return { kind: plan.kind, mounts: await fetchMountRecords(plan.entries, signal) };
};

const byNewest = (left: { id: number }, right: { id: number }): number => right.id - left.id;

/**
 * Blizzard's unfinished [PH]/[DND] records after every real mount (a stable
 * sort, so each side keeps the order it had): they have no render, and the
 * newest of them would otherwise fill the landing page's first row.
 */
const placeholdersLast = <T extends { name: string }>(items: T[]): T[] =>
  items.sort(
    (left, right) => Number(isPlaceholderName(left.name)) - Number(isPlaceholderName(right.name)),
  );

const pageCountOf = (total: number): number => Math.ceil(total / MOUNT_PAGE_SIZE);

export type MountResults = {
  index: UseQueryResult<MountIndexEntry[]>;
  mode: MountResultsMode;
  /** The page on screen (the previous one, dimmed, while `placeholder`). */
  mounts: MountSummary[];
  /** The page shown, clamped to the pages there are. */
  page: number;
  /** Pages of what is on screen; 0 when nothing matched. */
  pageCount: number;
  /**
   * The current criteria's page count once it is known (undefined while it
   * loads, or while the previous results stand in): what a page past the end
   * steps back to.
   */
  settledPageCount: number | undefined;
  /** Every match, when this page knows it (index and name search). */
  total: number | undefined;
  /** A name search found more than MATCH_LIMIT names. */
  truncated: boolean;
  /** Per source, the name search's matches (of the chosen faction). */
  matchSourceCounts: Record<string, number> | undefined;
  /** Nothing to show yet. */
  loading: boolean;
  /** The previous results stand in while these load. */
  placeholder: boolean;
  fetching: boolean;
  /** A failure with nothing to show in its place. */
  error: Error | null;
  /**
   * The index's failure, held while its Retry runs. `error` carries it where
   * the list needs the index; a filtered list does not, so it is reported
   * elsewhere then.
   */
  indexError: Error | null;
  retry: () => void;
};

/**
 * The mount list for the current criteria, from whichever source can serve
 * it: the sorted index (paged here, so all 1,676 mounts are reachable past
 * the search's 1,000-match cap), the index ranked against a name search, or
 * Blizzard's filtered search. One query carries all three, so the previous
 * page stays up (dimmed) while the next page of the same kind of list loads
 * instead of collapsing to skeletons.
 */
const useMountResults = (criteria: MountResultsCriteria): MountResults => {
  const { query, source, faction, sort, page: requestedPage } = criteria;
  const indexQuery = useQuery(mountIndexQuery());
  const index = indexQuery.data;

  const browsingAll = query === "" && source === null && faction === null;
  const indexPageCount = index ? pageCountOf(index.length) : 0;

  // Sorted once per index (and only in the order asked for).
  const newestFirst = useMemo(
    () => (index ? placeholdersLast([...index].sort(byNewest)) : undefined),
    [index],
  );
  const nameFirst = useMemo(
    () => (index && browsingAll && sort === "name" ? placeholdersLast(sortByName(index)) : undefined),
    [index, browsingAll, sort],
  );

  const ranked = useMemo(() => {
    if (!index || query === "") {
      return undefined;
    }
    const found = rankByName(index, query, (entry) => entry.name, MATCH_LIMIT + 1);
    return { entries: found.slice(0, MATCH_LIMIT), truncated: found.length > MATCH_LIMIT };
  }, [index, query]);

  const plan = useMemo((): Plan | null => {
    if (query !== "") {
      return ranked ? { kind: "matches", entries: ranked.entries } : null;
    }
    if (!browsingAll) {
      return {
        kind: "filtered",
        criteria: { source, faction, sort: sort === "name" ? "name" : "newest" },
        page: requestedPage,
      };
    }
    const sorted = sort === "name" ? nameFirst : newestFirst;
    if (!sorted) {
      return null;
    }
    const page = Math.min(requestedPage, Math.max(1, indexPageCount));
    return {
      kind: "page",
      entries: sorted.slice((page - 1) * MOUNT_PAGE_SIZE, page * MOUNT_PAGE_SIZE),
    };
  }, [
    query,
    ranked,
    browsingAll,
    source,
    faction,
    sort,
    requestedPage,
    nameFirst,
    newestFirst,
    indexPageCount,
  ]);

  const resultsQuery = useQuery({
    queryKey: planKey(plan),
    queryFn: ({ signal }): Promise<ResultsData> => {
      if (plan === null) {
        // Never runs: the query is disabled without a plan.
        return Promise.reject(new Error("No mount list to load"));
      }
      return runPlan(plan, signal);
    },
    enabled: plan !== null,
    staleTime: plan?.kind === "filtered" ? PAGE_STALE_MS : STATIC_STALE_MS,
    // The previous page stands in only for the same kind of list. A search's
    // matches kept across a cleared search (or "More Vendor mounts") would be
    // re-filtered by the new criteria into a list that does not exist.
    placeholderData: (previous) =>
      previous !== undefined && plan !== null && previous.kind === plan.kind ? previous : undefined,
  });

  // Placeholder data only stands in for results that were on screen.
  // react-query hands over the last query that had data, even when an error
  // or a wait on the index came in between, and that must not come back
  // under new criteria.
  const shownRef = useRef(false);
  const data =
    plan !== null && (!resultsQuery.isPlaceholderData || shownRef.current)
      ? resultsQuery.data
      : undefined;
  useEffect(() => {
    shownRef.current = data !== undefined;
  });
  const placeholder = data !== undefined && resultsQuery.isPlaceholderData;

  // A name search's matches are filtered, counted, sorted and paged here.
  const matchView = useMemo(() => {
    if (data?.kind !== "matches") {
      return undefined;
    }
    const ofFaction = faction
      ? data.mounts.filter((mount) => mount.faction?.type === faction)
      : data.mounts;
    const sourceCounts: Record<string, number> = {};
    ofFaction.forEach((mount) => {
      if (mount.source) {
        sourceCounts[mount.source.type] = (sourceCounts[mount.source.type] ?? 0) + 1;
      }
    });
    const kept = source
      ? ofFaction.filter((mount) => mount.source?.type === source)
      : ofFaction;
    // "match" keeps the ranking (the records come back in the order asked for).
    const ordered =
      sort === "name"
        ? placeholdersLast(sortByName(kept))
        : sort === "newest"
          ? placeholdersLast([...kept].sort(byNewest))
          : kept;
    return { ordered, sourceCounts };
  }, [data, faction, source, sort]);

  let mounts: MountSummary[] = [];
  let pageCount = 0;
  let total: number | undefined;
  let page = requestedPage;
  if (data?.kind === "page") {
    pageCount = indexPageCount;
    total = index?.length;
    page = Math.min(requestedPage, Math.max(1, pageCount));
    mounts = data.mounts;
  } else if (data?.kind === "filtered") {
    pageCount = data.pageCount;
    page = Math.min(requestedPage, Math.max(1, pageCount));
    mounts = data.mounts;
  } else if (matchView) {
    total = matchView.ordered.length;
    pageCount = pageCountOf(total);
    page = Math.min(requestedPage, Math.max(1, pageCount));
    mounts = matchView.ordered.slice((page - 1) * MOUNT_PAGE_SIZE, page * MOUNT_PAGE_SIZE);
  }

  const current = data !== undefined && !placeholder;
  let settledPageCount: number | undefined;
  if (plan?.kind === "page") {
    settledPageCount = indexPageCount;
  } else if (current && data.kind === "filtered") {
    settledPageCount = data.pageCount;
  } else if (current && matchView) {
    settledPageCount = pageCountOf(matchView.ordered.length);
  }

  const mode: MountResultsMode =
    query !== "" ? "matches" : browsingAll ? "index" : "filtered";

  // The index is what the unfiltered list and a name search are built
  // from; a filtered list does not need it.
  const indexError = useHeldError(indexQuery.error, indexQuery.isFetching, "index");
  const resultsError = useHeldError(
    resultsQuery.error,
    resultsQuery.isFetching,
    JSON.stringify(planKey(plan)),
  );
  const indexFailed = plan === null && indexError !== null;
  const error = indexFailed ? indexError : data === undefined ? resultsError : null;

  const { refetch: refetchIndex } = indexQuery;
  const { refetch: refetchResults } = resultsQuery;
  const retry = (): void => {
    if (indexFailed) {
      void refetchIndex();
      return;
    }
    void refetchResults();
  };

  return {
    index: indexQuery,
    mode,
    mounts,
    page,
    pageCount,
    settledPageCount,
    total,
    truncated: ranked?.truncated ?? false,
    matchSourceCounts: current ? matchView?.sourceCounts : undefined,
    loading: data === undefined && error === null,
    placeholder,
    fetching: resultsQuery.isFetching,
    error,
    indexError,
    retry,
  };
};

export default useMountResults;
