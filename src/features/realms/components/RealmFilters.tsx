import {
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import { useEffect, useId, useState } from "react";

import {
  ExplorerFilterBar,
  FilterChipGroup,
  SearchField,
} from "@/components/common/ExplorerFilterBar";
import type { RealmDirectory } from "@/features/realms/hooks/useRealmDirectory";
import { formatNumber, formatTimezone, humanizeEnum } from "@/lib/format";

export type RealmFiltersProps = {
  directory: RealmDirectory;
  /**
   * Stick under the app header on md+. RealmsPage passes `false` and makes
   * its measuring wrapper sticky instead, so the table header can stack
   * beneath the bar.
   */
  sticky?: boolean;
};

const SELECT_MIN_WIDTH = 180;

const RealmFilters = ({
  directory,
  sticky = true,
}: RealmFiltersProps): JSX.Element => {
  const {
    filters,
    setFilter,
    clearFilters,
    hasActiveFilters,
    facets,
    quickPicks,
    total,
    visibleCount,
    isFetching,
  } = directory;
  const generatedId = useId();
  const categoryLabelId = `realm-category-${generatedId}`;
  const timezoneLabelId = `realm-timezone-${generatedId}`;

  // The field echoes keystrokes immediately; the URL only changes after the
  // debounce (or when the URL itself changes: Back/Forward, popular chips).
  const [text, setText] = useState(filters.q);
  useEffect(() => {
    setText(filters.q);
  }, [filters.q]);

  const showInternal = filters.internal === "1";

  const activeLabels = [
    filters.q.trim() ? `"${filters.q.trim()}"` : undefined,
    filters.type
      ? (facets.types.find((option) => option.value === filters.type)?.label ??
        humanizeEnum(filters.type))
      : undefined,
    filters.category || undefined,
    filters.timezone ? formatTimezone(filters.timezone) : undefined,
  ].filter((label): label is string => Boolean(label));

  const summary = `Showing ${formatNumber(visibleCount)} of ${formatNumber(
    total,
  )} realms${activeLabels.length > 0 ? ` - ${activeLabels.join(", ")}` : ""}`;

  const handleCategory = (event: SelectChangeEvent<string>): void => {
    setFilter("category", event.target.value || null);
  };

  const handleTimezone = (event: SelectChangeEvent<string>): void => {
    setFilter("timezone", event.target.value || null);
  };

  return (
    <ExplorerFilterBar
      label="Realm filters"
      sticky={sticky}
      summary={summary}
      progress={isFetching}
    >
      <SearchField
        label="Search realms"
        placeholder="Search by realm name"
        value={text}
        onChange={setText}
        onDebouncedChange={(value) => setFilter("q", value || null)}
        onClear={() => setFilter("q", null)}
        size="small"
      />

      <FilterChipGroup
        label="Type"
        size="small"
        options={facets.types}
        value={filters.type || null}
        onChange={(value) => setFilter("type", value)}
      />

      <FormControl size="small" sx={{ minWidth: SELECT_MIN_WIDTH }}>
        <InputLabel id={categoryLabelId}>Category</InputLabel>
        <Select
          labelId={categoryLabelId}
          label="Category"
          value={filters.category}
          onChange={handleCategory}
        >
          <MenuItem value="">All categories</MenuItem>
          {facets.categories.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label} ({formatNumber(option.count)})
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: SELECT_MIN_WIDTH }}>
        <InputLabel id={timezoneLabelId}>Time zone</InputLabel>
        <Select
          labelId={timezoneLabelId}
          label="Time zone"
          value={filters.timezone}
          onChange={handleTimezone}
        >
          <MenuItem value="">All time zones</MenuItem>
          {facets.timezones.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label} ({formatNumber(option.count)})
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Chip
        label="Include internal realms"
        size="small"
        variant="outlined"
        clickable
        aria-pressed={showInternal}
        onClick={() => setFilter("internal", showInternal ? null : "1")}
      />

      {hasActiveFilters ? (
        <Button variant="text" size="small" onClick={clearFilters}>
          Clear filters
        </Button>
      ) : null}

      {quickPicks.length > 0 ? (
        <Stack
          direction="row"
          flexWrap="wrap"
          useFlexGap
          gap={1}
          alignItems="center"
          sx={{ flexBasis: "100%", minWidth: 0 }}
        >
          <Typography
            variant="overline"
            component="p"
            color="text.secondary"
            sx={{ margin: 0, marginRight: 0.5 }}
          >
            Popular realms
          </Typography>
          {quickPicks.map((realm) => {
            const pressed = filters.q === realm.name;
            return (
              <Chip
                key={realm.id}
                label={realm.name}
                size="small"
                variant="outlined"
                clickable
                aria-pressed={pressed}
                onClick={() => setFilter("q", pressed ? null : realm.name)}
              />
            );
          })}
        </Stack>
      ) : null}
    </ExplorerFilterBar>
  );
};

export default RealmFilters;
