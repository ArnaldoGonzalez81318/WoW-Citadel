import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CategoryRoundedIcon from "@mui/icons-material/CategoryRounded";
import PetsRoundedIcon from "@mui/icons-material/PetsRounded";
import SearchOffRoundedIcon from "@mui/icons-material/SearchOffRounded";
import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Pagination,
  Select,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ExplorerFilterBar,
  SearchField,
  SegmentedControl,
} from "@/components/common/ExplorerFilterBar";
import type { SegmentedOption } from "@/components/common/ExplorerFilterBar";
import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/common/StateBlocks";
import AbilityCard from "@/features/battlePets/components/AbilityCard";
import AbilityDialog from "@/features/battlePets/components/AbilityDialog";
import CatalogGrid, { CatalogGridSkeleton } from "@/features/battlePets/components/CatalogGrid";
import FamilyBanner from "@/features/battlePets/components/FamilyBanner";
import FamilyCoverage from "@/features/battlePets/components/FamilyCoverage";
import FamilyPicker from "@/features/battlePets/components/FamilyPicker";
import PetCard from "@/features/battlePets/components/PetCard";
import PetDialog from "@/features/battlePets/components/PetDialog";
import {
  PET_FAMILIES,
  familyById,
  parseFamilyParam,
} from "@/features/battlePets/config/petFamilies";
import {
  abilityIndexQuery,
  abilityQuery,
  petIndexQuery,
} from "@/features/battlePets/hooks/battlePetQueries";
import useCatalogListing from "@/features/battlePets/hooks/useCatalogListing";
import useFamilyNames from "@/features/battlePets/hooks/useFamilyNames";
import useFamilyScan from "@/features/battlePets/hooks/useFamilyScan";
import useStickyError from "@/features/battlePets/hooks/useStickyError";
import {
  CATALOG_PAGE_SIZE,
  pluralize,
} from "@/features/battlePets/services/battlePetService";
import { NO_FAMILY, useKnownFamilies } from "@/features/battlePets/services/familyMemory";
import type {
  CatalogKind,
  CatalogSort,
  IndexEntry,
  PetAbilitySlotRef,
} from "@/features/battlePets/types";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

const URL_DEFAULTS = {
  mode: "",
  q: "",
  sort: "",
  family: "",
  page: "",
  pet: "",
  ability: "",
};

type Mode = "pets" | "abilities";

const MODE_OPTIONS: ReadonlyArray<SegmentedOption<Mode>> = [
  { value: "pets", label: "Pets", icon: <PetsRoundedIcon fontSize="small" /> },
  { value: "abilities", label: "Abilities", icon: <AutoAwesomeRoundedIcon fontSize="small" /> },
];

const BROWSE_SORTS: ReadonlyArray<SegmentedOption<CatalogSort>> = [
  { value: "newest", label: "Newest" },
  { value: "name", label: "A–Z" },
];
const SEARCH_SORTS: ReadonlyArray<SegmentedOption<CatalogSort>> = [
  { value: "match", label: "Best match" },
  ...BROWSE_SORTS,
];

/** The family menu's "every family" value (the URL leaves `family` out). */
const ANY_FAMILY = "any";

const NOUNS: Readonly<Record<CatalogKind, { one: string; many: string }>> = {
  pet: { one: "pet", many: "pets" },
  ability: { one: "ability", many: "abilities" },
};

/** Ids the index lists, newest first: the order a full family count walks in. */
const EMPTY_IDS: number[] = [];

const parseId = (value: string): number | null => {
  const id = Number(value);
  return /^\d+$/.test(value) && Number.isSafeInteger(id) && id > 0 ? id : null;
};

/** Explicit sorts in the URL; "match" is the default while searching, never written. */
const parseSort = (value: string): CatalogSort | null =>
  value === "newest" || value === "name" ? value : null;

/** Smooth unless the visitor asked for reduced motion. */
const scrollToTop = (node: Element | null): void => {
  let reduced = false;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    // No matchMedia: the default (smooth) is fine.
  }
  node?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
};

/** Clears the sticky app header when a section is scrolled to. */
const scrollMarginSx = (theme: Theme) => ({
  scrollMarginTop: {
    xs: `${theme.wc.layout.headerHeight.xs + 16}px`,
    md: `${theme.wc.layout.headerHeight.md + 16}px`,
  },
});

