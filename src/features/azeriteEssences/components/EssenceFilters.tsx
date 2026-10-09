import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { useId, useMemo } from "react";
import type { ReactNode, Ref } from "react";

import {
  ExplorerFilterBar,
  FilterChipGroup,
  SearchField,
} from "@/components/common/ExplorerFilterBar";
import type { FilterOption } from "@/components/common/ExplorerFilterBar";
import { RoleIcon } from "@/features/azeriteEssences/components/RoleTags";
import { ROLE_ORDER } from "@/features/azeriteEssences/services/azeriteEssenceService";
import type { RoleType } from "@/features/azeriteEssences/types";
import { formatNumber } from "@/lib/format";

/** The URL spelling of each role (`?role=tank`). */
export type RoleParam = "tank" | "healer" | "damage";

export const roleToParam = (role: RoleType): RoleParam => role.toLowerCase() as RoleParam;

export const roleFromParam = (value: string): RoleType | null => {
  const upper = value.toUpperCase();
  return upper === "TANK" || upper === "HEALER" || upper === "DAMAGE" ? upper : null;
};

export type ClassOption = {
  id: number;
  name: string;
  /**
   * Essences that match with this class and the current role and search;
   * null while a search is still reading power names (no count to give yet).
   */
  count: number | null;
};

export type EssenceFiltersProps = {
  /** The search field's draft (keystrokes stay local; the URL gets `onSearch`). */
  draft: string;
  onDraftChange: (value: string) => void;
  onSearch: (value: string) => void;
  onClearSearch: () => void;
  searchInputRef?: Ref<HTMLInputElement>;
  role: RoleType | null;
  onRoleChange: (role: RoleType | null) => void;
  roleNames: Record<RoleType, string>;
  /** Essences that match each role with the current class and search. */
  roleCounts: Record<RoleType, number> | null;
  classId: number | null;
  onClassChange: (classId: number | null) => void;
  classes: readonly ClassOption[];
  /** Role and class wait for the specialization records. */
  filtersReady: boolean;
  summary?: ReactNode;
  progress: boolean;
};

/** The Select's value for "any class" (the URL leaves `class` out). */
const ANY = "any";

/**
 * The essence filter strip: a search over essence and power names, the role
 * that has to be able to use the essence, and a class. Role and class apply
 * together, per specialization: Paladin and Healer means Holy.
 */
const EssenceFilters = ({
  draft,
  onDraftChange,
  onSearch,
  onClearSearch,
  searchInputRef,
  role,
  onRoleChange,
  roleNames,
  roleCounts,
  classId,
  onClassChange,
  classes,
  filtersReady,
  summary,
  progress,
}: EssenceFiltersProps): JSX.Element => {
  const classLabelId = useId();
  const roleOptions = useMemo<FilterOption<RoleParam>[]>(
    () =>
      ROLE_ORDER.map((entry) => ({
        value: roleToParam(entry),
        label: roleNames[entry],
        count: roleCounts?.[entry],
        // No Tank essence for a Mage: the chip stays, but cannot be pressed
        // into an empty page (the one already pressed can still be released).
        disabled: !filtersReady || (roleCounts?.[entry] === 0 && entry !== role),
        icon: <RoleIcon role={entry} />,
      })),
    [filtersReady, role, roleCounts, roleNames],
  );
  // A class id from the URL the records have not named yet still shows.
  const classOptions: readonly ClassOption[] =
    classId !== null && !classes.some((option) => option.id === classId)
      ? [{ id: classId, name: `Class #${classId}`, count: 0 }, ...classes]
      : classes;

  return (
    <ExplorerFilterBar label="Essence filters" summary={summary} progress={progress}>
      <SearchField
        size="small"
        label="Search essences and their powers"
        placeholder="Search essences or powers"
        value={draft}
        onChange={onDraftChange}
        onDebouncedChange={onSearch}
        onClear={onClearSearch}
        inputRef={searchInputRef}
        debounceMs={200}
        // Shrinks at phone width (its 240px floor would widen the page there).
        sx={{ flex: "2 1 240px", minWidth: { xs: 0, sm: 240 }, maxWidth: { md: 420 } }}
      />
      <FilterChipGroup<RoleParam>
        label="Role"
        size="small"
        allLabel="Any role"
        options={roleOptions}
        value={role ? roleToParam(role) : null}
        onChange={(next) => onRoleChange(next ? roleFromParam(next) : null)}
      />
      <FormControl
        size="small"
        disabled={!filtersReady}
        sx={{ flex: "1 1 160px", minWidth: 0, maxWidth: { sm: 220 } }}
      >
        <InputLabel id={classLabelId}>Class</InputLabel>
        <Select
          labelId={classLabelId}
          label="Class"
          value={classId === null ? ANY : String(classId)}
          onChange={(event) => {
            const next = String(event.target.value);
            onClassChange(next === ANY ? null : Number(next));
          }}
        >
          <MenuItem value={ANY}>Any class</MenuItem>
          {classOptions.map((option) => (
            <MenuItem
              key={option.id}
              value={String(option.id)}
              // A class with nothing left to show stays visible but cannot be
              // picked, unless it is the one already chosen.
              disabled={option.count === 0 && option.id !== classId}
            >
              {option.count === null
                ? option.name
                : `${option.name} (${formatNumber(option.count)})`}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </ExplorerFilterBar>
  );
};

export default EssenceFilters;
