import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { useConnectedRealmCatalog } from "@/features/connectedRealms/hooks/useConnectedRealmSnapshots";
import type { ConnectedRealmSnapshot } from "@/features/connectedRealms/types";
import {
  fetchAllRealms,
  isInternalRealm,
} from "@/features/realms/services/realmService";
import type {
  RealmDirectoryRow,
  RealmSummary,
} from "@/features/realms/types";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import { formatTimezone, humanizeEnum } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type RealmSortKey =
  | "name"
  | "type"
  | "category"
  | "timezone"
  | "locale"
  | "status";

export type RealmSortDirection = "asc" | "desc";

export type RealmSort = `${RealmSortKey}-${RealmSortDirection}`;

export const DEFAULT_REALM_SORT: RealmSort = "name-asc";

export type RealmFilterKey = "q" | "type" | "category" | "timezone";

export type RealmFilters = Record<RealmFilterKey, string> & {
  /** "1" shows Blizzard-internal realms. */
  internal: string;
};

export type RealmFacetOption = {
  value: string;
  label: string;
  count: number;
};

export type RealmFacets = {
  types: RealmFacetOption[];
  categories: RealmFacetOption[];
  timezones: RealmFacetOption[];
};

export type RealmDirectory = {
  rows: RealmDirectoryRow[];
  /** Realms in the catalog (after the internal filter). */
  total: number;
  visibleCount: number;
  facets: RealmFacets;
  /** Full/high-population realms of this region, at most six. */
  quickPicks: RealmDirectoryRow[];
  sort: RealmSort;
  setSort: (sort: RealmSort) => void;
  filters: RealmFilters;
  setFilter: (key: keyof RealmFilters, value: string | null) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
  /** The connected-realm join is still loading (status cells only). */
  statusPending: boolean;
};

/* ------------------------------------------------------------------ */
/* Catalog query                                                       */
/* ------------------------------------------------------------------ */

const CATALOG_STALE_TIME = 30 * 60_000;
const CATALOG_GC_TIME = 60 * 60_000;
const QUICK_PICK_LIMIT = 6;
const QUICK_PICK_TIERS: ReadonlySet<string> = new Set(["FULL", "HIGH"]);

export const realmCatalogQueryKey = (): readonly [
  "realm-catalog",
  string,
  string,
] => ["realm-catalog", env.region, env.locale] as const;

export const useRealmCatalog = (): UseQueryResult<RealmSummary[]> =>
  useQuery({
    queryKey: realmCatalogQueryKey(),
    queryFn: ({ signal }) => fetchAllRealms(signal),
    staleTime: CATALOG_STALE_TIME,
    gcTime: CATALOG_GC_TIME,
  });

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const SORT_PATTERN = /^(name|type|category|timezone|locale|status)-(asc|desc)$/;

export const parseRealmSort = (
  value: string,
): { key: RealmSortKey; direction: RealmSortDirection } => {
  const match = SORT_PATTERN.exec(value);
  if (!match) {
    return { key: "name", direction: "asc" };
  }
  return {
    key: match[1] as RealmSortKey,
    direction: match[2] as RealmSortDirection,
  };
};

export const isRealmSort = (value: string): value is RealmSort =>
  SORT_PATTERN.test(value);

const compareText = (left: string, right: string): number =>
  left.localeCompare(right, undefined, { sensitivity: "base" });

/** Empty values always sort last, whatever the direction. */
const compareOptional = (
  left: string | undefined,
  right: string | undefined,
  direction: RealmSortDirection,
): number => {
  const a = left ?? "";
  const b = right ?? "";
  if (a.length === 0 && b.length === 0) {
    return 0;
  }
  if (a.length === 0) {
    return 1;
  }
  if (b.length === 0) {
    return -1;
  }
  return direction === "asc" ? compareText(a, b) : compareText(b, a);
};

const sortValue = (row: RealmDirectoryRow, key: RealmSortKey): string => {
  switch (key) {
    case "type":
      return row.typeCode ?? row.typeName ?? "";
    case "category":
      return row.category ?? "";
    case "timezone":
      return row.timezone ?? "";
    case "locale":
      return row.locale ?? "";
    case "status":
      return row.statusLabel ?? "";
    default:
      return row.name;
  }
};

const sortRows = (
  rows: RealmDirectoryRow[],
  sort: RealmSort,
): RealmDirectoryRow[] => {
  const { key, direction } = parseRealmSort(sort);
  return [...rows].sort((left, right) => {
    const primary = compareOptional(
      sortValue(left, key),
      sortValue(right, key),
      direction,
    );
    return primary !== 0 ? primary : compareText(left.name, right.name);
  });
};

const facetOptions = (
  rows: RealmDirectoryRow[],
  read: (row: RealmDirectoryRow) => string | undefined,
  label: (value: string) => string,
): RealmFacetOption[] => {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const value = read(row);
    if (value) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  });

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, label: label(value), count }))
    .sort((left, right) => compareText(left.label, right.label));
};

