import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import {
  Avatar,
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import MediaTile from "@/components/common/MediaTile";
import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import ConnectedRealmPicker from "@/features/connectedRealms/components/ConnectedRealmPicker";
import { useConnectedRealmCatalog } from "@/features/connectedRealms/hooks/useConnectedRealmSnapshots";
import DungeonTilePicker from "@/features/mythicLeaderboard/components/DungeonTilePicker";
import LeaderboardRunList from "@/features/mythicLeaderboard/components/LeaderboardRunList";
import {
  affixIconQuery,
  leaderboardQuery,
  periodQuery,
  specQuery,
} from "@/features/mythicLeaderboard/hooks/leaderboardQueries";
import type { Specialization } from "@/features/mythicLeaderboard/types";
import {
  keystoneDungeonQuery,
  keystoneSeasonQuery,
} from "@/features/mythicKeystone/hooks/keystoneQueries";
import { formatTimer } from "@/features/mythicKeystone/services/mythicKeystoneService";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import { formatNumber, toBcp47 } from "@/lib/format";
import { useNow } from "@/features/search/hooks/useNow";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

const PAGE_SIZE = 25;
const WEEK_MS = 7 * 24 * 60 * 60_000;
/** Per-viewer convenience: the realm a visitor last looked at (realm ids are regional). */
const REMEMBERED_REALM_KEY = `wc:keystone-leaderboard-realm:${env.region}`;

const URL_DEFAULTS = { realm: "", dungeon: "", period: "", page: "" };

const parseId = (value: string): number | null => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const readRememberedRealm = (): number | null => {
  try {
    return parseId(window.localStorage.getItem(REMEMBERED_REALM_KEY) ?? "");
  } catch {
    return null;
  }
};

const rememberRealm = (id: number): void => {
  try {
    window.localStorage.setItem(REMEMBERED_REALM_KEY, String(id));
  } catch {
    // Private mode or blocked storage: the URL still carries the choice.
  }
};

const formatDay = (timestamp: number): string =>
  new Intl.DateTimeFormat(toBcp47(env.locale), {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));

const combineSpecs = (
  results: UseQueryResult<Specialization>[],
): Specialization[] =>
  results
    .map((result) => result.data)
    .filter((spec): spec is Specialization => spec !== undefined);

const combineIcons = (results: UseQueryResult<string | null>[]): Array<string | null | undefined> =>
  results.map((result) => result.data);

/**
 * Mythic Keystone Leaderboards: a connected realm's top completed runs for one
 * of this season's dungeons in one week. Realm, dungeon, week and page live
 * in the URL, so a board can be shared; with none given it opens on the
 * visitor's last realm (or a full-population one), the first dungeon and
 * the current week.
 */
const MythicLeaderboardPage = ({
  eyebrow = "Competitive & Economy",
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const [params, setParams] = useSearchParamsRecord(URL_DEFAULTS);
  // Ticks, so a board fetched later never reads "completed in 20 minutes".
  const now = useNow();
  const weekLabelId = `keystone-week-${useId()}`;

  const seasonQuery = useQuery(keystoneSeasonQuery());
  const catalogQuery = useConnectedRealmCatalog();
  const season = seasonQuery.data ?? null;
  const catalog = useMemo(
    () => catalogQuery.data?.snapshots ?? [],
    [catalogQuery.data],
  );

  /* ---------------- Selection (URL first, then sensible defaults) ---------------- */

  const [rememberedRealm] = useState(readRememberedRealm);
  const fallbackRealm = useMemo(() => {
    // Trust a remembered realm until the catalog says otherwise (merged away,
    // or a foreign id from a shared link); a partial catalog cannot rule it out.
    if (
      rememberedRealm !== null &&
      (!catalogQuery.isSuccess ||
        catalogQuery.data.failedCount > 0 ||
        catalog.some((realm) => realm.id === rememberedRealm))
    ) {
      return rememberedRealm;
    }
    const full = catalog
      .filter((realm) => realm.populationType === "FULL")
      .sort((left, right) => left.shortLabel.localeCompare(right.shortLabel));
    return full[0]?.id ?? catalog[0]?.id ?? null;
  }, [catalog, catalogQuery.data, catalogQuery.isSuccess, rememberedRealm]);
  const realmId = parseId(params.realm) ?? fallbackRealm;

  // Write the resolved default into the URL once it is settled, so the
  // address bar always names the board on screen (and it never switches
  // realms under the viewer when the catalog refetches).
  useEffect(() => {
    if (params.realm === "" && realmId !== null && catalogQuery.isSuccess) {
      setParams({ realm: String(realmId) }, { replace: true });
    }
  }, [params.realm, realmId, catalogQuery.isSuccess, setParams]);

  const dungeons = season?.dungeons ?? [];
  const requestedDungeon = parseId(params.dungeon);
  const dungeonId =
    requestedDungeon !== null && dungeons.some((dungeon) => dungeon.id === requestedDungeon)
      ? requestedDungeon
      : (dungeons[0]?.id ?? null);
  const dungeon = dungeons.find((entry) => entry.id === dungeonId);

  const periodIds = season?.periodIds ?? [];
  const latestPeriodId = periodIds[periodIds.length - 1] ?? null;
  const requestedPeriod = parseId(params.period);
  const periodId =
    requestedPeriod !== null && periodIds.includes(requestedPeriod)
      ? requestedPeriod
      : latestPeriodId;
  const page = Math.max(1, parseId(params.page) ?? 1);

  /* ---------------- Data ---------------- */

  const latestPeriodQuery = useQuery({
    ...periodQuery(latestPeriodId ?? 0),
    enabled: latestPeriodId !== null,
  });
  const boardQuery = useQuery({
    ...leaderboardQuery(
      realmId ?? 0,
      dungeonId ?? 0,
      periodId ?? 0,
      periodId !== latestPeriodId,
    ),
    enabled: realmId !== null && dungeonId !== null && periodId !== null,
  });
  const dungeonQuery = useQuery({
    ...keystoneDungeonQuery(dungeonId ?? 0),
    enabled: dungeonId !== null,
  });

  const board = boardQuery.data;
  const runs = board?.runs ?? [];
  const pageCount = Math.max(1, Math.ceil(runs.length / PAGE_SIZE));
  const pageRuns = useMemo(
    () => runs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [runs, page],
  );

  // Only the specs on this page: a full board names about 40 specs.
  const specIds = useMemo(
    () =>
      Array.from(
        new Set(
          pageRuns.flatMap((run) =>
            run.members
              .map((member) => member.specId)
              .filter((id): id is number => typeof id === "number"),
          ),
        ),
      ),
    [pageRuns],
  );
  const specList = useQueries({
    queries: specIds.map((specId) => specQuery(specId)),
    combine: combineSpecs,
  });
  const specs = useMemo(
    () => new Map(specList.map((spec) => [spec.id, spec])),
    [specList],
  );

  const affixes = board?.affixes ?? [];
  const affixIcons = useQueries({
    queries: affixes.map((affix) => affixIconQuery(affix.id)),
    combine: combineIcons,
  });

  const realmNames = useMemo(() => {
    const names = new Map<string, string>();
    catalog.forEach((realm) =>
      realm.realmDetails.forEach((member) => names.set(member.slug, member.name)),
    );
    return names;
  }, [catalog]);
  const selectedRealm = catalog.find((realm) => realm.id === realmId);

  // A page past the end (a smaller board after switching) falls back to the last one.
  useEffect(() => {
    if (board && page > pageCount) {
      setParams({ page: pageCount > 1 ? String(pageCount) : null }, { replace: true });
    }
  }, [board, page, pageCount, setParams]);

  /* ---------------- Handlers ---------------- */

  const handleRealmChange = useCallback(
    (next: number | null) => {
      if (next === null) {
        return;
      }
      rememberRealm(next);
      setParams({ realm: String(next), page: null });
    },
    [setParams],
  );
  const handleDungeonChange = useCallback(
    (next: number) => setParams({ dungeon: String(next), page: null }),
    [setParams],
  );
  const handlePeriodChange = (next: number): void =>
    setParams({
      period: next === latestPeriodId ? null : String(next),
      page: null,
    });
  // A ranking is read from the top: a new page starts at its first run.
  const listTopRef = useRef<HTMLDivElement>(null);
  const handlePageChange = (next: number): void => {
    setParams({ page: next > 1 ? String(next) : null });
    listTopRef.current?.scrollIntoView({ block: "start" });
  };

  /* ---------------- Labels ---------------- */

  const latestStart = latestPeriodQuery.data?.start;
  const weekLabel = (id: number, index: number): string => {
    const base = id === latestPeriodId ? "This week" : `Week ${index + 1}`;
    if (!latestStart || latestPeriodId === null) {
      return base;
    }
    return `${base} · ${formatDay(latestStart - (latestPeriodId - id) * WEEK_MS)}`;
  };
  const boardDates =
    board?.periodStart && board.periodEnd
      ? `${formatDay(board.periodStart)} – ${formatDay(board.periodEnd)}`
      : undefined;
  const [timer] = dungeonQuery.data?.timers ?? [];

  /* ---------------- Render ---------------- */

  const renderBoard = (): JSX.Element => {
    if (seasonQuery.isError) {
      return (
        <ErrorState
          error={seasonQuery.error}
          context="the current keystone season"
          onRetry={() => void seasonQuery.refetch()}
        />
      );
    }
    // States where the board can never load: without these a disabled query
    // would leave the loading skeleton up forever.
    if (realmId === null && catalogQuery.isError) {
      return (
        <ErrorState
          error={catalogQuery.error}
          context="connected realms"
          onRetry={() => void catalogQuery.refetch()}
        />
      );
    }
    if (realmId === null && catalogQuery.isSuccess) {
      return (
        <EmptyState
          icon={<EmojiEventsRoundedIcon />}
          title="No connected realms found"
          description="Blizzard returned no connected realms for this region."
        />
      );
    }
    if (seasonQuery.isSuccess && (dungeonId === null || periodId === null)) {
      return (
        <EmptyState
          icon={<EmojiEventsRoundedIcon />}
          title={season ? `No leaderboards listed for ${season.name}` : "No keystone season is running"}
          description="Blizzard lists no current keystone dungeons or weeks, so there are no boards until the next season starts."
        />
      );
    }
    if (boardQuery.isError) {
      return (
        <ErrorState
          error={boardQuery.error}
          context="this leaderboard"
          onRetry={() => void boardQuery.refetch()}
        />
      );
    }
    if (!board) {
      return (
        <LoadingSkeleton
          variant="rows"
          count={8}
          itemHeight={64}
          label="Loading leaderboard"
        />
      );
    }
    if (runs.length === 0) {
      return (
        <EmptyState
          icon={<EmojiEventsRoundedIcon />}
          title="No runs on this board"
          description={`Nobody on ${selectedRealm?.shortLabel ?? "this realm"} completed ${dungeon?.name ?? "this dungeon"} ${periodId === latestPeriodId ? "this week yet" : "that week"}. Try another week or realm.`}
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
        <LeaderboardRunList
          runs={pageRuns}
          timers={dungeonQuery.data?.timers ?? []}
          specs={specs}
          realmNames={realmNames}
          now={now}
        />
        {pageCount > 1 ? (
          <Pagination
            count={pageCount}
            page={Math.min(page, pageCount)}
            onChange={(_event, next) => handlePageChange(next)}
            siblingCount={1}
            aria-label="Leaderboard pages"
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
        title="Mythic Keystone Leaderboards"
        documentTitle="Mythic Keystone Leaderboards"
        icon={<EmojiEventsRoundedIcon />}
        description="Each connected realm's best keystone runs per dungeon and week, with the week's affixes and every party's specs."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {season ? <Chip size="small" label={season.name} /> : null}
          </>
        }
      />

      <SectionCard
        title="Choose a board"
        description="Blizzard publishes keystone leaderboards per connected realm only; there is no region-wide ranking in its API."
      >
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <ConnectedRealmPicker
              options={catalog}
              value={realmId}
              onChange={handleRealmChange}
              loading={catalogQuery.isPending}
              clearable={false}
              sx={{ flex: "1 1 320px", minWidth: 0 }}
            />
            <FormControl size="small" sx={{ minWidth: 200 }} disabled={periodIds.length === 0}>
              <InputLabel id={weekLabelId}>Week</InputLabel>
              <Select
                labelId={weekLabelId}
                label="Week"
                value={periodId ?? ""}
                onChange={(event) => handlePeriodChange(Number(event.target.value))}
              >
                {[...periodIds].reverse().map((id) => (
                  <MenuItem key={id} value={id}>
                    {weekLabel(id, periodIds.indexOf(id))}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
          {seasonQuery.isPending ? (
            <LoadingSkeleton
              variant="grid"
              columns={{ xs: 2, sm: 4, lg: 8 }}
              gap={8}
              itemHeight={104}
              count={8}
              label="Loading dungeons"
            />
          ) : dungeons.length > 0 ? (
            <DungeonTilePicker
              dungeons={dungeons}
              value={dungeonId}
              onChange={handleDungeonChange}
            />
          ) : null}
        </Stack>
      </SectionCard>

      <SectionCard
        title={dungeon ? `${dungeon.name} · ${selectedRealm?.shortLabel ?? "…"}` : "Leaderboard"}
        description={[
          periodId !== null ? weekLabel(periodId, periodIds.indexOf(periodId)).split(" · ")[0] : undefined,
          boardDates,
          board ? `${formatNumber(runs.length)} completed ${runs.length === 1 ? "run" : "runs"}` : undefined,
        ]
          .filter(Boolean)
          .join(" · ")}
      >
        <Stack spacing={2.5}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
            {/* Phones already see this art in the pressed tile just above. */}
            <Box sx={{ display: { xs: "none", md: "block" }, width: 240, flexShrink: 0, aspectRatio: "2 / 1", borderRadius: 1, overflow: "hidden" }}>
              <MediaTile
                size="fill"
                aspect="2 / 1"
                src={dungeonQuery.data?.imageUrl ?? undefined}
                alt=""
                fallbackLabel={dungeon?.name ?? "?"}
                loading={dungeonId !== null && dungeonQuery.isPending}
              />
            </Box>
            <Stack spacing={1} sx={{ minWidth: 0 }}>
              {timer ? (
                <Box>
                  <Chip
                    size="small"
                    icon={<TimerOutlinedIcon />}
                    label={`Timer ${formatTimer(timer.durationMs)}`}
                  />
                </Box>
              ) : null}
              {affixes.length > 0 ? (
                <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75} role="group" aria-label="This week's affixes">
                  {affixes.map((affix, index) => (
                    <Chip
                      key={affix.id}
                      size="small"
                      variant="outlined"
                      avatar={
                        <Avatar alt="" src={affixIcons[index] ?? undefined}>
                          {affix.name.charAt(0)}
                        </Avatar>
                      }
                      label={affix.name}
                    />
                  ))}
                </Stack>
              ) : null}
            </Stack>
          </Stack>
          {renderBoard()}
        </Stack>
      </SectionCard>
    </Stack>
  );
};

export default MythicLeaderboardPage;
