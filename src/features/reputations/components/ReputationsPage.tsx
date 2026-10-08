import Diversity3RoundedIcon from "@mui/icons-material/Diversity3Rounded";
import { Box, Chip, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ExplorerFilterBar,
  SearchField,
} from "@/components/common/ExplorerFilterBar";
import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import FactionDialog from "@/features/reputations/components/FactionDialog";
import { FactionGridSkeleton } from "@/features/reputations/components/FactionGrid";
import FactionSearchResults, {
  SEARCH_PAGE_SIZE,
} from "@/features/reputations/components/FactionSearchResults";
import GroupBrowser from "@/features/reputations/components/GroupBrowser";
import GroupTilePicker, {
  GROUP_TILE_COLS,
  GROUP_TILE_GAP,
  GROUP_TILE_HEIGHT,
} from "@/features/reputations/components/GroupTilePicker";
import StandingsGuide from "@/features/reputations/components/StandingsGuide";
import { ladderIndexQuery } from "@/features/reputations/hooks/reputationQueries";
import { useFactionParents } from "@/features/reputations/hooks/useFactionParents";
import { useReputationGroups } from "@/features/reputations/hooks/useReputationGroups";
import { pluralize } from "@/features/reputations/services/reputationService";
import type { FactionRef } from "@/features/reputations/types";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import { MIN_FUZZY_QUERY_LENGTH, rankByName } from "@/lib/fuzzyMatch";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

const URL_DEFAULTS = { group: "", faction: "", q: "", page: "" };
/** Fourteen root groups on US: what the picker shows before the index lands. */
const EXPECTED_GROUP_COUNT = 14;
const GROUP_SKELETON_COUNT = 8;
const EMPTY: FactionRef[] = [];

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

const parseId = (value: string): number | null => {
  const id = Number(value);
  // Faction ids start at 1 (Blizzard's ladder ids start at 0, but ladders are not in the URL).
  return Number.isInteger(id) && id > 0 ? id : null;
};

/**
 * Reputations: Blizzard's reputation pane as an explorer. The top-level
 * groups (the guild, each expansion, standalone factions) are colour-coded
 * tiles; the chosen group shows its factions as cards, each with its
 * standing ladder drawn as a strip, and every sub-group (The Tillers, Horde
 * Forces) as a section of its own. A search covers all 284 factions at
 * once. A faction opens in a dialog with its ladder or renown track in full
 * and links up and down the tree. Group, search, page and open faction all
 * live in the URL.
 *
 * The page loads the index and the 14 root records (six at a time), then
 * the chosen group's factions; sub-group and search cards load as they near
 * the viewport, and one shared ladder serves every standard faction.
 */
