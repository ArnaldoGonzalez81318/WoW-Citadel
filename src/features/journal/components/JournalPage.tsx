import AutoStoriesRoundedIcon from "@mui/icons-material/AutoStoriesRounded";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import ExploreOffRoundedIcon from "@mui/icons-material/ExploreOffRounded";
import { Box, Chip, Skeleton, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import ExplorerFilterBar, { SearchField } from "@/components/common/ExplorerFilterBar";
import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import EncounterView from "@/features/journal/components/EncounterView";
import InstanceOverview from "@/features/journal/components/InstanceOverview";
import JournalSearchResults, {
  INSTANCE_RESULT_LIMIT,
  RESULT_PAGE_SIZE,
} from "@/features/journal/components/JournalSearchResults";
import JournalTrail from "@/features/journal/components/JournalTrail";
import type {
  JournalTrailStep,
  JournalTrailTarget,
} from "@/features/journal/components/JournalTrail";
import {
  scrollMarginSx,
  scrollToTop,
} from "@/features/journal/components/journalStyles";
import TierInstances, {
  TierInstancesSkeleton,
} from "@/features/journal/components/TierInstances";
import {
  journalEncounterIndexQuery,
  journalEncounterQuery,
  journalInstanceIndexQuery,
  journalInstanceQuery,
  journalTierQuery,
  journalTiersQuery,
} from "@/features/journal/hooks/journalQueries";
import {
  CURRENT_SEASON_TIER_ID,
  newestExpansion,
  pluralize,
  searchByName,
  tierListsInstance,
} from "@/features/journal/services/journalService";
import type {
  JournalRef,
  JournalTierSummary,
} from "@/features/journal/types";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";
import { COARSE_POINTER } from "@/theme";

const URL_DEFAULTS = {
  expansion: "",
  instance: "",
  encounter: "",
  q: "",
  page: "",
};

type FocusTarget = "tier" | "instance" | "encounter";

/** A view to bring into view once it renders; `focus` moves focus to its heading too. */
type PendingView = { target: FocusTarget; focus: boolean };

const EMPTY_TIERS: JournalTierSummary[] = [];
const EMPTY_REFS: JournalRef[] = [];
/** Twelve expansions and the Current Season: what the picker shows before the index lands. */
const EXPECTED_TIER_COUNT = 13;

const parseId = (value: string): number | null => {
  const id = Number(value);
  return value.trim() !== "" && Number.isInteger(id) && id > 0 ? id : null;
};

/** "02", "abc" or "0" in the URL become what they resolved to (or nothing). */
const canonical = (id: number | null): string => (id === null ? "" : String(id));

/**
 * Encounter Journal: Blizzard's dungeon and raid guide. Pick an expansion
 * (newest first, or the Current Season's mix), then an instance from its
 * art cards to see its description, difficulties and bosses as model cards;
 * a boss opens its abilities as a collapsible tree and its loot with icons.
 * Any boss, dungeon or raid can also be found by name. Expansion, instance,
 * encounter, search and result page all live in the URL, so every view can
 * be shared; with none given the page opens on the newest expansion.
 *
 * Each layer loads only when shown: a tier's cards fetch their instance and
 * art as they near the viewport, boss cards their record and model, loot
 * rows their icon, and the two name indexes (1,159 encounters, 213
 * instances) only once the search field is used.
 */
const JournalPage = ({
  eyebrow = "World & Factions",
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const [params, setParams] = useSearchParamsRecord(URL_DEFAULTS);
  const location = useLocation();

  /* ---------------- Tiers (URL first, then the newest expansion) ---------------- */

  const tiersQuery = useQuery(journalTiersQuery());
  const tiers = tiersQuery.data ?? EMPTY_TIERS;
  const requestedTierId = parseId(params.expansion);
  const resolvedTier: JournalTierSummary | undefined = tiersQuery.isSuccess
    ? (tiers.find((tier) => tier.id === requestedTierId) ?? newestExpansion(tiers) ?? tiers[0])
    : undefined;
  // Until the index lands, a linked tier loads alongside it instead of after.
  const tierId = tiersQuery.isSuccess ? (resolvedTier?.id ?? null) : requestedTierId;
  const tierQuery = useQuery({ ...journalTierQuery(tierId ?? 0), enabled: tierId !== null });
  const tierData = tierId !== null ? (tierQuery.data ?? null) : null;
  const tier: JournalTierSummary | undefined =
    resolvedTier ??
    (tierData
      ? { ...tierData, isCurrentSeason: tierData.id === CURRENT_SEASON_TIER_ID }
      : undefined);

  // Write the resolved tier into the URL, so the address always names the
  // expansion on screen (and a stale or foreign id falls back to the newest).
  useEffect(() => {
    if (!tiersQuery.isSuccess) {
      return;
    }
    const resolved = canonical(tierId);
    if (params.expansion !== resolved) {
      setParams({ expansion: resolved || null }, { replace: true });
    }
  }, [tiersQuery.isSuccess, tierId, params.expansion, setParams]);

  /* ---------------- Instance and encounter ---------------- */

  const instanceId = parseId(params.instance);
  const instanceQuery = useQuery({
    ...journalInstanceQuery(instanceId ?? 0),
    enabled: instanceId !== null,
  });
  const instance = instanceId !== null ? (instanceQuery.data ?? null) : null;

  const encounterId = parseId(params.encounter);
  const encounterQuery = useQuery({
    ...journalEncounterQuery(encounterId ?? 0),
    enabled: encounterId !== null,
  });
  const encounter = encounterId !== null ? (encounterQuery.data ?? null) : null;
  const encounterInstanceId = encounter?.instance?.id;

  useEffect(() => {
    const patch: Partial<Record<keyof typeof URL_DEFAULTS, string | null>> = {};
    if (params.instance !== canonical(instanceId)) {
      patch.instance = canonical(instanceId) || null;
    }
    if (params.encounter !== canonical(encounterId)) {
      patch.encounter = canonical(encounterId) || null;
    }
    if (Object.keys(patch).length > 0) {
      setParams(patch, { replace: true });
    }
  }, [params.instance, params.encounter, instanceId, encounterId, setParams]);

  // An encounter names its own instance: a search pick, or a link carrying
  // only the encounter, opens that instance around it.
  useEffect(() => {
    if (encounterInstanceId !== undefined && encounterInstanceId !== instanceId) {
      setParams({ instance: String(encounterInstanceId) }, { replace: true });
    }
  }, [encounterInstanceId, instanceId, setParams]);

  // An instance the tier on screen does not list (a search pick, an old
  // link) moves the picker to its own expansion; the Current Season keeps
  // the instances it re-lists, and takes the Keystone Dungeons primer, which
  // belongs to no expansion.
  const instanceExpansionId = instance?.expansion?.id;
  const loadedInstanceId = instance?.id;
  const tierListsSelected =
    tierData !== null && loadedInstanceId !== undefined
      ? tierListsInstance(tierData, loadedInstanceId)
      : true;
  useEffect(() => {
    if (loadedInstanceId === undefined || tierData === null || tierListsSelected) {
      return;
    }
    // The encounter is about to switch the instance: wait for that one.
    if (encounterInstanceId !== undefined && encounterInstanceId !== loadedInstanceId) {
      return;
    }
    const target = instanceExpansionId ?? CURRENT_SEASON_TIER_ID;
    const known = !tiersQuery.isSuccess || tiers.some((entry) => entry.id === target);
    if (target !== tierId && known) {
      setParams({ expansion: String(target) }, { replace: true });
    }
  }, [
    loadedInstanceId,
    instanceExpansionId,
    encounterInstanceId,
    tierData,
    tierListsSelected,
    tierId,
    tiers,
    tiersQuery.isSuccess,
    setParams,
  ]);

  /* ---------------- Search (keystrokes stay local; the URL gets the debounced value) ---------------- */

  const search = params.q.trim();
  const [draft, setDraft] = useState(search);
  const emittedRef = useRef(search);
  useEffect(() => {
    // The URL changed on its own (back button, a picked result): adopt it.
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
  const clearSearch = useCallback((): void => {
    emittedRef.current = "";
    setDraft("");
    setParams({ q: null, page: null }, { replace: true });
  }, [setParams]);

  // The name indexes are ~200 KB together: fetched once the search field is
  // first used (or a link carries a query), not on every visit.
  const [searchArmed, setSearchArmed] = useState(false);
  const indexQuery = useQuery({
    ...journalEncounterIndexQuery(),
    enabled: searchArmed || search !== "",
  });
  const instanceIndexQuery = useQuery({
    ...journalInstanceIndexQuery(),
    enabled: searchArmed || search !== "",
  });
  const matches = useMemo(
    () => (indexQuery.data && search ? searchByName(indexQuery.data, search) : EMPTY_REFS),
    [indexQuery.data, search],
  );
  const instanceMatches = useMemo(
    () =>
      instanceIndexQuery.data && search
        ? searchByName(instanceIndexQuery.data, search)
        : EMPTY_REFS,
    [instanceIndexQuery.data, search],
  );
  const pageCount = Math.max(1, Math.ceil(matches.length / RESULT_PAGE_SIZE));
  const requestedPage = parseId(params.page) ?? 1;
  const page = Math.min(requestedPage, pageCount);

  // Page 1 is the bare URL; a page past the end (a narrower query) or a page
  // without a query falls back to what is shown.
  useEffect(() => {
    if (search !== "" && !indexQuery.data) {
      return;
    }
    const resolved = search !== "" && page > 1 ? String(page) : "";
    if (params.page !== resolved) {
      setParams({ page: resolved || null }, { replace: true });
    }
  }, [search, indexQuery.data, page, params.page, setParams]);

  /* ---------------- Focus: a pick moves focus to what it opened ---------------- */

  const tierBoxRef = useRef<HTMLDivElement>(null);
  const instanceBoxRef = useRef<HTMLDivElement>(null);
  const encounterBoxRef = useRef<HTMLDivElement>(null);
  const tierHeadingRef = useRef<HTMLHeadingElement>(null);
  const instanceHeadingRef = useRef<HTMLHeadingElement>(null);
  const encounterHeadingRef = useRef<HTMLHeadingElement>(null);
  // A shared link to a boss or an instance opens scrolled to it (focus stays
  // put: nothing was picked on this page yet). Picks below move focus too.
  const pendingFocusRef = useRef<PendingView | null>(
    encounterId !== null
      ? { target: "encounter", focus: false }
      : instanceId !== null
        ? { target: "instance", focus: false }
        : null,
  );
  const scrolledRef = useRef(false);

  const requestFocus = useCallback((target: FocusTarget): void => {
    pendingFocusRef.current = { target, focus: true };
    scrolledRef.current = false;
  }, []);

  // After a pick, bring what it opened into view and move focus to its
  // heading, so the next Tab continues there instead of back in the cards
  // (which a drill down unmounts). The heading may only mount once its
  // record loads; a record that fails or is missing drops the request so a
  // later Retry never steals focus.
  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) {
      return;
    }
    const { target, focus } = pending;
    // Wait while the content above the encounter is still to change: its
    // instance not yet known (an encounter-only link, or a result picked
    // before its row loaded), about to switch, or still the overview's
    // skeleton. Scrolled now, the real hero and boss grid would push the
    // encounter off-screen where there is no scroll anchoring (Safari), and a
    // smooth scroll in flight overshoots. This effect runs on every render,
    // so the one that settles the instance picks the request up again.
    if (
      target === "encounter" &&
      ((encounterId !== null && instanceId === null && encounterQuery.isPending) ||
        (encounterInstanceId !== undefined && encounterInstanceId !== instanceId) ||
        (instanceId !== null && instanceQuery.isPending))
    ) {
      return;
    }
    const slots = {
      tier: { box: tierBoxRef, heading: tierHeadingRef, settled: true },
      instance: {
        box: instanceBoxRef,
        heading: instanceHeadingRef,
        settled: instanceQuery.isError || (instanceQuery.isSuccess && instanceQuery.data === null),
      },
      encounter: {
        box: encounterBoxRef,
        heading: encounterHeadingRef,
        settled: encounterQuery.isError || (encounterQuery.isSuccess && encounterQuery.data === null),
      },
    } as const;
    const slot = slots[target];
    if (!focus) {
      // A deep link waits for the view itself, then scrolls once, unless the
      // visitor has already scrolled the page on their own meanwhile.
      if (slot.heading.current) {
        if (window.scrollY === 0) {
          scrollToTop(slot.box.current);
        }
        pendingFocusRef.current = null;
      } else if (slot.settled) {
        pendingFocusRef.current = null;
      }
      return;
    }
    if (!scrolledRef.current && slot.box.current) {
      scrollToTop(slot.box.current);
      scrolledRef.current = true;
    }
    if (slot.heading.current) {
      slot.heading.current.focus({ preventScroll: true });
      pendingFocusRef.current = null;
    } else if (slot.settled) {
      pendingFocusRef.current = null;
    }
  });

  /* ---------------- Handlers ---------------- */

  const selectTier = useCallback(
    (id: number): void => {
      if (id === tierId && instanceId === null && encounterId === null) {
        return;
      }
      setParams({ expansion: String(id), instance: null, encounter: null });
    },
    [tierId, instanceId, encounterId, setParams],
  );

  const selectInstance = useCallback(
    (picked: JournalRef): void => {
      requestFocus("instance");
      setParams({ instance: String(picked.id), encounter: null });
    },
    [requestFocus, setParams],
  );

  const selectEncounter = useCallback(
    (picked: JournalRef): void => {
      // The open boss again: no navigation, just take the visitor back to it.
      if (picked.id === encounterId) {
        scrollToTop(encounterBoxRef.current);
        encounterHeadingRef.current?.focus({ preventScroll: true });
        return;
      }
      requestFocus("encounter");
      setParams({ encounter: String(picked.id) });
    },
    [encounterId, requestFocus, setParams],
  );

  // A result opens where it lives and leaves the search; Back returns to it.
  const selectInstanceResult = useCallback(
    (picked: JournalRef): void => {
      requestFocus("instance");
      setParams({ instance: String(picked.id), encounter: null, q: null, page: null });
    },
    [requestFocus, setParams],
  );

  const selectResult = useCallback(
    (picked: JournalRef, pickedInstanceId?: number): void => {
      requestFocus("encounter");
      setParams({
        encounter: String(picked.id),
        instance: pickedInstanceId !== undefined ? String(pickedInstanceId) : null,
        q: null,
        page: null,
      });
    },
    [requestFocus, setParams],
  );

  const clearInstance = useCallback((): void => {
    requestFocus("tier");
    setParams({ instance: null, encounter: null }, { replace: true });
  }, [requestFocus, setParams]);

  const closeEncounter = useCallback((): void => {
    setParams({ encounter: null }, { replace: true });
  }, [setParams]);

  const handleTrailNavigate = useCallback(
    (target: JournalTrailTarget): void => requestFocus(target),
    [requestFocus],
  );

  /** The current URL with some keys changed: the trail's real links. */
  const searchWith = (patch: Record<string, string | null>): string => {
    const next = new URLSearchParams(location.search);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });
    const query = next.toString();
    return query ? `?${query}` : "";
  };

  /* ---------------- Labels ---------------- */

  const expansionCount = tiers.filter((entry) => !entry.isCurrentSeason).length;
  const firstShown = (page - 1) * RESULT_PAGE_SIZE + 1;
  const lastShown = Math.min(matches.length, page * RESULT_PAGE_SIZE);
  let searchSummary: string | undefined;
  if (search !== "") {
    if (indexQuery.isPending || instanceIndexQuery.isPending) {
      searchSummary = "Searching…";
    } else if (indexQuery.data || instanceIndexQuery.data) {
      const found = [
        instanceMatches.length > 0
          ? pluralize(instanceMatches.length, "instance", "instances")
          : undefined,
        matches.length > 0 ? pluralize(matches.length, "encounter", "encounters") : undefined,
      ].filter(Boolean);
      // "1 encounter matches", "3 instances and 1 encounter match".
      const verb = instanceMatches.length + matches.length === 1 ? "matches" : "match";
      searchSummary =
        found.length === 0
          ? "No matches"
          : `${found.join(" and ")} ${verb}${
              instanceMatches.length > INSTANCE_RESULT_LIMIT
                ? ` · ${formatNumber(INSTANCE_RESULT_LIMIT)} closest instances shown`
                : ""
            }${
              pageCount > 1
                ? ` · encounters ${formatNumber(firstShown)}–${formatNumber(lastShown)}`
                : ""
            }`;
    }
  }

  const trailSteps: JournalTrailStep[] = [
    {
      label:
        tier?.name ??
        (tiersQuery.isPending || (tierId !== null && tierQuery.isPending) ? undefined : "Expansion"),
      href: searchWith({ instance: null, encounter: null }),
      target: "tier",
    },
    {
      label: instance?.name ?? (instanceQuery.isPending ? undefined : `Instance #${instanceId ?? ""}`),
      href: searchWith({ encounter: null }),
      target: "instance",
    },
  ];
  if (encounterId !== null) {
    trailSteps.push({
      label: encounter?.name ?? (encounterQuery.isPending ? undefined : `Encounter #${encounterId}`),
    });
  }

  const documentTitle = [encounter?.name, instance?.name, "Encounter Journal"]
    .filter(Boolean)
    .join(" · ");

  /* ---------------- Render ---------------- */

  const renderTierPicker = (): JSX.Element => {
    if (tiersQuery.isPending) {
      return (
        <Stack
          role="status"
          aria-label="Loading expansions"
          aria-busy
          direction="row"
          flexWrap="wrap"
          useFlexGap
          gap={1}
        >
          {Array.from({ length: EXPECTED_TIER_COUNT }, (_, index) => (
            <Skeleton
              key={index}
              variant="rounded"
              width={index % 3 === 0 ? 148 : 112}
              height={28}
              sx={(theme) => ({ borderRadius: `${theme.wc.radius.pill}px` })}
            />
          ))}
        </Stack>
      );
    }
    if (tiersQuery.isError) {
      return (
        <ErrorState
          compact
          error={tiersQuery.error}
          context="the journal's expansions"
          onRetry={() => void tiersQuery.refetch()}
        />
      );
    }
    if (tiers.length === 0) {
      return (
        <EmptyState
          compact
          icon={<ExploreOffRoundedIcon />}
          title="No expansions listed"
          description="Blizzard returned an empty journal index for this region."
        />
      );
    }
    return (
      <ExpansionChips tiers={tiers} value={tierId} onChange={selectTier} />
    );
  };

  const renderTier = (): JSX.Element | null => {
    if (tier) {
      return (
        <TierInstances
          tier={tier}
          query={tierQuery}
          headingRef={tierHeadingRef}
          onSelect={selectInstance}
        />
      );
    }
    if (tiersQuery.isPending || (tierId !== null && tierQuery.isPending)) {
      return <TierInstancesSkeleton />;
    }
    // Only reachable when the index failed but a linked tier was tried.
    if (tierId !== null && tierQuery.isError) {
      return (
        <ErrorState
          error={tierQuery.error}
          context="this expansion's instances"
          onRetry={() => void tierQuery.refetch()}
        />
      );
    }
    // The index failed or is empty: the picker's error or empty state explains.
    return null;
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
        title="Encounter Journal"
        documentTitle={documentTitle}
        icon={<AutoStoriesRoundedIcon />}
        description="Blizzard's dungeon and raid guide for every expansion: each instance with its zone art, difficulties and bosses, and each boss with its model, abilities and loot. Browse an expansion, or find any boss, dungeon or raid by name."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {expansionCount > 0 ? (
              <Chip size="small" label={pluralize(expansionCount, "expansion", "expansions")} />
            ) : null}
            {indexQuery.data ? (
              <Chip size="small" label={pluralize(indexQuery.data.length, "encounter", "encounters")} />
            ) : null}
          </>
        }
      />

      <ExplorerFilterBar
        label="Journal search"
        summary={searchSummary}
        progress={
          search !== "" &&
          ((indexQuery.isFetching && !indexQuery.isPending) ||
            (instanceIndexQuery.isFetching && !instanceIndexQuery.isPending))
        }
      >
        {/* Focus anywhere in the field arms the name index, so results are
            ready by the time the second letter is typed. */}
        <Box
          onFocusCapture={() => setSearchArmed(true)}
          sx={{ display: "flex", flex: "1 1 240px", minWidth: 0, maxWidth: { md: 560 } }}
        >
          <SearchField
            label="Find a boss, dungeon or raid by name"
            placeholder="Find a boss, dungeon or raid"
            value={draft}
            onChange={setDraft}
            onDebouncedChange={handleSearch}
            onClear={clearSearch}
            loading={search !== "" && (indexQuery.isPending || instanceIndexQuery.isPending)}
            sx={{ flex: 1, minWidth: 0 }}
          />
        </Box>
      </ExplorerFilterBar>

      {search !== "" ? (
        <JournalSearchResults
          query={search}
          encounterIndex={indexQuery}
          instanceIndex={instanceIndexQuery}
          encounterMatches={matches}
          instanceMatches={instanceMatches}
          page={page}
          onPageChange={(next) => setParams({ page: next > 1 ? String(next) : null })}
          onSelectEncounter={selectResult}
          onSelectInstance={selectInstanceResult}
          onClear={clearSearch}
        />
      ) : null}

      <SectionCard
        title="Choose an expansion"
        description="Newest first. The Current Season gathers this season's raids and dungeons from several expansions."
      >
        {renderTierPicker()}
      </SectionCard>

      {instanceId !== null ? (
        <Stack spacing={1.5} ref={instanceBoxRef} sx={scrollMarginSx}>
          <JournalTrail steps={trailSteps} onNavigate={handleTrailNavigate} />
          <InstanceOverview
            instanceId={instanceId}
            query={instanceQuery}
            headingRef={instanceHeadingRef}
            selectedEncounterId={encounterId}
            onSelectEncounter={selectEncounter}
            onClear={clearInstance}
            tierName={tier?.name}
          />
        </Stack>
      ) : (
        <Box ref={tierBoxRef} sx={scrollMarginSx}>
          {renderTier()}
        </Box>
      )}

      {encounterId !== null ? (
        <Box ref={encounterBoxRef} sx={scrollMarginSx}>
          <EncounterView
            encounterId={encounterId}
            query={encounterQuery}
            instance={instance}
            headingRef={encounterHeadingRef}
            onSelectEncounter={selectEncounter}
            onClose={closeEncounter}
          />
        </Box>
      ) : null}
    </Stack>
  );
};

