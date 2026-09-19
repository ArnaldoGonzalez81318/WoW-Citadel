import CloseRounded from "@mui/icons-material/CloseRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import {
  Box,
  ClickAwayListener,
  Dialog,
  IconButton,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { SearchField } from "@/components/common/ExplorerFilterBar";
import { LiveStatus } from "@/components/common/StateBlocks";
import {
  buildSearchUrl,
  isTypingTarget,
} from "@/components/layout/navigation/navUtils";
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

export type HeaderSearchAutocompleteProps = {
  query: string;
  anchorEl: HTMLElement | null;
  open: boolean;
  activeIndex: number;
  listboxId: string;
  onOptionsChange: (options: SuggestionOption[]) => void;
  onSelect: (option: SuggestionOption) => void;
  onHoverIndex: (index: number) => void;
};

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/**
 * Static on purpose: features/search/categories.ts lives in the
 * "search-experience" manual chunk and importing it here would make that
 * chunk an eager dependency of the shell.
 */
const PLACEHOLDER = "Search items, spells, mounts, creatures";
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 350;

/**
 * The suggestion list pulls in useBlizzardSearch (search-experience chunk),
 * so it is only ever imported dynamically; the field itself never unmounts.
 */
const loadAutocomplete = () =>
  import("@/components/layout/HeaderSearchAutocomplete");
const HeaderSearchAutocomplete = lazy(loadAutocomplete);

const qualifies = (value: string): boolean =>
  value.trim().length >= MIN_QUERY_LENGTH;

/* ------------------------------------------------------------------ */
/* SearchCombobox                                                      */
/* ------------------------------------------------------------------ */

type SearchComboboxProps = {
  id: string;
  /** Only the search dialog takes focus on mount. */
  autoFocus?: boolean;
  onNavigated?: () => void;
  size?: "small" | "medium";
};

const SearchCombobox = ({
  id,
  autoFocus = false,
  onNavigated,
  size = "small",
}: SearchComboboxProps): JSX.Element => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { query, submitQuery, clearQuery, pushRecentSearch } = useSearchState();

  const [draft, setDraft] = useState(query);
  const [debounced, setDebounced] = useState(qualifies(query) ? query : "");
  const [enhanced, setEnhanced] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [options, setOptions] = useState<SuggestionOption[]>([]);
  const [wrapperEl, setWrapperEl] = useState<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = `${id}-listbox`;

  /* Adopt an external query change (URL -> SearchProvider) without opening the list. */
  const lastQueryRef = useRef(query);
  useEffect(() => {
    if (query === lastQueryRef.current) {
      return;
    }
    lastQueryRef.current = query;
    setDraft(query);
    setDebounced("");
    setListOpen(false);
  }, [query]);

  const closeList = useCallback((): void => {
    setListOpen(false);
    setActiveIndex(-1);
  }, []);

  /* Route change closes the list. */
  useEffect(() => {
    closeList();
  }, [pathname, closeList]);

  const handleDebouncedChange = (value: string): void => {
    setDebounced(value);
    setActiveIndex(-1);
    setListOpen(qualifies(value));
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
        return;
      }
      closeList();
      lastQueryRef.current = trimmed;
      setDraft(trimmed);
      submitQuery(trimmed);
      onNavigated?.();
    },
    [draft, closeList, onNavigated, submitQuery],
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
      setDraft(option.name);
      pushRecentSearch(option.name);
      navigate(
        `${buildSearchUrl(option.name)}&cat=${encodeURIComponent(option.categoryId)}`,
      );
      onNavigated?.();
    },
    [closeList, navigate, onNavigated, pushRecentSearch, submit],
  );

  const handleClear = (): void => {
    setDraft("");
    setDebounced("");
    lastQueryRef.current = "";
    clearQuery();
    closeList();
  };

  /* Combobox ARIA on the input (SearchField has no attribute passthrough). */
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-haspopup", "listbox");
    input.setAttribute("aria-expanded", listOpen ? "true" : "false");
    if (listOpen) {
      input.setAttribute("aria-controls", listboxId);
    } else {
      input.removeAttribute("aria-controls");
    }
    if (listOpen && activeIndex >= 0 && activeIndex < options.length) {
      input.setAttribute(
        "aria-activedescendant",
        `${listboxId}-opt-${activeIndex}`,
      );
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }, [listOpen, activeIndex, options.length, listboxId]);

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

  return (
    <ClickAwayListener onClickAway={handleClickAway}>
      <Box
        ref={setWrapperEl}
        onKeyDownCapture={handleKeyDownCapture}
        onKeyDown={handleKeyDown}
        onFocus={enhance}
        onPointerEnter={preload}
        sx={{ position: "relative", minWidth: 0 }}
      >
        <SearchField
          id={id}
          value={draft}
          onChange={setDraft}
          onDebouncedChange={handleDebouncedChange}
          debounceMs={DEBOUNCE_MS}
          minLength={MIN_QUERY_LENGTH}
          label="Search the game data"
          placeholder={PLACEHOLDER}
          autoFocus={autoFocus}
          inputRef={inputRef}
          onSubmit={submit}
          onClear={handleClear}
          size={size}
          sx={{ flex: "1 1 auto", minWidth: 0 }}
        />
        {listOpen ? (
          <LiveStatus visuallyHidden>{`${options.length} suggestions`}</LiveStatus>
        ) : null}
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
            />
          </Suspense>
        ) : null}
      </Box>
    </ClickAwayListener>
  );
};

