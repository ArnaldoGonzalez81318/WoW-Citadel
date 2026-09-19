import CloseRounded from "@mui/icons-material/CloseRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { useCallback, useEffect, useId, useRef } from "react";
import type { KeyboardEvent, ReactElement, ReactNode, Ref } from "react";

import { InlineProgress, LiveStatus, toSxArray } from "@/components/common/StateBlocks";
import { formatNumber } from "@/lib/format";
import { visuallyHidden } from "@/theme";

/* ------------------------------------------------------------------ */
/* ExplorerFilterBar                                                   */
/* ------------------------------------------------------------------ */

export type ExplorerFilterBarProps = {
  /** SearchField, FilterChipGroup, Select, SegmentedControl… on one wrapping row. */
  children: ReactNode;
  /** Result summary ("Showing 24 of 1,204 · Plate"), announced politely. */
  summary?: ReactNode;
  /** Stick under the app header on md+ (long grids only). */
  sticky?: boolean;
  /** Accessible name of the region. */
  label?: string;
  /** Shows the 2px refetch bar. */
  progress?: boolean;
  sx?: SxProps<Theme>;
};

/**
 * Full-width filter strip directly under the page header.
 */
export const ExplorerFilterBar = ({
  children,
  summary,
  sticky = false,
  label = "Filters",
  progress = false,
  sx,
}: ExplorerFilterBarProps): JSX.Element => (
  <Box
    component="section"
    role="region"
    aria-label={label}
    sx={[
      (theme) => ({
        position: sticky ? { xs: "relative", md: "sticky" } : "relative",
        top: sticky ? { md: theme.wc.layout.headerHeight.md } : undefined,
        zIndex: sticky ? theme.zIndex.appBar - 1 : undefined,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        padding: "12px 16px 14px",
        backgroundColor: theme.palette.surface.raised,
        border: `1px solid ${theme.palette.border.default}`,
        borderRadius: `${theme.wc.radius.lg}px`,
        minWidth: 0,
      }),
      ...toSxArray(sx),
    ]}
  >
    <Stack
      direction="row"
      flexWrap="wrap"
      useFlexGap
      gap={1.5}
      alignItems="center"
      sx={{ minWidth: 0 }}
    >
      {children}
      {summary ? (
        <LiveStatus
          busy={progress}
          sx={{ marginLeft: { md: "auto" }, flexShrink: 0 }}
        >
          {summary}
        </LiveStatus>
      ) : null}
    </Stack>
    <InlineProgress
      active={progress}
      label="Updating results"
      sx={(theme) => ({
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        borderBottomLeftRadius: `${theme.wc.radius.lg}px`,
        borderBottomRightRadius: `${theme.wc.radius.lg}px`,
      })}
    />
  </Box>
);

/* ------------------------------------------------------------------ */
/* SearchField                                                         */
/* ------------------------------------------------------------------ */

export type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** Fires after `debounceMs` once the value has at least `minLength` chars (or is empty). */
  onDebouncedChange?: (value: string) => void;
  debounceMs?: number;
  /** Enter: the debounce is flushed first, then this is called. */
  onSubmit?: (value: string) => void;
  /** Escape or the clear button. */
  onClear?: () => void;
  placeholder?: string;
  /** Visually hidden label (required; the field has no floating label). */
  label: string;
  size?: "small" | "medium";
  loading?: boolean;
  /** Off by default; only the search dialog may take focus on mount. */
  autoFocus?: boolean;
  minLength?: number;
  id?: string;
  inputRef?: Ref<HTMLInputElement>;
  name?: string;
  disabled?: boolean;
  sx?: SxProps<Theme>;
};

const setRef = <T,>(ref: Ref<T> | undefined, value: T | null): void => {
  if (!ref) {
    return;
  }
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  (ref as { current: T | null }).current = value;
};