/**
 * The tier picker: the Current Season first (marked with an icon), then
 * every expansion newest first, one pressed at a time.
 */
const ExpansionChips = ({
  tiers,
  value,
  onChange,
}: {
  tiers: readonly JournalTierSummary[];
  value: number | null;
  onChange: (tierId: number) => void;
}): JSX.Element => (
  <Stack
    role="group"
    aria-label="Expansion"
    direction="row"
    flexWrap="wrap"
    useFlexGap
    gap={1}
    alignItems="center"
    sx={(theme) => ({
      minWidth: 0,
      // Chips grow a 44px hit area on touch screens (theme MuiChip); a
      // wider row gap keeps wrapped rows' targets from overlapping much.
      [COARSE_POINTER]: { rowGap: theme.spacing(1.5) },
    })}
  >
    {tiers.map((entry) => {
      const pressed = entry.id === value;
      return (
        <Chip
          key={entry.id}
          label={entry.name}
          variant="outlined"
          color={entry.isCurrentSeason ? "secondary" : "default"}
          icon={entry.isCurrentSeason ? <EventRepeatRoundedIcon /> : undefined}
          clickable
          aria-pressed={pressed}
          onClick={() => onChange(entry.id)}
        />
      );
    })}
  </Stack>
);

export default JournalPage;
