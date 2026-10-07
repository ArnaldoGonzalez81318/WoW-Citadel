import { Autocomplete, TextField } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { useMemo } from "react";

import type { ConnectedRealmSnapshot } from "@/features/connectedRealms/types";

export type ConnectedRealmPickerProps = {
  /** The catalog's connected realms (useConnectedRealmCatalog). */
  options: ConnectedRealmSnapshot[];
  value: number | null;
  onChange: (connectedRealmId: number | null) => void;
  loading?: boolean;
  label?: string;
  /** Allow clearing the field (off when the page always needs a realm). */
  clearable?: boolean;
  sx?: SxProps<Theme>;
};

const placeholderOption = (id: number): ConnectedRealmSnapshot => {
  const label = `Connected realm #${id}`;
  return {
    id,
    realms: [],
    realmDetails: [],
    displayName: label,
    leadName: label,
    shortLabel: label,
    realmSlugs: [],
    realmTypes: [],
    timezones: [],
  };
};

const matches = (option: ConnectedRealmSnapshot, needle: string): boolean =>
  option.displayName.toLowerCase().includes(needle) ||
  option.shortLabel.toLowerCase().includes(needle) ||
  option.realmSlugs.some((slug) => slug.toLowerCase().includes(needle));

/**
 * Searchable connected-realm field: matches any member realm's name or slug,
 * so typing "Fizzcrank" finds "Aggramar, Fizzcrank". An id the catalog does
 * not list (a shared link from another region) still shows as a placeholder.
 */
const ConnectedRealmPicker = ({
  options,
  value,
  onChange,
  loading = false,
  label = "Connected realm",
  clearable = true,
  sx,
}: ConnectedRealmPickerProps): JSX.Element => {
  const allOptions = useMemo(
    () =>
      value !== null && !options.some((option) => option.id === value)
        ? [placeholderOption(value), ...options]
        : options,
    [options, value],
  );
  const selected =
    value === null ? null : (allOptions.find((option) => option.id === value) ?? null);

  return (
    <Autocomplete<ConnectedRealmSnapshot, false, boolean, false>
      size="small"
      options={allOptions}
      value={selected}
      loading={loading}
      disableClearable={!clearable}
      onChange={(_event, next) => onChange(next ? next.id : null)}
      getOptionLabel={(option) => option.shortLabel}
      isOptionEqualToValue={(option, current) => option.id === current.id}
      filterOptions={(candidates, state) => {
        const needle = state.inputValue.trim().toLowerCase();
        return needle.length === 0
          ? candidates
          : candidates.filter((option) => matches(option, needle));
      }}
      renderOption={(props, option) => {
        // MUI v6 puts `key` in props; React forbids spreading it.
        const { key: _ignored, ...optionProps } = props;
        return (
          <li key={option.id} {...optionProps}>
            {option.shortLabel}
          </li>
        );
      }}
      renderInput={(params) => <TextField {...params} label={label} />}
      noOptionsText="No connected realms match"
      sx={sx}
    />
  );
};

export default ConnectedRealmPicker;
