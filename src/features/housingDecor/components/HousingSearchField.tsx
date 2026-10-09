import type { Ref } from "react";

import { SearchField } from "@/components/common/ExplorerFilterBar";
import { MIN_FUZZY_QUERY_LENGTH } from "@/lib/fuzzyMatch";

/**
 * The page's one search, handed to whichever tab is open: keystrokes stay
 * in the page's draft, the URL gets the debounced value.
 */
export type SearchBinding = {
  draft: string;
  onDraftChange: (value: string) => void;
  onSearch: (value: string) => void;
  onClear: () => void;
  inputRef: Ref<HTMLInputElement>;
  /** Moves focus to the field: where it goes when a Clear button removes itself. */
  focus: () => void;
};

/**
 * A lone letter matches nearly everything, so a name waits for a second
 * one; an id is exact, so a single digit already finds rooms 1 to 9.
 */
const searchMinLength = (value: string): number =>
  /^#?\d+$/.test(value.trim()) ? 1 : MIN_FUZZY_QUERY_LENGTH;

/** Whether `value` is a search the field would hand to the URL (empty clears it). */
export const searchQualifies = (value: string): boolean => {
  const trimmed = value.trim();
  return trimmed === "" || trimmed.length >= searchMinLength(trimmed);
};

export type HousingSearchFieldProps = {
  binding: SearchBinding;
  /** Visually hidden label. */
  label: string;
  placeholder: string;
  disabled?: boolean;
};

const HousingSearchField = ({
  binding,
  label,
  placeholder,
  disabled = false,
}: HousingSearchFieldProps): JSX.Element => (
  <SearchField
    size="small"
    label={label}
    placeholder={placeholder}
    value={binding.draft}
    onChange={binding.onDraftChange}
    onDebouncedChange={binding.onSearch}
    onClear={binding.onClear}
    inputRef={binding.inputRef}
    disabled={disabled}
    minLength={searchMinLength(binding.draft)}
    // Shrinks at phone width (its 240px floor would widen the page there).
    sx={{ flex: "2 1 240px", minWidth: { xs: 0, sm: 240 }, maxWidth: { md: 480 } }}
  />
);

export default HousingSearchField;
