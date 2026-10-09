import MilitaryTechRounded from "@mui/icons-material/MilitaryTechRounded";
import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef } from "react";
import { Link as RouterLink } from "react-router-dom";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import MediaTile from "@/components/common/MediaTile";
import SectionCard from "@/components/common/SectionCard";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import {
  PVP_COLUMNS,
  PanelDescriptionSkeleton,
  PvpCardSkeletons,
} from "@/features/home/components/HomePanelsFallback";
import {
  PanelFooterAction,
  PanelHeaderAction,
} from "@/features/home/components/PanelAction";
import { HOME_PATHS, pvpSeasonPath } from "@/features/home/config/homeLinks";
import { HOME_PANELS } from "@/features/home/config/panels";
import useFocusAfterRetry from "@/features/home/hooks/useFocusAfterRetry";
import FactionTag from "@/features/pvpSeasons/components/FactionTag";
import {
  achievementIconQuery,
  pvpRewardsQuery,
  pvpSeasonIndexQuery,
  pvpSeasonQuery,
} from "@/features/pvpSeasons/hooks/pvpSeasonQueries";
import { groupCutoffs } from "@/features/pvpSeasons/services/cutoffGroups";
import type {
  CutoffGroup,
  TitleSummary,
} from "@/features/pvpSeasons/services/cutoffGroups";
import { seasonNameFromCutoffs } from "@/features/pvpSeasons/services/pvpSeasonService";
import { fallbackSeasonName } from "@/features/pvpSeasons/services/seasonFormat";
import type { PvpRewardCutoff } from "@/features/pvpSeasons/types";
import useStickyError from "@/features/wowToken/hooks/useStickyError";
import useNearViewport from "@/hooks/useNearViewport";
import { formatNumber } from "@/lib/format";
import { visuallyHidden } from "@/theme";

const PANEL = HOME_PANELS.pvp;
const EMPTY: readonly PvpRewardCutoff[] = [];
const LOADING_LABEL = "Loading the PvP title cutoffs";

/**
 * "Venomous Gladiator: Midnight Season 2" -> "Venomous Gladiator": the
 * season is named in the panel's description. Only an exact match is
 * trimmed, so "Hero of the Alliance: Venomous" keeps its suffix.
 */
