import CategoryRoundedIcon from "@mui/icons-material/CategoryRounded";
import ExtensionRoundedIcon from "@mui/icons-material/ExtensionRounded";
import LinkOffRoundedIcon from "@mui/icons-material/LinkOffRounded";
import SchemaRoundedIcon from "@mui/icons-material/SchemaRounded";
import { Box, Button, Chip, Pagination, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ExplorerFilterBar,
  SearchField,
  SegmentedControl,
} from "@/components/common/ExplorerFilterBar";
import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/common/StateBlocks";
import CardGrid, { CardGridSkeleton } from "@/features/modifiedCrafting/components/CardGrid";
import CategoryCard, {
  CATEGORY_CARD_HEIGHT,
} from "@/features/modifiedCrafting/components/CategoryCard";
import type { AcceptedCount } from "@/features/modifiedCrafting/components/CategoryCard";
import HowItWorks, { HOW_IT_WORKS_ID } from "@/features/modifiedCrafting/components/HowItWorks";
import type { LiveCount } from "@/features/modifiedCrafting/components/HowItWorks";
import ModifierDialog from "@/features/modifiedCrafting/components/ModifierDialog";
import ResultsSection from "@/features/modifiedCrafting/components/ResultsSection";
import SearchResults from "@/features/modifiedCrafting/components/SearchResults";
import SlotLinksPanel from "@/features/modifiedCrafting/components/SlotLinksPanel";
import SlotTypeCard, { SLOT_CARD_HEIGHT } from "@/features/modifiedCrafting/components/SlotTypeCard";
import { THEME_ICONS } from "@/features/modifiedCrafting/components/ThemeGlyph";
import ThemeTilePicker, {
  THEME_TILE_COLS,
  THEME_TILE_GAP,
  THEME_TILE_HEIGHT,
} from "@/features/modifiedCrafting/components/ThemeTilePicker";
import type { ThemeTile } from "@/features/modifiedCrafting/components/ThemeTilePicker";
import { scrollToStart } from "@/features/modifiedCrafting/components/cardStyles";
import {
  THEME_LOCALE,
  categoryIndexQuery,
  slotTypeIndexQuery,
} from "@/features/modifiedCrafting/hooks/modifiedCraftingQueries";
import useRetainedError from "@/features/modifiedCrafting/hooks/useRetainedError";
import { useSlotLinks } from "@/features/modifiedCrafting/hooks/useSlotLinks";
import {
  groupByCategoryId,
  groupCategories,
} from "@/features/modifiedCrafting/services/categoryGroups";
import {
  categoryName,
  pluralize,
  slotTypeName,
} from "@/features/modifiedCrafting/services/modifiedCraftingService";
import {
  DEFAULT_SLOT_THEME,
  SLOT_THEMES,
  SLOT_THEME_BY_ID,
  accentColor,
  isSlotThemeId,
  themeMapOf,
} from "@/features/modifiedCrafting/services/slotThemes";
import type { SlotThemeId } from "@/features/modifiedCrafting/services/slotThemes";
import type {
  CategoryGroup,
  CategoryRef,
  ModifierTarget,
  SlotTypeRef,
} from "@/features/modifiedCrafting/types";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import { MIN_FUZZY_QUERY_LENGTH, normalizeForSearch, rankByName } from "@/lib/fuzzyMatch";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

type View = "slots" | "categories";

const URL_DEFAULTS = { view: "", group: "", slot: "", category: "", q: "", page: "" };
const CATEGORIES_VIEW = "categories";
/** The categories view's filter for categories no slot type accepts. */
const NO_SLOT_GROUP = "none";
const SLOT_PAGE_SIZE = 24;
const CATEGORY_PAGE_SIZE = 48;
/** Eleven themes: what the picker shows before the index lands. */
const THEME_SKELETON_COUNT = SLOT_THEMES.length;
const EMPTY_SLOTS: SlotTypeRef[] = [];
const EMPTY_CATEGORIES: CategoryRef[] = [];

const VIEW_OPTIONS = [
  { value: "slots", label: "Slot types", icon: <ExtensionRoundedIcon fontSize="small" /> },
  { value: "categories", label: "Categories", icon: <CategoryRoundedIcon fontSize="small" /> },
] as const;

const parseId = (value: string): number | null => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const liveCount = (list: readonly unknown[] | undefined, error: unknown): LiveCount => {
  if (list) {
    return list.length;
  }
  return error !== undefined ? "failed" : null;
};

/** "25–48 of 230 slot types" on a paged list, "19 slot types" on a short one. */
const pageSummary = (
  page: number,
  pageSize: number,
  total: number,
  one: string,
  many: string,
): string => {
  if (total <= pageSize) {
    return pluralize(total, one, many);
  }
  const start = (page - 1) * pageSize;
  return `${formatNumber(start + 1)}–${formatNumber(Math.min(start + pageSize, total))} of ${pluralize(total, one, many)}`;
};

