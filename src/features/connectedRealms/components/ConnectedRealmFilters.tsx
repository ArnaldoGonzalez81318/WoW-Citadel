import { Button, Chip } from "@mui/material";
import { useEffect, useRef, useState } from "react";

import {
  ExplorerFilterBar,
  FilterChipGroup,
  SearchField,
} from "@/components/common/ExplorerFilterBar";
import type { ConnectedRealmFilterResult } from "@/features/connectedRealms/hooks/useConnectedRealmFilters";
import { formatNumber } from "@/lib/format";

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

  // The field echoes keystrokes immediately; the URL only changes after the
  // debounce. The URL is mirrored back into the field only when it changed
  // elsewhere (Back/Forward, Clear filters) — never for the value the field
  // itself just emitted, so a transition commit cannot swallow a keystroke.
  const [text, setText] = useState(filters.q);
  const lastEmitted = useRef(filters.q);
  useEffect(() => {
    if (filters.q !== lastEmitted.current) {
      lastEmitted.current = filters.q;
      setText(filters.q);
    }
  }, [filters.q]);

  const emitQuery = (value: string): void => {
    lastEmitted.current = value;
    setFilter("q", value || null);
  };

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
        onDebouncedChange={emitQuery}
        onClear={() => emitQuery("")}
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