const withoutSeason = (title: string, seasonName: string): string => {
  const suffix = `: ${seasonName}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title;
};

const ratingSx = {
  m: 0,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
} as const;

/** One number, labelled for screen readers. */
const Rating = ({ value }: { value: number }): JSX.Element => (
  <Typography variant="h6" component="span" sx={ratingSx}>
    <Box component="span" sx={visuallyHidden}>
      Rating cutoff{" "}
    </Box>
    {formatNumber(value)}
  </Typography>
);

/**
 * A title's cutoff as Blizzard sets it: one rating; one per faction (shown
 * once when they match, else each with its faction named); or, for titles
 * set per specialization, the lowest to highest.
 */
const TitleRating = ({ title }: { title: TitleSummary }): JSX.Element | null => {
  const { ratings, specRange } = title;
  if (ratings.length > 0) {
    const shared = ratings.every((entry) => entry.rating === ratings[0].rating);
    if (shared) {
      return <Rating value={ratings[0].rating} />;
    }
    return (
      <Stack spacing={0.25} alignItems={{ sm: "flex-end" }}>
        {ratings.map((entry) => (
          <Stack
            key={entry.faction ?? "all"}
            direction="row"
            spacing={0.75}
            alignItems="baseline"
          >
            {entry.faction ? (
              <Typography variant="caption" color="text.secondary" component="span">
                <FactionTag faction={entry.faction} />
              </Typography>
            ) : null}
            <Rating value={entry.rating} />
          </Stack>
        ))}
      </Stack>
    );
  }
  if (specRange) {
    const [low, high] = specRange;
    return (
      <Stack spacing={0} alignItems={{ sm: "flex-end" }}>
        <Typography variant="h6" component="span" sx={ratingSx}>
          <Box component="span" sx={visuallyHidden}>
            {low === high
              ? `Rating cutoff ${formatNumber(low)}`
              : `Rating cutoffs from ${formatNumber(low)} to ${formatNumber(high)}`}
          </Box>
          <Box component="span" aria-hidden="true">
            {low === high ? formatNumber(low) : `${formatNumber(low)}–${formatNumber(high)}`}
          </Box>
        </Typography>
        <Typography variant="caption" color="text.secondary" component="span">
          {low === high ? "every spec" : "by spec"}
        </Typography>
      </Stack>
    );
  }
  return null;
};

/** One title row: the rating sits on the right, and drops under the name on phones. */
const TitleRow = ({
  title,
  seasonName,
}: {
  title: TitleSummary;
  seasonName: string;
}): JSX.Element => (
  <Box
    component="li"
    sx={{
      display: "flex",
      flexWrap: "wrap",
      alignItems: "baseline",
      columnGap: 1.5,
      rowGap: 0.25,
      minWidth: 0,
    }}
  >
    <Box sx={{ flex: { xs: "1 1 100%", sm: "1 1 8rem" }, minWidth: 0 }}>
      <Typography
        variant="body2"
        component="span"
        sx={{ display: "block", fontWeight: 600, overflowWrap: "anywhere" }}
      >
        {withoutSeason(title.name, seasonName)}
      </Typography>
      {/* Named, never shown by colour alone. */}
      {title.faction ? (
        <Typography variant="caption" color="text.secondary" component="span" sx={{ display: "block" }}>
          <FactionTag faction={title.faction} />
        </Typography>
      ) : null}
    </Box>
    <Box sx={{ ml: { sm: "auto" }, textAlign: { sm: "right" }, flexShrink: 0 }}>
      <TitleRating title={title} />
    </Box>
  </Box>
);

/**
 * One bracket's titles. Not a link: Blizzard's bracket types do not map
 * reliably to the PvP page's board slugs, so the panel's own button is the
 * way in. The bracket's first title lends the card its icon (decorative,
 * shared with the PvP page), fetched once the panel nears the viewport.
 */
const BracketCard = ({
  group,
  seasonName,
  near,
}: {
  group: CutoffGroup;
  seasonName: string;
  near: boolean;
}): JSX.Element => {
  const lead = group.titles[0];
  const iconQuery = useQuery({
    ...achievementIconQuery(lead?.achievementId ?? 0),
    enabled: near && lead !== undefined,
  });
  return (
    <Paper
      component="li"
      variant="outlined"
      sx={(theme) => ({ p: 2, minWidth: 0, borderRadius: `${theme.wc.radius.lg}px` })}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
          <MediaTile
            size={40}
            src={iconQuery.data ?? undefined}
            alt=""
            fallbackLabel={group.label}
            loading={lead !== undefined && (!near || iconQuery.isPending)}
          />
          <Typography
            variant="overline"
            component="p"
            color="text.secondary"
            sx={{ m: 0, lineHeight: 1.5, minWidth: 0, overflowWrap: "anywhere" }}
          >
            {group.label}
          </Typography>
        </Stack>
        <Stack
          component="ul"
          // Safari drops the list role from a list-style:none list without it.
          role="list"
          spacing={1.25}
          sx={{ listStyle: "none", m: 0, p: 0 }}
        >
          {group.titles.map((title) => (
            <TitleRow key={title.achievementId} title={title} seasonName={seasonName} />
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
};

/**
 * The running season's title cutoffs, one card per bracket. They come from
 * the PvP Seasons page's own rewards entry (one request, about 52 KB),
 * fetched only once the panel nears the viewport; the season itself is the
 * strip's cached entry. The numbers are never copied into the page: they
 * move through the season, and the API is the only source.
 */
const PvpCutoffsPanel = (): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const indexQuery = useQuery(pvpSeasonIndexQuery());
  const indexError = useStickyError(indexQuery);
  const index = indexQuery.data;
  const currentId = index?.currentId ?? null;
  const seasonQuery = useQuery({
    ...pvpSeasonQuery(currentId ?? 0),
    enabled: currentId != null,
  });
  const seasonError = useStickyError(seasonQuery);
  const season = seasonQuery.data;
  const ended = Boolean(season?.endTimestamp);
  const rewardsQuery = useQuery({
    ...pvpRewardsQuery(currentId ?? 0, ended),
    enabled: near && currentId != null,
  });
  const rewardsError = useStickyError(rewardsQuery);
  const rewards = rewardsQuery.data;
  // Already in bracket order (Arena first, Blitz last).
  const groups = useMemo(() => groupCutoffs(rewards ?? EMPTY), [rewards]);
  // The error the body shows, in the order renderBody checks them.
  const shownError =
    index === undefined
      ? indexError
      : currentId == null
        ? null
        : season === undefined
          ? seasonError
          : rewards === undefined
            ? rewardsError
            : null;
  const listRef = useRef<HTMLUListElement>(null);
  // A successful Retry removes its alert; the cards take the focus it held.
  const afterRetry = useFocusAfterRetry(listRef, groups.length > 0, shownError);

  // Blizzard leaves some seasons unnamed (40, The War Within Season 3, on
  // US); their titles carry the name, as on the PvP Seasons page. The
  // placeholder "Season {id}" waits until the titles have had their say.
  const seasonName = season
    ? (season.name ??
      seasonNameFromCutoffs(rewards ?? EMPTY) ??
      (rewards === undefined && !rewardsError ? undefined : fallbackSeasonName(season.id)))
    : undefined;
  const seasonPath = currentId != null ? pvpSeasonPath(currentId) : HOME_PATHS.pvpSeasons;
  const description = seasonName ? (
    ended ? (
      <Stack direction="row" flexWrap="wrap" useFlexGap gap={1} alignItems="center">
        <span>{`Final title cutoffs for ${seasonName}.`}</span>
        <Chip size="small" variant="outlined" label="Final" />
      </Stack>
    ) : (
      `${seasonName} title cutoffs at Blizzard's latest update; they move as the season goes on.`
    )
  ) : (index === undefined && !indexError) || (currentId != null && !seasonError) ? (
    <PanelDescriptionSkeleton />
  ) : undefined;

  const renderBody = (): JSX.Element => {
    if (index === undefined) {
      if (indexError) {
        return (
          <ErrorState
            compact
            // The strip's PvP card reads the same query and announces this failure.
            announce={false}
            error={indexError}
            context="the rated PvP season"
            onRetry={afterRetry(() => void indexQuery.refetch())}
          />
        );
      }
      return <PvpCardSkeletons label={LOADING_LABEL} />;
    }
    if (currentId == null) {
      return <EmptyState compact title="Blizzard lists no rated PvP season" />;
    }
    if (season === undefined) {
      if (seasonError) {
        return (
          <ErrorState
            compact
            // The strip's PvP card reads the same query and announces this failure.
            announce={false}
            error={seasonError}
            context="the rated PvP season"
            onRetry={afterRetry(() => void seasonQuery.refetch())}
          />
        );
      }
      return <PvpCardSkeletons label={LOADING_LABEL} />;
    }
    if (rewards === undefined) {
      if (rewardsError) {
        return (
          <ErrorState
            compact
            error={rewardsError}
            context="the PvP title cutoffs"
            onRetry={afterRetry(() => void rewardsQuery.refetch())}
          />
        );
      }
      return <PvpCardSkeletons label={LOADING_LABEL} />;
    }
    // With the titles in, the name is settled: theirs or the placeholder.
    const name = seasonName ?? fallbackSeasonName(season.id);
    if (groups.length === 0) {
      // Blizzard publishes the cutoffs some weeks into a season (a 404 until then).
      return (
        <EmptyState
          compact
          title={`Blizzard hasn't published title cutoffs for ${name} yet`}
          action={
            <Button
              component={RouterLink}
              to={pvpSeasonPath(currentId)}
              variant="outlined"
              size="small"
            >
              Open PvP Seasons
            </Button>
          }
        />
      );
    }
    return (
      <Box
        component="ul"
        ref={listRef}
        // Safari drops the list role from a list-style:none list without it.
        role="list"
        aria-label={`${name} title cutoffs by bracket`}
        // Takes focus when a successful Retry removes the alert that held it.
        tabIndex={-1}
        sx={{
          listStyle: "none",
          outline: "none",
          m: 0,
          p: 0,
          display: "grid",
          gap: 2,
          ...gridTemplateColumnsSx(PVP_COLUMNS),
        }}
      >
        {groups.map((group) => (
          <BracketCard key={group.bracketType} group={group} seasonName={name} near={near} />
        ))}
      </Box>
    );
  };

  return (
    <SectionCard
      id={PANEL.id}
      title={PANEL.title}
      icon={<MilitaryTechRounded />}
      description={description}
      actions={<PanelHeaderAction to={seasonPath}>Ladders and cutoffs</PanelHeaderAction>}
    >
      {/* The panel sits far down the page; it asks for the cutoffs only once it comes near. */}
      <Box ref={nearRef} sx={{ minWidth: 0 }}>
        {renderBody()}
      </Box>
      <PanelFooterAction to={seasonPath}>Ladders and cutoffs</PanelFooterAction>
    </SectionCard>
  );
};

export default PvpCutoffsPanel;
