import TimerOutlined from "@mui/icons-material/TimerOutlined";
import { Skeleton, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import StripCard, {
  StripCardError,
  StripCardSkeleton,
} from "@/features/home/components/StripCard";
import { HOME_PATHS } from "@/features/home/config/homeLinks";
import useWeeklyReset, { RESET_FORMAT } from "@/features/home/hooks/useWeeklyReset";
import type { WeeklyReset } from "@/features/home/hooks/useWeeklyReset";
import { keystoneSeasonQuery } from "@/features/mythicKeystone/hooks/keystoneQueries";
import { periodQuery } from "@/features/mythicLeaderboard/hooks/leaderboardQueries";
import useStickyError from "@/features/wowToken/hooks/useStickyError";
import { formatNumber, formatRelativeTime } from "@/lib/format";
import { mixins } from "@/theme";

const ID = "home-week-mplus";
const OVERLINE = "Mythic+";

const ResetLine = ({
  reset,
  pending,
  failed,
  now,
}: {
  reset: WeeklyReset;
  pending: boolean;
  failed: boolean;
  now: number;
}): JSX.Element => {
  if (pending) {
    return <Skeleton variant="text" width="35%" sx={{ fontSize: "0.75rem" }} />;
  }
  const lineSx = { ...mixins.truncate, display: "block", m: 0 } as const;
  // A button may not sit inside this link: the Mythic+ panel below carries the Retry.
  if (failed || reset.kind === "unknown") {
    return (
      <Typography variant="caption" color="text.secondary" component="span" sx={lineSx}>
        Reset time unavailable
      </Typography>
    );
  }
  if (reset.kind === "rolled-over") {
    return (
      <Typography variant="caption" color="text.secondary" component="span" sx={lineSx}>
        New week started
      </Typography>
    );
  }
  // The absolute time is visible text, not a tooltip, so touch and keyboard users get it too.
  return (
    <Typography variant="caption" color="text.secondary" component="span" sx={lineSx}>
      <time dateTime={reset.iso}>{`Resets ${RESET_FORMAT.format(reset.resetAt)}`}</time>
      {` · ${formatRelativeTime(reset.resetAt, now)}`}
    </Typography>
  );
};

/**
 * This week's Mythic+ at a glance: the season, which week of it, the size
 * of the rotation and when the week resets. The season record is the one
 * every keystone page shares (four small requests, an hour fresh); the
 * period adds one more, a day fresh.
 */
const MythicPlusCard = ({ now }: { now: number }): JSX.Element => {
  const seasonQuery = useQuery(keystoneSeasonQuery());
  const seasonError = useStickyError(seasonQuery);
  const season = seasonQuery.data;
  // The KeystoneSeason type documents the list as oldest first: the last id is this week.
  const latestId = season ? season.periodIds[season.periodIds.length - 1] : undefined;
  const periodResult = useQuery({
    ...periodQuery(latestId ?? 0),
    enabled: latestId !== undefined,
  });
  const reset = useWeeklyReset(periodResult.data, now, seasonQuery.dataUpdatedAt);

  if (season === undefined) {
    if (seasonError) {
      return (
        <StripCardError
          id={ID}
          icon={<TimerOutlined />}
          overline={OVERLINE}
          error={seasonError}
          context="the Mythic+ season"
          onRetry={() => void seasonQuery.refetch()}
          linkLabel="Open Mythic+ leaderboards"
          to={HOME_PATHS.keystoneLeaderboards}
        />
      );
    }
    return <StripCardSkeleton label="Loading the Mythic+ season" />;
  }

  if (season === null) {
    return (
      <StripCard
        id={ID}
        icon={<TimerOutlined />}
        overline={OVERLINE}
        title="No Mythic+ season is running"
        details={
          <Typography variant="body2" color="text.secondary" component="span" sx={{ display: "block" }}>
            Browse every keystone dungeon
          </Typography>
        }
        cue="Keystone dungeons"
        to={HOME_PATHS.keystoneDungeons}
      />
    );
  }

  const dungeonCount = season.dungeons.length;
  const weekCount = season.periodIds.length;
  const summary = [
    weekCount > 0 ? `Week ${formatNumber(weekCount)}` : undefined,
    dungeonCount > 0 ? `${formatNumber(dungeonCount)} dungeons in rotation` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <StripCard
      id={ID}
      icon={<TimerOutlined />}
      overline={OVERLINE}
      title={season.name}
      details={
        <>
          {summary ? (
            <Typography
              variant="body2"
              color="text.secondary"
              component="span"
              sx={{ ...mixins.truncate, display: "block" }}
            >
              {summary}
            </Typography>
          ) : null}
          <ResetLine
            reset={reset}
            pending={latestId !== undefined && periodResult.isPending}
            failed={latestId === undefined || (periodResult.isError && !periodResult.data)}
            now={now}
          />
        </>
      }
      cue="This week's top runs"
      to={HOME_PATHS.keystoneLeaderboards}
    />
  );
};

export default MythicPlusCard;
