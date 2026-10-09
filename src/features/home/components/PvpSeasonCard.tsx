import MilitaryTechRounded from "@mui/icons-material/MilitaryTechRounded";
import { Chip, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import StripCard, {
  StripCardError,
  StripCardSkeleton,
} from "@/features/home/components/StripCard";
import { HOME_PATHS, pvpSeasonPath } from "@/features/home/config/homeLinks";
import {
  pvpRewardsQuery,
  pvpSeasonIndexQuery,
  pvpSeasonQuery,
} from "@/features/pvpSeasons/hooks/pvpSeasonQueries";
import { seasonNameFromCutoffs } from "@/features/pvpSeasons/services/pvpSeasonService";
import {
  fallbackSeasonName,
  formatSeasonDay,
} from "@/features/pvpSeasons/services/seasonFormat";
import type { PvpSeason } from "@/features/pvpSeasons/types";
import useStickyError from "@/features/wowToken/hooks/useStickyError";
import { formatRelativeTime } from "@/lib/format";
import { mixins } from "@/theme";

const ID = "home-week-pvp";
const OVERLINE = "Rated PvP";

/**
 * SeasonSummary's wording, without its week count. Rewritten rather than
 * imported: SeasonSummary is the PvP page's header block, with its own
 * icon query, chips and error states.
 */
const datesLine = (season: PvpSeason, now: number): string | undefined => {
  const start = season.startTimestamp;
  const end = season.endTimestamp;
  if (!start) {
    return undefined;
  }
  if (end) {
    return `${formatSeasonDay(start)} – ${formatSeasonDay(end)}`;
  }
  if (start > now) {
    return `Starts ${formatSeasonDay(start)}`;
  }
  return `Started ${formatSeasonDay(start)} · ${formatRelativeTime(start, now)}`;
};

/**
 * The rated PvP season Blizzard calls current: its name and how long it
 * has run. Two small requests, an hour fresh, shared with the PvP Seasons
 * page and the cutoffs panel below; an unnamed season shows "Season {id}"
 * until that panel's titles are in.
 */
const PvpSeasonCard = ({ now }: { now: number }): JSX.Element => {
  const indexQuery = useQuery(pvpSeasonIndexQuery());
  const indexError = useStickyError(indexQuery);
  const currentId = indexQuery.data?.currentId ?? null;
  const seasonQuery = useQuery({
    ...pvpSeasonQuery(currentId ?? 0),
    enabled: currentId != null,
  });
  const seasonError = useStickyError(seasonQuery);
  // Cache only (never fetched here; the cutoffs panel asks for it near the
  // viewport): a season Blizzard left unnamed names itself from its titles,
  // as on the PvP Seasons page.
  const rewardsQuery = useQuery({ ...pvpRewardsQuery(currentId ?? 0), enabled: false });

  const index = indexQuery.data;
  const season = seasonQuery.data;
  const failure =
    index === undefined && indexError
      ? { error: indexError, retry: () => void indexQuery.refetch() }
      : currentId != null && season === undefined && seasonError
        ? { error: seasonError, retry: () => void seasonQuery.refetch() }
        : null;

  if (failure) {
    return (
      <StripCardError
        id={ID}
        icon={<MilitaryTechRounded />}
        overline={OVERLINE}
        error={failure.error}
        context="the rated PvP season"
        onRetry={failure.retry}
        linkLabel="Open PvP Seasons"
        to={HOME_PATHS.pvpSeasons}
      />
    );
  }

  if (index === undefined || (currentId != null && season === undefined)) {
    return <StripCardSkeleton label="Loading the PvP season" />;
  }

  if (currentId == null || season === undefined) {
    return (
      <StripCard
        id={ID}
        icon={<MilitaryTechRounded />}
        overline={OVERLINE}
        title="No rated PvP season listed"
        cue="Ladders and title cutoffs"
        to={HOME_PATHS.pvpSeasons}
      />
    );
  }

  const dates = datesLine(season, now);
  return (
    <StripCard
      id={ID}
      icon={<MilitaryTechRounded />}
      overline={OVERLINE}
      title={
        season.name ??
        seasonNameFromCutoffs(rewardsQuery.data ?? []) ??
        fallbackSeasonName(season.id)
      }
      details={
        dates ? (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            <Typography
              variant="body2"
              color="text.secondary"
              component="span"
              sx={{ ...mixins.truncate, display: "block", minWidth: 0 }}
            >
              {dates}
            </Typography>
            {season.endTimestamp ? (
              <Chip size="small" variant="outlined" label="Ended" sx={{ flexShrink: 0 }} />
            ) : null}
          </Stack>
        ) : undefined
      }
      cue="Ladders and title cutoffs"
      to={pvpSeasonPath(season.id)}
    />
  );
};

export default PvpSeasonCard;