export const SearchField = ({
  value,
  onChange,
  onDebouncedChange,
  debounceMs = 350,
  onSubmit,
  onClear,
  placeholder,
  label,
  size = "medium",
  loading = false,
  autoFocus = false,
  minLength = 2,
  id,
  inputRef,
  name,
  disabled = false,
  sx,
}: SearchFieldProps): JSX.Element => {
  const generatedId = useId();
  const inputId = id ?? `search-${generatedId}`;
  const innerRef = useRef<HTMLInputElement | null>(null);
  const timerRef = useRef<number | null>(null);
  /** Last value handed to `onDebouncedChange` (or adopted from the parent). */
  const lastEmittedRef = useRef(value);
  /** Value the user just typed, awaiting the debounce; null when `value` changed externally. */
  const pendingRef = useRef<string | null>(null);
  const debouncedChangeRef = useRef(onDebouncedChange);
  debouncedChangeRef.current = onDebouncedChange;

  const qualifies = useCallback(
    (next: string): boolean =>
      next === "" || next.trim().length >= minLength,
    [minLength],
  );

  const cancelPending = useCallback((): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const emit = useCallback((next: string): void => {
    lastEmittedRef.current = next;
    debouncedChangeRef.current?.(next);
  }, []);

  /** Emits `next` immediately (Enter, clear) when it qualifies. */
  const flush = useCallback(
    (next: string): void => {
      cancelPending();
      if (qualifies(next) && next !== lastEmittedRef.current) {
        emit(next);
      }
    },
    [cancelPending, emit, qualifies],
  );

  useEffect(() => {
    if (pendingRef.current !== value) {
      // The parent changed `value` itself (URL navigation, reset): adopt it
      // without echoing it back through `onDebouncedChange`.
      pendingRef.current = null;
      lastEmittedRef.current = value;
      cancelPending();
      return undefined;
    }
    pendingRef.current = null;

    if (
      !debouncedChangeRef.current ||
      value === lastEmittedRef.current ||
      !qualifies(value)
    ) {
      cancelPending();
      return undefined;
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      emit(value);
    }, debounceMs);

    // Re-runs only when `value` changes (a new keystroke restarts the timer);
    // the callback is read through a ref so parent re-renders never cancel it.
    return cancelPending;
  }, [value, debounceMs, qualifies, cancelPending, emit]);

  const handleChange = (next: string): void => {
    pendingRef.current = next;
    onChange(next);
  };

  const handleClear = useCallback((): void => {
    pendingRef.current = "";
    onChange("");
    onClear?.();
    flush("");
    innerRef.current?.focus();
  }, [flush, onChange, onClear]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      flush(value);
      onSubmit?.(value);
      return;
    }

    if (event.key === "Escape") {
      if (value.length > 0) {
        event.preventDefault();
        handleClear();
      }
    }
  };

  const assignRef = useCallback(
    (node: HTMLInputElement | null): void => {
      innerRef.current = node;
      setRef(inputRef, node);
    },
    [inputRef],
  );

  const showClear = value.length > 0 && !disabled;

  return (
    <Box
      sx={[
        { position: "relative", flex: "1 1 240px", minWidth: 240, maxWidth: "100%" },
        ...toSxArray(sx),
      ]}
    >
      <Box component="label" htmlFor={inputId} sx={visuallyHidden}>
        {label}
      </Box>
      <TextField
        id={inputId}
        name={name}
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        size={size}
        variant="outlined"
        fullWidth
        autoFocus={autoFocus}
        disabled={disabled}
        inputRef={assignRef}
        slotProps={{
          htmlInput: {
            type: "search",
            enterKeyHint: "search",
            autoComplete: "off",
            spellCheck: false,
          },
          input: {
            startAdornment: (
              <InputAdornment position="start" sx={{ color: "text.secondary" }}>
                <SearchRounded fontSize="small" />
              </InputAdornment>
            ),
            endAdornment:
              loading || showClear ? (
                <InputAdornment position="end" sx={{ gap: 0.5 }}>
                  {loading ? (
                    <CircularProgress
                      size={16}
                      thickness={5}
                      aria-label="Searching"
                    />
                  ) : null}
                  {showClear ? (
                    <IconButton
                      aria-label="Clear search"
                      size="small"
                      edge="end"
                      onClick={handleClear}
                    >
                      <CloseRounded fontSize="small" />
                    </IconButton>
                  ) : null}
                </InputAdornment>
              ) : null,
            sx: {
              "& input::-webkit-search-cancel-button, & input::-webkit-search-decoration":
                {
                  WebkitAppearance: "none",
                  appearance: "none",
                  display: "none",
                },
            },
          },
        }}
      />
    </Box>
  );
};