/** Whether `name` has the typed number as one of its words ("01" in "Rare Ore 01"). */
const hasNumberWord = (name: string | null, query: string): boolean => {
  const digits = query.replace(/^#/, "");
  return name !== null && normalizeForSearch(name).split(" ").includes(digits);
};

/** "709" or "#709": an id lookup rather than a name search. */
const parseIdQuery = (query: string): number | null => {
  const match = /^#?(\d{1,6})$/.exec(query.trim());
  return match ? parseId(match[1]) : null;
};

/**
 * Modified Crafting: the reagent slots recipes offer (named materials,
 * embellishments, stat missives, sparks, finishing reagents) and what fits
 * each. Slot types are sorted into themes by their names, shown as
 * colour-coded tiles with counts; a theme's slot types are cards that load
 * their record (the categories they accept) and a reagent's icon near the
 * viewport. The categories view collapses same-name categories, shows each
 * one's reagents from the item search, and, once every slot type record has
 * been read (389, six at a time, only in that view or once a category
 * dialog's "Accepted by" section comes into view), which slot types accept
 * it. One search covers both lists; the dialog walks the relation either
 * way. View, theme, page, search and the open slot type or category all
 * live in the URL.
 */
const ModifiedCraftingPage = ({
  eyebrow = "Collectibles & Gear",
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const [params, setParams] = useSearchParamsRecord(URL_DEFAULTS);
  const navigate = useNavigate();

  const slotIndex = useQuery(slotTypeIndexQuery());
  // The same query as above when the app is in English; else one more request.
  const englishIndex = useQuery(slotTypeIndexQuery(THEME_LOCALE));
  const categoryIndex = useQuery(categoryIndexQuery());
  // A Retry puts an index back to pending; these keep its error (and the
  // focused Retry button) on screen until it lands or fails again.
  const slotIndexError = useRetainedError("slot-index", slotIndex);
  const categoryIndexError = useRetainedError("category-index", categoryIndex);

  const slots = slotIndex.data ?? EMPTY_SLOTS;
  const categories = categoryIndex.data ?? EMPTY_CATEGORIES;
  // If the English list fails (a non-English app), the local names still
  // sort what they can rather than leaving the page without themes.
  const themeSource = englishIndex.data ?? (englishIndex.isError ? slotIndex.data : undefined);
  const themesReady = themeSource !== undefined;
  const themeOf = useMemo(() => themeMapOf(themeSource ?? EMPTY_SLOTS), [themeSource]);

  const slotById = useMemo(() => new Map(slots.map((slot) => [slot.id, slot])), [slots]);
  const slotIds = useMemo(() => slotIndex.data?.map((slot) => slot.id), [slotIndex.data]);
  const slotIdsByName = useMemo(() => {
    const map = new Map<string, number[]>();
    slots.forEach((slot) => {
      if (slot.name) {
        const ids = map.get(slot.name);
        if (ids) {
          ids.push(slot.id);
        } else {
          map.set(slot.name, [slot.id]);
        }
      }
    });
    map.forEach((ids) => ids.sort((left, right) => right - left));
    return map;
  }, [slots]);
  const slotsByTheme = useMemo(() => {
    const map = new Map<SlotThemeId, SlotTypeRef[]>();
    slots.forEach((slot) => {
      const theme = themeOf.get(slot.id) ?? "reagents";
      const list = map.get(theme);
      if (list) {
        list.push(slot);
      } else {
        map.set(theme, [slot]);
      }
    });
    // Blizzard numbers slot types as it adds them: newest expansion first.
    map.forEach((list) => list.sort((left, right) => right.id - left.id));
    return map;
  }, [slots, themeOf]);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const groups = useMemo(() => groupCategories(categories), [categories]);
  const groupOfCategory = useMemo(() => groupByCategoryId(groups), [groups]);
  // Unnamed categories get a card each but are no name: the "names" counts
  // leave them out (522 names and 9 unnamed on US).
  const namedGroupCount = useMemo(
    () => groups.filter((group) => group.name !== null).length,
    [groups],
  );
  const mostRepeated = useMemo(() => {
    const top = groups.reduce<CategoryGroup | null>(
      (best, group) => (group.name && group.ids.length > (best?.ids.length ?? 0) ? group : best),
      null,
    );
    return top?.name ? { name: top.name, count: top.ids.length } : null;
  }, [groups]);

  /* ---------------- View ---------------- */

  const view: View = params.view === CATEGORIES_VIEW ? "categories" : "slots";
  useEffect(() => {
    // "slots" is the default (no param); anything else unknown falls back to it.
    if (params.view !== "" && params.view !== CATEGORIES_VIEW) {
      setParams({ view: null }, { replace: true });
    }
  }, [params.view, setParams]);

  /* ---------------- Dialog target (URL) ---------------- */

  const slotParam = parseId(params.slot);
  const categoryParam = parseId(params.category);
  const target = useMemo<ModifierTarget | null>(() => {
    if (slotParam !== null) {
      return { kind: "slot", id: slotParam };
    }
    return categoryParam !== null ? { kind: "category", id: categoryParam } : null;
  }, [slotParam, categoryParam]);
  // The target outlives the URL param so the dialog never blanks while closing.
  const [shownTarget, setShownTarget] = useState<ModifierTarget | null>(target);
  if (
    target !== null &&
    (shownTarget === null || shownTarget.kind !== target.kind || shownTarget.id !== target.id)
  ) {
    setShownTarget(target);
  }

  // A category dialog's "Accepted by" section asks for the slot-link map as
  // it comes into view (not on open: a shared category link would otherwise
  // start 389 requests on load). Once asked, the map keeps loading while the
  // dialog stays open, even on a slot type it walked to.
  const [dialogWantsLinks, setDialogWantsLinks] = useState(false);
  if (target === null && dialogWantsLinks) {
    setDialogWantsLinks(false);
  }
  const requestLinks = useCallback((): void => setDialogWantsLinks(true), []);
  const links = useSlotLinks(slotIds, view === "categories" || dialogWantsLinks);

  /* ---------------- Theme (slots view) and filter (categories view) ---------------- */

  const themeCounts = useMemo(() => {
    const counts = new Map<SlotThemeId, number>();
    slotsByTheme.forEach((list, theme) => counts.set(theme, list.length));
    return counts;
  }, [slotsByTheme]);

  const requestedTheme = isSlotThemeId(params.group) ? params.group : null;
  // The most telling theme with slot types in it: embellishments on US.
  const defaultTheme = useMemo<SlotThemeId>(() => {
    if (!themesReady || slots.length === 0) {
      return DEFAULT_SLOT_THEME;
    }
    if ((themeCounts.get(DEFAULT_SLOT_THEME) ?? 0) > 0) {
      return DEFAULT_SLOT_THEME;
    }
    return SLOT_THEMES.find((theme) => (themeCounts.get(theme.id) ?? 0) > 0)?.id ?? DEFAULT_SLOT_THEME;
  }, [themesReady, slots.length, themeCounts]);
  const slotTheme: SlotThemeId = requestedTheme ?? defaultTheme;

  const categoryFilter =
    view === "categories" && (params.group === NO_SLOT_GROUP || requestedTheme !== null)
      ? params.group
      : "";

  // The address names the theme on screen (the default written in once the
  // themes are known); an unknown value falls back. The categories view's
  // default is every category, so it writes nothing.
  useEffect(() => {
    if (view === "slots") {
      if (themesReady && slots.length > 0 && params.group !== slotTheme) {
        setParams({ group: slotTheme }, { replace: true });
      }
      return;
    }
    if (params.group !== "" && params.group !== categoryFilter) {
      setParams({ group: null }, { replace: true });
    }
  }, [view, themesReady, slots.length, params.group, slotTheme, categoryFilter, setParams]);

  /* ---------------- Search (keystrokes stay local; the URL gets the debounced value) ---------------- */

  const search = params.q.trim();
  const searching = search !== "";
  const [draft, setDraft] = useState(params.q);
  const emittedRef = useRef(search);
  useEffect(() => {
    // The URL changed on its own (back button, a tile): adopt it.
    if (search !== emittedRef.current) {
      emittedRef.current = search;
      setDraft(search);
    }
  }, [search]);
  const handleSearch = useCallback(
    (value: string): void => {
      const next = value.trim();
      emittedRef.current = next;
      setParams({ q: next || null, page: null }, { replace: true });
    },
    [setParams],
  );
  // The field's own clear button and Escape keep focus in the field.
  const clearSearch = useCallback((): void => {
    emittedRef.current = "";
    setDraft("");
    setParams({ q: null, page: null }, { replace: true });
  }, [setParams]);

  const idQuery = parseIdQuery(search);
  const searchTooShort = searching && idQuery === null && search.length < MIN_FUZZY_QUERY_LENGTH;
  // Digits look up an id, then names carrying that number as a word ("Rare
  // Ore 01"); fuzzy matching would offer #729 for 709 as a one-digit typo.
  const slotMatches = useMemo(() => {
    if (!searching) {
      return EMPTY_SLOTS;
    }
    if (idQuery === null) {
      return rankByName(slots, search, slotTypeName, slots.length);
    }
    const exact = slotById.get(idQuery);
    const named = slots.filter((slot) => slot.id !== idQuery && hasNumberWord(slot.name, search));
    return exact ? [exact, ...named] : named;
  }, [searching, slots, search, idQuery, slotById]);
  const categoryMatches = useMemo(() => {
    if (!searching) {
      return [] as CategoryGroup[];
    }
    if (idQuery === null) {
      return rankByName(
        groups,
        search,
        (group) => categoryName({ id: group.newestId, name: group.name }),
        groups.length,
      );
    }
    const exact = groupOfCategory.get(idQuery);
    const named = groups.filter((group) => group !== exact && hasNumberWord(group.name, search));
    return exact ? [exact, ...named] : named;
  }, [searching, groups, search, idQuery, groupOfCategory]);

  /* ---------------- Focus: a pick moves focus to the section it changed ---------------- */

  const mainHeadingRef = useRef<HTMLHeadingElement>(null);
  const pendingFocusRef = useRef(false);
  const requestFocus = useCallback((): void => {
    pendingFocusRef.current = true;
  }, []);
  // Bring the section into view if it starts off screen (on phones the
  // tiles fill it) and move focus to its heading, so the next Tab continues
  // in the cards the pick brought up.
  const revealMain = useCallback((): void => {
    const heading = mainHeadingRef.current;
    if (!heading) {
      return;
    }
    const top = heading.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.75) {
      scrollToStart(heading.closest("section"));
    }
    heading.focus({ preventScroll: true });
  }, []);
  // After the pick has rendered. Without a heading to go to (a failed
  // index), the request is dropped so a later Retry never steals focus.
  useEffect(() => {
    if (pendingFocusRef.current) {
      pendingFocusRef.current = false;
      revealMain();
    }
  });

  const selectTheme = useCallback(
    (value: string): void => {
      // The theme already on screen: nothing re-renders, so reveal it now.
      if (value === slotTheme && !searching && params.page === "") {
        revealMain();
        return;
      }
      requestFocus();
      setParams({ group: value, page: null, q: null });
    },
    [slotTheme, searching, params.page, revealMain, requestFocus, setParams],
  );
  const selectCategoryFilter = useCallback(
    (value: string): void => {
      if (value === categoryFilter && !searching && params.page === "") {
        revealMain();
        return;
      }
      requestFocus();
      setParams({ group: value === "" ? null : value, page: null, q: null });
    },
    [categoryFilter, searching, params.page, revealMain, requestFocus, setParams],
  );
  const changeView = useCallback(
    (next: View): void => {
      setParams({ view: next === "slots" ? null : CATEGORIES_VIEW, group: null, page: null, q: null });
    },
    [setParams],
  );

  // The results' button unmounts with them: focus goes to what replaces them.
  const leaveSearch = useCallback((): void => {
    requestFocus();
    clearSearch();
  }, [requestFocus, clearSearch]);

  /* ---------------- Slot-link derived counts ---------------- */

  // Theme counts need the themes too, which a non-English app reads from a
  // second index; the map is only read once both are in.
  const linksReady = links.settled && themesReady;
  // The links cannot be built without the slot type list: nothing may wait on them then.
  const linksBlocked = !links.listed && slotIndexError.error !== undefined;
  // The map changes with every record while it loads; only a settled one
  // is read, so the page's derived counts (and the cards) stay put meanwhile.
  const settledAcceptedBy = linksReady ? links.acceptedBy : null;
  /** Group key -> distinct slot types accepting any of its ids, and their themes. */
  const groupLinks = useMemo(() => {
    const map = new Map<string, { count: number; themes: Set<SlotThemeId> }>();
    if (!settledAcceptedBy) {
      return map;
    }
    groups.forEach((group) => {
      const accepting = new Set<number>();
      group.ids.forEach((id) => settledAcceptedBy.get(id)?.forEach((slotId) => accepting.add(slotId)));
      const themes = new Set<SlotThemeId>();
      accepting.forEach((slotId) => themes.add(themeOf.get(slotId) ?? "reagents"));
      map.set(group.key, { count: accepting.size, themes });
    });
    return map;
  }, [settledAcceptedBy, groups, themeOf]);
  const acceptedMax = useMemo(() => {
    let max = 1;
    groupLinks.forEach((entry) => {
      max = Math.max(max, entry.count);
    });
    return max;
  }, [groupLinks]);
  const acceptedOf = useCallback(
    (group: CategoryGroup): AcceptedCount => {
      if (!links.enabled || linksBlocked) {
        return undefined;
      }
      return linksReady ? (groupLinks.get(group.key)?.count ?? 0) : null;
    },
    [links.enabled, linksBlocked, linksReady, groupLinks],
  );

  /* ---------------- The list on screen, and its page ---------------- */

  const themeSlots = slotsByTheme.get(slotTheme) ?? EMPTY_SLOTS;
  const filteredGroups = useMemo(() => {
    if (categoryFilter === "") {
      return groups;
    }
    if (!linksReady) {
      return [] as CategoryGroup[];
    }
    return groups.filter((group) => {
      const entry = groupLinks.get(group.key);
      return categoryFilter === NO_SLOT_GROUP
        ? (entry?.count ?? 0) === 0
        : (entry?.themes.has(categoryFilter as SlotThemeId) ?? false);
    });
  }, [categoryFilter, linksReady, groups, groupLinks]);

  const pageSize = view === "slots" ? SLOT_PAGE_SIZE : CATEGORY_PAGE_SIZE;
  const listLength = view === "slots" ? themeSlots.length : filteredGroups.length;
  const pageCount = Math.max(1, Math.ceil(listLength / pageSize));
  const requestedPage = parseId(params.page) ?? 1;
  const page = Math.min(requestedPage, pageCount);
  // The list's length is only final once its data is in (a filtered view
  // also waits for the slot links), so only then may a page be judged out of range.
  const listReady =
    view === "slots"
      ? slotIndex.data !== undefined && themesReady
      : categoryIndex.data !== undefined && (categoryFilter === "" || linksReady);
  useEffect(() => {
    if (params.page === "" || !listReady) {
      return;
    }
    const resolved = searching ? 1 : page;
    const next = resolved > 1 ? String(resolved) : null;
    if ((next ?? "") !== params.page) {
      setParams({ page: next }, { replace: true });
    }
  }, [params.page, listReady, searching, page, setParams]);

  const changePage = useCallback(
    (next: number): void => {
      requestFocus();
      setParams({ page: next > 1 ? String(next) : null });
    },
    [requestFocus, setParams],
  );

  /* ---------------- Dialog: open, walk, close ---------------- */

  // Opened by a click on this page (a history entry we pushed), not a shared link.
  const openedHereRef = useRef(false);
  const openTarget = useCallback(
    (next: ModifierTarget): void => {
      openedHereRef.current = true;
      setParams(
        next.kind === "slot"
          ? { slot: String(next.id), category: null }
          : { category: String(next.id), slot: null },
      );
    },
    [setParams],
  );
  // Walking inside the dialog replaces its history entry, so one Back (or
  // closing) always leaves the dialog, however far it walked.
  const walkTo = useCallback(
    (next: ModifierTarget): void => {
      setParams(
        next.kind === "slot"
          ? { slot: String(next.id), category: null }
          : { category: String(next.id), slot: null },
        { replace: true },
      );
    },
    [setParams],
  );
  // Closing a dialog this page opened steps back over its history entry, so
  // Back after closing leaves the page instead of reopening the dialog.
  const closeDialog = useCallback((): void => {
    if (openedHereRef.current) {
      openedHereRef.current = false;
      navigate(-1);
      return;
    }
    setParams({ slot: null, category: null }, { replace: true });
  }, [navigate, setParams]);

  // Malformed ids, both params at once, or an id the index does not know
  // (once it has loaded) fall back to no dialog, or to the slot type.
  useEffect(() => {
    if (target === null) {
      openedHereRef.current = false;
    }
    const patch: Partial<Record<"slot" | "category", null>> = {};
    if (params.slot !== "" && (slotParam === null || (slotIndex.data && !slotById.has(slotParam)))) {
      patch.slot = null;
    }
    if (
      params.category !== "" &&
      (categoryParam === null ||
        slotParam !== null ||
        (categoryIndex.data && !categoryById.has(categoryParam)))
    ) {
      patch.category = null;
    }
    if (Object.keys(patch).length > 0) {
      setParams(patch, { replace: true });
    }
  }, [
    target,
    params.slot,
    params.category,
    slotParam,
    categoryParam,
    slotIndex.data,
    categoryIndex.data,
    slotById,
    categoryById,
    setParams,
  ]);

  const openSlot = useCallback(
    (slot: SlotTypeRef): void => openTarget({ kind: "slot", id: slot.id }),
    [openTarget],
  );
  // A card stands for every id sharing its name and opens the newest, but an
  // id lookup ("18", "#489") opens the id that was typed, or older ids of a
  // repeated name would be out of reach.
  const openGroup = useCallback(
    (group: CategoryGroup): void =>
      openTarget({
        kind: "category",
        id: idQuery !== null && group.ids.includes(idQuery) ? idQuery : group.newestId,
      }),
    [openTarget, idQuery],
  );
  const openCategory = useCallback(
    (category: CategoryRef): void => openTarget({ kind: "category", id: category.id }),
    [openTarget],
  );

  /* ---------------- How it works ---------------- */

  const scrollToGuide = useCallback((): void => {
    const heading = document.getElementById(`${HOW_IT_WORKS_ID}-title`);
    if (!heading) {
      return;
    }
    scrollToStart(heading.closest("section"));
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }, []);

  /* ---------------- Render ---------------- */

  const slotTiles = useMemo<ThemeTile[]>(() => {
    const max = Math.max(1, ...Array.from(themeCounts.values()));
    return SLOT_THEMES.map((theme) => {
      const Icon = THEME_ICONS[theme.id];
      const count = themeCounts.get(theme.id) ?? 0;
      return {
        value: theme.id,
        label: theme.label,
        caption: themesReady && slotIndex.data ? pluralize(count, "slot type", "slot types") : null,
        share: themesReady && slotIndex.data ? count / max : null,
        icon: <Icon />,
        accent: (muiTheme) => accentColor(muiTheme, theme.accent),
      };
    });
  }, [themeCounts, themesReady, slotIndex.data]);

  const categoryTiles = useMemo<ThemeTile[]>(() => {
    const themeTotals = new Map<SlotThemeId, number>();
    let unlinked = 0;
    groupLinks.forEach((entry) => {
      if (entry.count === 0) {
        unlinked += 1;
      }
      entry.themes.forEach((theme) => themeTotals.set(theme, (themeTotals.get(theme) ?? 0) + 1));
    });
    const total = groups.length;
    const ready = linksReady && categoryIndex.data !== undefined;
    const caption = (count: number): string | null => {
      if (linksBlocked) {
        return "Needs the slot type list";
      }
      // Cards are same-name groups (or one unnamed id), so the tiles count
      // cards, as the list does.
      return ready ? pluralize(count, "card", "cards") : null;
    };
    return [
      {
        value: "",
        label: "All categories",
        caption: categoryIndex.data ? pluralize(total, "card", "cards") : null,
        share: categoryIndex.data ? 1 : null,
        icon: <CategoryRoundedIcon />,
        accent: (muiTheme) => muiTheme.palette.primary.main,
      },
      ...SLOT_THEMES.map((theme): ThemeTile => {
        const Icon = THEME_ICONS[theme.id];
        const count = themeTotals.get(theme.id) ?? 0;
        return {
          value: theme.id,
          label: theme.label,
          caption: caption(count),
          share: ready && total > 0 ? count / total : null,
          icon: <Icon />,
          accent: (muiTheme) => accentColor(muiTheme, theme.accent),
          disabled: !ready || count === 0,
        };
      }),
      {
        value: NO_SLOT_GROUP,
        label: "No slot type",
        caption: caption(unlinked),
        share: ready && total > 0 ? unlinked / total : null,
        icon: <LinkOffRoundedIcon />,
        accent: (muiTheme) => muiTheme.palette.text.secondary,
        disabled: !ready || unlinked === 0,
      },
    ];
  }, [groupLinks, groups.length, linksReady, linksBlocked, categoryIndex.data]);

  const renderTiles = (): JSX.Element => {
    const index = view === "slots" ? slotIndex : categoryIndex;
    const retained = view === "slots" ? slotIndexError : categoryIndexError;
    if (retained.error !== undefined) {
      return (
        <ErrorState
          error={retained.error}
          context={view === "slots" ? "reagent slot types" : "reagent categories"}
          onRetry={retained.retry}
          retryLabel={retained.retrying ? "Retrying…" : "Retry"}
        />
      );
    }
    if (index.isPending) {
      return (
        <LoadingSkeleton
          variant="grid"
          columns={THEME_TILE_COLS}
          itemHeight={THEME_TILE_HEIGHT.sm}
          count={THEME_SKELETON_COUNT + (view === "slots" ? 0 : 2)}
          gap={THEME_TILE_GAP * 8}
          label={view === "slots" ? "Loading slot types" : "Loading categories"}
          sx={{ "& > .MuiSkeleton-root": { height: THEME_TILE_HEIGHT } }}
        />
      );
    }
    return view === "slots" ? (
      <ThemeTilePicker
        label="Slot type themes"
        tiles={slotTiles}
        value={searching ? null : slotTheme}
        onChange={selectTheme}
      />
    ) : (
      <ThemeTilePicker
        label="Filter categories by the slot types that accept them"
        tiles={categoryTiles}
        value={searching ? null : categoryFilter}
        onChange={selectCategoryFilter}
      />
    );
  };

  const renderPager = (): JSX.Element | null =>
    pageCount > 1 ? (
      <Pagination
        count={pageCount}
        page={page}
        onChange={(_event, next) => changePage(next)}
        siblingCount={1}
        aria-label={view === "slots" ? "Slot type pages" : "Category pages"}
        sx={{ alignSelf: "center" }}
      />
    ) : null;

  const renderSlotSection = (): JSX.Element | null => {
    const theme = SLOT_THEME_BY_ID.get(slotTheme);
    if (!theme) {
      return null;
    }
    // The tiles above explain a failed index.
    if (slotIndexError.error !== undefined) {
      return null;
    }
    const ready = slotIndex.data !== undefined && themesReady;
    const start = (page - 1) * SLOT_PAGE_SIZE;
    return (
      <ResultsSection
        ref={mainHeadingRef}
        title={theme.label}
        description={
          ready
            ? `${theme.blurb} ${pluralize(themeSlots.length, "slot type", "slot types")}, newest first.`
            : theme.blurb
        }
      >
        {!ready ? (
          <CardGridSkeleton count={8} itemHeight={SLOT_CARD_HEIGHT} label="Loading slot types" />
        ) : themeSlots.length === 0 ? (
          <EmptyState
            compact
            icon={<ExtensionRoundedIcon />}
            title={`No slot types under ${theme.label}`}
            description="Blizzard lists none under this theme in this region; pick another tile above."
          />
        ) : (
          <Stack spacing={2.5}>
            <CardGrid
              label={`${theme.label} slot types`}
              entries={themeSlots.slice(start, start + SLOT_PAGE_SIZE)}
              keyOf={(slot) => slot.id}
              render={(slot) => <SlotTypeCard slot={slot} theme={slotTheme} onSelect={openSlot} />}
            />
            {renderPager()}
          </Stack>
        )}
      </ResultsSection>
    );
  };

  const renderCategorySection = (): JSX.Element | null => {
    if (categoryIndexError.error !== undefined) {
      return null;
    }
    const filterTheme = isSlotThemeId(categoryFilter) ? SLOT_THEME_BY_ID.get(categoryFilter) : undefined;
    let title = "All categories";
    if (filterTheme) {
      title = `${filterTheme.label}: accepted categories`;
    } else if (categoryFilter === NO_SLOT_GROUP) {
      title = "Categories no slot type accepts";
    }
    // A filter needs the slot links, which need the slot type list.
    const blocked = categoryFilter !== "" && linksBlocked;
    const waiting =
      categoryIndex.data === undefined || (categoryFilter !== "" && !linksReady && !blocked);
    const start = (page - 1) * CATEGORY_PAGE_SIZE;
    return (
      <ResultsSection
        ref={mainHeadingRef}
        title={title}
        description={
          waiting
            ? categoryFilter !== ""
              ? "This filter needs the slot links above."
              : undefined
            : `${pluralize(filteredGroups.length, "card", "cards")} covering ${pluralize(
                filteredGroups.reduce((sum, group) => sum + group.ids.length, 0),
                "category id",
                "category ids",
              )}, newest first; same-name ids share one card.`
        }
      >
        {blocked ? (
          // Slot links above already raise the failure, with its Retry: one
          // alert per failed request.
          <EmptyState
            compact
            icon={<LinkOffRoundedIcon />}
            title="This filter needs the slot type list"
            description="It could not be loaded; retry it under Slot links above."
          />
        ) : waiting ? (
          <CardGridSkeleton count={8} itemHeight={CATEGORY_CARD_HEIGHT} label="Loading categories" />
        ) : filteredGroups.length === 0 ? (
          <EmptyState
            compact
            icon={<CategoryRoundedIcon />}
            title="No categories here"
            description="No category matches this filter; pick another tile above."
          />
        ) : (
          <Stack spacing={2.5}>
            <CardGrid
              label={title}
              entries={filteredGroups.slice(start, start + CATEGORY_PAGE_SIZE)}
              keyOf={(group) => group.key}
              render={(group) => (
                <CategoryCard
                  group={group}
                  accepted={acceptedOf(group)}
                  acceptedMax={acceptedMax}
                  onSelect={openGroup}
                />
              )}
            />
            {renderPager()}
          </Stack>
        )}
      </ResultsSection>
    );
  };

  const renderMain = (): JSX.Element | null => {
    if (searching) {
      // Both lists are searched together: wait for each to land or fail.
      const settling =
        (slotIndex.isPending && slotIndexError.error === undefined) ||
        (categoryIndex.isPending && categoryIndexError.error === undefined);
      if (settling) {
        return (
          <SectionCard title="Search results">
            <CardGridSkeleton count={8} itemHeight={SLOT_CARD_HEIGHT} label="Loading names" />
          </SectionCard>
        );
      }
      // Neither list loaded: the section above explains why.
      if (!slotIndex.data && !categoryIndex.data) {
        return null;
      }
      return (
        <SearchResults
          ref={mainHeadingRef}
          query={search}
          tooShort={searchTooShort}
          slots={slotMatches}
          categories={categoryMatches}
          themeOf={themeOf}
          acceptedOf={acceptedOf}
          acceptedMax={acceptedMax}
          onClear={leaveSearch}
          onOpenSlot={openSlot}
          onOpenCategory={openGroup}
          slotsSearched={slotIndex.data !== undefined}
          categoriesSearched={categoryIndex.data !== undefined}
        />
      );
    }
    return view === "slots" ? renderSlotSection() : renderCategorySection();
  };

  /* ---------------- Summary, title ---------------- */

  let summary = "";
  if (searching) {
    if (searchTooShort) {
      summary = "Type at least two letters, or an id";
    } else if (slotMatches.length + categoryMatches.length === 0) {
      summary = "No matching names";
    } else {
      summary = `${pluralize(slotMatches.length, "slot type", "slot types")} · ${pluralize(
        categoryMatches.length,
        "category name",
        "category names",
      )} match`;
    }
  } else if (view === "slots" && slotIndex.data && themesReady) {
    summary = pageSummary(page, SLOT_PAGE_SIZE, themeSlots.length, "slot type", "slot types");
  } else if (view === "categories" && categoryIndex.data && (categoryFilter === "" || linksReady)) {
    summary = pageSummary(
      page,
      CATEGORY_PAGE_SIZE,
      filteredGroups.length,
      "category card",
      "category cards",
    );
  }

  let documentTitle = "Modified Crafting";
  if (target?.kind === "slot") {
    const ref = slotById.get(target.id);
    if (ref) {
      documentTitle = `${slotTypeName(ref)} · Modified Crafting`;
    }
  } else if (target?.kind === "category") {
    const ref = categoryById.get(target.id);
    if (ref) {
      documentTitle = `${categoryName(ref)} · Modified Crafting`;
    }
  } else if (searching) {
    documentTitle = "Search · Modified Crafting";
  } else if (view === "categories") {
    documentTitle = "Categories · Modified Crafting";
  } else {
    documentTitle = `${SLOT_THEME_BY_ID.get(slotTheme)?.label ?? "Slot types"} · Modified Crafting`;
  }

  return (
    <Stack
      sx={(theme) => ({
        gap: {
          xs: theme.spacing(theme.wc.layout.sectionGap.xs),
          md: theme.spacing(theme.wc.layout.sectionGap.md),
        },
      })}
    >
      <PageHeader
        eyebrow={eyebrow}
        breadcrumbs={breadcrumbs}
        title="Modified Crafting"
        documentTitle={documentTitle}
        icon={<ExtensionRoundedIcon />}
        description="Every reagent slot a crafting recipe can offer, from named materials to embellishments, stat missives, sparks and finishing reagents, with the reagent categories each one accepts and the reagent items in them. Browse slot types by theme, or switch to the categories to see which slots take them."
        actions={
          <Button
            size="small"
            variant="outlined"
            startIcon={<SchemaRoundedIcon />}
            onClick={scrollToGuide}
          >
            How it works
          </Button>
        }
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {slots.length > 0 ? (
              <Chip size="small" label={pluralize(slots.length, "slot type", "slot types")} />
            ) : null}
            {categories.length > 0 ? (
              <Chip size="small" label={pluralize(categories.length, "category", "categories")} />
            ) : null}
            {namedGroupCount > 0 && groups.length !== categories.length ? (
              <Chip
                size="small"
                variant="outlined"
                label={pluralize(namedGroupCount, "category name", "category names")}
              />
            ) : null}
          </>
        }
      />

      <ExplorerFilterBar label="Search and view" summary={summary || undefined}>
        <SearchField
          size="small"
          label="Search slot types and categories by name or id"
          placeholder="Search slot types and categories"
          value={draft}
          onChange={setDraft}
          onDebouncedChange={handleSearch}
          onClear={clearSearch}
          // One character is an id ("7") or the page's own "too short" note,
          // not something for the field to swallow.
          minLength={1}
          disabled={slotIndexError.error !== undefined && categoryIndexError.error !== undefined}
          sx={{ minWidth: { xs: 0, sm: 240 }, maxWidth: { md: 480 } }}
        />
        <SegmentedControl
          label="View"
          size="small"
          options={VIEW_OPTIONS}
          value={view}
          onChange={changeView}
        />
      </ExplorerFilterBar>

      {view === "categories" && !searching ? (
        <SlotLinksPanel
          links={links}
          listError={slotIndexError}
          categories={categories}
          onOpenCategory={openCategory}
        />
      ) : null}

      <SectionCard
        title={view === "slots" ? "Slot type themes" : "Filter by slot theme"}
        description={
          view === "slots"
            ? "Every reagent slot type, sorted by the words in its name. Bars compare each theme with the largest."
            : linksReady
              ? "Filter the categories by the theme of the slot types that accept them; one category can sit in several."
              : "Filter the categories by the theme of the slot types that accept them, once the slot links above are read."
        }
      >
        {renderTiles()}
      </SectionCard>

      <Box>{renderMain()}</Box>

      <HowItWorks
        slotCount={liveCount(slotIndex.data, slotIndexError.error)}
        categoryCount={liveCount(categoryIndex.data, categoryIndexError.error)}
        categoryNameCount={categoryIndex.data ? namedGroupCount : null}
        unnamedCategoryCount={categoryIndex.data ? groups.length - namedGroupCount : 0}
        mostRepeated={mostRepeated}
      />

      <ModifierDialog
        open={target !== null}
        target={shownTarget}
        slotById={slotById}
        slotIdsByName={slotIdsByName}
        themeOf={themeOf}
        categoryById={categoryById}
        groupOfCategory={groupOfCategory}
        indexesReady={slotIndex.data !== undefined && categoryIndex.data !== undefined}
        links={links}
        onNeedLinks={requestLinks}
        slotListError={slotIndexError}
        onNavigate={walkTo}
        onClose={closeDialog}
      />
    </Stack>
  );
};

export default ModifiedCraftingPage;
