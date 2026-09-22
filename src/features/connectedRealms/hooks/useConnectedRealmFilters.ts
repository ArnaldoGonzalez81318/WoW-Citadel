import { useCallback, useMemo } from "react";

import type { FilterOption } from "@/components/common/ExplorerFilterBar";
import type { ConnectedRealmSnapshot } from "@/features/connectedRealms/types";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import { humanizeEnum } from "@/lib/format";

export type ConnectedRealmFilterState = {
  q: string;
  population: string;
  /** "1" keeps only clusters with an active queue. */
  queue: string;
};

const FILTER_DEFAULTS: ConnectedRealmFilterState = {
  q: "",
  population: "",
  queue: "",
};

export type ConnectedRealmFilterResult = {
  filters: ConnectedRealmFilterState;
  setFilter: (key: keyof ConnectedRealmFilterState, value: string | null) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  /** Clusters matching the filters. */
  visible: ConnectedRealmSnapshot[];
  populationOptions: FilterOption[];
};

const compareText = (left: string, right: string): number =>
  left.localeCompare(right, undefined, { sensitivity: "base" });

/** Population chips read as a scale, quietest first; unknown tiers follow. */
const POPULATION_TIER_ORDER: readonly string[] = [
  "RECOMMENDED",
  "LOW",
  "MEDIUM",
  "HIGH",
  "FULL",
];

const populationTierRank = (value: string): number => {
  const index = POPULATION_TIER_ORDER.indexOf(value);
  return index === -1 ? POPULATION_TIER_ORDER.length : index;
};

/** URL-backed filter state plus the filtered cluster list. */
export const useConnectedRealmFilters = (
  snapshots: ConnectedRealmSnapshot[],
): ConnectedRealmFilterResult => {
  const [params, setParams] = useSearchParamsRecord(FILTER_DEFAULTS);

  const populationOptions = useMemo<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    snapshots.forEach((snapshot) => {
      if (snapshot.populationType) {
        counts.set(
          snapshot.populationType,
          (counts.get(snapshot.populationType) ?? 0) + 1,
        );
      }
    });
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, label: humanizeEnum(value), count }))
      .sort(
        (left, right) =>
          populationTierRank(left.value) - populationTierRank(right.value) ||
          compareText(left.label, right.label),
      );
  }, [snapshots]);

  const visible = useMemo(() => {
    const needle = params.q.trim().toLowerCase();
    return snapshots.filter((snapshot) => {
      if (
        needle.length > 0 &&
        !snapshot.displayName.toLowerCase().includes(needle) &&
        !snapshot.realmSlugs.some((slug) => slug.toLowerCase().includes(needle))
      ) {
        return false;
      }
      if (params.population && snapshot.populationType !== params.population) {
        return false;
      }
      if (params.queue === "1" && !snapshot.has_queue) {
        return false;
      }
      return true;
    });
  }, [params.population, params.q, params.queue, snapshots]);

  const setFilter = useCallback(
    (key: keyof ConnectedRealmFilterState, value: string | null): void => {
      setParams({ [key]: value }, { replace: key === "q" });
    },
    [setParams],
  );

  const clearFilters = useCallback((): void => {
    setParams({ q: null, population: null, queue: null });
  }, [setParams]);

  return {
    filters: params,
    setFilter,
    clearFilters,
    hasActiveFilters:
      params.q.trim().length > 0 ||
      params.population.length > 0 ||
      params.queue === "1",
    visible,
    populationOptions,
  };
};

export default useConnectedRealmFilters;