/* ------------------------------------------------------------------ */
/* FilterChipGroup                                                     */
/* ------------------------------------------------------------------ */

export type FilterOption<V extends string = string> = {
  value: V;
  label: string;
  count?: number;
  disabled?: boolean;
  icon?: ReactElement;
};

export type FilterChipGroupProps<V extends string = string> = {
  /** Accessible name of the group. */
  label: string;
  options: ReadonlyArray<FilterOption<V>>;
  /** `null` = the "All" option. */
  value: V | null;
  onChange: (value: V | null) => void;
  allLabel?: string;
  size?: "small" | "medium";
  /** Hide the "All" chip (when the group is not clearable). */
  hideAll?: boolean;
  sx?: SxProps<Theme>;
};

const chipLabel = (label: string, count?: number): string =>
  typeof count === "number" ? `${label} (${formatNumber(count)})` : label;

/** Single-select chip row; the pressed state is exposed via `aria-pressed`. */
export const FilterChipGroup = <V extends string = string>({
  label,
  options,
  value,
  onChange,
  allLabel = "All",
  size = "medium",
  hideAll = false,
  sx,
}: FilterChipGroupProps<V>): JSX.Element => (
  <Stack
    role="group"
    aria-label={label}
    direction="row"
    flexWrap="wrap"
    useFlexGap
    gap={1}
    alignItems="center"
    sx={[{ minWidth: 0 }, ...toSxArray(sx)]}
  >
    {hideAll ? null : (
      <Chip
        label={allLabel}
        size={size}
        variant="outlined"
        clickable
        aria-pressed={value === null}
        onClick={() => onChange(null)}
      />
    )}
    {options.map((option) => {
      const pressed = option.value === value;
      return (
        <Chip
          key={option.value}
          label={chipLabel(option.label, option.count)}
          size={size}
          variant="outlined"
          clickable
          disabled={option.disabled}
          aria-pressed={pressed}
          icon={option.icon}
          onClick={() => onChange(pressed ? null : option.value)}
        />
      );
    })}
  </Stack>
);

/* ------------------------------------------------------------------ */
/* SegmentedControl                                                    */
/* ------------------------------------------------------------------ */

export type SegmentedOption<V extends string = string> = {
  value: V;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
};

export type SegmentedControlProps<V extends string = string> = {
  label: string;
  options: ReadonlyArray<SegmentedOption<V>>;
  value: V;
  onChange: (value: V) => void;
  size?: "small" | "medium";
  sx?: SxProps<Theme>;
};

/** Exclusive toggle group (view / sort switches). Always keeps one value selected. */
export const SegmentedControl = <V extends string = string>({
  label,
  options,
  value,
  onChange,
  size = "medium",
  sx,
}: SegmentedControlProps<V>): JSX.Element => (
  <ToggleButtonGroup
    exclusive
    value={value}
    size={size}
    aria-label={label}
    onChange={(_event, next: V | null) => {
      if (next !== null && next !== value) {
        onChange(next);
      }
    }}
    sx={[{ flexShrink: 0 }, ...toSxArray(sx)]}
  >
    {options.map((option) => (
      <ToggleButton
        key={option.value}
        value={option.value}
        aria-label={option.label}
        disabled={option.disabled}
        sx={{ gap: 0.75 }}
      >
        {option.icon}
        {option.label}
      </ToggleButton>
    ))}
  </ToggleButtonGroup>
);

export default ExplorerFilterBar;