const ReputationsPage = ({
  eyebrow = "World & Factions",
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const [params, setParams] = useSearchParamsRecord(URL_DEFAULTS);
  const navigate = useNavigate();
  const groups = useReputationGroups();
  const parents = useFactionParents();
  const ladderIndex = useQuery(ladderIndexQuery());

  const index = groups.index.data;
  const roots = groups.roots;
  const factions = index?.factions ?? EMPTY;
  const rootIds = useMemo(() => new Set(roots.map((root) => root.id)), [roots]);
  const nameById = useMemo(
    () => new Map(factions.map((faction) => [faction.id, faction.name])),
    [factions],
  );

  // A retried root has no error until it fails again, so the banner keeps
  // showing the last one meanwhile (and its focused Retry button stays put).
  const [lastRootError, setLastRootError] = useState<Error | null>(null);
  if (groups.error !== null && groups.error !== lastRootError) {
    setLastRootError(groups.error);
  }
  const rootError = groups.error ?? lastRootError;

  /* ---------------- Group (URL first, then the first full group) ---------------- */

  const requestedGroup = parseId(params.group);
  // Trusted until the index says otherwise, so a shared link starts loading at once.
  const trustedGroup =
    requestedGroup !== null && (index === undefined || rootIds.has(requestedGroup))
      ? requestedGroup
      : null;
  // The first group with more than one faction (Midnight, not the guild's
  // single bar), once every root has settled so the pick cannot change.
  const defaultGroup = useMemo(() => {
    if (!groups.settled) {
      return null;
    }
    const full = roots.find((root) => (groups.records.get(root.id)?.children.length ?? 0) > 1);
    return full?.id ?? roots[0]?.id ?? null;
  }, [groups.settled, groups.records, roots]);
  const groupId = trustedGroup ?? defaultGroup;
  const group = useMemo<FactionRef | null>(
    () =>
      groupId === null
        ? null
        : (roots.find((root) => root.id === groupId) ?? {
            id: groupId,
            name: nameById.get(groupId) ?? "Reputation group",
          }),
    [groupId, roots, nameById],
  );

  // Write the resolved group into the URL, so the address always names the
  // group on screen (and a stale or foreign id falls back to the default).
  useEffect(() => {
    if (index === undefined || groupId === null) {
      return;
    }
    if (params.group !== String(groupId)) {
      setParams({ group: String(groupId) }, { replace: true });
    }
  }, [index, groupId, params.group, setParams]);

  // On phones the group's cards sit below seven rows of tiles: after a pick
  // whose section starts off screen, bring it up (focus stays on the tile,
  // so the next arrow or Tab still moves through the picker).
  const mainRef = useRef<HTMLDivElement>(null);
  const revealPendingRef = useRef(false);
  const revealMain = useCallback((): void => {
    const top = mainRef.current?.getBoundingClientRect().top;
    if (top !== undefined && top > window.innerHeight * 0.75) {
      scrollToTop(mainRef.current);
    }
  }, []);
  const selectGroup = useCallback(
    (id: number): void => {
      // The group already on screen: nothing re-renders, so reveal it now.
      if (id === groupId && params.q.trim() === "") {
        revealMain();
        return;
      }
      revealPendingRef.current = true;
      setParams({ group: String(id), q: null, page: null });
    },
    [groupId, params.q, revealMain, setParams],
  );
  const resetGroup = useCallback((): void => {
    setParams({ group: null }, { replace: true });
  }, [setParams]);

  /* ---------------- Search (keystrokes stay local; the URL gets the debounced value) ---------------- */

  const search = params.q.trim();
  const searching = search !== "";
  const [draft, setDraft] = useState(params.q);
  const emittedRef = useRef(search);
  useEffect(() => {
    // The URL changed on its own (back button, a group tile): adopt it.
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

  // After the pick has rendered (a new group, or the search it cleared).
  useEffect(() => {
    if (!revealPendingRef.current) {
      return;
    }
    revealPendingRef.current = false;
    revealMain();
  }, [groupId, searching, revealMain]);

  const results = useMemo(
    () =>
      searching
        ? rankByName(factions, search, (faction) => faction.name, factions.length)
        : EMPTY,
    [factions, search, searching],
  );
  const pageCount = Math.max(1, Math.ceil(results.length / SEARCH_PAGE_SIZE));
  const requestedPage = Math.max(1, parseId(params.page) ?? 1);
  const page = Math.min(requestedPage, pageCount);

  // A page past the end (a narrower search), a malformed one, or a page
  // without a search falls back to what is on screen.
  useEffect(() => {
    if (params.page === "" || index === undefined) {
      return;
    }
    const resolved = searching ? page : 1;
    const next = resolved > 1 ? String(resolved) : null;
    if ((next ?? "") !== params.page) {
      setParams({ page: next }, { replace: true });
    }
  }, [index, params.page, searching, page, setParams]);

  const changePage = useCallback(
    (next: number): void => {
      setParams({ page: next > 1 ? String(next) : null });
    },
    [setParams],
  );

  /* ---------------- Faction dialog ---------------- */

  const factionId = parseId(params.faction);
  // The id outlives the URL param so the dialog never blanks while closing.
  const [shownFactionId, setShownFactionId] = useState<number | null>(factionId);
  if (factionId !== null && factionId !== shownFactionId) {
    setShownFactionId(factionId);
  }
  // The card or row that opened it, for its name until the record loads
  // (the index names nearly every faction; a header's record may name more).
  const [opened, setOpened] = useState<FactionRef | null>(null);
  // Opened by a click on this page (a history entry we pushed), not a shared link.
  const openedHereRef = useRef(false);
  useEffect(() => {
    if (factionId === null) {
      openedHereRef.current = false;
    }
    if (params.faction !== "" && factionId === null) {
      setParams({ faction: null }, { replace: true });
    }
  }, [factionId, params.faction, setParams]);

  const openFaction = useCallback(
    (faction: FactionRef): void => {
      openedHereRef.current = true;
      setOpened(faction);
      setParams({ faction: String(faction.id) });
    },
    [setParams],
  );
  // Walking the tree inside the dialog replaces its history entry, so one
  // Back (or closing) always leaves the dialog, however far it walked.
  const walkToFaction = useCallback(
    (faction: FactionRef): void => {
      setOpened(faction);
      setParams({ faction: String(faction.id) }, { replace: true });
    },
    [setParams],
  );
  // Closing a dialog this page opened steps back over its history entry, so
  // Back after closing leaves the page instead of reopening the faction.
  const closeFaction = useCallback((): void => {
    if (openedHereRef.current) {
      openedHereRef.current = false;
      navigate(-1);
      return;
    }
    setParams({ faction: null }, { replace: true });
  }, [navigate, setParams]);

  /* ---------------- Render ---------------- */

  const renderGroups = (): JSX.Element => {
    if (groups.index.isPending) {
      return (
        <LoadingSkeleton
          variant="grid"
          columns={GROUP_TILE_COLS}
          itemHeight={GROUP_TILE_HEIGHT.sm}
          count={EXPECTED_GROUP_COUNT}
          gap={GROUP_TILE_GAP * 8}
          label="Loading reputation groups"
          // The cells take the tiles' own (responsive) height.
          sx={{ "& > .MuiSkeleton-root": { height: GROUP_TILE_HEIGHT } }}
        />
      );
    }
    if (groups.index.isError && !index) {
      return (
        <ErrorState
          error={groups.index.error}
          context="reputation factions"
          onRetry={() => void groups.index.refetch()}
        />
      );
    }
    if (roots.length === 0) {
      return (
        <EmptyState
          compact
          icon={<Diversity3RoundedIcon />}
          title="No reputation groups listed"
          description={
            factions.length > 0
              ? "Blizzard lists no top-level groups for this region; search the factions above instead."
              : "Blizzard returned an empty faction index for this region."
          }
        />
      );
    }
    return (
      <Stack spacing={2}>
        {groups.failedCount > 0 && rootError ? (
          <ErrorState
            compact
            error={rootError}
            title={`${pluralize(groups.failedCount, "group", "groups")} could not be loaded`}
            context="these groups"
            onRetry={groups.retryFailed}
            retryLabel={groups.retrying ? "Retrying…" : "Retry"}
          />
        ) : null}
        <GroupTilePicker
          groups={roots}
          value={searching ? null : groupId}
          onChange={selectGroup}
        />
      </Stack>
    );
  };

  const renderMain = (): JSX.Element | null => {
    // A group from the URL starts loading alongside the index.
    if (!searching && group) {
      return (
        <GroupBrowser key={group.id} group={group} onSelect={openFaction} onReset={resetGroup} />
      );
    }
    // The groups section already explains a failed or empty index.
    if (index === undefined) {
      return groups.index.isPending ? (
        <SectionCard title={searching ? "Search results" : "Factions"}>
          <FactionGridSkeleton
            count={GROUP_SKELETON_COUNT}
            withPath={searching}
            label="Loading factions"
          />
        </SectionCard>
      ) : null;
    }
    if (searching) {
      return (
        <FactionSearchResults
          query={search}
          results={results}
          page={page}
          pageCount={pageCount}
          parents={parents}
          rootIds={rootIds}
          onPageChange={changePage}
          onClear={clearSearch}
          onSelect={openFaction}
        />
      );
    }
    if (roots.length === 0) {
      return null;
    }
    // Waiting for the roots to settle before picking the default group.
    return (
      <SectionCard title="Factions">
        <FactionGridSkeleton count={GROUP_SKELETON_COUNT} label="Loading factions" />
      </SectionCard>
    );
  };

  const ladderCount = ladderIndex.data?.length ?? 0;
  const start = (page - 1) * SEARCH_PAGE_SIZE;
  let summary: string;
  if (!index) {
    summary = groups.index.isPending ? "Loading factions…" : "";
  } else if (searching) {
    // Same check as the results body: one letter ranks nothing, but that is
    // "too short", not "no match" (one more letter matches plenty).
    if (search.length < MIN_FUZZY_QUERY_LENGTH) {
      summary = "Type at least two letters";
    } else if (results.length === 0) {
      summary = "No matching factions";
    } else {
      const range = `${formatNumber(start + 1)}–${formatNumber(Math.min(start + SEARCH_PAGE_SIZE, results.length))}`;
      summary = `${formatNumber(results.length)} of ${pluralize(factions.length, "faction", "factions")} match${pageCount > 1 ? ` · showing ${range}` : ""}`;
    }
  } else {
    summary = `${pluralize(factions.length, "faction", "factions")} in ${pluralize(roots.length, "group", "groups")}`;
  }

  const groupName = group ? (groups.records.get(group.id)?.name ?? group.name) : undefined;
  // The open faction names the tab, so a shared dialog link reads as itself.
  const openFactionName = factionId !== null ? nameById.get(factionId) : undefined;
  let documentTitle = "Reputations";
  if (openFactionName) {
    documentTitle = `${openFactionName} · Reputations`;
  } else if (searching) {
    documentTitle = "Search · Reputations";
  } else if (groupName) {
    documentTitle = `${groupName} · Reputations`;
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
        title="Reputations"
        documentTitle={documentTitle}
        icon={<Diversity3RoundedIcon />}
        description="Every faction in Blizzard's reputation pane, grouped by expansion: standing ladders from Hated to Exalted, friendship ranks and renown tracks with their rewards. Pick a group, or search every faction at once."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {factions.length > 0 ? (
              <Chip size="small" label={pluralize(factions.length, "faction", "factions")} />
            ) : null}
            {roots.length > 0 ? (
              <Chip size="small" label={pluralize(roots.length, "group", "groups")} />
            ) : null}
            {ladderCount > 0 ? (
              <Chip
                size="small"
                variant="outlined"
                label={pluralize(ladderCount, "standing ladder", "standing ladders")}
              />
            ) : null}
          </>
        }
      />

      <ExplorerFilterBar label="Search factions" summary={summary || undefined}>
        <SearchField
          size="small"
          label="Search every faction by name"
          placeholder={
            factions.length > 0
              ? `Search ${formatNumber(factions.length)} factions`
              : "Search factions"
          }
          value={draft}
          onChange={setDraft}
          onDebouncedChange={handleSearch}
          onClear={clearSearch}
          disabled={groups.index.isError && !index}
          sx={{ minWidth: { xs: 0, sm: 240 }, maxWidth: { md: 480 } }}
        />
      </ExplorerFilterBar>

      <SectionCard
        title="Expansions and groups"
        description="The reputation pane's top level, in Blizzard's order: the guild, each expansion newest first, and factions that stand alone."
      >
        {renderGroups()}
      </SectionCard>

      <Box
        ref={mainRef}
        sx={(theme) => ({
          scrollMarginTop: {
            xs: `${theme.wc.layout.headerHeight.xs + 16}px`,
            md: `${theme.wc.layout.headerHeight.md + 16}px`,
          },
        })}
      >
        {renderMain()}
      </Box>

      <StandingsGuide />

      <FactionDialog
        open={factionId !== null}
        factionId={shownFactionId}
        fallbackName={
          shownFactionId === null
            ? undefined
            : (nameById.get(shownFactionId) ??
              (opened?.id === shownFactionId ? opened.name : undefined))
        }
        parents={parents}
        rootIds={rootIds}
        onNavigate={walkToFaction}
        onClose={closeFaction}
      />
    </Stack>
  );
};

export default ReputationsPage;
