import type { TextFieldProps } from "@mui/material";

import { SearchField } from "@/components/common/ExplorerFilterBar";
import { toSxArray } from "@/components/common/StateBlocks";

/** @deprecated Use `SearchFieldProps` from `@/components/common/ExplorerFilterBar`. */
export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  /** Off by default: only the search dialog may take focus on mount. */
  autoFocus?: boolean;
  /** @deprecated Only `size`, `sx`, `id`, `name`, `disabled` and `inputRef` are forwarded. */
  textFieldProps?: Partial<TextFieldProps>;
}

const DEFAULT_PLACEHOLDER = "Search items, spells, mounts, creatures...";

/** "Search mounts by name..." → "Search mounts by name" (the field's accessible name). */
const labelFromPlaceholder = (placeholder: string): string => {
  const trimmed = placeholder.replace(/[\s.…]+$/u, "").trim();
  return trimmed.length > 0 ? trimmed : "Search";
};

/**
 * @deprecated Thin wrapper over `SearchField` kept for the explorer pages
 * that still import it. Use `SearchField` (inside `ExplorerFilterBar`)
 * directly: it adds the visually hidden label, `type="search"`, Escape to
 * clear, Enter to submit and an optional debounced callback.
 *
 * `onChange` still fires on every keystroke, as before; callers keep their
 * own debounce until they migrate to `onDebouncedChange`.
 */
const SearchInput = ({
  value,
  onChange,
  onClear,
  placeholder = DEFAULT_PLACEHOLDER,
  autoFocus = false,
  textFieldProps,
}: SearchInputProps): JSX.Element => (
  <SearchField
    value={value}
    onChange={onChange}
    onClear={onClear}
    placeholder={placeholder}
    label={labelFromPlaceholder(placeholder)}
    autoFocus={autoFocus}
    size={textFieldProps?.size}
    id={textFieldProps?.id}
    name={textFieldProps?.name ?? "search"}
    disabled={textFieldProps?.disabled}
    inputRef={textFieldProps?.inputRef}
    sx={[
      // SearchField is sized for ExplorerFilterBar's wrapping row
      // (flex-basis 240px). Legacy callers stack it in a column, where that
      // basis would become a 240px height, so it is a plain full-width block here.
      { flex: "0 0 auto", width: "100%", minWidth: 0 },
      ...toSxArray(textFieldProps?.sx),
    ]}
  />
);

export default SearchInput;
