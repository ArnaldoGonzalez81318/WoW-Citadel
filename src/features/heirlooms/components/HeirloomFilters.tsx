import {
  Button,
  FormControl,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
} from "@mui/material";
import { useId } from "react";
import type { ReactNode, Ref } from "react";

import {
  ExplorerFilterBar,
  SearchField,
} from "@/components/common/ExplorerFilterBar";
import type {
  FacetOption,
  FilterKey,
  HeirloomFacets,
  HeirloomFilters as Filters,
} from "@/features/heirlooms/services/heirloomCatalog";
import { formatNumber } from "@/lib/format";

/** The Select's value for "any" (the URL leaves the key out). */
const ANY = "any";

export type HeirloomFiltersProps = {
  /** The search field's draft (keystrokes stay local; the URL gets `onSearch`). */
  draft: string;
  onDraftChange: (value: string) => void;
  onSearch: (value: string) => void;
  onClearSearch: () => void;
  /** Where focus goes when the Clear button removes itself. */
  searchInputRef?: Ref<HTMLInputElement>;
  searchDisabled: boolean;
  searchPlaceholder: string;
  facets: HeirloomFacets;
  filters: Filters;
  /**
   * The menus' options come from the records, so they open once every
   * record has answered; until then they say they are loading.
   */
  facetsReady: boolean;
  onFilterChange: (key: FilterKey, value: string | null) => void;
  canClear: boolean;
  onClear: () => void;
  summary?: ReactNode;
  progress: boolean;
};

type MenuSpec = {
  key: FilterKey;
  label: string;
  anyLabel: string;
  options: readonly FacetOption[];
};

/**
 * A value the options do not list (a shared link while the records load)
 * still shows, instead of MUI's out-of-range warning and a blank field.
 */
const withPlaceholder = (
  options: readonly FacetOption[],
  value: string | null,
  ready: boolean,
): readonly FacetOption[] =>
  value !== null && !options.some((option) => option.value === value)
    ? [{ value, label: ready ? "Unknown" : "Loading…", count: 0, total: 0 }, ...options]
    : options;

const optionLabel = (option: FacetOption, ready: boolean): string =>
  ready && option.total > 0 ? `${option.label} (${formatNumber(option.count)})` : option.label;

/**
 * The type menu groups armor and weapon types under their item class
 * (sub-headers are plain children of the Select, not options).
 */
const menuItems = (spec: MenuSpec, value: string | null, ready: boolean): ReactNode[] => {
  const items: ReactNode[] = [];
  let group: string | undefined;
  withPlaceholder(spec.options, value, ready).forEach((option) => {
    if (option.group && option.group !== group) {
      group = option.group;
      items.push(<ListSubheader key={`group-${group}`}>{group}</ListSubheader>);
    }
    items.push(
      <MenuItem
        key={option.value}
        value={option.value}
        // An option that would empty the list stays visible (the count says
        // why) but cannot be picked; the current one always can.
        disabled={option.value !== value && ready && option.count === 0}
      >
        {optionLabel(option, ready)}
      </MenuItem>,
    );
  });
  return items;
};

const FacetSelect = ({
  spec,
  value,
  ready,
  onChange,
}: {
  spec: MenuSpec;
  value: string | null;
  ready: boolean;
  onChange: (key: FilterKey, value: string | null) => void;
}): JSX.Element => {
  const labelId = useId();
  return (
    <FormControl
      size="small"
      // Two to a row even at 320px: 120 + 12 + 120 fits the 254px inside
      // the bar (page gutters, the bar's padding and border taken off).
      sx={{ flex: "1 1 120px", minWidth: 0, maxWidth: { sm: 220 } }}
    >
      <InputLabel id={labelId}>{spec.label}</InputLabel>
      <Select
        labelId={labelId}
        label={spec.label}
        value={value ?? ANY}
        onChange={(event) => {
          const next = String(event.target.value);
          onChange(spec.key, next === ANY ? null : next);
        }}
        MenuProps={{ slotProps: { paper: { sx: { maxHeight: 420 } } } }}
      >
        <MenuItem value={ANY}>{spec.anyLabel}</MenuItem>
        {!ready && spec.options.length === 0 && value === null ? (
          <MenuItem value="" disabled>
            Loading…
          </MenuItem>
        ) : null}
        {menuItems(spec, value, ready)}
      </Select>
    </FormControl>
  );
};

/**
 * The collection's filter strip: a name search (fuzzy, over the index, so
 * it works before the records are in), then slot, armor or weapon type,
 * primary stat and source, each with how many heirlooms it would leave. A
 * summary of the results is announced politely at the end.
 */
const HeirloomFilters = ({
  draft,
  onDraftChange,
  onSearch,
  onClearSearch,
  searchInputRef,
  searchDisabled,
  searchPlaceholder,
  facets,
  filters,
  facetsReady,
  onFilterChange,
  canClear,
  onClear,
  summary,
  progress,
}: HeirloomFiltersProps): JSX.Element => {
  const specs: MenuSpec[] = [
    { key: "slot", label: "Slot", anyLabel: "Any slot", options: facets.slots },
    { key: "type", label: "Type", anyLabel: "Any type", options: facets.types },
    { key: "stat", label: "Primary stat", anyLabel: "Any stat", options: facets.stats },
    { key: "source", label: "Source", anyLabel: "Any source", options: facets.sources },
  ];

  return (
    <ExplorerFilterBar label="Heirloom filters" summary={summary} progress={progress}>
      <SearchField
        size="small"
        label="Search heirlooms by name"
        placeholder={searchPlaceholder}
        value={draft}
        onChange={onDraftChange}
        onDebouncedChange={onSearch}
        onClear={onClearSearch}
        inputRef={searchInputRef}
        disabled={searchDisabled}
        // Shrinks at phone width (its 240px floor would widen the page there).
        sx={{ flex: "2 1 240px", minWidth: { xs: 0, sm: 240 }, maxWidth: { md: 360 } }}
      />
      {specs.map((spec) => (
        <FacetSelect
          key={spec.key}
          spec={spec}
          value={filters[spec.key]}
          ready={facetsReady}
          onChange={onFilterChange}
        />
      ))}
      {canClear ? (
        <Button size="small" onClick={onClear} sx={{ flexShrink: 0 }}>
          Clear filters
        </Button>
      ) : null}
    </ExplorerFilterBar>
  );
};

export default HeirloomFilters;