/**
 * Battle Pets: Blizzard's pet journal as an explorer. Every pet, newest
 * first, as cards with its icon, family and source; a name search across
 * all 2,179 (typos and half-typed words included); the ten families as
 * tiles that filter the list; and each pet's dialog with its model render,
 * flags, ability bar and family matchups. A second mode browses the 758
 * battle abilities the same way. Mode, search, sort, family, page and the
 * open pet or ability all live in the URL.
 *
 * The indexes are one request each. A pet card costs its record, then its
 * creature's display list and render, as it nears the viewport (an ability
 * card, its record and icon). The indexes have no families, so a family
 * filter reads records in list order, at a pace the proxy's rate limit can
 * take, until the page is full; families seen are kept on the device for a
 * day (see familyMemory), so the next visit filters instantly.
 */
const BattlePetsPage = ({
  eyebrow = "Collectibles & Gear",
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const [params, setParams] = useSearchParamsRecord(URL_DEFAULTS);
  const navigate = useNavigate();
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"));

  const mode: Mode = params.mode === "abilities" ? "abilities" : "pets";
  const kind: CatalogKind = mode === "abilities" ? "ability" : "pet";
  const noun = NOUNS[kind];

  /* ---------------- Indexes ---------------- */

  const petIndex = useQuery(petIndexQuery());
  const abilityIndex = useQuery({ ...abilityIndexQuery(), enabled: mode === "abilities" });
  const index = kind === "pet" ? petIndex : abilityIndex;
  const indexError = useStickyError(`${kind}-index`, index);
  const entries = index.data;
  const familyNames = useFamilyNames();

  /* ---------------- Criteria (URL first; anything unusable falls back) ---------------- */

  const search = params.q.trim();
  const searching = search !== "";
  const familyId = parseFamilyParam(params.family);
  const explicitSort = parseSort(params.sort);
  const sort: CatalogSort = explicitSort ?? (searching ? "match" : "newest");
  const requestedPage = Math.max(1, parseId(params.page) ?? 1);

  const listing = useCatalogListing({
    kind,
    entries,
    search,
    sort,
    familyId,
    page: requestedPage,
  });
  const page = Math.min(requestedPage, listing.pageCount);

  // Drop what the page cannot use (a typo, an old link) so the address
  // always describes what is on screen.
  useEffect(() => {
    const patch: Partial<Record<keyof typeof URL_DEFAULTS, null>> = {};
    if (params.mode !== "" && params.mode !== "abilities") {
      patch.mode = null;
    }
    if (params.sort !== "" && explicitSort === null) {
      patch.sort = null;
    }
    if (params.family !== "" && familyId === null) {
      patch.family = null;
    }
    if (params.page !== "" && (parseId(params.page) === null || params.page === "1")) {
      patch.page = null;
    }
    if (params.pet !== "" && parseId(params.pet) === null) {
      patch.pet = null;
    }
    if (params.ability !== "" && parseId(params.ability) === null) {
      patch.ability = null;
    }
    if (Object.keys(patch).length > 0) {
      setParams(patch, { replace: true });
    }
  }, [
    params.mode,
    params.sort,
    params.family,
    params.page,
    params.pet,
    params.ability,
    explicitSort,
    familyId,
    setParams,
  ]);

  // A page past the end (a narrower search, an old link) falls back to the
  // last one. While a family scan has not reached the end of the list, the
  // last page is not known, and finding page 50 of a small family would
  // read every record (minutes of requests) before it could clamp. So a
  // page is only looked for if the pager could have led to it: the pages
  // found so far (on this device) and the one after. Further out falls back.
  useEffect(() => {
    if (params.page === "") {
      return;
    }
    let lastPage: number | null = null;
    if (listing.total !== undefined) {
      lastPage = listing.pageCount;
    } else if (familyId !== null && entries !== undefined) {
      lastPage = Math.ceil(listing.found / CATALOG_PAGE_SIZE) + 1;
    }
    if (lastPage !== null && requestedPage > lastPage) {
      setParams({ page: lastPage > 1 ? String(lastPage) : null }, { replace: true });
    }
  }, [
    listing.total,
    listing.pageCount,
    listing.found,
    familyId,
    entries,
    requestedPage,
    params.page,
    setParams,
  ]);

  /* ---------------- Search draft (keystrokes stay local; the URL gets the debounced value) ---------------- */

  const [draft, setDraft] = useState(params.q);
  const emittedRef = useRef(search);
  useEffect(() => {
    // The URL changed on its own (back button, a mode switch): adopt it.
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const clearSearch = useCallback((): void => {
    emittedRef.current = "";
    setDraft("");
    setParams({ q: null, page: null }, { replace: true });
    searchInputRef.current?.focus();
  }, [setParams]);

  /* ---------------- Mode, sort, family ---------------- */

  const changeMode = (next: Mode): void => {
    // Names differ between the catalogues, so the search starts over; the
    // family carries across ("Beast pets" -> "Beast abilities").
    setParams({ mode: next === "abilities" ? "abilities" : null, q: null, page: null });
  };

  const changeSort = (next: CatalogSort): void => {
    const isDefault = next === (searching ? "match" : "newest");
    setParams({ sort: isDefault || next === "match" ? null : next, page: null }, { replace: true });
  };

  const resultsRef = useRef<HTMLDivElement>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  // "tile": a family tile was pressed; "dialog": a dialog's "Show … pets".
  const revealPendingRef = useRef<"tile" | "dialog" | null>(null);

  // After a family pick, the results show it. From a tile: the tiles sit
  // under the results, so the results' top has usually scrolled away; it is
  // brought back and focus moves to their heading (the next Tab continues
  // in them). When the top is still in view (a short list), focus stays on
  // the tile. From a dialog, whose opener card the new list may no longer
  // hold, focus always moves to the heading.
  useEffect(() => {
    const source = revealPendingRef.current;
    if (source === null) {
      return;
    }
    revealPendingRef.current = null;
    const top = resultsRef.current?.getBoundingClientRect().top;
    const offScreen = top !== undefined && (top < 0 || top > window.innerHeight * 0.6);
    if (offScreen) {
      scrollToTop(resultsRef.current);
    }
    if (offScreen || source === "dialog") {
      resultsHeadingRef.current?.focus({ preventScroll: true });
    }
  }, [familyId, mode]);

  const selectFamily = useCallback(
    (id: number): void => {
      // The pressed tile is a toggle: pressing it again lists every family.
      if (id === familyId) {
        setParams({ family: null, page: null });
        return;
      }
      revealPendingRef.current = "tile";
      setParams({ family: String(id), page: null });
    },
    [familyId, setParams],
  );
  // The banner's button goes with the filter; focus moves to the results' heading.
  const clearFamily = useCallback((): void => {
    setParams({ family: null, page: null });
    resultsHeadingRef.current?.focus({ preventScroll: true });
  }, [setParams]);
  // The filter bar's menu: the results sit right under it, so focus stays.
  const pickFamily = (value: string): void => {
    setParams({ family: value === ANY_FAMILY ? null : value, page: null });
  };

  /* ---------------- Paging ---------------- */

  // A grid is read from the top: a new page starts at its first card.
  const listTopRef = useRef<HTMLDivElement>(null);
  const changePage = (next: number): void => {
    setParams({ page: next > 1 ? String(next) : null });
    listTopRef.current?.scrollIntoView({ block: "start" });
  };

  /* ---------------- Family counts (every record's family, on request) ---------------- */

  const { families: knownFamilies, version: familiesVersion } = useKnownFamilies(kind);
  const coverage = useMemo(() => {
    if (!entries) {
      return null;
    }
    let known = 0;
    const counts = new Map<number, number>();
    entries.forEach((entry) => {
      const family = knownFamilies.get(entry.id);
      if (family === undefined) {
        return;
      }
      known += 1;
      if (family !== NO_FAMILY) {
        counts.set(family, (counts.get(family) ?? 0) + 1);
      }
    });
    return { known, total: entries.length, counts: known === entries.length ? counts : null };
    // `familiesVersion` stands for the live map's contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, knownFamilies, familiesVersion]);

  const [countingKind, setCountingKind] = useState<CatalogKind | null>(null);
  const allIds = useMemo(
    () => (entries ? entries.map((entry) => entry.id).sort((left, right) => right - left) : EMPTY_IDS),
    [entries],
  );
  const countScan = useFamilyScan({
    kind,
    ids: allIds,
    familyId: null,
    wanted: Infinity,
    enabled: countingKind === kind && entries !== undefined,
  });
  const pickerRef = useRef<HTMLDivElement>(null);
  const stopCounting = (): void => {
    const counted = coverage !== null && coverage.counts !== null;
    setCountingKind(null);
    // Done (everything counted) takes its button away: focus goes to the
    // tiles, which now carry the counts.
    if (counted) {
      pickerRef.current?.querySelector<HTMLElement>("button")?.focus();
    }
  };

  /* ---------------- Dialogs ---------------- */

  const petId = parseId(params.pet);
  const abilityId = parseId(params.ability);
  // The ids outlive the URL params so the dialogs never blank while closing.
  const [shownPetId, setShownPetId] = useState<number | null>(petId);
  if (petId !== null && petId !== shownPetId) {
    setShownPetId(petId);
  }
  const [shownAbilityId, setShownAbilityId] = useState<number | null>(abilityId);
  if (abilityId !== null && abilityId !== shownAbilityId) {
    setShownAbilityId(abilityId);
  }
  // The card or ability-bar cell that opened the ability, for its name until
  // the record loads (the ability index only loads in the Abilities view).
  const [openedAbility, setOpenedAbility] = useState<IndexEntry | null>(null);
  // Opened by a click on this page (a history entry we pushed), not a shared link.
  const petOpenedHereRef = useRef(false);
  const abilityOpenedHereRef = useRef(false);
  useEffect(() => {
    if (petId === null) {
      petOpenedHereRef.current = false;
    }
  }, [petId]);
  useEffect(() => {
    if (abilityId === null) {
      abilityOpenedHereRef.current = false;
    }
  }, [abilityId]);

  const openPet = useCallback(
    (entry: IndexEntry): void => {
      petOpenedHereRef.current = true;
      setParams({ pet: String(entry.id) });
    },
    [setParams],
  );
  const openAbility = useCallback(
    (entry: IndexEntry | PetAbilitySlotRef): void => {
      abilityOpenedHereRef.current = true;
      setOpenedAbility({ id: entry.id, name: entry.name });
      setParams({ ability: String(entry.id) });
    },
    [setParams],
  );
  // Closing a dialog this page opened steps back over its history entry, so
  // Back after closing leaves the page instead of reopening it.
  const closePet = useCallback((): void => {
    if (petOpenedHereRef.current) {
      petOpenedHereRef.current = false;
      navigate(-1);
      return;
    }
    setParams({ pet: null }, { replace: true });
  }, [navigate, setParams]);
  const closeAbility = useCallback((): void => {
    if (abilityOpenedHereRef.current) {
      abilityOpenedHereRef.current = false;
      navigate(-1);
      return;
    }
    setParams({ ability: null }, { replace: true });
  }, [navigate, setParams]);
  // "Show Beast pets" in a dialog: the dialog's entry becomes that list.
  const showFamilyFrom = useCallback(
    (target: Mode) =>
      (id: number): void => {
        petOpenedHereRef.current = false;
        abilityOpenedHereRef.current = false;
        revealPendingRef.current = "dialog";
        setParams(
          {
            mode: target === "abilities" ? "abilities" : null,
            family: String(id),
            q: null,
            page: null,
            pet: null,
            ability: null,
          },
          { replace: true },
        );
      },
    [setParams],
  );

  const petNames = useMemo(
    () => new Map((petIndex.data ?? []).map((entry) => [entry.id, entry.name])),
    [petIndex.data],
  );
  const abilityNames = useMemo(
    () => new Map((abilityIndex.data ?? []).map((entry) => [entry.id, entry.name])),
    [abilityIndex.data],
  );

  /* ---------------- Labels ---------------- */

  const familyName =
    familyId !== null
      ? (familyNames.get(familyId) ?? familyById(familyId)?.fallbackName)
      : undefined;
  const total = entries?.length ?? 0;
  const start = (page - 1) * CATALOG_PAGE_SIZE;
  const range = `${formatNumber(start + 1)}–${formatNumber(start + listing.pageEntries.length)}`;
  const scan = listing.scan;

  let summary: string | undefined;
  if (!entries) {
    summary = index.isPending && !indexError.error ? `Loading ${noun.many}…` : undefined;
  } else if (listing.tooShort) {
    summary = "Type at least two letters";
  } else if (familyId !== null) {
    const what = `${familyName} ${noun.many}`;
    if (listing.total !== undefined) {
      const counted = pluralize(listing.total, `${familyName} ${noun.one}`, what);
      summary = searching
        ? `${counted} ${listing.total === 1 ? "matches" : "match"} “${search}”`
        : counted;
    } else {
      // The summary is a live region: while records stream in it holds still
      // (the progress line under the results heading counts them). A failure
      // is the results' alert to announce, so it is not said twice.
      if (listing.found === 0 && scan?.error) {
        summary = undefined;
      } else if (scan?.active || listing.found === 0) {
        summary = `Finding ${what}…`;
      } else {
        summary = `${formatNumber(listing.found)}+ ${what} found so far`;
      }
    }
  } else if (searching) {
    summary =
      listing.ordered.length === 0
        ? `No ${noun.many} match`
        : `${formatNumber(listing.ordered.length)} of ${pluralize(total, noun.one, noun.many)} match${
            listing.pageCount > 1 ? ` · showing ${range}` : ""
          }`;
  } else {
    summary =
      listing.pageCount > 1
        ? `Showing ${range} of ${pluralize(total, noun.one, noun.many)}`
        : pluralize(total, noun.one, noun.many);
  }

  const capitalNoun = kind === "pet" ? "Pets" : "Abilities";
  let resultsTitle: string;
  if (searching && !listing.tooShort) {
    resultsTitle = familyName
      ? `${familyName} ${noun.many} matching “${search}”`
      : `${capitalNoun} matching “${search}”`;
  } else if (familyName) {
    resultsTitle = `${familyName} ${noun.many}`;
  } else {
    resultsTitle = sort === "name" ? `${capitalNoun} A–Z` : `Newest ${noun.many}`;
  }
  const orderNote =
    sort === "match"
      ? "best match first, typos and half-typed words included"
      : sort === "name"
        ? "A to Z"
        : "newest first (the highest ids are the latest additions)";
  const resultsDescription =
    familyId !== null
      ? `Blizzard's ${noun.one} index has no families, so ${noun.one} records are read in list order, ${orderNote}, until the page is full. Families seen are remembered on this device for a day.`
      : kind === "pet"
        ? `Blizzard's pet journal, ${orderNote}.`
        : `Every pet battle ability, ${orderNote}.`;

  // The dialog's own record (the same cache entry, so no extra request)
  // names an ability opened from a shared link in the Pets view, where the
  // ability index does not load.
  const shownAbilityRecord = useQuery({
    ...abilityQuery(shownAbilityId ?? 0),
    enabled: shownAbilityId !== null,
  }).data;
  const openPetName = shownPetId !== null ? petNames.get(shownPetId) : undefined;
  const openAbilityName =
    shownAbilityId !== null
      ? (abilityNames.get(shownAbilityId) ??
        (openedAbility?.id === shownAbilityId ? openedAbility.name : undefined) ??
        shownAbilityRecord?.name)
      : undefined;
  // The open dialog names the tab, so a shared dialog link reads as itself.
  let documentTitle = "Battle Pets";
  if (abilityId !== null && openAbilityName) {
    documentTitle = `${openAbilityName} · Battle Pets`;
  } else if (petId !== null && openPetName) {
    documentTitle = `${openPetName} · Battle Pets`;
  } else if (familyName) {
    documentTitle = `${familyName} ${noun.many} · Battle Pets`;
  } else if (mode === "abilities") {
    documentTitle = "Abilities · Battle Pets";
  }

  const headingId = useId();
  const familyLabelId = useId();

  /* ---------------- Render ---------------- */

  const renderScanProgress = (): JSX.Element | null => {
    if (!scan || listing.total !== undefined || scan.error) {
      return null;
    }
    const checkedOf = `${formatNumber(scan.checked)} of ${pluralize(listing.ordered.length, noun.one, noun.many)} checked`;
    return (
      <Box>
        <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0, mb: 0.75 }}>
          {scan.active
            ? `Reading ${noun.one} records in order: ${checkedOf}, ${pluralize(listing.found, `${familyName} ${noun.one}`, `${familyName} ${noun.many}`)} so far.`
            : `${checkedOf}. The next page reads more.`}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={listing.ordered.length > 0 ? (scan.checked / listing.ordered.length) * 100 : 0}
          aria-label={`${noun.many} checked for ${familyName}`}
          sx={{ height: 4, borderRadius: 2 }}
        />
      </Box>
    );
  };

  const renderResults = (): JSX.Element => {
    if (indexError.error && !entries) {
      return (
        <ErrorState
          error={indexError.error}
          context={kind === "pet" ? "the pet journal" : "pet abilities"}
          onRetry={indexError.retry}
          retryLabel={indexError.retrying ? "Retrying…" : "Retry"}
        />
      );
    }
    if (!entries) {
      return <CatalogGridSkeleton kind={kind} label={`Loading ${noun.many}`} />;
    }
    if (entries.length === 0) {
      return (
        <EmptyState
          icon={<PetsRoundedIcon />}
          title={`No ${noun.many} listed`}
          description={`Blizzard returned an empty ${noun.one} index for this region.`}
        />
      );
    }
    if (listing.tooShort) {
      return (
        <EmptyState
          compact
          icon={<SearchOffRoundedIcon />}
          title="Type at least two letters"
          description={`One letter matches nearly every ${noun.one}; add another, or type an id.`}
        />
      );
    }
    if (listing.ordered.length === 0) {
      return (
        <EmptyState
          compact
          icon={<SearchOffRoundedIcon />}
          title={`No ${noun.many} match “${search}”`}
          // A pasted link or a long unbroken word must wrap, not widen the page.
          sx={{ overflowWrap: "anywhere" }}
          description="The search reads names (typos and half-typed words included) and ids. Try a shorter name or a single word."
          action={
            <Button variant="outlined" size="small" onClick={clearSearch}>
              Clear search
            </Button>
          }
        />
      );
    }
    if (listing.total === 0) {
      return (
        <EmptyState
          compact
          icon={<CategoryRoundedIcon />}
          sx={{ overflowWrap: "anywhere" }}
          title={
            searching
              ? `No ${familyName} ${noun.many} match “${search}”`
              : `No ${familyName} ${noun.many}`
          }
          description={
            searching
              ? `Every match for “${search}” belongs to another family.`
              : `Blizzard lists no ${noun.many} of this family.`
          }
          action={
            <Button variant="outlined" size="small" onClick={searching ? clearSearch : clearFamily}>
              {searching ? "Clear search" : "Show every family"}
            </Button>
          }
        />
      );
    }

    const gridLabel = resultsTitle;
    return (
      <Stack spacing={2.5} ref={listTopRef} sx={scrollMarginSx}>
        {scan?.error ? (
          <ErrorState
            compact
            error={scan.error}
            title={`Could not read every ${noun.one}`}
            context={`${noun.one} records`}
            onRetry={scan.retry}
            retryLabel={scan.retrying ? "Retrying…" : "Retry"}
          />
        ) : null}
        {/* Nothing found before a failed record leaves no list: the alert is the content. */}
        {listing.pageEntries.length === 0 && listing.pending > 0 ? (
          <CatalogGridSkeleton kind={kind} label={`Finding ${familyName} ${noun.many}`} />
        ) : listing.pageEntries.length === 0 ? null : (
          <CatalogGrid
            kind={kind}
            entries={listing.pageEntries}
            pending={listing.pending}
            label={gridLabel}
            renderCard={(entry) =>
              kind === "pet" ? (
                <PetCard entry={entry} onOpen={openPet} />
              ) : (
                <AbilityCard entry={entry} onOpen={openAbility} />
              )
            }
          />
        )}
        {listing.pageCount > 1 ? (
          <Pagination
            count={listing.pageCount}
            page={page}
            onChange={(_event, next) => changePage(next)}
            // Nine medium items need ~342px; a phone has ~248-303px.
            siblingCount={isPhone ? 0 : 1}
            size={isPhone ? "small" : "medium"}
            aria-label={`${capitalNoun} pages`}
            sx={{ alignSelf: "center" }}
          />
        ) : null}
      </Stack>
    );
  };

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
        title="Battle Pets"
        documentTitle={documentTitle}
        icon={<PetsRoundedIcon />}
        description="Every companion in Blizzard's pet journal, newest first: search by name, filter by family, and open any pet for its model, source, flags and battle abilities. A second view browses every pet battle ability."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {petIndex.data ? (
              <Chip size="small" label={pluralize(petIndex.data.length, "pet", "pets")} />
            ) : null}
            {abilityIndex.data ? (
              <Chip
                size="small"
                label={pluralize(abilityIndex.data.length, "ability", "abilities")}
              />
            ) : null}
            <Chip
              size="small"
              variant="outlined"
              label={pluralize(PET_FAMILIES.length, "family", "families")}
            />
          </>
        }
      />

      <ExplorerFilterBar
        label={`Search ${noun.many}`}
        summary={summary}
        progress={Boolean(scan?.active) || (index.isFetching && !entries)}
      >
        <SegmentedControl
          size="small"
          label="Browse"
          options={MODE_OPTIONS}
          value={mode}
          onChange={changeMode}
        />
        <SearchField
          size="small"
          label={`Search every ${noun.one} by name or id`}
          placeholder={
            entries ? `Search ${formatNumber(entries.length)} ${noun.many}` : `Search ${noun.many}`
          }
          value={draft}
          onChange={setDraft}
          onDebouncedChange={handleSearch}
          onClear={clearSearch}
          inputRef={searchInputRef}
          minLength={1}
          disabled={Boolean(indexError.error) && !entries}
          sx={{ minWidth: { xs: 0, sm: 240 }, maxWidth: { md: 420 } }}
        />
        <FormControl size="small" sx={{ flex: "1 1 160px", minWidth: 0, maxWidth: { sm: 200 } }}>
          <InputLabel id={familyLabelId}>Family</InputLabel>
          <Select
            labelId={familyLabelId}
            label="Family"
            value={familyId !== null ? String(familyId) : ANY_FAMILY}
            onChange={(event) => pickFamily(String(event.target.value))}
          >
            <MenuItem value={ANY_FAMILY}>Every family</MenuItem>
            {PET_FAMILIES.map((family) => (
              <MenuItem key={family.id} value={String(family.id)}>
                {familyNames.get(family.id) ?? family.fallbackName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <SegmentedControl
          size="small"
          label={`Order ${noun.many}`}
          options={searching ? SEARCH_SORTS : BROWSE_SORTS}
          value={sort}
          onChange={changeSort}
        />
      </ExplorerFilterBar>

      <Box
        ref={resultsRef}
        component="section"
        aria-labelledby={headingId}
        sx={scrollMarginSx}
      >
        <SectionCard>
          <Stack spacing={2.5}>
            <Box>
              <Typography
                id={headingId}
                ref={resultsHeadingRef}
                tabIndex={-1}
                variant="h5"
                component="h2"
                sx={{
                  m: 0,
                  overflowWrap: "anywhere",
                  "&:focus:not(:focus-visible)": { outline: "none" },
                }}
              >
                {resultsTitle}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                component="p"
                sx={{ m: 0, mt: 0.5, maxWidth: "72ch" }}
              >
                {resultsDescription}
              </Typography>
            </Box>
            {familyId !== null ? (
              <FamilyBanner
                familyId={familyId}
                kind={kind}
                names={familyNames}
                onClear={clearFamily}
              />
            ) : null}
            {renderScanProgress()}
            {renderResults()}
          </Stack>
        </SectionCard>
      </Box>

      {/* After the results, so the first screen holds pets rather than the
          tiles (the filter bar's Family menu does the same job up top). */}
      <SectionCard
        title="Pet families"
        description={`The ten battle pet families, with their icons from Blizzard's render host. Pick one to list its ${noun.many}; pick it again to list every family.`}
      >
        <Stack spacing={2}>
          <Box ref={pickerRef}>
            <FamilyPicker
              names={familyNames}
              value={familyId}
              onChange={selectFamily}
              counts={coverage?.counts ?? null}
              noun={noun}
            />
          </Box>
          {coverage ? (
            <FamilyCoverage
              known={coverage.known}
              total={coverage.total}
              noun={noun}
              scan={countingKind === kind ? countScan : null}
              onStart={() => setCountingKind(kind)}
              onStop={stopCounting}
            />
          ) : index.isPending && !indexError.error ? (
            // The coverage line and its button: a column on phones, a row from `sm`.
            <LoadingSkeleton
              variant="block"
              label="Loading family coverage"
              sx={{ height: { xs: 128, sm: 64, md: 44 } }}
            />
          ) : null}
        </Stack>
      </SectionCard>

      <PetDialog
        open={petId !== null}
        petId={shownPetId}
        fallbackName={openPetName}
        familyNames={familyNames}
        activeFamilyId={mode === "pets" ? familyId : null}
        onShowFamily={showFamilyFrom("pets")}
        onOpenAbility={openAbility}
        onClose={closePet}
      />
      <AbilityDialog
        open={abilityId !== null}
        abilityId={shownAbilityId}
        fallbackName={openAbilityName}
        familyNames={familyNames}
        activeFamilyId={mode === "abilities" ? familyId : null}
        onShowFamily={showFamilyFrom("abilities")}
        onClose={closeAbility}
      />
    </Stack>
  );
};

export default BattlePetsPage;