/* ------------------------------------------------------------------ */
/* HeaderSearch                                                        */
/* ------------------------------------------------------------------ */

const DIALOG_TITLE_ID = "site-search-dialog-title";

/**
 * Inline combobox at md+, a full-screen search dialog below. `/` and
 * Ctrl/Cmd+K focus the field (or open the dialog).
 */
const HeaderSearch = (): JSX.Element => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [dialogOpen, setDialogOpen] = useState(false);
  const inlineRef = useRef<HTMLDivElement | null>(null);

  const closeDialog = useCallback((): void => setDialogOpen(false), []);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      const isCommandK =
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "k";
      const isSlash =
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isTypingTarget(event.target);

      if (!isCommandK && !isSlash) {
        return;
      }
      event.preventDefault();

      if (isDesktop) {
        inlineRef.current?.querySelector("input")?.focus();
        return;
      }
      setDialogOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDesktop]);

  return (
    <>
      <Box
        role="search"
        ref={inlineRef}
        sx={{
          display: { xs: "none", md: "block" },
          flex: "1 1 auto",
          minWidth: { md: 200, lg: 240 },
          maxWidth: 440,
          ml: "auto",
        }}
      >
        <Tooltip
          title="Press / to search"
          describeChild
          disableFocusListener
          enterDelay={600}
        >
          <Box>
            <SearchCombobox id="site-search" />
          </Box>
        </Tooltip>
      </Box>

      <IconButton
        aria-label="Open search"
        aria-haspopup="dialog"
        aria-expanded={dialogOpen}
        size="large"
        onClick={() => setDialogOpen(true)}
        sx={{ display: { xs: "inline-flex", md: "none" }, ml: "auto" }}
      >
        <SearchRounded />
      </IconButton>

      <Dialog
        fullScreen
        open={dialogOpen}
        onClose={closeDialog}
        aria-labelledby={DIALOG_TITLE_ID}
      >
        <Toolbar
          sx={{
            minHeight: theme.wc.layout.headerHeight.xs,
            gap: 1,
            borderBottom: `1px solid ${theme.palette.border.subtle}`,
          }}
        >
          <Typography
            id={DIALOG_TITLE_ID}
            component="h2"
            variant="h6"
            sx={{ flex: 1 }}
          >
            Search
          </Typography>
          <IconButton aria-label="Close search" onClick={closeDialog} edge="end">
            <CloseRounded />
          </IconButton>
        </Toolbar>
        <Box role="search" sx={{ p: 2 }}>
          <SearchCombobox
            id="site-search-dialog"
            autoFocus
            onNavigated={closeDialog}
            size="medium"
          />
        </Box>
      </Dialog>
    </>
  );
};

export default HeaderSearch;
