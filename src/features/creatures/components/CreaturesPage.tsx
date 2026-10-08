import PetsRoundedIcon from "@mui/icons-material/PetsRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
  Box,
  Button,
  Chip,
  Link,
  Pagination,
  Stack,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import CreatureDialog from "@/features/creatures/components/CreatureDialog";
import type { CreatureDialogSeed } from "@/features/creatures/components/CreatureDialog";
import CreatureFilters from "@/features/creatures/components/CreatureFilters";
import type { TameableFilter } from "@/features/creatures/components/CreatureFilters";
import CreatureGrid, {
  CreatureGridSkeleton,
} from "@/features/creatures/components/CreatureGrid";
import FamilyBanner from "@/features/creatures/components/FamilyBanner";
import PetFamilyGallery from "@/features/creatures/components/PetFamilyGallery";
import {
  creatureSearchQuery,
  creatureTypesQuery,
} from "@/features/creatures/hooks/creatureQueries";
import usePetFamilyCatalog from "@/features/creatures/hooks/usePetFamilyCatalog";
import {
  CREATURE_PAGE_SIZE,
  pluralize,
} from "@/features/creatures/services/creatureService";
import type {
  Creature,
  CreatureFamilySummary,
  CreatureSearchCriteria,
  CreatureType,
} from "@/features/creatures/types";
import { useSearchState } from "@/features/search/context/SearchContext";
import useNearViewport from "@/hooks/useNearViewport";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

/*
 * `q` is also the header search's parameter: /category/creatures is a search
 * route (searchRoutes.ts), so SearchContext reads `q` from here and the
 * header writes it (resetting `page`) on Enter. The page keeps that contract
 * and owns the rest.
 */
const URL_DEFAULTS = {
  q: "",
  page: "",
  type: "",
  family: "",
  tameable: "",
  creature: "",
};

/** Blizzard's search needs a whole word; one letter is never one worth sending. */
const MIN_QUERY_LENGTH = 2;
/** English words, so only offered in English locales (the search is per locale). */
const EXAMPLE_TERMS = ["Raptor", "Dragonhawk", "Whelpling", "Kitten", "Murky"];
const JOURNAL_PATH = "/category/journal";
const EMPTY_TYPES: CreatureType[] = [];
const EMPTY_FAMILIES: CreatureFamilySummary[] = [];

const parseId = (value: string): number | null => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const parseTameable = (value: string): boolean | null => {
  if (value === "yes") {
    return true;
  }
  return value === "no" ? false : null;
};

const toTameableFilter = (tameable: boolean | null): TameableFilter => {
  if (tameable === null) {
    return "any";
  }
  return tameable ? "yes" : "no";
};

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

/** Where bosses are: Blizzard's creature search barely has any. */
const JournalLink = (): JSX.Element => (
  <Link component={RouterLink} to={JOURNAL_PATH}>
    Journal
  </Link>
);

/**
 * Creatures: Blizzard's creature search as a gallery of model renders,
 * filtered by name, type, hunter pet family and tameability, with each
 * creature's displays, family and pet spec in a dialog. Below it, every
 * creature family grouped by the hunter pet specialization its pets take;
 * picking one lists its creatures. Search, filters, page and open creature
 * all live in the URL, so any view can be shared.
 *
 * A page of 24 cards costs one search request (each hit is the whole
 * creature record) plus a render lookup per card as it nears the viewport;
 * the family gallery's 84 records only load once it is scrolled near (or
 * the Family menu is opened).
 */
