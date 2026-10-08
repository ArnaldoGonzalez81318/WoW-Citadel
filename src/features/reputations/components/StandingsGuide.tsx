import { Box, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import SectionCard from "@/components/common/SectionCard";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/common/StateBlocks";
import { KindIcon } from "@/features/reputations/components/KindBadge";
import StandingLadderView from "@/features/reputations/components/StandingLadderView";
import {
  ladderIndexQuery,
  ladderQuery,
} from "@/features/reputations/hooks/reputationQueries";
import { kindColor } from "@/features/reputations/services/reputationPalette";
import {
  KIND_TITLE,
  STANDARD_LADDER_ID,
  pluralize,
} from "@/features/reputations/services/reputationService";
import type { LadderKind } from "@/features/reputations/types";
import { formatNumber } from "@/lib/format";

/** The loaded standard ladder: summary, strip, eight rows of about 40px. */
const LADDER_SKELETON_HEIGHT = 440;

const KindCard = ({
  kind,
  children,
}: {
  kind: LadderKind;
  children: string;
}): JSX.Element => (
  <Box
    component="li"
    sx={(theme) => {
      const color = kindColor(theme, kind);
      return {
        display: "flex",
        gap: 1.5,
        alignItems: "flex-start",
        p: 1.5,
        minWidth: 0,
        borderRadius: `${theme.wc.radius.md}px`,
        border: `1px solid ${theme.palette.border.subtle}`,
        borderTop: `3px solid ${alpha(color, 0.7)}`,
        background: `linear-gradient(180deg, ${alpha(color, 0.1)} 0%, ${alpha(color, 0)} 70%)`,
      };
    }}
  >
    <Box
      aria-hidden="true"
      sx={(theme) => ({
        display: "flex",
        flexShrink: 0,
        color: kindColor(theme, kind),
        "& svg": { fontSize: 24 },
      })}
    >
      <KindIcon kind={kind} />
    </Box>
    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
      <Typography variant="subtitle2" component="h3" sx={{ m: 0, fontWeight: 600 }}>
        {KIND_TITLE[kind]}
      </Typography>
      <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
        {children}
      </Typography>
    </Stack>
  </Box>
);

/**
 * How reputation is measured: the three kinds of ladder a faction can have,
 * with Blizzard's own counts and examples, and the standard ladder drawn
 * out as the legend for the standard strips (the other kinds' ramps are
 * named in words). Two requests (the ladder index and ladder 0, which every
 * standard card shares anyway).
 */
const StandingsGuide = (): JSX.Element => {
  const indexQuery = useQuery(ladderIndexQuery());
  const standardQuery = useQuery(ladderQuery(STANDARD_LADDER_ID));
  const ladders = indexQuery.data;
  const friendshipLadders = ladders?.filter((ladder) => ladder.id !== STANDARD_LADDER_ID) ?? [];
  const examples = friendshipLadders
    .map((ladder) => ladder.name)
    .filter((name): name is string => Boolean(name))
    .slice(0, 3);
  const standard = standardQuery.data;
  const first = standard?.tiers[0];
  const last = standard?.tiers[standard.tiers.length - 1];

  const standardText =
    standard && first && last
      ? `${first.name} to ${last.name}: ${pluralize(standard.tiers.length, "standing", "standings")} from ${formatNumber(first.min)} to ${formatNumber(last.min)} points, shared by most factions.`
      : "Hated to Exalted, shared by most factions.";
  const friendshipText = ladders
    ? `${pluralize(friendshipLadders.length, "ladder", "ladders")} of a faction's own ranks${examples.length > 0 ? `, such as ${examples.join(", ")}` : ""}.`
    : "A ladder of a faction's own ranks, such as a friend's or a delve companion's.";

  const renderLadder = (): JSX.Element => {
    if (standardQuery.isPending) {
      return (
        <LoadingSkeleton
          variant="block"
          height={LADDER_SKELETON_HEIGHT}
          label="Loading the standard ladder"
        />
      );
    }
    if (standardQuery.isError && !standard) {
      return (
        <ErrorState
          compact
          error={standardQuery.error}
          context="the standard standing ladder"
          onRetry={() => void standardQuery.refetch()}
        />
      );
    }
    if (!standard) {
      return (
        <EmptyState
          compact
          title="No standard ladder"
          description="Blizzard has no record of reputation ladder 0."
        />
      );
    }
    return <StandingLadderView ladder={standard} kind="standard" />;
  };

  return (
    <SectionCard
      title="How standing is measured"
      description="Factions climb one of three kinds of ladder; headers only group others. Standard strips use the colours below, friendship ranks run from yellow to green, renown from blue to gold, and a group's strip is a block per faction in its colour."
    >
      <Stack spacing={3}>
        <Box
          component="ul"
          role="list"
          aria-label="Kinds of reputation"
          sx={{
            listStyle: "none",
            m: 0,
            p: 0,
            display: "grid",
            gap: 1.5,
            ...gridTemplateColumnsSx({ xs: 1, md: 3 }),
          }}
        >
          <KindCard kind="standard">{standardText}</KindCard>
          <KindCard kind="friendship">{friendshipText}</KindCard>
          <KindCard kind="renown">
            Numbered levels instead of standings, each unlocking rewards: how the major factions of recent expansions are earned.
          </KindCard>
        </Box>
        {indexQuery.isError && !ladders ? (
          <ErrorState
            compact
            error={indexQuery.error}
            context="the list of standing ladders"
            onRetry={() => void indexQuery.refetch()}
          />
        ) : null}
        <Stack spacing={1}>
          <Typography variant="subtitle1" component="h3" sx={{ m: 0, fontWeight: 600 }}>
            The standard ladder
          </Typography>
          {renderLadder()}
        </Stack>
      </Stack>
    </SectionCard>
  );
};

export default StandingsGuide;
