import { Box, Skeleton, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import MediaTile from "@/components/common/MediaTile";
import { ErrorState, LoadingSkeleton } from "@/components/common/StateBlocks";
import GuildName from "@/features/mythicRaidLeaderboard/components/GuildName";
import { HALL_OF_FAME_SIZE } from "@/features/mythicRaidLeaderboard/config/hallOfFameRaids";
import { raidJournalQuery } from "@/features/mythicRaidLeaderboard/hooks/hallOfFameQueries";
import {
  FACTION_LABEL,
  firstLabel,
  formatGap,
  formatKillDate,
} from "@/features/mythicRaidLeaderboard/services/hallOfFameService";
import type {
  FactionView,
  HallOfFameRaid,
  HallOfFameRow,
} from "@/features/mythicRaidLeaderboard/types";
import { formatNumber } from "@/lib/format";
import { lineClamp } from "@/theme";

export type RaidOverviewProps = {
  raid: HallOfFameRaid;
  view: FactionView;
  /** The view's rows in list order; undefined while loading. */
  rows: HallOfFameRow[] | undefined;
  /** A board failed: the list below explains, so no fact placeholders here. */
  boardFailed: boolean;
};

const FACT_COLS: GridColumns = { xs: 1, sm: 2 };
const FACT_HEIGHT = 92;

const Fact = ({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}): JSX.Element => (
  // Each fact is its own one-term list, so loading placeholders can sit
  // between them in the grid without breaking a shared <dl>'s content model.
  <Box
    component="dl"
    sx={(theme) => ({
      m: 0,
      minWidth: 0,
      minHeight: FACT_HEIGHT,
      px: 1.75,
      py: 1.25,
      border: `1px solid ${theme.palette.border.subtle}`,
      borderRadius: `${theme.wc.radius.md}px`,
      backgroundColor: theme.palette.surface.inset,
    })}
  >
    <Typography component="dt" variant="overline" color="text.secondary" sx={{ display: "block", lineHeight: 1.6 }}>
      {label}
    </Typography>
    {/*
      Plain text (a long boss name) is clamped to two lines. An element value
      (a guild link) already truncates itself and must not be clipped here:
      an overflow:hidden ancestor would cut off the link's outset focus ring.
    */}
    <Typography
      component="dd"
      variant="subtitle1"
      sx={{ m: 0, minWidth: 0, ...(typeof value === "string" ? lineClamp(2) : {}) }}
    >
      {value}
    </Typography>
    {detail ? (
      <Typography component="dd" variant="caption" color="text.secondary" sx={{ m: 0, display: "block" }}>
        {detail}
      </Typography>
    ) : null}
  </Box>
);

/** "Tarren Mill · EU · Horde · Dec 23, 2022" */
const whereAndWhen = (row: HallOfFameRow, view: FactionView): string =>
  [
    row.guild.realmName,
    row.region.toUpperCase(),
    view === "both" ? FACTION_LABEL[row.faction] : undefined,
    formatKillDate(row.timestamp),
  ]
    .filter(Boolean)
    .join(" · ");

/**
 * The selected raid: its Encounter Journal art and description, then the
 * board's headline facts (who got there first, the final boss, how many
 * guilds made it and how long the last one took).
 */
const RaidOverview = ({ raid, view, rows, boardFailed }: RaidOverviewProps): JSX.Element => {
  const journalQuery = useQuery(raidJournalQuery(raid.journalInstanceId));
  const journal = journalQuery.data;
  const name = journal?.name ?? raid.name;

  const first = rows?.[0];
  const last = rows && rows.length > 1 ? rows[rows.length - 1] : undefined;
  const allianceCount = rows?.filter((row) => row.faction === "alliance").length ?? 0;

  const renderAbout = (): JSX.Element | null => {
    if (journalQuery.isPending) {
      return <LoadingSkeleton variant="text" count={3} label={`Loading ${name}`} />;
    }
    if (journalQuery.isError) {
      return (
        <ErrorState
          compact
          error={journalQuery.error}
          context="this raid's journal entry"
          onRetry={() => void journalQuery.refetch()}
        />
      );
    }
    return journal?.description ? (
      <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0, maxWidth: "72ch" }}>
        {journal.description}
      </Typography>
    ) : null;
  };

  const renderFacts = (): JSX.Element | null => {
    if (boardFailed || (rows && rows.length === 0)) {
      return null;
    }
    if (!rows || !first) {
      return (
        <LoadingSkeleton
          variant="grid"
          columns={FACT_COLS}
          count={4}
          gap={12}
          itemHeight={FACT_HEIGHT}
          label="Loading the Hall of Fame"
        />
      );
    }
    const listedDetail =
      view === "both"
        ? `${formatNumber(allianceCount)} Alliance · ${formatNumber(rows.length - allianceCount)} Horde`
        : rows.length < HALL_OF_FAME_SIZE
          ? `Of ${HALL_OF_FAME_SIZE} places; the board never filled`
          : `All ${HALL_OF_FAME_SIZE} places filled`;
    return (
      <Box sx={{ display: "grid", gap: 1.5, ...gridTemplateColumnsSx(FACT_COLS) }}>
        <Fact label={firstLabel(view)} value={<GuildName entry={first} variant="subtitle1" />} detail={whereAndWhen(first, view)} />
        {journalQuery.isPending ? (
          <Skeleton variant="rounded" height={FACT_HEIGHT} aria-hidden />
        ) : journal?.finalBoss ? (
          <Fact
            label="Final boss"
            value={journal.finalBoss}
            detail={
              journal.bossCount > 0
                ? `Mythic · ${journal.bossCount} ${journal.bossCount === 1 ? "boss" : "bosses"}`
                : "Mythic"
            }
          />
        ) : null}
        <Fact label="Guilds listed" value={formatNumber(rows.length)} detail={listedDetail} />
        {last ? (
          <Fact
            label="Last entry"
            value={<GuildName entry={last} variant="subtitle1" />}
            detail={`${formatGap(last.timestamp - first.timestamp)} after #1 · ${formatKillDate(last.timestamp)}`}
          />
        ) : null}
      </Box>
    );
  };

  return (
    // useFlexGap: the art is display:none below md, and Stack's sibling
    // margins would still push the description down by a gap there.
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={{ xs: 2, md: 3 }}
      useFlexGap
      alignItems={{ md: "flex-start" }}
    >
      {/* Phones and tablets already see this art in the pressed tile above. */}
      <Box
        sx={(theme) => ({
          display: { xs: "none", md: "block" },
          width: { md: 320, lg: 400 },
          flexShrink: 0,
          aspectRatio: "2 / 1",
          borderRadius: `${theme.wc.radius.md}px`,
          overflow: "hidden",
        })}
      >
        <MediaTile
          size="fill"
          aspect="2 / 1"
          src={journal?.imageUrl ?? undefined}
          alt=""
          fallbackLabel={name}
          loading={journalQuery.isPending}
        />
      </Box>
      <Stack spacing={2} sx={{ minWidth: 0, flex: 1 }}>
        {renderAbout()}
        {renderFacts()}
      </Stack>
    </Stack>
  );
};

export default RaidOverview;
