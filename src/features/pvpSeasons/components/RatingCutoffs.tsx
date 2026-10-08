import { Avatar, Box, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useId, useMemo } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import MediaTile from "@/components/common/MediaTile";
import { specQuery } from "@/features/mythicLeaderboard/hooks/leaderboardQueries";
import FactionTag from "@/features/pvpSeasons/components/FactionTag";
import { achievementIconQuery } from "@/features/pvpSeasons/hooks/pvpSeasonQueries";
import { groupCutoffs } from "@/features/pvpSeasons/services/cutoffGroups";
import type {
  FactionRating,
  SpecCutoff,
  TitleSummary,
} from "@/features/pvpSeasons/services/cutoffGroups";
import type { PvpRewardCutoff } from "@/features/pvpSeasons/types";
import useNearViewport from "@/hooks/useNearViewport";
import { formatNumber } from "@/lib/format";
import { mixins, visuallyHidden } from "@/theme";

export type RatingCutoffsProps = {
  cutoffs: readonly PvpRewardCutoff[];
};

/** A rating, labelled for screen readers; a faction name in front when it is one faction's. */
const RatingValue = ({
  value,
  showFaction,
  large = false,
}: {
  value: FactionRating;
  showFaction: boolean;
  large?: boolean;
}): JSX.Element => (
  <Box
    component="span"
    sx={{ display: "inline-flex", alignItems: "baseline", gap: 0.75, whiteSpace: "nowrap" }}
  >
    {showFaction && value.faction ? (
      <Typography component="span" variant="caption" color="text.secondary">
        <FactionTag faction={value.faction} />
      </Typography>
    ) : null}
    <Typography
      component="span"
      variant={large ? "h6" : "subtitle2"}
      sx={{ margin: 0, fontVariantNumeric: "tabular-nums" }}
    >
      <Box component="span" sx={visuallyHidden}>Rating cutoff </Box>
      {formatNumber(value.rating)}
    </Typography>
  </Box>
);

/**
 * One title: its achievement icon, name, faction, and its cutoff (or its
 * per-spec range). Each card watches its own position and asks for its icon
 * only once it nears the viewport.
 */
const TitleCard = ({ title }: { title: TitleSummary }): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const iconQuery = useQuery({ ...achievementIconQuery(title.achievementId), enabled: near });
  return (
    <Box
      ref={nearRef}
      sx={(theme) => ({
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        p: 1.5,
        minWidth: 0,
        border: `1px solid ${theme.palette.border.gold}`,
        borderRadius: `${theme.wc.radius.md}px`,
        bgcolor: theme.palette.surface.inset,
      })}
    >
      {/* Decorative: the title's name is right beside it. */}
      <MediaTile
        size={56}
        src={iconQuery.data ?? undefined}
        alt=""
        fallbackLabel={title.name}
        loading={!near || iconQuery.isPending}
        radius="md"
      />
      <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="subtitle2" component="p" sx={{ margin: 0, overflowWrap: "anywhere" }}>
          {title.name}
        </Typography>
        {title.faction ? (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ margin: 0 }}>
            <FactionTag faction={title.faction} />
          </Typography>
        ) : null}
        {title.ratings.length > 0 ? (
          <Stack direction="row" flexWrap="wrap" useFlexGap columnGap={2} rowGap={0.25}>
            {title.ratings.map((rating) => (
              <RatingValue
                key={rating.faction ?? "all"}
                value={rating}
                showFaction={title.faction === undefined}
                large={title.ratings.length === 1}
              />
            ))}
          </Stack>
        ) : null}
        {title.specRange ? (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ margin: 0 }}>
            {title.specRange[0] === title.specRange[1]
              ? `${formatNumber(title.specRange[0])} for every specialization`
              : `By specialization: ${formatNumber(title.specRange[0])}–${formatNumber(title.specRange[1])}`}
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
};

/**
 * One spec's cutoff. The spec's name and icon (two requests, shared with the
 * bracket picker's select) load once this row nears the viewport. Each row
 * watches itself rather than the section as a whole: the section can sit
 * near the fold for the few seconds the ~2 MB ladder above it takes, and
 * one shared flag would then fire every spec's requests (about 80) at once.
 */
