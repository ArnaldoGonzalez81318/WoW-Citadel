import TimerOutlined from "@mui/icons-material/TimerOutlined";
import { Box, Button, Chip, Link, Stack, Typography } from "@mui/material";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import SectionCard from "@/components/common/SectionCard";
import {
  EmptyState,
  ErrorState,
  LiveStatus,
} from "@/components/common/StateBlocks";
import {
  PanelDescriptionSkeleton,
  TILE_SKELETON_COUNT,
} from "@/features/home/components/HomePanelsFallback";
import {
  PanelFooterAction,
  PanelHeaderAction,
} from "@/features/home/components/PanelAction";
import SeasonTile, {
  TILE_COLUMNS,
  TileGridSkeleton,
} from "@/features/home/components/SeasonTile";
import TileRetryAlert from "@/features/home/components/TileRetryAlert";
import { HOME_PATHS, leaderboardForDungeon } from "@/features/home/config/homeLinks";
import { HOME_PANELS } from "@/features/home/config/panels";
import useFocusAfterRetry from "@/features/home/hooks/useFocusAfterRetry";
import useNearIds from "@/features/home/hooks/useNearIds";
import useTileRetry from "@/features/home/hooks/useTileRetry";
import {
  keystoneDungeonQuery,
  keystoneSeasonQuery,
} from "@/features/mythicKeystone/hooks/keystoneQueries";
import { formatTimer } from "@/features/mythicKeystone/services/mythicKeystoneService";
import type { KeystoneDungeon, KeystoneDungeonSummary } from "@/features/mythicKeystone/types";
import { periodQuery } from "@/features/mythicLeaderboard/hooks/leaderboardQueries";
import useStickyError from "@/features/wowToken/hooks/useStickyError";
import { formatNumber } from "@/lib/format";
import { visuallyHidden } from "@/theme";

const PANEL = HOME_PANELS.mythicPlus;
const EMPTY: readonly KeystoneDungeonSummary[] = [];

/** The keystone timer, then the +2 and +3 thresholds in plain text. */
const TimerFooter = ({ dungeon }: { dungeon: KeystoneDungeon }): JSX.Element | null => {
  const [timer, ...upgrades] = dungeon.timers;
  if (!timer) {
    return null;
  }
  return (
    <>
      <Chip
        size="small"
        icon={<TimerOutlined aria-hidden="true" />}
        label={
          <>
            {/* Named in text, not with aria-label: the chip is a plain element. */}
            <Box component="span" sx={visuallyHidden}>
              Timer{" "}
            </Box>
            {formatTimer(timer.durationMs)}
          </>
        }
      />
      {upgrades.length > 0 ? (
        <Box component="span" sx={{ typography: "caption", color: "text.secondary" }}>
          {upgrades
            .map((upgrade) => `+${upgrade.level} ${formatTimer(upgrade.durationMs)}`)
            .join(" · ")}
        </Box>
      ) : null}
    </>
  );
};

/**
 * This season's keystone rotation as art tiles, each linking to that
 * dungeon's leaderboard for the week. The season and its week are the
 * strip's cached entries; each tile then loads the Mythic Keystone Dungeons
 * page's own record for it (three small lookups and one zone image) as it
 * nears the viewport, so the eight never load at once.
 *
 * This week's affixes are not shown: Blizzard only lists them inside the
 * per-realm leaderboards (about 690 KB each), which the footer links to.
 */
