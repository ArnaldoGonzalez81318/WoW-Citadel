import MilitaryTechRoundedIcon from "@mui/icons-material/MilitaryTechRounded";
import { Alert, Button, Chip, Pagination, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { SegmentedControl } from "@/components/common/ExplorerFilterBar";
import type { SegmentedOption } from "@/components/common/ExplorerFilterBar";
import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import { EmptyState, ErrorState, LiveStatus } from "@/components/common/StateBlocks";
import HallOfFameList, {
  HallOfFameListSkeleton,
} from "@/features/mythicRaidLeaderboard/components/HallOfFameList";
import RaidOverview from "@/features/mythicRaidLeaderboard/components/RaidOverview";
import RaidTilePicker from "@/features/mythicRaidLeaderboard/components/RaidTilePicker";
import {
  HALL_OF_FAME_RAIDS,
  HALL_OF_FAME_SIZE,
  LATEST_RAID,
  findRaid,
} from "@/features/mythicRaidLeaderboard/config/hallOfFameRaids";
import {
  hallOfFameQuery,
  raidJournalQuery,
} from "@/features/mythicRaidLeaderboard/hooks/hallOfFameQueries";
import {
  FACTION_LABEL,
  isGuildRegion,
  toRows,
} from "@/features/mythicRaidLeaderboard/services/hallOfFameService";
import type { FactionView, GuildRegion } from "@/features/mythicRaidLeaderboard/types";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import type { SearchParamsPatch } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";
import { COARSE_POINTER } from "@/theme";

const PAGE_SIZE = 25;

const URL_DEFAULTS = { raid: "", faction: "", region: "", page: "" };

const FACTION_OPTIONS: ReadonlyArray<SegmentedOption<FactionView>> = [
  { value: "both", label: "Both" },
  { value: "alliance", label: "Alliance" },
  { value: "horde", label: "Horde" },
];

const isFactionView = (value: string): value is FactionView =>
  FACTION_OPTIONS.some((option) => option.value === value);

const parsePage = (value: string): number => {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
};

/** Long enough to recognise, short enough not to wrap a phone's notice. */
const MAX_ECHOED_SLUG = 48;

/**
 * Mythic Raid Leaderboards: Blizzard's Hall of Fame, the first 100 guilds
 * of each faction to finish a raid on Mythic, for every raid it still
 * serves (Uldir to Vault of the Incarnates). Raid, faction (or both,
 * merged in kill order), region filter and page live in the URL, so a
 * board can be shared; with none given it opens on the latest raid with
 * both factions.
 */
const MythicRaidLeaderboardPage = ({
  eyebrow = "Competitive & Economy",
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const [params, setParams] = useSearchParamsRecord(URL_DEFAULTS);
  const regionLabelId = `hall-of-fame-region-${useId()}`;

  /* ---------------- Selection (URL first, then sensible defaults) ---------------- */

  const raid = findRaid(params.raid) ?? LATEST_RAID;
  const view: FactionView = isFactionView(params.faction) ? params.faction : "both";
  const region: GuildRegion | null = isGuildRegion(params.region) ? params.region : null;
  const page = parsePage(params.page);

  // A shared link to a raid without a Hall of Fame (Antorus and older,
  // Aberrus and newer) says so once, before the URL is corrected just below.
  const [unsupportedRaid, setUnsupportedRaid] = useState<string | null>(() =>
    params.raid !== "" && !findRaid(params.raid) ? params.raid : null,
  );

  // Write the resolved board into the URL and drop values that are not
  // valid, so the address bar always names the board on screen.
  useEffect(() => {
    const patch: SearchParamsPatch<typeof URL_DEFAULTS> = {};
    if (params.raid !== raid.slug) {
      patch.raid = raid.slug;
    }
    if (params.faction !== view) {
      patch.faction = view;
    }
    if (params.region !== "" && region === null) {
      patch.region = null;
    }
    // Page 1 is the bare URL; "abc", "0" or "02" become what they resolved to.
    const canonicalPage = page > 1 ? String(page) : "";
    if (params.page !== canonicalPage) {
      patch.page = canonicalPage || null;
    }
    if (Object.keys(patch).length > 0) {
      setParams(patch, { replace: true });
    }
  }, [params.raid, params.faction, params.region, params.page, raid.slug, view, region, page, setParams]);

  /* ---------------- Data ---------------- */

  const journalQuery = useQuery(raidJournalQuery(raid.journalInstanceId));
  const allianceQuery = useQuery({
    ...hallOfFameQuery(raid.slug, "alliance"),
    enabled: view !== "horde",
  });
  const hordeQuery = useQuery({
    ...hallOfFameQuery(raid.slug, "horde"),
    enabled: view !== "alliance",
  });

  const raidName = journalQuery.data?.name ?? raid.name;
  const expansion = journalQuery.data?.expansion ?? raid.expansion;
  const finalBoss = journalQuery.data?.finalBoss;

  // The boards this view needs. One that failed without data blocks the
  // list: a merged list missing a faction would misstate the world first.
  const activeBoards = (
    [
      { faction: "alliance", query: allianceQuery },
      { faction: "horde", query: hordeQuery },
    ] as const
  ).filter((board) => view === "both" || board.faction === view);
  const failedBoards = activeBoards.filter(
    (board) => board.query.isError && board.query.data === undefined,
  );

  const rows = useMemo(
    () => toRows(view, allianceQuery.data, hordeQuery.data),
    [view, allianceQuery.data, hordeQuery.data],
  );
  const firstKill = rows?.[0]?.timestamp ?? 0;

  const regionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    rows?.forEach((row) => counts.set(row.region, (counts.get(row.region) ?? 0) + 1));
    return [...counts.entries()].sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    );
  }, [rows]);

  const filteredRows = useMemo(
    () => (rows && region ? rows.filter((row) => row.region === region) : rows),
    [rows, region],
  );
  const total = filteredRows?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageRows = useMemo(
    () => filteredRows?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) ?? [],
    [filteredRows, page],
  );

  // A page past the end (a smaller board after switching) falls back to the last one.
  useEffect(() => {
    if (filteredRows && page > pageCount) {
      setParams({ page: pageCount > 1 ? String(pageCount) : null }, { replace: true });
    }
  }, [filteredRows, page, pageCount, setParams]);

  /* ---------------- Handlers ---------------- */

  const handleRaidChange = useCallback(
    (next: string) => {
      setUnsupportedRaid(null);
      if (next !== raid.slug) {
        setParams({ raid: next, page: null });
      }
    },
    [raid.slug, setParams],
  );
  const handleViewChange = (next: FactionView): void =>
    setParams({ faction: next, page: null });
  // Re-tapping the pressed chip is a no-op: it must neither push a
  // duplicate history entry nor quietly reset the page.
  const handleRegionChange = (next: GuildRegion | null): void => {
    if (next !== region) {
      setParams({ region: next, page: null });
    }
  };
  // A ranking is read from the top: a new page starts at its first guild.
  const listTopRef = useRef<HTMLDivElement>(null);
  const handlePageChange = (next: number): void => {
    setParams({ page: next > 1 ? String(next) : null });
    listTopRef.current?.scrollIntoView({ block: "start" });
  };

  /* ---------------- Labels ---------------- */

  const bossLabel = finalBoss ?? "its final boss";
  const boardDescription =
    view === "both"
      ? `The first ${HALL_OF_FAME_SIZE} guilds of each faction to defeat ${bossLabel} on Mythic, merged in kill order. Times are in your time zone.`
      : `The first ${HALL_OF_FAME_SIZE} ${FACTION_LABEL[view]} guilds to defeat ${bossLabel} on Mythic. Times are in your time zone.`;
  const regionName = region ? region.toUpperCase() : "";
  const firstShown = (Math.min(page, pageCount) - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(total, firstShown + PAGE_SIZE - 1);

  /* ---------------- Render ---------------- */

  const renderRegionFilter = (): JSX.Element | null => {
    if (!rows || rows.length === 0 || regionCounts.length < 2) {
      return null;
    }
    // Only regions the URL can hold get a chip (an unknown code still counts
    // in All). A region from the URL with no guilds on this board keeps its
    // chip, so the pressed filter that explains the empty list stays visible.
    const known = regionCounts.filter(
      (entry): entry is [GuildRegion, number] => isGuildRegion(entry[0]),
    );
    const options: Array<[GuildRegion, number]> =
      region && !known.some(([code]) => code === region)
        ? [...known, [region, 0]]
        : known;
    return (
      <Stack
        direction="row"
        flexWrap="wrap"
        useFlexGap
        gap={1}
        alignItems="center"
        role="group"
        aria-labelledby={regionLabelId}
        // Chips grow a 44px hit area on touch screens (theme MuiChip); a
        // wider row gap keeps wrapped rows' targets from overlapping much.
        sx={{ [COARSE_POINTER]: { rowGap: 1.5 } }}
      >
        <Typography id={regionLabelId} variant="caption" color="text.secondary" component="span" sx={{ mr: 0.5 }}>
          Guild region
        </Typography>
        <Chip
          size="small"
          label={`All · ${formatNumber(rows.length)}`}
          color={region === null ? "primary" : "default"}
          variant={region === null ? "filled" : "outlined"}
          aria-pressed={region === null}
          onClick={() => handleRegionChange(null)}
        />
        {options.map(([code, count]) => (
          <Chip
            key={code}
            size="small"
            label={`${code.toUpperCase()} · ${formatNumber(count)}`}
            color={region === code ? "primary" : "default"}
            variant={region === code ? "filled" : "outlined"}
            aria-pressed={region === code}
            onClick={() => handleRegionChange(code)}
          />
        ))}
      </Stack>
    );
  };

  const renderBoard = (): JSX.Element => {
    if (failedBoards.length > 0) {
      return (
        <ErrorState
          error={failedBoards[0].query.error}
          context={
            failedBoards.length === 1
              ? `the ${FACTION_LABEL[failedBoards[0].faction]} Hall of Fame`
              : "the Hall of Fame"
          }
          onRetry={() => failedBoards.forEach((board) => void board.query.refetch())}
        />
      );
    }
    if (!rows || !filteredRows) {
      return <HallOfFameListSkeleton view={view} count={10} label="Loading the Hall of Fame" />;
    }
    if (rows.length === 0) {
      const missing = activeBoards.every((board) => board.query.data?.found === false);
      return (
        <EmptyState
          icon={<MilitaryTechRoundedIcon />}
          title={
            missing
              ? `Blizzard has no ${view === "both" ? "" : `${FACTION_LABEL[view]} `}Hall of Fame for ${raidName}`
              : `No guilds on this Hall of Fame`
          }
          description={
            view === "both"
              ? "Neither faction's board lists a guild."
              : "Try the other faction, or both."
          }
        />
      );
    }
    if (filteredRows.length === 0) {
      return (
        <EmptyState
          icon={<MilitaryTechRoundedIcon />}
          title={`No ${regionName} guilds on this board`}
          description={`None of the ${formatNumber(rows.length)} guilds listed here played in ${regionName}.`}
          action={
            <Button size="small" variant="outlined" onClick={() => handleRegionChange(null)}>
              Show every region
            </Button>
          }
        />
      );
    }
    return (
      <Stack
        spacing={2}
        ref={listTopRef}
        sx={(theme) => ({
          scrollMarginTop: {
            xs: `${theme.wc.layout.headerHeight.xs + 16}px`,
            md: `${theme.wc.layout.headerHeight.md + 16}px`,
          },
        })}
      >
        <LiveStatus sx={{ typography: "caption", color: "text.secondary", m: 0 }}>
          {`Showing ${formatNumber(firstShown)}–${formatNumber(lastShown)} of ${formatNumber(total)} ${region ? `${regionName} ` : ""}guilds`}
        </LiveStatus>
        <HallOfFameList rows={pageRows} view={view} firstKill={firstKill} />
        {pageCount > 1 ? (
          <Pagination
            count={pageCount}
            page={Math.min(page, pageCount)}
            onChange={(_event, next) => handlePageChange(next)}
            siblingCount={0}
            aria-label="Hall of Fame pages"
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
        title="Mythic Raid Leaderboards"
        documentTitle="Mythic Raid Leaderboards"
        icon={<MilitaryTechRoundedIcon />}
        description={`Blizzard's Hall of Fame: the first ${HALL_OF_FAME_SIZE} guilds of each faction to defeat a raid's final boss on Mythic, with when they did it and how far each trailed the first kill. Blizzard's Hall of Fame API stops at Vault of the Incarnates; there is no Hall of Fame data for any later raid.`}
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            <Chip size="small" label={`${formatNumber(HALL_OF_FAME_RAIDS.length)} raids`} />
            <Chip size="small" label={`Top ${HALL_OF_FAME_SIZE} per faction`} />
          </>
        }
      />

      <SectionCard
        title="Choose a board"
        description="From Uldir to Vault of the Incarnates, newest first. Aberrus and every raid since have no Hall of Fame in Blizzard's API."
      >
        <Stack spacing={2}>
          {unsupportedRaid ? (
            <Alert severity="info" onClose={() => setUnsupportedRaid(null)}>
              {`There is no Hall of Fame for “${unsupportedRaid.length > MAX_ECHOED_SLUG ? `${unsupportedRaid.slice(0, MAX_ECHOED_SLUG)}…` : unsupportedRaid}”: Blizzard's Hall of Fame only covers Uldir to Vault of the Incarnates, so the latest board is shown instead.`}
            </Alert>
          ) : null}
          <SegmentedControl
            label="Faction"
            options={FACTION_OPTIONS}
            value={view}
            onChange={handleViewChange}
            size="small"
            sx={{ alignSelf: "flex-start" }}
          />
          <RaidTilePicker
            raids={HALL_OF_FAME_RAIDS}
            value={raid.slug}
            onChange={handleRaidChange}
          />
        </Stack>
      </SectionCard>

      <SectionCard title={raidName} description={[expansion, journalQuery.data?.location].filter(Boolean).join(" · ")}>
        <RaidOverview raid={raid} view={view} rows={rows} boardFailed={failedBoards.length > 0} />
      </SectionCard>

      <SectionCard
        title={view === "both" ? "Hall of Fame" : `${FACTION_LABEL[view]} Hall of Fame`}
        description={boardDescription}
      >
        <Stack spacing={2}>
          {renderRegionFilter()}
          {renderBoard()}
        </Stack>
      </SectionCard>
    </Stack>
  );
};

export default MythicRaidLeaderboardPage;