const CreaturesPage = ({
  eyebrow = "World & Factions",
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const [params, setParams] = useSearchParamsRecord(URL_DEFAULTS);
  const navigate = useNavigate();
  const { pushRecentSearch } = useSearchState();

  /* ---------------- Reference data ---------------- */

  const typesQuery = useQuery(creatureTypesQuery());
  const types = typesQuery.data ?? EMPTY_TYPES;
  const [galleryRef, galleryNear] = useNearViewport<HTMLDivElement>();
  // Opening the Family menu loads the records too: they are what tells the
  // menu which families have no creatures to list (see familyOptions).
  const [familyMenuOpened, setFamilyMenuOpened] = useState(false);
  const catalog = usePetFamilyCatalog(galleryNear || familyMenuOpened);
  const familyIndex = catalog.index.data ?? EMPTY_FAMILIES;

  /* ---------------- Criteria (URL first; unknown ids fall back to "any") ---------------- */

  const name = params.q.trim();
  const tooShort = name.length > 0 && name.length < MIN_QUERY_LENGTH;
  const requestedType = parseId(params.type);
  const typeId =
    requestedType !== null &&
    (!typesQuery.isSuccess || types.some((type) => type.id === requestedType))
      ? requestedType
      : null;
  const requestedFamily = parseId(params.family);
  const familyId =
    requestedFamily !== null &&
    (!catalog.index.isSuccess || familyIndex.some((family) => family.id === requestedFamily))
      ? requestedFamily
      : null;
  const tameable = parseTameable(params.tameable);
  const page = Math.max(1, parseId(params.page) ?? 1);

  // Drop what the page cannot use (a typo, an old link, a type the index no
  // longer lists) so the address always describes the results on screen.
  useEffect(() => {
    const patch: Partial<Record<keyof typeof URL_DEFAULTS, null>> = {};
    if (params.type !== "" && typeId === null && (requestedType === null || typesQuery.isSuccess)) {
      patch.type = null;
    }
    if (
      params.family !== "" &&
      familyId === null &&
      (requestedFamily === null || catalog.index.isSuccess)
    ) {
      patch.family = null;
    }
    if (params.tameable !== "" && tameable === null) {
      patch.tameable = null;
    }
    if (params.page !== "" && parseId(params.page) === null) {
      patch.page = null;
    }
    if (params.creature !== "" && parseId(params.creature) === null) {
      patch.creature = null;
    }
    if (Object.keys(patch).length > 0) {
      setParams(patch, { replace: true });
    }
  }, [
    params.type,
    params.family,
    params.tameable,
    params.page,
    params.creature,
    typeId,
    requestedType,
    typesQuery.isSuccess,
    familyId,
    requestedFamily,
    catalog.index.isSuccess,
    tameable,
    setParams,
  ]);

  const criteria = useMemo<CreatureSearchCriteria>(
    () => ({ name: tooShort ? "" : name, typeId, familyId, tameable }),
    [tooShort, name, typeId, familyId, tameable],
  );
  const hasCriteria =
    criteria.name !== "" || typeId !== null || familyId !== null || tameable !== null;
  const hasFilters = typeId !== null || familyId !== null || tameable !== null;
  const searchEnabled = hasCriteria && !tooShort;

  /* ---------------- Search ---------------- */

  const searchQuery = useQuery({
    ...creatureSearchQuery(criteria, page),
    enabled: searchEnabled,
    // The last page stays up (dimmed) while the next one loads, instead of
    // the grid collapsing to skeletons on every page or filter change.
    placeholderData: keepPreviousData,
  });
  // Placeholder data only stands in for results that are on screen. While
  // the query is disabled (the landing prompt, a one-letter name) react-query
  // still hands it the last results it fetched, and the next search would
  // show those, cleared long ago, under its own title until it lands; a
  // search started from a prompt shows the skeleton instead.
  const shownResultsRef = useRef(false);
  const data =
    searchEnabled && (!searchQuery.isPlaceholderData || shownResultsRef.current)
      ? searchQuery.data
      : undefined;
  useEffect(() => {
    shownResultsRef.current = data !== undefined;
  });
  const placeholder = searchQuery.isPlaceholderData;
  const pageCount = data?.pageCount ?? 0;

  // A page past the end (a narrower search, an old link) falls back to the
  // last one; Blizzard reports pageCount 0 for no matches, which is page 1.
  useEffect(() => {
    if (!data || placeholder || page <= 1) {
      return;
    }
    const last = Math.max(1, data.pageCount);
    if (page > last) {
      setParams({ page: last > 1 ? String(last) : null }, { replace: true });
    }
  }, [data, placeholder, page, setParams]);

  // Record settled, successful name searches in the header's recent list,
  // as the search page this one replaces did.
  const settledHits =
    searchQuery.isSuccess && !placeholder && !searchQuery.isFetching
      ? (data?.creatures.length ?? 0)
      : 0;
  useEffect(() => {
    if (criteria.name && settledHits > 0) {
      pushRecentSearch(criteria.name);
    }
  }, [criteria.name, settledHits, pushRecentSearch]);

  /* ---------------- Search field draft (keystrokes stay local; the URL gets the debounced value) ---------------- */

  const [draft, setDraft] = useState(params.q);
  const emittedRef = useRef(params.q);
  useEffect(() => {
    // The URL changed on its own (header search, back button, a family pick): adopt it.
    if (params.q !== emittedRef.current) {
      emittedRef.current = params.q;
      setDraft(params.q);
    }
  }, [params.q]);
  const handleSearch = useCallback(
    (value: string): void => {
      const next = value.trim();
      emittedRef.current = next;
      setParams({ q: next || null, page: null }, { replace: true });
    },
    [setParams],
  );

  /* ---------------- Filters ---------------- */

  const handleTypeChange = (next: number | null): void =>
    setParams({ type: next === null ? null : String(next), page: null });
  const handleFamilyChange = (next: number | null): void =>
    setParams({ family: next === null ? null : String(next), page: null });
  const handleTameableChange = (next: TameableFilter): void =>
    setParams({ tameable: next === "any" ? null : next, page: null });

  // Every Clear button disappears with what it cleared; focus moves to the
  // search field rather than falling back to the top of the document.
  const searchInputRef = useRef<HTMLInputElement>(null);
  const clearFilters = (): void => {
    setParams({ type: null, family: null, tameable: null, page: null });
    searchInputRef.current?.focus();
  };
  const clearFamily = (): void => {
    setParams({ family: null, page: null });
    searchInputRef.current?.focus();
  };

  // A pick in the gallery or the dialog starts a fresh list of that family
  // (a name or type from before would most likely empty it), then brings the
  // results into view with focus on the family's heading, so the next Tab
  // continues in what just appeared instead of back down in the gallery.
  const resultsRef = useRef<HTMLDivElement>(null);
  const bannerHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusPendingRef = useRef(false);
  useEffect(() => {
    if (!focusPendingRef.current || familyId === null) {
      return;
    }
    focusPendingRef.current = false;
    scrollToTop(resultsRef.current);
    bannerHeadingRef.current?.focus({ preventScroll: true });
  }, [familyId]);

  const selectFamily = useCallback(
    (id: number): void => {
      // The pressed tile is a toggle: pressing it again lists every family.
      if (id === familyId) {
        setParams({ family: null, page: null });
        return;
      }
      focusPendingRef.current = true;
      setParams({ family: String(id), q: null, type: null, tameable: null, page: null });
    },
    [familyId, setParams],
  );

  // Blizzard's search lists no creatures for a family without a hunter pet
  // spec (every one of them comes back empty), so the menu leaves those out
  // once their records say which they are. The selected one stays (an old
  // link), so the field shows its name rather than "Family #16".
  const selectedIsOther =
    familyId !== null && catalog.others.some((family) => family.id === familyId);
  const familyOptions = useMemo(
    () =>
      catalog.others.length === 0
        ? familyIndex
        : familyIndex.filter(
            (family) =>
              family.id === familyId || !catalog.others.some((other) => other.id === family.id),
          ),
    [familyIndex, catalog.others, familyId],
  );

  /* ---------------- Creature dialog ---------------- */

  const creatureId = parseId(params.creature);
  // The id outlives the URL param so the dialog never blanks while closing.
  const [shownCreatureId, setShownCreatureId] = useState<number | null>(creatureId);
  if (creatureId !== null && creatureId !== shownCreatureId) {
    setShownCreatureId(creatureId);
  }
  // Opened by a click on this page (a history entry we pushed), not a shared link.
  const openedHereRef = useRef(false);
  useEffect(() => {
    if (creatureId === null) {
      openedHereRef.current = false;
    }
  }, [creatureId]);

  const openCreature = useCallback(
    (creature: Creature): void => {
      openedHereRef.current = true;
      setParams({ creature: String(creature.id) });
    },
    [setParams],
  );
  // Closing a dialog this page opened steps back over its history entry, so
  // Back after closing leaves the page instead of reopening the creature.
  const closeCreature = useCallback((): void => {
    if (openedHereRef.current) {
      openedHereRef.current = false;
      navigate(-1);
      return;
    }
    setParams({ creature: null }, { replace: true });
  }, [navigate, setParams]);
  // The dialog's entry becomes the family list, so Back returns to the
  // results the creature was opened from.
  const showFamilyFromDialog = useCallback(
    (id: number): void => {
      openedHereRef.current = false;
      focusPendingRef.current = true;
      setParams(
        { creature: null, family: String(id), q: null, type: null, tameable: null, page: null },
        { replace: true },
      );
    },
    [setParams],
  );

  const dialogSeed = useMemo((): CreatureDialogSeed | undefined => {
    const listed = data?.creatures.find((creature) => creature.id === shownCreatureId);
    return listed ? { creature: listed, updatedAt: searchQuery.dataUpdatedAt } : undefined;
  }, [data, shownCreatureId, searchQuery.dataUpdatedAt]);

  /* ---------------- Paging ---------------- */

  // A grid is read from the top: a new page starts at its first card.
  const listTopRef = useRef<HTMLDivElement>(null);
  const handlePageChange = (next: number): void => {
    setParams({ page: next > 1 ? String(next) : null });
    listTopRef.current?.scrollIntoView({ block: "start" });
  };

  /* ---------------- Labels ---------------- */

  const familyName = familyIndex.find((family) => family.id === familyId)?.name;
  const typeName = types.find((type) => type.id === typeId)?.name;
  const creatures = data?.creatures ?? [];

  const summary = ((): string | undefined => {
    if (!searchEnabled) {
      return undefined;
    }
    if (!data || placeholder) {
      return searchQuery.isError ? "Couldn't load creatures" : "Searching creatures…";
    }
    if (creatures.length === 0) {
      // A page past the end is being stepped back (see above), not empty.
      return page > Math.max(1, data.pageCount) ? "Searching creatures…" : "No creatures matched";
    }
    if (data.narrowed && data.total !== undefined) {
      return data.capped
        ? `${pluralize(data.total, "creature", "creatures")} among the closest 100 names; finish the last word for every match`
        : pluralize(data.total, "creature", "creatures");
    }
    if (data.total !== undefined) {
      return pluralize(data.total, "creature", "creatures");
    }
    const first = (data.page - 1) * CREATURE_PAGE_SIZE + 1;
    const last = first + creatures.length - 1;
    return `Showing ${formatNumber(first)}–${formatNumber(last)} · page ${formatNumber(data.page)} of ${formatNumber(data.pageCount)}${
      data.capped ? " (Blizzard pages through the first 1,000 matches)" : ""
    }`;
  })();

  const resultsTitle = criteria.name
    ? `Creatures named “${criteria.name}”`
    : familyName
      ? `${familyName} creatures`
      : typeName
        ? `${typeName} creatures`
        : "Creatures";

  /* ---------------- Render ---------------- */

  const renderResults = (): JSX.Element => {
    if (tooShort) {
      return (
        <EmptyState
          compact
          icon={<SearchRoundedIcon />}
          title={`Type at least ${MIN_QUERY_LENGTH} characters`}
          description="Blizzard's creature search matches whole words, so a single letter finds nothing."
        />
      );
    }
    // Nothing to search for: a prompt, never a skeleton for a query that cannot run.
    if (!hasCriteria) {
      const examples = env.locale.startsWith("en") ? EXAMPLE_TERMS : [];
      return (
        <Stack spacing={2}>
          <EmptyState
            compact
            icon={<SearchRoundedIcon />}
            title="Search a name, or browse a family"
            description={
              <>
                Search by name, filter by type, or pick a hunter pet family
                below. Blizzard&apos;s creature search covers tameable beasts,
                battle pets and companions; raid and dungeon bosses are in the{" "}
                <JournalLink />.
              </>
            }
          />
          {examples.length > 0 ? (
            <Stack
              direction="row"
              flexWrap="wrap"
              useFlexGap
              gap={1}
              justifyContent="center"
              role="group"
              aria-label="Example searches"
            >
              {examples.map((term) => (
                <Chip
                  key={term}
                  label={term}
                  variant="outlined"
                  clickable
                  onClick={() => setParams({ q: term, page: null })}
                />
              ))}
            </Stack>
          ) : null}
        </Stack>
      );
    }
    if (searchQuery.isError && !data) {
      return (
        <ErrorState
          error={searchQuery.error}
          context="creatures"
          onRetry={() => void searchQuery.refetch()}
        />
      );
    }
    // Loading, or a page past the end that the effect above is stepping back from.
    if (!data || (creatures.length === 0 && (placeholder || page > Math.max(1, pageCount)))) {
      return <CreatureGridSkeleton label="Loading creatures" />;
    }
    if (creatures.length === 0) {
      return (
        <EmptyState
          icon={<PetsRoundedIcon />}
          title={
            criteria.name
              ? `No creatures named “${criteria.name}”${hasFilters ? " with these filters" : ""}`
              : "No creatures match these filters"
          }
          description={
            <>
              {criteria.name
                ? "Blizzard matches whole words only: check the spelling and finish every word (“Raptor”, not “Rap”). "
                : null}
              {selectedIsOther
                ? "Blizzard lists no creatures for families without a hunter pet specialization. "
                : null}
              Its creature search covers tameable beasts, battle pets and
              companions; raid and dungeon bosses are in the <JournalLink />.
            </>
          }
          action={
            hasFilters ? (
              <Button variant="outlined" size="small" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      );
    }
    return (
      <Stack spacing={2.5} ref={listTopRef} sx={scrollMarginSx}>
        <Box
          aria-busy={placeholder || undefined}
          sx={(theme) => ({
            opacity: placeholder ? 0.6 : 1,
            transition: theme.transitions.create("opacity", {
              duration: theme.wc.motion.base,
            }),
          })}
        >
          <CreatureGrid creatures={creatures} label={resultsTitle} onSelect={openCreature} />
        </Box>
        {pageCount > 1 ? (
          <Pagination
            count={pageCount}
            page={Math.min(page, pageCount)}
            onChange={(_event, next) => handlePageChange(next)}
            siblingCount={1}
            aria-label="Creature pages"
            sx={{ alignSelf: "center" }}
          />
        ) : null}
      </Stack>
    );
  };

  const hunterFamilyCount = catalog.groups.reduce(
    (count, group) => count + group.families.length,
    0,
  );

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
        title="Creatures"
        documentTitle={
          criteria.name
            ? `${criteria.name} · Creatures`
            : familyName
              ? `${familyName} · Creatures`
              : "Creatures"
        }
        icon={<PetsRoundedIcon />}
        description="Blizzard's creature records with their model renders: search by name, type, hunter pet family or tameability, and open any creature for its every display. Below, every creature family grouped by the hunter pet specialization its pets take."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {familyIndex.length > 0 ? (
              <Chip
                size="small"
                label={pluralize(familyIndex.length, "creature family", "creature families")}
              />
            ) : null}
            {types.length > 0 ? (
              <Chip size="small" label={pluralize(types.length, "creature type", "creature types")} />
            ) : null}
          </>
        }
      />

      <CreatureFilters
        draft={draft}
        onDraftChange={setDraft}
        onSearch={handleSearch}
        searchInputRef={searchInputRef}
        types={types}
        typesLoading={typesQuery.isPending}
        typeId={typeId}
        onTypeChange={handleTypeChange}
        families={familyOptions}
        familiesLoading={catalog.index.isPending}
        familyId={familyId}
        onFamilyChange={handleFamilyChange}
        onFamiliesOpen={() => setFamilyMenuOpened(true)}
        tameable={toTameableFilter(tameable)}
        onTameableChange={handleTameableChange}
        canClear={hasFilters}
        onClear={clearFilters}
        summary={summary}
        progress={searchEnabled && searchQuery.isFetching && (placeholder || !data)}
      />

      {/* The Type menu is empty without its index; say so instead of leaving it bare.
          (The family index's failure shows in the gallery below.) */}
      {typesQuery.isError && !typesQuery.data ? (
        <ErrorState
          compact
          error={typesQuery.error}
          context="creature types"
          onRetry={() => void typesQuery.refetch()}
        />
      ) : null}

      <Box ref={resultsRef} sx={scrollMarginSx}>
        <SectionCard
          title={resultsTitle}
          description="Blizzard's creature search, A to Z. It covers tameable beasts, battle pets and companions, not every NPC in the game."
        >
          <Stack spacing={2.5}>
            {familyId !== null ? (
              <FamilyBanner
                familyId={familyId}
                fallbackName={familyName}
                headingRef={bannerHeadingRef}
                onClear={clearFamily}
              />
            ) : null}
            {renderResults()}
          </Stack>
        </SectionCard>
      </Box>

      <Box ref={galleryRef}>
        <SectionCard
          title="Hunter pet families"
          description={
            hunterFamilyCount > 0
              ? `${pluralize(hunterFamilyCount, "family", "families")} a hunter can tame, grouped by the specialization their pets take. Pick one to list its creatures.`
              : "Every family a hunter can tame, grouped by the specialization their pets take. Pick one to list its creatures."
          }
        >
          <PetFamilyGallery catalog={catalog} selectedId={familyId} onSelect={selectFamily} />
        </SectionCard>
      </Box>

      <CreatureDialog
        open={creatureId !== null}
        creatureId={shownCreatureId}
        seed={dialogSeed}
        activeFamilyId={familyId}
        onShowFamily={showFamilyFromDialog}
        onClose={closeCreature}
      />
    </Stack>
  );
};

export default CreaturesPage;