const SpecCutoffItem = ({ spec }: { spec: SpecCutoff }): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLLIElement>();
  const detailQuery = useQuery({ ...specQuery(spec.specId), enabled: near });
  const detail = detailQuery.data;
  const name = detail?.name ?? spec.specName ?? `Spec #${spec.specId}`;
  // A faction's own cutoff goes under the name, labelled; a shared one on the right.
  const split = spec.ratings.some((rating) => rating.faction !== undefined);
  return (
    <Box
      component="li"
      ref={nearRef}
      sx={(theme) => ({
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: 1.5,
        py: 1,
        minWidth: 0,
        border: `1px solid ${theme.palette.border.subtle}`,
        borderRadius: `${theme.wc.radius.md}px`,
        bgcolor: "background.paper",
      })}
    >
      {/* Decorative: the spec's name is right beside it. */}
      <Avatar
        alt=""
        src={detail?.iconUrl ?? undefined}
        variant="rounded"
        sx={{ width: 36, height: 36, fontSize: "0.875rem", flexShrink: 0 }}
      >
        {name.charAt(0)}
      </Avatar>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="subtitle2" component="p" sx={{ ...mixins.truncate, margin: 0 }}>
          {name}
        </Typography>
        {detail?.className || spec.bothFactions ? (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ ...mixins.truncate, margin: 0 }}>
            {[detail?.className, spec.bothFactions ? "both factions" : undefined]
              .filter(Boolean)
              .join(" · ")}
          </Typography>
        ) : null}
        {split ? (
          <Stack direction="row" flexWrap="wrap" useFlexGap columnGap={1.5} rowGap={0.25}>
            {spec.ratings.map((rating) => (
              <RatingValue key={rating.faction ?? "all"} value={rating} showFaction />
            ))}
          </Stack>
        ) : null}
      </Box>
      {split ? null : (
        <Box sx={{ flexShrink: 0 }}>
          {spec.ratings.map((rating) => (
            <RatingValue key={rating.faction ?? "all"} value={rating} showFaction={false} />
          ))}
        </Box>
      )}
    </Box>
  );
};

/** Every spec's cutoff in one bracket, hardest first. */
const SpecCutoffGrid = ({ specs, label }: { specs: SpecCutoff[]; label: string }): JSX.Element => (
  <Box
    component="ul"
    // Safari drops the list role from a list-style:none list without it.
    role="list"
    aria-label={label}
    sx={{
      listStyle: "none",
      m: 0,
      p: 0,
      display: "grid",
      gap: 1,
      ...gridTemplateColumnsSx({ xs: 1, sm: 2, md: 3, lg: 4 }),
    }}
  >
    {specs.map((spec) => (
      <SpecCutoffItem key={spec.specId} spec={spec} />
    ))}
  </Box>
);

/**
 * The season's title cutoffs, grouped by bracket: each title with its
 * achievement icon and cutoff, then the per-spec cutoffs of Solo Shuffle
 * and Blitz. Every card and row loads its own icon as it nears the viewport.
 */
const RatingCutoffs = ({ cutoffs }: RatingCutoffsProps): JSX.Element => {
  const groups = useMemo(() => groupCutoffs(cutoffs), [cutoffs]);
  const idBase = useId();

  return (
    <Stack spacing={3}>
      {groups.map((group) => {
        const headingId = `${idBase}-${group.bracketType}`;
        return (
          <Box key={group.bracketType} component="section" aria-labelledby={headingId}>
            <Stack spacing={1.5}>
              <Box>
                <Typography id={headingId} variant="h6" component="h3" sx={{ margin: 0 }}>
                  {group.label}
                </Typography>
                {group.specs.length > 0 ? (
                  <Typography variant="body2" color="text.secondary" component="p" sx={{ margin: 0 }}>
                    {`Set per specialization: ${formatNumber(group.specs.length)} ${group.specs.length === 1 ? "spec" : "specs"}, highest cutoff first.`}
                  </Typography>
                ) : null}
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gap: 1,
                  ...gridTemplateColumnsSx({ xs: 1, sm: 2, lg: 3 }),
                }}
              >
                {group.titles.map((title) => (
                  <TitleCard key={title.achievementId} title={title} />
                ))}
              </Box>
              {group.specs.length > 0 ? (
                <SpecCutoffGrid
                  specs={group.specs}
                  label={`${group.label} cutoffs by specialization`}
                />
              ) : null}
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
};

export default RatingCutoffs;
