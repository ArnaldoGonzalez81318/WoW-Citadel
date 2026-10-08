import {
  Autocomplete,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import { useId, useMemo } from "react";
import type { ReactNode, Ref } from "react";

import {
  ExplorerFilterBar,
  SearchField,
} from "@/components/common/ExplorerFilterBar";
import type {
  CreatureFamilySummary,
  CreatureType,
  NamedRef,
} from "@/features/creatures/types";

export type TameableFilter = "any" | "yes" | "no";

export type CreatureFiltersProps = {
  /** The search field's draft (keystrokes stay local; the URL gets `onSearch`). */
  draft: string;
  onDraftChange: (value: string) => void;
  onSearch: (value: string) => void;
  /** Where focus goes when a Clear button removes itself. */
  searchInputRef?: Ref<HTMLInputElement>;
  types: CreatureType[];
  typesLoading: boolean;
  typeId: number | null;
  onTypeChange: (typeId: number | null) => void;
  families: CreatureFamilySummary[];
  familiesLoading: boolean;
  familyId: number | null;
  onFamilyChange: (familyId: number | null) => void;
  /** The Family menu was opened (the page loads what trims its options). */
  onFamiliesOpen?: () => void;
  tameable: TameableFilter;
  onTameableChange: (value: TameableFilter) => void;
  /** Some filter besides the name is set. */
  canClear: boolean;
  onClear: () => void;
  summary?: ReactNode;
  progress: boolean;
};

/** The Select's value for "any type" (the URL leaves `type` out). */
const ANY = "any";

const TAMEABLE_OPTIONS: ReadonlyArray<{ value: TameableFilter; label: string }> = [
  { value: "any", label: "Any" },
  { value: "yes", label: "Tameable by hunters" },
  { value: "no", label: "Not tameable" },
];

/** An id the index does not list (an old link, or the index failed) still shows. */
const withPlaceholder = (
  options: NamedRef[],
  value: number | null,
  noun: string,
): NamedRef[] =>
  value !== null && !options.some((option) => option.id === value)
    ? [{ id: value, name: `${noun} #${value}` }, ...options]
    : options;

/**
 * The creature search strip: name, type, family and whether hunters can tame
 * it. Blizzard's creature search filters on all four server-side, so any mix
 * of them pages through the matches. A summary of the results is announced
 * politely at the end.
 */
const CreatureFilters = ({
  draft,
  onDraftChange,
  onSearch,
  searchInputRef,
  types,
  typesLoading,
  typeId,
  onTypeChange,
  families,
  familiesLoading,
  familyId,
  onFamilyChange,
  onFamiliesOpen,
  tameable,
  onTameableChange,
  canClear,
  onClear,
  summary,
  progress,
}: CreatureFiltersProps): JSX.Element => {
  const typeLabelId = useId();
  const tameLabelId = useId();
  const typeOptions = useMemo(() => withPlaceholder(types, typeId, "Type"), [types, typeId]);
  const familyOptions = useMemo(
    () => withPlaceholder(families, familyId, "Family"),
    [families, familyId],
  );
  const selectedFamily =
    familyId === null ? null : (familyOptions.find((option) => option.id === familyId) ?? null);

  return (
    <ExplorerFilterBar label="Creature filters" summary={summary} progress={progress}>
      <SearchField
        size="small"
        label="Search creatures by name"
        placeholder="Search creatures by name"
        value={draft}
        onChange={onDraftChange}
        onDebouncedChange={onSearch}
        inputRef={searchInputRef}
        // Shrinks at phone width (its 240px floor would widen the page there).
        sx={{ flex: "2 1 240px", minWidth: { xs: 0, sm: 240 } }}
      />
      <FormControl size="small" sx={{ flex: "1 1 150px", minWidth: 0, maxWidth: { sm: 200 } }}>
        <InputLabel id={typeLabelId}>Type</InputLabel>
        <Select
          labelId={typeLabelId}
          label="Type"
          value={typeId === null ? ANY : String(typeId)}
          onChange={(event) => {
            const next = String(event.target.value);
            onTypeChange(next === ANY ? null : Number(next));
          }}
        >
          <MenuItem value={ANY}>Any type</MenuItem>
          {typesLoading && typeOptions.length === 0 ? (
            <MenuItem value="" disabled>
              Loading types…
            </MenuItem>
          ) : null}
          {typeOptions.map((type) => (
            <MenuItem key={type.id} value={String(type.id)}>
              {type.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Autocomplete<NamedRef, false, false, false>
        size="small"
        options={familyOptions}
        value={selectedFamily}
        loading={familiesLoading}
        onChange={(_event, next) => onFamilyChange(next ? next.id : null)}
        onOpen={onFamiliesOpen}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(option, current) => option.id === current.id}
        renderOption={(props, option) => {
          // MUI v6 puts `key` in props; React forbids spreading it.
          const { key: _ignored, ...optionProps } = props;
          return (
            <li key={option.id} {...optionProps}>
              {option.name}
            </li>
          );
        }}
        renderInput={(params) => <TextField {...params} label="Family" />}
        noOptionsText="No families match"
        sx={{ flex: "1 1 190px", minWidth: 0, maxWidth: { sm: 240 } }}
      />
      <FormControl size="small" sx={{ flex: "1 1 170px", minWidth: 0, maxWidth: { sm: 220 } }}>
        <InputLabel id={tameLabelId}>Hunter taming</InputLabel>
        <Select
          labelId={tameLabelId}
          label="Hunter taming"
          value={tameable}
          onChange={(event) => onTameableChange(event.target.value as TameableFilter)}
        >
          {TAMEABLE_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {canClear ? (
        <Button size="small" onClick={onClear} sx={{ flexShrink: 0 }}>
          Clear filters
        </Button>
      ) : null}
    </ExplorerFilterBar>
  );
};

export default CreatureFilters;
