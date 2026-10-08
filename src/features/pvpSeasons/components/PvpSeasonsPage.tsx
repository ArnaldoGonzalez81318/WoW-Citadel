import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import LockClockRoundedIcon from "@mui/icons-material/LockClockRounded";
import MilitaryTechRoundedIcon from "@mui/icons-material/MilitaryTechRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import {
  Button,
  Chip,
  Pagination,
  Skeleton,
  Stack,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";

import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import {
  EmptyState,
  ErrorState,
  LiveStatus,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import { useConnectedRealmCatalog } from "@/features/connectedRealms/hooks/useConnectedRealmSnapshots";
import BracketPicker from "@/features/pvpSeasons/components/BracketPicker";
import LadderSearch from "@/features/pvpSeasons/components/LadderSearch";
import PvpLadderList from "@/features/pvpSeasons/components/PvpLadderList";
import RatingCutoffs from "@/features/pvpSeasons/components/RatingCutoffs";
import SeasonPicker from "@/features/pvpSeasons/components/SeasonPicker";
import SeasonSummary from "@/features/pvpSeasons/components/SeasonSummary";
import type { SeasonSummaryState } from "@/features/pvpSeasons/components/SeasonSummary";
import {
  pvpBoardIndexQuery,
  pvpLadderQuery,
  pvpRewardsQuery,
  pvpSeasonIndexQuery,
  pvpSeasonQuery,
} from "@/features/pvpSeasons/hooks/pvpSeasonQueries";
import useBoardSpec from "@/features/pvpSeasons/hooks/useBoardSpec";
import {
  boardForGroup,
  groupLabelOf,
  resolveBoard,
} from "@/features/pvpSeasons/services/pvpBrackets";
import {
  isUnpublishedSeasonError,
  seasonNameFromCutoffs,
} from "@/features/pvpSeasons/services/pvpSeasonService";
import { fallbackSeasonName } from "@/features/pvpSeasons/services/seasonFormat";
import type {
  PvpBoardRef,
  PvpLadderEntry,
  PvpRewardCutoff,
} from "@/features/pvpSeasons/types";
import { pvpTierQuery } from "@/features/pvpTiers/hooks/pvpTierQueries";
import type { PvpTier } from "@/features/pvpTiers/types";
import { useNow } from "@/features/search/hooks/useNow";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import type { SearchParamsPatch } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import { normalizeForSearch } from "@/lib/fuzzyMatch";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

const PAGE_SIZE = 25;
/** Season dates read in weeks; a minute tick is plenty. */
const CLOCK_TICK_MS = 60_000;

const URL_DEFAULTS = { season: "", bracket: "", page: "", q: "" };
type UrlState = typeof URL_DEFAULTS;

const EMPTY_IDS: number[] = [];
const EMPTY_BOARDS: PvpBoardRef[] = [];
const EMPTY_ENTRIES: PvpLadderEntry[] = [];
const EMPTY_CUTOFFS: PvpRewardCutoff[] = [];

/** Bracket tiles: two columns on phones, five across from md. */
const TILE_SKELETON_COLUMNS = { xs: 2, sm: 3, md: 5 };
/**
 * Placeholders as tall as what they stand in for: a tile stacks its glyph
 * over its label on phones, and a ladder row takes two lines there.
 */
const TILE_SKELETON_SX = { "& > .MuiSkeleton-root": { height: { xs: 104, sm: 64 } } };
const LADDER_SKELETON_SX = { "& > .MuiSkeleton-root": { height: { xs: 92, md: 64 } } };
const SPEC_CUTOFF_COLUMNS = { xs: 1, sm: 2, md: 3, lg: 4 };
const TITLE_CARD_COLUMNS = { xs: 1, sm: 2, lg: 3 };

const parseId = (value: string): number | null => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

type TierLookup = {
  tiers: Map<number, PvpTier>;
  pending: Set<number>;
};

/**
 * PvP Seasons: every rated PvP season Blizzard lists, with the chosen
 * season's leaderboard for one bracket (Arena 2v2 / 3v3, Rated
 * Battlegrounds, Solo Shuffle and Blitz overall or per spec) and its title
 * cutoffs. Season, board, page and search live in the URL, so a ladder
 * position can be shared; with none given it opens on the current season's
 * Arena 3v3 board. Only the board on screen is fetched (Arena 3v3 is ~2 MB)
 * and it is paged here, 25 players at a time.
 */
const PvpSeasonsPage = ({
  eyebrow = "Competitive & Economy",
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const [params, setParams] = useSearchParamsRecord(URL_DEFAULTS);
  // Ticks, so "started 7 weeks ago" keeps up with a page left open.
  const now = useNow(CLOCK_TICK_MS);
  const theme = useTheme();
  const compactPager = useMediaQuery(theme.breakpoints.down("sm"));

  /* ---------------- Season (URL first, then the current one) ---------------- */

  const indexQuery = useQuery(pvpSeasonIndexQuery());
  const seasonIds = indexQuery.data?.seasonIds ?? EMPTY_IDS;
  const currentId = indexQuery.data?.currentId ?? null;
  const requestedSeason = parseId(params.season);
  // Trust the URL's season until the index says otherwise, so a shared link
  // starts loading at once (and an index that failed cannot rule it out).
  const seasonId =
    requestedSeason !== null &&
    (!indexQuery.isSuccess || seasonIds.includes(requestedSeason))
      ? requestedSeason
      : currentId;
  const seasonQuery = useQuery({
    ...pvpSeasonQuery(seasonId ?? 0),
    enabled: seasonId !== null,
  });
  const currentSeasonQuery = useQuery({
    ...pvpSeasonQuery(currentId ?? 0),
    enabled: currentId !== null,
  });

  // Between two seasons Blizzard's index keeps calling the one that just
  // ended "current" (Midnight Season 1 ended a week before Season 2 began).
  // A season whose end date has passed is over whatever the index says, so
  // it is not badged "Current season" and its cutoffs read as final.
  const isOver = (endTimestamp: number | undefined): boolean =>
    endTimestamp !== undefined && endTimestamp <= now;
  const seasonOver = isOver(seasonQuery.data?.endTimestamp);
  const isCurrent =
    indexQuery.isSuccess && seasonId !== null && seasonId === currentId && !seasonOver;
  // A finished season's boards and cutoffs are final: cached far longer.
  const ended =
    seasonOver || (indexQuery.isSuccess && seasonId !== null && seasonId !== currentId);
  const currentOver = isOver(currentSeasonQuery.data?.endTimestamp);
  const boardsQuery = useQuery({
    ...pvpBoardIndexQuery(seasonId ?? 0, ended),
    enabled: seasonId !== null,
  });
  const rewardsQuery = useQuery({
    ...pvpRewardsQuery(seasonId ?? 0, ended),
    enabled: seasonId !== null,
  });

  // Only once the index loaded: with the same credentials working there, a
  // 403 on one season's records is Blizzard withholding them (seasons 22–26
  // on US), not a credentials problem. Each section reads its own request.
  const withheld = (error: unknown): boolean =>
    indexQuery.isSuccess && isUnpublishedSeasonError(error);
  const seasonWithheld = withheld(seasonQuery.error);
  const boardsWithheld = withheld(boardsQuery.error);
  const rewardsWithheld = withheld(rewardsQuery.error);

  const cutoffs = rewardsQuery.data ?? EMPTY_CUTOFFS;
  const seasonName =
    seasonId === null
      ? undefined
      : (seasonQuery.data?.name ??
        seasonNameFromCutoffs(cutoffs) ??
        // Keep the placeholder name off screen while the real one may still come.
        (seasonQuery.isPending || rewardsQuery.isPending ? undefined : fallbackSeasonName(seasonId)));
  const currentSeasonName =
    currentSeasonQuery.data?.name ??
    (currentId !== null && currentId === seasonId ? seasonNameFromCutoffs(cutoffs) : undefined);
  const featuredTitle = useMemo(
    () => cutoffs.find((cutoff) => cutoff.bracketType === "ARENA_3v3") ?? cutoffs[0],
    [cutoffs],
  );

  /* ---------------- Board ---------------- */

  const boards = boardsQuery.data ?? EMPTY_BOARDS;
  const board = boardsQuery.isSuccess ? resolveBoard(params.bracket, boards) : null;
  const boardSpec = useBoardSpec(board);

  // Only the board on screen is ever requested.
  const ladderQuery = useQuery({
    ...pvpLadderQuery(seasonId ?? 0, board?.slug ?? "", ended),
    enabled: seasonId !== null && board !== null,
  });
  const ladder = ladderQuery.data;
  const entries = ladder?.entries ?? EMPTY_ENTRIES;

  const catalogQuery = useConnectedRealmCatalog({ enabled: board !== null });
  const realmNames = useMemo(() => {
    const names = new Map<string, string>();
    (catalogQuery.data?.snapshots ?? []).forEach((realm) =>
      realm.realmDetails.forEach((member) => names.set(member.slug, member.name)),
    );
    return names;
  }, [catalogQuery.data]);

  /* ---------------- Search and paging ---------------- */

  // Built once per board: name, realm name and slug ("kelthuzad" and "Kel'Thuzad").
  const searchKeys = useMemo(
    () =>
      entries.map((entry) =>
        normalizeForSearch(
          `${entry.name} ${realmNames.get(entry.realmSlug) ?? ""} ${entry.realmSlug}`,
        ),
      ),
    [entries, realmNames],
  );
  const needle = normalizeForSearch(params.q);
  const filtered = useMemo(
    () =>
      needle ? entries.filter((_entry, index) => searchKeys[index].includes(needle)) : entries,
    [entries, searchKeys, needle],
  );

  const page = parseId(params.page) ?? 1;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageEntries = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );

  // Only the tiers on this page: a full board spans about ten.
  const tierIds = useMemo(
    () =>
      Array.from(
        new Set(
          pageEntries
            .map((entry) => entry.tierId)
            .filter((id): id is number => id !== undefined),
        ),
      ),
    [pageEntries],
  );
  const combineTiers = useCallback(
    (results: UseQueryResult<PvpTier>[]): TierLookup => {
      const tiers = new Map<number, PvpTier>();
      const pending = new Set<number>();
      results.forEach((result, index) => {
        if (result.data) {
          tiers.set(tierIds[index], result.data);
        } else if (result.isPending) {
          pending.add(tierIds[index]);
        }
      });
      return { tiers, pending };
    },
    [tierIds],
  );
  const tierLookup = useQueries({
    queries: tierIds.map((tierId) => pvpTierQuery(tierId)),
    combine: combineTiers,
  });

  /* ---------------- URL upkeep (one navigation for every fix) ---------------- */

  // The resolved season and board are written into the URL once settled, so
  // the address bar always names the ladder on screen; a page past the end
  // (a smaller board, a narrower search) falls back to the last one. One
  // patch per pass: two navigations in one commit would clobber each other.
  useEffect(() => {
    const patch: SearchParamsPatch<UrlState> = {};
    if (indexQuery.isSuccess && seasonId !== null && params.season !== String(seasonId)) {
      patch.season = String(seasonId);
    }
    if (board !== null && params.bracket !== board.slug) {
      patch.bracket = board.slug;
    }
    if (params.page !== "" && (parseId(params.page) ?? 1) === 1) {
      patch.page = null;
    } else if (ladderQuery.isSuccess && page > pageCount) {
      patch.page = pageCount > 1 ? String(pageCount) : null;
    }
    if (Object.keys(patch).length > 0) {
      setParams(patch, { replace: true });
    }
  }, [
    indexQuery.isSuccess,
    seasonId,
    params.season,
    board,
    params.bracket,
    params.page,
    ladderQuery.isSuccess,
    page,
    pageCount,
    setParams,
  ]);

  /* ---------------- Handlers ---------------- */

  const handleSeasonChange = useCallback(
    (next: number) => setParams({ season: String(next), page: null }),
    [setParams],
  );
  const handleBoardChange = useCallback(
    (slug: string) => setParams({ bracket: slug, page: null }),
    [setParams],
  );
  const handleGroupChange = useCallback(
    (groupKey: string) => {
      const next = boardForGroup(groupKey, board, boards);
      if (next) {
        handleBoardChange(next.slug);
      }
    },
    [board, boards, handleBoardChange],
  );
  // Typing replaces the history entry instead of stacking one per word.
  const handleQueryChange = useCallback(
    (text: string) => setParams({ q: text || null, page: null }, { replace: true }),
    [setParams],
  );
  // The button below only exists while a search is active, so it vanishes
  // on activation; focus goes to the search field first, never to <body>.
  const searchInputRef = useRef<HTMLInputElement>(null);
  const clearSearch = (): void => {
    searchInputRef.current?.focus();
    handleQueryChange("");
  };
  // A ranking is read from the top: a new page starts at its first player.
  const listTopRef = useRef<HTMLDivElement>(null);
  const handlePageChange = (next: number): void => {
    setParams({ page: next > 1 ? String(next) : null });
    listTopRef.current?.scrollIntoView({ block: "start" });
  };

  /* ---------------- Season section ---------------- */

  const summaryState: SeasonSummaryState = seasonWithheld
    ? "unpublished"
    : seasonQuery.isError
      ? "error"
      : seasonQuery.isPending
        ? "loading"
        : "ready";

  const renderSeason = (): JSX.Element => {
    if (seasonId === null && indexQuery.isError) {
      return (
        <ErrorState
          error={indexQuery.error}
          context="PvP seasons"
          onRetry={() => void indexQuery.refetch()}
        />
      );
    }
    if (seasonId === null && indexQuery.isSuccess) {
      return (
        <EmptyState
          icon={<MilitaryTechRoundedIcon />}
          title="No PvP seasons listed"
          description="Blizzard's season index for this region is empty, so there are no ladders or cutoffs to show."
        />
      );
    }
    return (
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column-reverse", md: "row" }}
          spacing={2}
          alignItems={{ md: "flex-start" }}
          justifyContent="space-between"
          useFlexGap
        >
          <SeasonSummary
            seasonId={seasonId}
            season={seasonQuery.data}
            name={seasonName}
            state={seasonId === null ? "loading" : summaryState}
            error={seasonQuery.error}
            onRetry={() => void seasonQuery.refetch()}
            isCurrent={isCurrent}
            featuredTitle={featuredTitle}
            titleLoading={rewardsQuery.isPending}
            boardCount={boardsQuery.data?.length}
            now={now}
          />
          <SeasonPicker
            seasonIds={seasonIds}
            currentId={currentId}
            value={seasonId}
            onChange={handleSeasonChange}
            selectedLabel={seasonName ?? (seasonId !== null ? fallbackSeasonName(seasonId) : "")}
            loading={indexQuery.isPending}
            now={now}
            sx={{ flexShrink: 0 }}
          />
        </Stack>
        {/* A shared link's season loads without the index, but the picker
            needs it: without this the select would sit disabled and empty
            with nothing saying why or offering to try again. */}
        {indexQuery.isError ? (
          <ErrorState
            compact
            error={indexQuery.error}
            context="the PvP season list"
            onRetry={() => void indexQuery.refetch()}
          />
        ) : null}
      </Stack>
    );
  };

  /* ---------------- Leaderboard section ---------------- */

  const ladderSkeleton = (
    <LoadingSkeleton
      variant="rows"
      count={8}
      gap={8}
      label="Loading leaderboard"
      sx={LADDER_SKELETON_SX}
    />
  );

  const renderLadder = (): JSX.Element => {
    if (ladderQuery.isError) {
      return (
        <ErrorState
          error={ladderQuery.error}
          context="this leaderboard"
          onRetry={() => void ladderQuery.refetch()}
        />
      );
    }
    if (!ladder) {
      return ladderSkeleton;
    }
    if (entries.length === 0) {
      return (
        <EmptyState
          icon={<EmojiEventsRoundedIcon />}
          title="Nobody is ranked on this board yet"
          description="Blizzard lists the board but no rated players on it; ladders fill in once players finish their placement games."
        />
      );
    }
    if (filtered.length === 0) {
      return (
        <EmptyState
          icon={<PersonSearchRoundedIcon />}
          title={`No players match "${params.q}"`}
          description="The search covers character and realm names on this board only. Try another spelling, bracket or season."
          action={
            <Button variant="outlined" size="small" onClick={clearSearch}>
              Clear search
            </Button>
          }
        />
      );
    }
    return (
      <Stack
        spacing={2}
        ref={listTopRef}
        sx={{
          scrollMarginTop: {
            xs: `${theme.wc.layout.headerHeight.xs + 16}px`,
            md: `${theme.wc.layout.headerHeight.md + 16}px`,
          },
        }}
      >
        <PvpLadderList
          entries={pageEntries}
          tiers={tierLookup.tiers}
          pendingTiers={tierLookup.pending}
          realmNames={realmNames}
        />
        {pageCount > 1 ? (
          <Pagination
            count={pageCount}
            page={currentPage}
            onChange={(_event, next) => handlePageChange(next)}
            // Phones get first, current and last only: 200 pages still fit 320px.
            siblingCount={compactPager ? 0 : 1}
            size={compactPager ? "small" : "medium"}
            aria-label="Leaderboard pages"
            sx={{ alignSelf: "center" }}
          />
        ) : null}
      </Stack>
    );
  };

  const ladderStatus = ((): string | undefined => {
    if (!ladder || entries.length === 0) {
      return undefined;
    }
    if (needle) {
      return `${formatNumber(filtered.length)} of ${formatNumber(entries.length)} players match "${params.q}"`;
    }
    const from = (currentPage - 1) * PAGE_SIZE + 1;
    const to = Math.min(currentPage * PAGE_SIZE, filtered.length);
    return `Showing ${formatNumber(from)}–${formatNumber(to)} of ${formatNumber(entries.length)} players`;
  })();

  const renderLeaderboards = (): JSX.Element => {
    if (boardsWithheld) {
      return (
        <EmptyState
          compact
          icon={<LockClockRoundedIcon />}
          title="Leaderboards not available"
          description={`Blizzard no longer serves the leaderboards of ${seasonName ?? "this season"}. Pick a later season.`}
        />
      );
    }
    if (boardsQuery.isError) {
      return (
        <ErrorState
          error={boardsQuery.error}
          context="this season's leaderboards"
          onRetry={() => void boardsQuery.refetch()}
        />
      );
    }
    if (!boardsQuery.isSuccess) {
      return (
        <Stack spacing={2}>
          <LoadingSkeleton
            variant="grid"
            columns={TILE_SKELETON_COLUMNS}
            gap={8}
            count={5}
            label="Loading brackets"
            sx={TILE_SKELETON_SX}
          />
          {ladderSkeleton}
        </Stack>
      );
    }
    if (board === null) {
      return (
        <EmptyState
          icon={<EmojiEventsRoundedIcon />}
          title={`No leaderboards for ${seasonName ?? "this season"}`}
          description="Blizzard lists no ladders for this season yet; they appear once rated play opens."
        />
      );
    }
    return (
      <Stack spacing={2.5}>
        <BracketPicker
          boards={boards}
          value={board}
          onGroupChange={handleGroupChange}
          onBoardChange={handleBoardChange}
        />
        <Stack direction="row" flexWrap="wrap" useFlexGap gap={1.5} alignItems="center">
          <LadderSearch
            q={params.q}
            onQueryChange={handleQueryChange}
            inputRef={searchInputRef}
            disabled={!ladder || entries.length === 0}
          />
          {ladderStatus ? (
            <LiveStatus
              sx={{
                // Its own line on phones; right-aligned beside the field from sm.
                flex: { xs: "1 1 100%", sm: "0 1 auto" },
                marginLeft: { sm: "auto" },
                minWidth: 0,
                overflowWrap: "anywhere",
              }}
            >
              {ladderStatus}
            </LiveStatus>
          ) : null}
        </Stack>
        {renderLadder()}
      </Stack>
    );
  };

  /* ---------------- Cutoffs section ---------------- */

  const renderCutoffs = (): JSX.Element => {
    if (rewardsWithheld) {
      return (
        <EmptyState
          compact
          icon={<LockClockRoundedIcon />}
          title="Rating cutoffs not available"
          description={`Blizzard no longer serves the rewards of ${seasonName ?? "this season"}.`}
        />
      );
    }
    if (rewardsQuery.isError) {
      return (
        <ErrorState
          error={rewardsQuery.error}
          context="this season's rating cutoffs"
          onRetry={() => void rewardsQuery.refetch()}
        />
      );
    }
    if (!rewardsQuery.isSuccess) {
      return (
        <Stack spacing={2}>
          <Skeleton variant="text" width={160} sx={{ fontSize: "1.25rem" }} />
          <LoadingSkeleton
            variant="grid"
            columns={TITLE_CARD_COLUMNS}
            gap={8}
            itemHeight={82}
            count={3}
            label="Loading rating cutoffs"
          />
          <LoadingSkeleton
            variant="grid"
            columns={SPEC_CUTOFF_COLUMNS}
            gap={8}
            itemHeight={58}
            count={8}
          />
        </Stack>
      );
    }
    if (cutoffs.length === 0) {
      return (
        <EmptyState
          icon={<WorkspacePremiumRoundedIcon />}
          title="No rating cutoffs published"
          description={`Blizzard lists no title cutoffs for ${seasonName ?? "this season"} yet; they appear once enough players are rated.`}
        />
      );
    }
    return <RatingCutoffs cutoffs={cutoffs} />;
  };

  // With no season to show (the index failed or is empty) only the season
  // section speaks; the others would repeat it.
  const showSeasonContent = seasonId !== null || indexQuery.isPending;
  const boardLabel = board
    ? [groupLabelOf(board), boardSpec?.label].filter(Boolean).join(" · ")
    : undefined;

  return (
    <Stack
      sx={{
        gap: {
          xs: theme.spacing(theme.wc.layout.sectionGap.xs),
          md: theme.spacing(theme.wc.layout.sectionGap.md),
        },
      }}
    >
      <PageHeader
        eyebrow={eyebrow}
        breadcrumbs={breadcrumbs}
        title="PvP Seasons"
        documentTitle="PvP Seasons"
        icon={<MilitaryTechRoundedIcon />}
        description="Every rated PvP season: the ladders for Arena, Rated Battlegrounds, Solo Shuffle and Blitz with each player's tier and record, and the rating each season title took."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {currentSeasonName ? (
              <Chip
                size="small"
                label={`${currentOver ? "Latest" : "Current"}: ${currentSeasonName}`}
              />
            ) : null}
            {seasonIds.length > 0 ? (
              <Chip
                size="small"
                label={`${formatNumber(seasonIds.length)} ${seasonIds.length === 1 ? "season" : "seasons"}`}
              />
            ) : null}
          </>
        }
      />

      <SectionCard
        title="Season"
        description="Any season Blizzard lists, newest first. A finished season keeps its final ladders and cutoffs."
      >
        {renderSeason()}
      </SectionCard>

      {showSeasonContent ? (
        <SectionCard
          title="Leaderboards"
          description={
            boardsWithheld
              ? undefined
              : [
                  boardLabel,
                  ladder && entries.length > 0
                    ? `${formatNumber(entries.length)} rated ${entries.length === 1 ? "player" : "players"}`
                    : undefined,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined
          }
        >
          {renderLeaderboards()}
        </SectionCard>
      ) : null}

      {showSeasonContent ? (
        <SectionCard
          title="Rating cutoffs"
          description={
            rewardsWithheld
              ? undefined
              : isCurrent
                ? "The rating each bracket's top title needs right now. Blizzard moves these as the ladder changes until the season ends."
                : "The rating each bracket's top title needed when Blizzard last updated it."
          }
        >
          {renderCutoffs()}
        </SectionCard>
      ) : null}
    </Stack>
  );
};

export default PvpSeasonsPage;
