import { Button, Chip } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ExplorerFilterBar,
  FilterChipGroup,
  SearchField,
} from "@/components/common/ExplorerFilterBar";
import type { FilterOption } from "@/components/common/ExplorerFilterBar";
import type { ConnectedRealmSnapshot } from "@/features/connectedRealms/types";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import { formatNumber, humanizeEnum } from "@/lib/format";

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
      .sort((left, right) => compareText(left.label, right.label));
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

export type ConnectedRealmFiltersProps = {
  filterState: ConnectedRealmFilterResult;
  total: number;
  isFetching: boolean;
};

const ConnectedRealmFilters = ({
  filterState,
  total,
  isFetching,
}: ConnectedRealmFiltersProps): JSX.Element => {
  const {
    filters,
    setFilter,
    clearFilters,
    hasActiveFilters,
    visible,
    populationOptions,
  } = filterState;

  const [text, setText] = useState(filters.q);
  useEffect(() => {
    setText(filters.q);
  }, [filters.q]);

  const queueActive = filters.queue === "1";
  const summary = `Showing ${formatNumber(visible.length)} of ${formatNumber(
    total,
  )} clusters`;

  return (
    <ExplorerFilterBar
      label="Connected realm filters"
      summary={summary}
      progress={isFetching}
    >
      <SearchField
        label="Search connected realms"
        placeholder="Search by realm name"
        value={text}
        onChange={setText}
        onDebouncedChange={(value) => setFilter("q", value || null)}
        onClear={() => setFilter("q", null)}
        size="small"
      />

      <FilterChipGroup
        label="Population"
        size="small"
        options={populationOptions}
        value={filters.population || null}
        onChange={(value) => setFilter("population", value)}
      />

      <Chip
        label="Queue active"
        size="small"
        variant="outlined"
        clickable
        aria-pressed={queueActive}
        onClick={() => setFilter("queue", queueActive ? null : "1")}
      />

      {hasActiveFilters ? (
        <Button variant="text" size="small" onClick={clearFilters}>
          Clear filters
        </Button>
      ) : null}
    </ExplorerFilterBar>
  );
};

export default ConnectedRealmFilters;