const MythicPlusPanel = (): JSX.Element => {
  const seasonQuery = useQuery(keystoneSeasonQuery());
  const seasonError = useStickyError(seasonQuery);
  const season = seasonQuery.data;
  const latestId = season ? season.periodIds[season.periodIds.length - 1] : undefined;
  const periodResult = useQuery({
    ...periodQuery(latestId ?? 0),
    enabled: latestId !== undefined,
  });
  const periodError = useStickyError(periodResult);

  const dungeons = season?.dungeons ?? EMPTY;
  const [nearIds, markNear] = useNearIds();
  // Read by index on every render, never copied into state, and no
  // `combine`: react-query 5.90 hands back the previous list's combine
  // result for one render when the list changes.
  const results = useQueries({
    queries: dungeons.map((dungeon) => ({
      ...keystoneDungeonQuery(dungeon.id),
      enabled: nearIds.has(dungeon.id),
    })),
  });
  const tileRetry = useTileRetry(results, "Dungeon details loaded");
  // A successful Retry removes its alert; the tiles take the focus it held.
  const afterSeasonRetry = useFocusAfterRetry(
    tileRetry.listRef,
    dungeons.length > 0,
    season === undefined ? seasonError : null,
  );
  const afterPeriodRetry = useFocusAfterRetry(
    tileRetry.listRef,
    dungeons.length > 0 && periodResult.data !== undefined,
    periodResult.data === undefined ? periodError : null,
  );

  const weekLabel = season ? `${season.name}, week ${formatNumber(season.periodIds.length)}` : "";
  const description = season
    ? dungeons.length > 0
      ? `${weekLabel}: the ${formatNumber(dungeons.length)} dungeons in this season's rotation and their keystone timers. Open one for this week's top runs.`
      : `${weekLabel}.`
    : season === undefined && !seasonError
      ? <PanelDescriptionSkeleton />
      : undefined;

  const renderBody = (): JSX.Element => {
    if (season === undefined) {
      if (seasonError) {
        return (
          <ErrorState
            compact
            // The strip's Mythic+ card reads the same query and announces this failure.
            announce={false}
            error={seasonError}
            context="the Mythic+ season"
            onRetry={afterSeasonRetry(() => void seasonQuery.refetch())}
          />
        );
      }
      return (
        <TileGridSkeleton count={TILE_SKELETON_COUNT} label="Loading the Mythic+ rotation" />
      );
    }

    if (season === null || dungeons.length === 0) {
      return (
        <EmptyState
          compact
          title={
            season === null
              ? "No Mythic+ season is running"
              : "Blizzard lists no dungeons in this season's rotation yet"
          }
          action={
            <Button component={RouterLink} to={HOME_PATHS.keystoneDungeons} variant="outlined" size="small">
              Browse every keystone dungeon
            </Button>
          }
        />
      );
    }

    return (
      <Stack spacing={2}>
        {periodError && !periodResult.data ? (
          <ErrorState
            compact
            error={periodError}
            context="the weekly reset time"
            onRetry={afterPeriodRetry(() => void periodResult.refetch())}
          />
        ) : null}

        <Box
          component="ul"
          ref={tileRetry.listRef}
          // Safari drops the list role from a list-style:none list without it.
          role="list"
          aria-label="This season's keystone dungeons"
          // Takes focus when a successful Retry removes the alert that held it.
          tabIndex={-1}
          sx={{
            listStyle: "none",
            m: 0,
            p: 0,
            display: "grid",
            gap: 2,
            outline: "none",
            ...gridTemplateColumnsSx(TILE_COLUMNS),
          }}
        >
          {dungeons.map((summary, index) => {
            const result = results[index];
            const dungeon = result?.data;
            const origin = dungeon
              ? [dungeon.expansion, dungeon.location].filter(Boolean).join(" · ")
              : undefined;
            return (
              <Box component="li" key={summary.id} sx={{ minWidth: 0 }}>
                <SeasonTile
                  id={summary.id}
                  name={summary.name}
                  to={leaderboardForDungeon(summary.id)}
                  ariaLabel={`${summary.name}, this week's top runs`}
                  imageUrl={dungeon?.imageUrl}
                  pending={result?.isPending ?? true}
                  failed={result?.isError === true && dungeon === undefined}
                  origin={origin || undefined}
                  footer={dungeon ? <TimerFooter dungeon={dungeon} /> : undefined}
                  onNear={markNear}
                />
              </Box>
            );
          })}
        </Box>

        <TileRetryAlert tileRetry={tileRetry} one="dungeon" many="dungeons" />

        <Stack
          direction="row"
          flexWrap="wrap"
          useFlexGap
          columnGap={1.5}
          rowGap={0.5}
          alignItems="baseline"
        >
          <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
            This week&apos;s affixes are listed on each dungeon&apos;s leaderboard.
          </Typography>
          <Link component={RouterLink} to={HOME_PATHS.keystoneLeaderboards} variant="body2">
            Mythic+ leaderboards
          </Link>
        </Stack>
      </Stack>
    );
  };

  return (
    <SectionCard
      id={PANEL.id}
      title={PANEL.title}
      icon={<TimerOutlined />}
      description={description}
      actions={<PanelHeaderAction to={HOME_PATHS.keystoneDungeons}>All dungeons</PanelHeaderAction>}
    >
      {renderBody()}
      <PanelFooterAction to={HOME_PATHS.keystoneDungeons}>All dungeons</PanelFooterAction>
      {/* Always mounted: a live region inserted with its first text is not reliably announced. */}
      <LiveStatus visuallyHidden>{tileRetry.announcement}</LiveStatus>
    </SectionCard>
  );
};

export default MythicPlusPanel;
