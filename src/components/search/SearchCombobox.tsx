import { Box, ClickAwayListener } from "@mui/material";
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { FocusEvent, KeyboardEvent, Ref } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { SearchField } from "@/components/common/ExplorerFilterBar";
import { LiveStatus } from "@/components/common/StateBlocks";
import { searchUrl } from "@/features/search/config/searchRoutes";
import { useSearchState } from "@/features/search/context/SearchContext";
import type { ItemQuality } from "@/features/search/types";

/* ------------------------------------------------------------------ */
/* Types shared with the lazily loaded suggestion list                 */
/* ------------------------------------------------------------------ */

export type SuggestionOption = {
  id: string;
  name: string;
  /** Search category; absent for the "See all results" row. */
  categoryId?: string;
  categoryLabel?: string;
  subtitle?: string;
  mediaUrl?: string;
  quality?: ItemQuality;
};

/** Where the suggestion list is for the current term. */
export type SuggestionStatus = "idle" | "loading" | "results" | "empty" | "error";

export type HeaderSearchAutocompleteProps = {
  query: string;
  anchorEl: HTMLElement | null;
  open: boolean;
  activeIndex: number;
  listboxId: string;
  onOptionsChange: (options: SuggestionOption[]) => void;
  onSelect: (option: SuggestionOption) => void;
  onHoverIndex: (index: number) => void;
  /**
   * Reports whether the `<ul role="listbox">` is actually in the DOM, so the
   * input's aria-expanded / aria-controls never reference a missing element
   * (lazy chunk still loading, first fetch in flight, or list closed).
   */
  onVisibleChange: (visible: boolean) => void;
  /**
   * Reported from an effect as a primitive, never an object, so the parent's
   * state update cannot loop back into a new value (see combineMediaUrls).
   */
  onStatusChange: (status: SuggestionStatus) => void;
};

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/**
 * Static on purpose: features/search/categories.ts ships in the
 * Rollup-generated shared chunk (useBlizzardSearch-*.js, together with
 * searchService and the hook). This module is in the shell (index) chunk, so
 * a static import of categories.ts would make that chunk an eager dependency
 * of every page. Hosts pass their own copy via `label` / `placeholder`.
 */
const PLACEHOLDER = "Search items, spells, mounts, creatures";
const DEFAULT_LABEL = "Search the game data";
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 350;

/** aria-keyshortcuts for the field the global `/` and Ctrl/Cmd+K shortcuts focus. */
export const SEARCH_KEY_SHORTCUTS = "/ Control+K Meta+K";

/**
 * The suggestion list pulls in useBlizzardSearch (and with it categories.ts
 * and searchService), so it is only ever imported dynamically; the field
 * itself never unmounts.
 */
const loadAutocomplete = () =>
  import("@/components/layout/HeaderSearchAutocomplete");
const HeaderSearchAutocomplete = lazy(loadAutocomplete);

const qualifies = (value: string): boolean =>
  value.trim().length >= MIN_QUERY_LENGTH;

/* ------------------------------------------------------------------ */
/* SearchCombobox                                                      */
/* ------------------------------------------------------------------ */

export type SearchComboboxHandle = {
  /** `select` also selects the current text so typing replaces it (the `/` shortcut). */
  focus: (options?: { select?: boolean }) => void;
  /** Same as Enter with no active option (the minimum length still applies). */
  submit: () => void;
};

export type SearchComboboxProps = {
  id: string;
  /** Only the search dialog takes focus on mount. */
  autoFocus?: boolean;
  onNavigated?: () => void;
  size?: "small" | "medium";
  label?: string;
  placeholder?: string;
  /** Space-separated ids for the input's aria-describedby (SearchField has no attribute passthrough). */
  describedBy?: string;
  /** aria-keyshortcuts, only on the input the global shortcuts actually focus. */
  keyShortcuts?: string;
  /** Enter / submit() with fewer than the minimum characters; nothing navigates either way. */
  onSubmitTooShort?: (minLength: number) => void;
  /** A plain prop, not forwardRef: React 18 has no ref-as-prop and the repo uses no forwardRef. */
  handleRef?: Ref<SearchComboboxHandle>;
};

