import EventRoundedIcon from "@mui/icons-material/EventRounded";
import { Box, Chip, Skeleton, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import MediaTile from "@/components/common/MediaTile";
import { ErrorState } from "@/components/common/StateBlocks";
import { achievementIconQuery } from "@/features/pvpSeasons/hooks/pvpSeasonQueries";
import { bracketTypeLabel } from "@/features/pvpSeasons/services/pvpBrackets";
import {
  formatSeasonDay,
  weeksBetween,
} from "@/features/pvpSeasons/services/seasonFormat";
import type { PvpRewardCutoff, PvpSeason } from "@/features/pvpSeasons/types";
import { formatNumber, formatRelativeTime } from "@/lib/format";
import { mixins } from "@/theme";

export type SeasonSummaryState = "loading" | "ready" | "unpublished" | "error";

export type SeasonSummaryProps = {
  seasonId: number | null;
  season?: PvpSeason;
  /** Blizzard's name, else one read from the season's titles, else "Season N"; undefined while unknown. */
  name?: string;
  state: SeasonSummaryState;
  error?: unknown;
  onRetry?: () => void;
  isCurrent: boolean;
  /** The season's headline title (Arena 3v3's Gladiator when there is one). */
  featuredTitle?: PvpRewardCutoff;
  /** The rewards are still loading, so the title's icon is too. */
  titleLoading: boolean;
  boardCount?: number;
  now: number;
};

/** "Venomous Gladiator: Midnight Season 2" -> "Venomous Gladiator" (the season is named above it). */
const withoutSeason = (title: string): string => {
  const separator = title.lastIndexOf(":");
  return separator > 0 && /\d/u.test(title.slice(separator + 1))
    ? title.slice(0, separator).trim()
    : title;
};

const datesLine = (season: PvpSeason | undefined, now: number): string | undefined => {
  const start = season?.startTimestamp;
  const end = season?.endTimestamp;
  if (!start) {
    return undefined;
  }
  if (end) {
    return `${formatSeasonDay(start)} – ${formatSeasonDay(end)} · ${weeksBetween(start, end)} weeks`;
  }
  if (start > now) {
    return `Starts ${formatSeasonDay(start)}`;
  }
  return `Started ${formatSeasonDay(start)} · ${formatRelativeTime(start, now)}`;
};

/**
 * The selected season at a glance: its headline title's icon, its name
 * (Blizzard's "Player vs. Player (…)" wrapper removed), its dates and
 * whether it is the one running now.
 */
const SeasonSummary = ({
  seasonId,
  season,
  name,
  state,
  error,
  onRetry,
  isCurrent,
  featuredTitle,
  titleLoading,
  boardCount,
  now,
}: SeasonSummaryProps): JSX.Element => {
  const iconQuery = useQuery({
    ...achievementIconQuery(featuredTitle?.achievementId ?? 0),
    enabled: featuredTitle !== undefined,
  });
  const dates = datesLine(season, now);

  return (
    <Stack spacing={1.5} sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
        <MediaTile
          size={56}
          src={iconQuery.data ?? undefined}
          alt=""
          fallbackLabel={name ?? "?"}
          loading={
            state === "loading" ||
            (state === "ready" && (titleLoading || (featuredTitle !== undefined && iconQuery.isPending)))
          }
          radius="md"
        />
        <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="h4"
            component="p"
            sx={{ margin: 0, overflowWrap: "anywhere" }}
          >
            {name ?? <Skeleton variant="text" width="min(240px, 70%)" />}
          </Typography>
          {state === "loading" ? (
            <Skeleton variant="text" width="min(260px, 80%)" sx={{ fontSize: "0.875rem" }} />
          ) : dates ? (
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: "text.secondary", minWidth: 0 }}>
              <EventRoundedIcon aria-hidden="true" sx={{ fontSize: 16, flexShrink: 0 }} />
              <Typography variant="body2" component="p" sx={{ margin: 0, minWidth: 0 }}>
                {dates}
              </Typography>
            </Stack>
          ) : null}
          {featuredTitle ? (
            <Typography
              variant="caption"
              color="text.secondary"
              component="p"
              sx={{ ...mixins.lineClamp(2), margin: 0 }}
            >
              {`${bracketTypeLabel(featuredTitle.bracketType)} title: ${withoutSeason(featuredTitle.achievementName)}`}
            </Typography>
          ) : null}
        </Stack>
      </Stack>

      {state === "unpublished" ? (
        <Typography variant="body2" color="text.secondary" component="p" sx={{ margin: 0, maxWidth: "72ch" }}>
          {`Blizzard still lists season ${seasonId ?? ""} but answers "Forbidden" for its records, so its leaderboards and rating cutoffs are no longer available. Pick a later season.`}
        </Typography>
      ) : null}

      {state === "error" ? (
        <ErrorState compact error={error} context="this season's details" onRetry={onRetry} />
      ) : null}

      {state === "ready" || state === "loading" ? (
        <Stack direction="row" flexWrap="wrap" useFlexGap gap={1} alignItems="center">
          {isCurrent ? (
            <Chip size="small" color="success" label="Current season" />
          ) : season?.endTimestamp ? (
            <Chip size="small" variant="outlined" label="Ended" />
          ) : null}
          {boardCount !== undefined && boardCount > 0 ? (
            <Chip
              size="small"
              variant="outlined"
              label={`${formatNumber(boardCount)} ${boardCount === 1 ? "leaderboard" : "leaderboards"}`}
            />
          ) : null}
          {state === "loading" ? (
            <Box>
              <Skeleton variant="rounded" width={112} height={24} />
            </Box>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
};

export default SeasonSummary;
