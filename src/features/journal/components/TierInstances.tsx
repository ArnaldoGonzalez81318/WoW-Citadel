import ExploreOffRoundedIcon from "@mui/icons-material/ExploreOffRounded";
import { Box, Paper, Skeleton, Stack, Typography } from "@mui/material";
import type { UseQueryResult } from "@tanstack/react-query";
import { useId } from "react";
import type { Ref } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import InstanceCard, {
  INSTANCE_CARD_TEXT_HEIGHT,
} from "@/features/journal/components/InstanceCard";
import {
  artCellSx,
  focusTargetSx,
  panelSx,
} from "@/features/journal/components/journalStyles";
import { pluralize } from "@/features/journal/services/journalService";
import type {
  JournalRef,
  JournalTier,
  JournalTierSummary,
} from "@/features/journal/types";
import { formatNumber } from "@/lib/format";

const INSTANCE_COLS: GridColumns = { xs: 1, sm: 2, md: 3, lg: 4 };
const GRID_GAP_PX = 16;
const CARD_SX = artCellSx(0.5, INSTANCE_CARD_TEXT_HEIGHT);

export type TierInstancesProps = {
  /** The tier from the index: its name is known before its record loads. */
  tier: JournalTierSummary;
  query: UseQueryResult<JournalTier | null>;
  /** The h2, focusable from script: stepping back up the trail moves focus here. */
  headingRef?: Ref<HTMLHeadingElement>;
  onSelect: (instance: JournalRef) => void;
};

const InstanceGroup = ({
  title,
  instances,
  showExpansion,
  onSelect,
}: {
  title: string;
  instances: JournalRef[];
  showExpansion: boolean;
  onSelect: (instance: JournalRef) => void;
}): JSX.Element => {
  const headingId = useId();
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} alignItems="baseline" sx={{ minWidth: 0 }}>
        <Typography id={headingId} variant="subtitle1" component="h3" sx={{ m: 0 }}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="span">
          {formatNumber(instances.length)}
        </Typography>
      </Stack>
      <Box
        component="ul"
        role="list"
        aria-labelledby={headingId}
        sx={{
          display: "grid",
          gap: `${GRID_GAP_PX}px`,
          listStyle: "none",
          m: 0,
          p: 0,
          ...gridTemplateColumnsSx(INSTANCE_COLS),
        }}
      >
        {instances.map((instance) => (
          <Box component="li" key={instance.id} sx={{ minWidth: 0 }}>
            <InstanceCard instance={instance} showExpansion={showExpansion} onSelect={onSelect} />
          </Box>
        ))}
      </Box>
    </Stack>
  );
};

const GroupSkeleton = ({ count, label }: { count: number; label: string }): JSX.Element => (
  <Stack spacing={1.5}>
    <Skeleton variant="text" width={96} sx={{ fontSize: "1rem" }} />
    <LoadingSkeleton
      variant="grid"
      columns={INSTANCE_COLS}
      count={count}
      gap={GRID_GAP_PX}
      label={label}
      sx={CARD_SX}
    />
  </Stack>
);

/**
 * The whole panel before even the tier's name is known (the expansion index
 * is still loading): the same outline, heading line and card groups.
 */
export const TierInstancesSkeleton = (): JSX.Element => (
  <Paper variant="outlined" sx={panelSx}>
    <Stack spacing={2} sx={{ p: { xs: 2, md: 2.5 } }}>
      <Stack spacing={0.5}>
        <Skeleton variant="text" width={180} sx={{ fontSize: "1.25rem" }} />
        <Skeleton variant="text" width={160} sx={{ fontSize: "0.875rem" }} />
      </Stack>
      <Stack spacing={3}>
        <GroupSkeleton count={4} label="Loading raids" />
        <GroupSkeleton count={4} label="Loading dungeons" />
      </Stack>
    </Stack>
  </Paper>
);

/**
 * One tier's raids, then its dungeons, as art cards in Blizzard's journal
 * order. The Current Season names each card's expansion, since it mixes
 * them; an expansion's own cards show only the location.
 */
const TierInstances = ({ tier, query, headingRef, onSelect }: TierInstancesProps): JSX.Element => {
  const titleId = useId();
  const data = query.data ?? null;

  const description = tier.isCurrentSeason
    ? "This season's raids and dungeons, from several expansions, as Blizzard's journal lists them."
    : data
      ? [
          data.raids.length > 0 ? pluralize(data.raids.length, "raid", "raids") : undefined,
          data.dungeons.length > 0 ? pluralize(data.dungeons.length, "dungeon", "dungeons") : undefined,
        ]
          .filter(Boolean)
          .join(" · ")
      : undefined;

  const renderBody = (): JSX.Element => {
    if (query.isPending) {
      return (
        <Stack spacing={3}>
          <GroupSkeleton count={4} label={`Loading ${tier.name} raids`} />
          <GroupSkeleton count={4} label={`Loading ${tier.name} dungeons`} />
        </Stack>
      );
    }
    if (query.isError && !data) {
      return (
        <ErrorState
          compact
          error={query.error}
          context={`${tier.name} instances`}
          onRetry={() => void query.refetch()}
        />
      );
    }
    if (!data || (data.raids.length === 0 && data.dungeons.length === 0)) {
      return (
        <EmptyState
          compact
          icon={<ExploreOffRoundedIcon />}
          title={`No dungeons or raids listed for ${tier.name}`}
          description="Blizzard's journal has no instances under this tier. Try another expansion."
        />
      );
    }
    return (
      <Stack spacing={3}>
        {data.raids.length > 0 ? (
          <InstanceGroup
            title="Raids"
            instances={data.raids}
            showExpansion={tier.isCurrentSeason}
            onSelect={onSelect}
          />
        ) : null}
        {data.dungeons.length > 0 ? (
          <InstanceGroup
            title="Dungeons"
            instances={data.dungeons}
            showExpansion={tier.isCurrentSeason}
            onSelect={onSelect}
          />
        ) : null}
      </Stack>
    );
  };

  return (
    <Paper component="section" variant="outlined" aria-labelledby={titleId} sx={panelSx}>
      <Stack spacing={2} sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Typography
            ref={headingRef}
            id={titleId}
            variant="h5"
            component="h2"
            tabIndex={-1}
            sx={focusTargetSx}
          >
            {tier.name}
          </Typography>
          {description ? (
            <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0, maxWidth: "72ch" }}>
              {description}
            </Typography>
          ) : query.isPending ? (
            <Skeleton variant="text" width={160} sx={{ fontSize: "0.875rem" }} />
          ) : null}
        </Stack>
        {renderBody()}
      </Stack>
    </Paper>
  );
};

export default TierInstances;
