import {
  Box,
  FormControl,
  InputLabel,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
} from "@mui/material";
import { useId, useMemo } from "react";
import type { ReactNode, Ref } from "react";

import {
  ExplorerFilterBar,
  FilterChipGroup,
  SearchField,
  SegmentedControl,
} from "@/components/common/ExplorerFilterBar";
import type { FilterOption, SegmentedOption } from "@/components/common/ExplorerFilterBar";
import SourceIcon from "@/features/toys/components/SourceIcon";
import type { ToySort, ToySourceOption } from "@/features/toys/types";
import { formatNumber } from "@/lib/format";

export type ToyFiltersProps = {
  /** The search field's draft (keystrokes stay local; the URL gets `onSearch`). */
  draft: string;
  onDraftChange: (value: string) => void;
  onSearch: (value: string) => void;
  onClearSearch: () => void;
  /** Where focus goes when a Clear button removes itself. */
  searchInputRef?: Ref<HTMLInputElement>;
  /** Toys in the index, for the placeholder (0 while it loads). */
  toyCount: number;
  /** The index failed: there is nothing to search. */
  disabled: boolean;
  searching: boolean;
  sort: ToySort;
  onSortChange: (sort: ToySort) => void;
  sourceOptions: ToySourceOption[];
  source: string | null;
  onSourceChange: (source: string | null) => void;
  summary?: ReactNode;
  progress: boolean;
};

const BROWSE_SORTS: ReadonlyArray<SegmentedOption<ToySort>> = [
  { value: "newest", label: "Newest" },
  { value: "name", label: "A–Z" },
];

const SEARCH_SORTS: ReadonlyArray<SegmentedOption<ToySort>> = [
  { value: "match", label: "Best match" },
  ...BROWSE_SORTS,
];

/** The Select's value for "every source" (the URL leaves `source` out). */
const ALL = "all";

const optionLabel = (option: ToySourceOption): string =>
  option.count !== undefined ? `${option.name} (${formatNumber(option.count)})` : option.name;

/**
 * The toy box's strip: a name search ranked locally (half-typed and
 * misspelled names included), the order, and a chip per source (a menu on
 * narrow screens). A summary of the results is announced politely at the end.
 */
const ToyFilters = ({
  draft,
  onDraftChange,
  onSearch,
  onClearSearch,
  searchInputRef,
  toyCount,
  disabled,
  searching,
  sort,
  onSortChange,
  sourceOptions,
  source,
  onSourceChange,
  summary,
  progress,
}: ToyFiltersProps): JSX.Element => {
  const sourceLabelId = useId();
  const chipOptions = useMemo<FilterOption[]>(
    () =>
      sourceOptions.map((option) => ({
        value: option.type,
        label: option.name,
        count: option.count,
        icon: <SourceIcon type={option.type} />,
      })),
    [sourceOptions],
  );

  return (
    <ExplorerFilterBar label="Toy filters" summary={summary} progress={progress}>
      <SearchField
        size="small"
        label="Search toys by name"
        placeholder={toyCount > 0 ? `Search ${formatNumber(toyCount)} toys` : "Search toys"}
        value={draft}
        onChange={onDraftChange}
        onDebouncedChange={onSearch}
        onClear={onClearSearch}
        inputRef={searchInputRef}
        disabled={disabled}
        // Shrinks at phone width (its 240px floor would widen the page there).
        sx={{ flex: "2 1 240px", minWidth: { xs: 0, sm: 240 }, maxWidth: { md: 440 } }}
      />
      <SegmentedControl
        size="small"
        label="Order toys by"
        options={searching ? SEARCH_SORTS : BROWSE_SORTS}
        value={sort}
        onChange={onSortChange}
        sx={{ minHeight: 40, maxWidth: "100%", "& .MuiToggleButton-root": { px: 1.5 } }}
      />
      {/* A dozen chips would fill a phone's first screen: below md the
          sources are a menu instead (only one of the two is ever shown). */}
      <FormControl
        size="small"
        sx={{ display: { xs: "inline-flex", md: "none" }, flex: "1 1 180px", minWidth: 0 }}
      >
        <InputLabel id={sourceLabelId}>Source</InputLabel>
        <Select
          labelId={sourceLabelId}
          label="Source"
          value={source ?? ALL}
          onChange={(event) => {
            const next = String(event.target.value);
            onSourceChange(next === ALL ? null : next);
          }}
          renderValue={(value) =>
            value === ALL
              ? "All sources"
              : (sourceOptions.find((option) => option.type === value)?.name ?? value)
          }
        >
          <MenuItem value={ALL}>All sources</MenuItem>
          {sourceOptions.map((option) => (
            <MenuItem key={option.type} value={option.type}>
              <ListItemIcon>
                <SourceIcon type={option.type} />
              </ListItemIcon>
              <ListItemText primary={optionLabel(option)} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Box sx={{ display: { xs: "none", md: "block" }, flex: "1 1 100%", minWidth: 0 }}>
        <FilterChipGroup
          label="Filter toys by source"
          allLabel="All sources"
          size="small"
          options={chipOptions}
          value={source}
          onChange={onSourceChange}
        />
      </Box>
    </ExplorerFilterBar>
  );
};

export default ToyFilters;