const joinStatus = (
  realm: RealmSummary,
  snapshot: ConnectedRealmSnapshot | undefined,
): RealmDirectoryRow => ({
  ...realm,
  connectedRealmId: realm.connectedRealmId ?? snapshot?.id,
  statusType: snapshot?.statusType,
  statusLabel: snapshot?.statusLabel,
  populationType: snapshot?.populationType,
  populationLabel: snapshot?.populationLabel,
  hasQueue: snapshot?.has_queue,
  isInternal: isInternalRealm(realm),
});

const FILTER_DEFAULTS: RealmFilters & { sort: string } = {
  q: "",
  type: "",
  category: "",
  timezone: "",
  sort: DEFAULT_REALM_SORT,
  internal: "",
};

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

/**
 * The realm directory: one catalog request joined with the connected-realm
 * catalog for live status, filtered and sorted from URL state.
 */
export const useRealmDirectory = (): RealmDirectory => {
  const catalogQuery = useRealmCatalog();
  const connectedQuery = useConnectedRealmCatalog();
  const [params, setParams] = useSearchParamsRecord(FILTER_DEFAULTS);

  const sort: RealmSort = isRealmSort(params.sort)
    ? params.sort
    : DEFAULT_REALM_SORT;
  const showInternal = params.internal === "1";

  const statusByRealmId = useMemo(() => {
    const map = new Map<number, ConnectedRealmSnapshot>();
    connectedQuery.data?.snapshots.forEach((snapshot) => {
      snapshot.realms?.forEach((realm) => {
        map.set(realm.id, snapshot);
      });
    });
    return map;
  }, [connectedQuery.data]);

  const allRows = useMemo<RealmDirectoryRow[]>(
    () =>
      (catalogQuery.data ?? []).map((realm) =>
        joinStatus(realm, statusByRealmId.get(realm.id)),
      ),
    [catalogQuery.data, statusByRealmId],
  );

  const catalogRows = useMemo(
    () => (showInternal ? allRows : allRows.filter((row) => !row.isInternal)),
    [allRows, showInternal],
  );

  const facets = useMemo<RealmFacets>(() => {
    // Blizzard labels each type ("Roleplaying"); the enum is the fallback.
    const typeLabels = new Map<string, string>();
    catalogRows.forEach((row) => {
      if (row.typeCode && row.typeName && !typeLabels.has(row.typeCode)) {
        typeLabels.set(row.typeCode, row.typeName);
      }
    });

    return {
      types: facetOptions(
        catalogRows,
        (row) => row.typeCode,
        (value) => typeLabels.get(value) ?? humanizeEnum(value),
      ),
      categories: facetOptions(
        catalogRows,
        (row) => row.category,
        (value) => value,
      ),
      timezones: facetOptions(
        catalogRows,
        (row) => row.timezone,
        (value) => formatTimezone(value),
      ),
    };
  }, [catalogRows]);

  const quickPicks = useMemo(
    () =>
      catalogRows
        .filter((row) => QUICK_PICK_TIERS.has(row.populationType ?? ""))
        .sort((left, right) => compareText(left.name, right.name))
        .slice(0, QUICK_PICK_LIMIT),
    [catalogRows],
  );

  const rows = useMemo(() => {
    const needle = params.q.trim().toLowerCase();
    const filtered = catalogRows.filter((row) => {
      if (
        needle.length > 0 &&
        !row.name.toLowerCase().includes(needle) &&
        !row.slug.toLowerCase().includes(needle)
      ) {
        return false;
      }
      if (params.type && row.typeCode !== params.type) {
        return false;
      }
      if (params.category && row.category !== params.category) {
        return false;
      }
      if (params.timezone && row.timezone !== params.timezone) {
        return false;
      }
      return true;
    });

    return sortRows(filtered, sort);
  }, [catalogRows, params.category, params.q, params.timezone, params.type, sort]);

  const setFilter = useCallback(
    (key: keyof RealmFilters, value: string | null): void => {
      setParams({ [key]: value }, { replace: key === "q" });
    },
    [setParams],
  );

  const setSort = useCallback(
    (next: RealmSort): void => {
      setParams({ sort: next }, { replace: true });
    },
    [setParams],
  );

  const clearFilters = useCallback((): void => {
    setParams({ q: null, type: null, category: null, timezone: null });
  }, [setParams]);

  const filters = useMemo<RealmFilters>(
    () => ({
      q: params.q,
      type: params.type,
      category: params.category,
      timezone: params.timezone,
      internal: params.internal,
    }),
    [params.category, params.internal, params.q, params.timezone, params.type],
  );

  const hasActiveFilters =
    params.q.trim().length > 0 ||
    params.type.length > 0 ||
    params.category.length > 0 ||
    params.timezone.length > 0;

  const refetch = useCallback((): void => {
    void catalogQuery.refetch();
    if (connectedQuery.isError) {
      void connectedQuery.refetch();
    }
  }, [catalogQuery, connectedQuery]);

  return {
    rows,
    total: catalogRows.length,
    visibleCount: rows.length,
    facets,
    quickPicks,
    sort,
    setSort,
    filters,
    setFilter,
    clearFilters,
    hasActiveFilters,
    isLoading: catalogQuery.isPending,
    isFetching: catalogQuery.isFetching,
    error: catalogQuery.error,
    refetch,
    statusPending: connectedQuery.isPending,
  };
};

export default useRealmDirectory;