/**
 * Search field with grouped live suggestions: the header's inline field, its
 * mobile dialog and the home hero all render this. Hosts own their layout
 * (buttons, hints); this owns the draft, the listbox and where a choice lands.
 */
const SearchCombobox = ({
  id,
  autoFocus = false,
  onNavigated,
  size = "small",
  label = DEFAULT_LABEL,
  placeholder = PLACEHOLDER,
  describedBy,
  keyShortcuts,
  onSubmitTooShort,
  handleRef,
}: SearchComboboxProps): JSX.Element => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { query, submitQuery, clearQuery, pushRecentSearch } = useSearchState();

  const [draft, setDraft] = useState(query);
  const [debounced, setDebounced] = useState(qualifies(query) ? query : "");
  const [enhanced, setEnhanced] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  /** True only while the suggestion `<ul role="listbox">` exists in the DOM. */
  const [listVisible, setListVisible] = useState(false);
  const [status, setStatus] = useState<SuggestionStatus>("idle");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [options, setOptions] = useState<SuggestionOption[]>([]);
  const [wrapperEl, setWrapperEl] = useState<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = `${id}-listbox`;

  /**
   * Mirror of SearchField's own "last emitted" value: it never re-emits a
   * value equal to its last emission or to a value the parent set
   * programmatically, so every programmatic draft change goes through
   * `adoptDraft` to keep the two in step.
   */
  const fieldEmittedRef = useRef(query);
  const adoptDraft = useCallback((value: string): void => {
    fieldEmittedRef.current = value;
    setDraft(value);
  }, []);

  /* Adopt an external query change (URL -> SearchProvider) without opening the list. */
  const lastQueryRef = useRef(query);
  useEffect(() => {
    if (query === lastQueryRef.current) {
      return;
    }
    lastQueryRef.current = query;
    adoptDraft(query);
    setDebounced("");
    setListOpen(false);
  }, [query, adoptDraft]);

  const closeList = useCallback((): void => {
    setListOpen(false);
    setActiveIndex(-1);
  }, []);

  /* Route change closes the list. */
  useEffect(() => {
    closeList();
  }, [pathname, closeList]);

  const handleDebouncedChange = (value: string): void => {
    fieldEmittedRef.current = value;
    setDebounced(value);
    setActiveIndex(-1);
    setListOpen(qualifies(value));
  };

  /**
   * SearchField only debounces values that qualify, so a draft shrinking
   * below the minimum never reaches `handleDebouncedChange`: drop the stale
   * suggestions here, immediately. When the user retypes exactly the last
   * emitted value, SearchField stays silent; reopen at once (react-query
   * already holds those results).
   */
  const handleDraftChange = (value: string): void => {
    setDraft(value);
    // Editing hands focus back to the text: Enter now searches what was
    // typed, not a suggestion highlighted for an earlier term.
    setActiveIndex(-1);
    if (!qualifies(value)) {
      setDebounced("");
      closeList();
      return;
    }
    if (value === fieldEmittedRef.current && value !== debounced) {
      setDebounced(value);
      setListOpen(true);
    }
  };

  const enhance = (): void => {
    if (!enhanced) {
      setEnhanced(true);
    }
  };

  const preload = (): void => {
    enhance();
    loadAutocomplete().catch(() => undefined);
  };

  /**
   * Enter / "See all results": SearchContext owns where a submitted term
   * lands (`/search?q=`, or the current search route's own `?q=`), records it
   * in recent searches and clears any pending header draft.
   */
  const submit = useCallback(
    (value: string = draft): void => {
      const trimmed = value.trim();
      if (trimmed.length < MIN_QUERY_LENGTH) {
        onSubmitTooShort?.(MIN_QUERY_LENGTH);
        return;
      }
      closeList();
      lastQueryRef.current = trimmed;
      adoptDraft(trimmed);
      submitQuery(trimmed);
      onNavigated?.();
    },
    [draft, adoptDraft, closeList, onNavigated, onSubmitTooShort, submitQuery],
  );

  /**
   * A category suggestion opens the results page on that category's tab.
   * SearchPage reads the tab from `?cat=`; on `/search` the URL is the
   * source of truth for `query`, so no context write is needed.
   */
  const handleSelect = useCallback(
    (option: SuggestionOption): void => {
      if (!option.categoryId) {
        submit(option.name);
        return;
      }
      closeList();
      lastQueryRef.current = option.name;
      adoptDraft(option.name);
      pushRecentSearch(option.name);
      navigate(searchUrl(option.name, option.categoryId));
      onNavigated?.();
    },
    [adoptDraft, closeList, navigate, onNavigated, pushRecentSearch, submit],
  );

  useImperativeHandle(
    handleRef,
    () => ({
      focus: ({ select = false } = {}) => {
        const input = inputRef.current;
        if (!input) {
          return;
        }
        input.focus();
        if (select) {
          input.select();
        }
      },
      submit: () => submit(),
    }),
    [submit],
  );

  const handleClear = (): void => {
    adoptDraft("");
    setDebounced("");
    lastQueryRef.current = "";
    clearQuery();
    closeList();
  };

  /*
   * Categories answer independently, so a late one inserts rows ahead of the
   * highlighted option. Follow that option by identity; otherwise the same
   * index (and aria-activedescendant id) would silently point at another row.
   */
  const previousOptionsRef = useRef<SuggestionOption[]>(options);
  useLayoutEffect(() => {
    const previous = previousOptionsRef.current;
    previousOptionsRef.current = options;
    if (previous === options) {
      return;
    }
    setActiveIndex((index) => {
      // Nothing highlighted, or ArrowDown/ArrowUp opened a list whose rows
      // had not arrived yet: keep that intent.
      if (index < 0 || previous.length === 0) {
        return index;
      }
      const activeId = previous[index]?.id;
      return activeId === undefined
        ? -1
        : options.findIndex((option) => option.id === activeId);
    });
  }, [options]);

  /*
   * Combobox ARIA on the input (SearchField has no attribute passthrough).
   * Driven by `listVisible`, not `listOpen`: the listbox element only exists
   * once the lazy chunk has mounted and the Popper is showing, and
   * aria-controls must never point at an id that is not in the DOM.
   */
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-haspopup", "listbox");
    input.setAttribute("aria-expanded", listVisible ? "true" : "false");
    if (listVisible) {
      input.setAttribute("aria-controls", listboxId);
    } else {
      input.removeAttribute("aria-controls");
    }
    if (listVisible && activeIndex >= 0 && activeIndex < options.length) {
      input.setAttribute(
        "aria-activedescendant",
        `${listboxId}-opt-${activeIndex}`,
      );
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }, [listVisible, activeIndex, options.length, listboxId]);

  /* Host-provided ARIA, kept apart from the combobox state above. */
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    if (describedBy) {
      input.setAttribute("aria-describedby", describedBy);
    } else {
      input.removeAttribute("aria-describedby");
    }
    if (keyShortcuts) {
      input.setAttribute("aria-keyshortcuts", keyShortcuts);
    } else {
      input.removeAttribute("aria-keyshortcuts");
    }
  }, [describedBy, keyShortcuts]);

  /* Capture phase: runs before SearchField's own Enter / Escape handling. */
  const handleKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!listOpen) {
        if (!qualifies(debounced)) {
          return;
        }
        event.preventDefault();
        enhance();
        setListOpen(true);
        setActiveIndex(event.key === "ArrowDown" ? 0 : options.length - 1);
        return;
      }
      if (options.length === 0) {
        return;
      }
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((previous) => {
        const base = previous < 0 ? (delta > 0 ? -1 : 0) : previous;
        return (base + delta + options.length) % options.length;
      });
      return;
    }

    if (event.key === "Enter" && listOpen && activeIndex >= 0) {
      const option = options[activeIndex];
      if (option) {
        event.preventDefault();
        event.stopPropagation();
        handleSelect(option);
      }
      return;
    }

    if (event.key === "Escape" && listOpen) {
      // First Escape closes the list; the next one reaches SearchField and clears.
      event.preventDefault();
      event.stopPropagation();
      closeList();
      return;
    }

    if (event.key === "Tab") {
      closeList();
    }
  };

  /* Bubble phase: SearchField has already cleared the field on this Escape. */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Escape" && draft.length > 0) {
      // Keep the search dialog open while there was text to clear.
      event.stopPropagation();
    }
  };

  /*
   * Focus moved to another element without a key or click here (the `/` or
   * Ctrl+K shortcut jumping between the header and the hero): close the list
   * so it is not left floating. A null relatedTarget (window switch, click on
   * nothing focusable) is ClickAwayListener's call; option rows and the
   * footer swallow mousedown, so clicks inside the panel never blur.
   */
  const handleBlur = (event: FocusEvent<HTMLDivElement>): void => {
    const next = event.relatedTarget;
    if (
      next instanceof Element &&
      !event.currentTarget.contains(next) &&
      !next.closest(`[data-search-popup="${listboxId}"]`)
    ) {
      closeList();
    }
  };

  /* The list is portaled, so a click inside it counts as "away" for the wrapper. */
  const handleClickAway = (event: Event): void => {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest(`[data-search-popup="${listboxId}"]`)
    ) {
      return;
    }
    closeList();
  };

  const showSuggestions = enhanced && qualifies(debounced);

  const announcement = !listVisible
    ? ""
    : status === "error"
      ? "Couldn't load suggestions"
      : options.length > 0
        ? `${options.length} suggestion${options.length === 1 ? "" : "s"}`
        : status === "empty"
          ? "No matches"
          : "";

  return (
    <ClickAwayListener onClickAway={handleClickAway}>
      <Box
        ref={setWrapperEl}
        onKeyDownCapture={handleKeyDownCapture}
        onKeyDown={handleKeyDown}
        onFocus={preload}
        onBlur={handleBlur}
        onPointerEnter={preload}
        sx={{ position: "relative", minWidth: 0 }}
      >
        <SearchField
          id={id}
          value={draft}
          onChange={handleDraftChange}
          onDebouncedChange={handleDebouncedChange}
          debounceMs={DEBOUNCE_MS}
          minLength={MIN_QUERY_LENGTH}
          label={label}
          placeholder={placeholder}
          autoFocus={autoFocus}
          inputRef={inputRef}
          onSubmit={submit}
          onClear={handleClear}
          loading={listOpen && status === "loading" && !listVisible}
          size={size}
          sx={{ flex: "1 1 auto", minWidth: 0 }}
        />
        {/* Always mounted: a live region inserted together with its first text is not reliably announced. */}
        <LiveStatus visuallyHidden>{announcement}</LiveStatus>
        {showSuggestions ? (
          <Suspense fallback={null}>
            <HeaderSearchAutocomplete
              query={debounced}
              anchorEl={wrapperEl}
              open={listOpen}
              activeIndex={activeIndex}
              listboxId={listboxId}
              onOptionsChange={setOptions}
              onSelect={handleSelect}
              onHoverIndex={setActiveIndex}
              onVisibleChange={setListVisible}
              onStatusChange={setStatus}
            />
          </Suspense>
        ) : null}
      </Box>
    </ClickAwayListener>
  );
};

export default SearchCombobox;
