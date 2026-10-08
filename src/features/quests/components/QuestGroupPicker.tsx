import {
  Autocomplete,
  Box,
  Skeleton,
  TextField,
  createFilterOptions,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { useMemo } from "react";

import { FilterChipGroup } from "@/components/common/ExplorerFilterBar";
import { toPickerOptions } from "@/features/quests/services/questGroups";
import type { PickerOption } from "@/features/quests/services/questGroups";
import { unnamedGroup } from "@/features/quests/services/questService";
import type {
  QuestBrowseMode,
  QuestGroupSummary,
} from "@/features/quests/types";

export type QuestGroupPickerProps = {
  mode: QuestBrowseMode;
  /** The mode's index (zones, categories or types), in Blizzard's order. */
  options: readonly QuestGroupSummary[];
  value: number | null;
  onChange: (groupId: number) => void;
  /** The index is still loading. */
  loading: boolean;
  sx?: SxProps<Theme>;
};

const FIELD_LABEL: Readonly<Record<Exclude<QuestBrowseMode, "type">, string>> = {
  zone: "Zone",
  category: "Category",
};

/** Typing a zone's id finds it too (the number in a shared link). */
const filterOptions = createFilterOptions<PickerOption>({
  stringify: (option) => `${option.label} ${option.id}`,
});

const placeholderOption = (mode: QuestBrowseMode, id: number): PickerOption => {
  const label = unnamedGroup(mode, id);
  return { id, name: label, label, section: "Selected" };
};

/**
 * The group to list. The nine types fit as a chip row; the 440 zones and 184
 * categories get a searchable field, zones by first letter and categories in
 * themed sections (see questGroups). An id the index does not list yet (a
 * shared link while the index loads) shows as a placeholder.
 */
const QuestGroupPicker = ({
  mode,
  options,
  value,
  onChange,
  loading,
  sx,
}: QuestGroupPickerProps): JSX.Element => {
  const pickerOptions = useMemo(
    () => (mode === "type" ? [] : toPickerOptions(mode, options)),
    [mode, options],
  );

  if (mode === "type") {
    if (loading) {
      return (
        <Box
          role="status"
          aria-label="Loading quest types"
          sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}
        >
          {Array.from({ length: 9 }, (_, index) => (
            <Skeleton key={index} variant="rounded" width={88} height={32} sx={{ borderRadius: 4 }} />
          ))}
        </Box>
      );
    }
    return (
      <FilterChipGroup
        label="Quest type"
        hideAll
        options={options.map((option) => ({ value: String(option.id), label: option.name }))}
        value={value === null ? null : String(value)}
        // Pressing the selected chip again would clear it; a list always has a type.
        onChange={(next) => {
          if (next !== null) {
            onChange(Number(next));
          }
        }}
        sx={sx}
      />
    );
  }

  const allOptions =
    value !== null && !pickerOptions.some((option) => option.id === value)
      ? [placeholderOption(mode, value), ...pickerOptions]
      : pickerOptions;
  const selected =
    value === null ? null : (allOptions.find((option) => option.id === value) ?? null);
  const label = FIELD_LABEL[mode];

  return (
    <Autocomplete<PickerOption, false, boolean, false>
      size="small"
      options={allOptions}
      value={selected}
      loading={loading}
      // A list always has a group: picking another one is the only change.
      disableClearable
      onChange={(_event, next) => {
        if (next) {
          onChange(next.id);
        }
      }}
      groupBy={(option) => option.section}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, current) => option.id === current.id}
      filterOptions={filterOptions}
      renderOption={(props, option) => {
        // MUI v6 puts `key` in props; React forbids spreading it.
        const { key: _ignored, ...optionProps } = props;
        return (
          <li key={option.id} {...optionProps}>
            {option.label}
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={mode === "zone" ? "Search zones" : "Search categories"}
        />
      )}
      noOptionsText={mode === "zone" ? "No zones match" : "No categories match"}
      loadingText={mode === "zone" ? "Loading zones…" : "Loading categories…"}
      sx={sx}
    />
  );
};

export default QuestGroupPicker;
