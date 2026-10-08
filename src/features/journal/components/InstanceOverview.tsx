import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import TravelExploreRoundedIcon from "@mui/icons-material/TravelExploreRounded";
import {
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import type { UseQueryResult } from "@tanstack/react-query";
import { useId } from "react";
import type { Ref } from "react";
import { Link as RouterLink } from "react-router-dom";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import MediaTile from "@/components/common/MediaTile";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import BossCard, { BOSS_CARD_TEXT_HEIGHT } from "@/features/journal/components/BossCard";
import {
  artCellSx,
  focusTargetSx,
  panelSx,
} from "@/features/journal/components/journalStyles";
import {
  categoryLabel,
  playersLabel,
  workbenchUrl,
} from "@/features/journal/services/journalService";
import type { JournalInstance, JournalRef } from "@/features/journal/types";
import IconBackdrop from "@/features/professions/components/IconBackdrop";
import { WOWHEAD_LABEL, wowheadSearchUrl } from "@/lib/externalLinks";
import { formatNumber } from "@/lib/format";
import { visuallyHidden } from "@/theme";

const BOSS_COLS: GridColumns = { xs: 2, sm: 3, md: 4, lg: 6 };
const BOSS_GAP_PX = 12;
const BOSS_CELL_SX = artCellSx(1, BOSS_CARD_TEXT_HEIGHT);
/** Where most raids land; the skeleton only needs to be in the right shape. */
const EXPECTED_BOSS_COUNT = 6;

export type InstanceOverviewProps = {
  instanceId: number;
  query: UseQueryResult<JournalInstance | null>;
  /** The h2, focusable from script: opening an instance moves focus here. */
  headingRef?: Ref<HTMLHeadingElement>;
  selectedEncounterId: number | null;
  onSelectEncounter: (encounter: JournalRef) => void;
  /** Leaves an instance Blizzard does not have (an old link). */
  onClear: () => void;
  /** The tier the trail leads back to, for the not-found action. */
  tierName?: string;
};

/** The art column: full width on phones, beside the text from md up. */
const artBoxSx = {
  width: { xs: "100%", md: 360, lg: 440 },
  flexShrink: 0,
  aspectRatio: "2 / 1",
  borderRadius: 1,
  overflow: "hidden",
} as const;

const HeroSkeleton = (): JSX.Element => (
  <Stack
    role="status"
    aria-label="Loading the instance"
    aria-busy
    direction={{ xs: "column", md: "row" }}
    spacing={{ xs: 2, md: 3 }}
    useFlexGap
  >
    <Skeleton variant="rectangular" sx={{ ...artBoxSx, height: "auto" }} />
    <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
      <Skeleton variant="text" width={120} sx={{ fontSize: "0.75rem" }} />
      <Skeleton variant="text" width="55%" sx={{ fontSize: "2rem" }} />
      <Skeleton variant="text" width={160} sx={{ fontSize: "0.875rem" }} />
      <Skeleton variant="text" sx={{ fontSize: "1rem" }} />
      <Skeleton variant="text" sx={{ fontSize: "1rem" }} />
      <Skeleton variant="text" width="70%" sx={{ fontSize: "1rem" }} />
      <Stack direction="row" spacing={1}>
        <Skeleton variant="rounded" width={88} height={24} />
        <Skeleton variant="rounded" width={72} height={24} />
        <Skeleton variant="rounded" width={72} height={24} />
      </Stack>
    </Stack>
  </Stack>
);

/**
 * The selected dungeon or raid: its zone art over a blurred wash of the
 * same picture, category and expansion, location, Blizzard's description,
 * its difficulties and group sizes, then every boss as a model card in
 * journal order. A boss card opens the encounter below.
 */
const InstanceOverview = ({
  instanceId,
  query,
  headingRef,
  selectedEncounterId,
  onSelectEncounter,
  onClear,
  tierName,
}: InstanceOverviewProps): JSX.Element => {
  const titleId = useId();
  const bossesHeadingId = useId();
  const modesHeadingId = useId();
  const instance = query.data ?? null;

  if (query.isError && !instance) {
    return (
      <ErrorState
        error={query.error}
        context="this instance"
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (!query.isPending && !instance) {
    return (
      <EmptyState
        icon={<TravelExploreRoundedIcon />}
        title="Instance not found"
        description={`Blizzard's journal has no instance #${instanceId}.`}
        action={
          <Button variant="outlined" size="small" onClick={onClear}>
            {tierName ? `Back to ${tierName}` : "Back to the expansion"}
          </Button>
        }
      />
    );
  }

  const overline = instance
    ? [categoryLabel(instance.category), instance.expansion?.name].filter(Boolean).join(" · ")
    : "";
  const players = instance ? playersLabel(instance.modes) : undefined;
  const wowhead = instance ? wowheadSearchUrl(instance.name) : undefined;
  const bossCount = instance?.encounters.length ?? 0;

  const renderBosses = (): JSX.Element => {
    if (!instance) {
      return (
        <LoadingSkeleton
          variant="grid"
          columns={BOSS_COLS}
          count={EXPECTED_BOSS_COUNT}
          gap={BOSS_GAP_PX}
          label="Loading bosses"
          sx={BOSS_CELL_SX}
        />
      );
    }
    if (bossCount === 0) {
      return (
        <EmptyState
          compact
          title="No bosses listed"
          description={`Blizzard's journal lists no encounters for ${instance.name}.`}
        />
      );
    }
    return (
      <Box
        component="ul"
        role="list"
        aria-labelledby={bossesHeadingId}
        sx={{
          display: "grid",
          gap: `${BOSS_GAP_PX}px`,
          listStyle: "none",
          m: 0,
          p: 0,
          ...gridTemplateColumnsSx(BOSS_COLS),
        }}
      >
        {instance.encounters.map((encounter, index) => (
          // Faction twins share a name (Icecrown Gunship Battle), never an id.
          <Box component="li" key={encounter.id} sx={{ minWidth: 0 }}>
            <BossCard
              encounter={encounter}
              position={index + 1}
              total={bossCount}
              selected={encounter.id === selectedEncounterId}
              onSelect={onSelectEncounter}
            />
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Paper component="section" variant="outlined" aria-labelledby={titleId} sx={panelSx}>
      <IconBackdrop src={instance?.imageUrl} opacity={0.35} sx={{ height: 320, bottom: "auto" }} />
      <Stack spacing={3} sx={{ position: "relative", p: { xs: 2, md: 3 } }}>
        {!instance ? (
          <HeroSkeleton />
        ) : (
          // useFlexGap: a CSS gap, so the stacked phone layout gets no stray margin.
          <Stack direction={{ xs: "column", md: "row" }} spacing={{ xs: 2, md: 3 }} useFlexGap>
            <Box
              sx={(theme) => ({
                ...artBoxSx,
                borderRadius: `${theme.wc.radius.md}px`,
                boxShadow: theme.palette.glow.card,
              })}
            >
              <MediaTile
                size="fill"
                aspect="2 / 1"
                src={instance.imageUrl}
                alt=""
                fallbackLabel={instance.name}
              />
            </Box>
            <Stack spacing={1.5} sx={{ minWidth: 0, flex: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                {overline ? (
                  <Typography
                    variant="overline"
                    component="p"
                    sx={{ m: 0, color: "secondary.main", lineHeight: 1.4 }}
                  >
                    {overline}
                  </Typography>
                ) : null}
                <Typography
                  ref={headingRef}
                  id={titleId}
                  variant="h3"
                  component="h2"
                  tabIndex={-1}
                  sx={focusTargetSx}
                >
                  {instance.name}
                </Typography>
                {instance.location ? (
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5, color: "text.secondary" }}>
                    <PlaceRoundedIcon aria-hidden fontSize="small" />
                    <Typography variant="body2" component="p" sx={{ m: 0, minWidth: 0, overflowWrap: "anywhere" }}>
                      <Box component="span" sx={visuallyHidden}>
                        {"Location: "}
                      </Box>
                      {instance.location}
                    </Typography>
                  </Stack>
                ) : null}
              </Box>

              {instance.description ? (
                <Typography variant="body1" color="text.secondary" component="p" sx={{ m: 0, maxWidth: "72ch" }}>
                  {instance.description}
                </Typography>
              ) : null}

              {instance.modes.length > 0 ? (
                <Stack spacing={0.75}>
                  <Typography id={modesHeadingId} variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
                    {["Difficulties", players].filter(Boolean).join(" · ")}
                  </Typography>
                  <Stack
                    component="ul"
                    role="list"
                    aria-labelledby={modesHeadingId}
                    direction="row"
                    flexWrap="wrap"
                    useFlexGap
                    gap={1}
                    sx={{ m: 0, p: 0, listStyle: "none" }}
                  >
                    {instance.modes.map((mode, index) => (
                      <Box component="li" key={`${mode.type}-${index}`}>
                        <Chip size="small" variant="outlined" label={mode.name} />
                      </Box>
                    ))}
                  </Stack>
                </Stack>
              ) : null}

              <Stack direction="row" flexWrap="wrap" useFlexGap gap={1} alignItems="center">
                {instance.minimumLevel !== undefined ? (
                  <Chip size="small" label={`Level ${formatNumber(instance.minimumLevel)}+`} />
                ) : null}
                <Box sx={{ flex: "1 1 auto" }} />
                {wowhead ? (
                  <Button
                    href={wowhead}
                    target="_blank"
                    rel="noreferrer"
                    size="small"
                    endIcon={<OpenInNewRoundedIcon />}
                  >
                    {WOWHEAD_LABEL}
                    <Box component="span" sx={visuallyHidden}>
                      {" (opens in a new tab)"}
                    </Box>
                  </Button>
                ) : null}
                <Button component={RouterLink} to={workbenchUrl("journal-instance", instance.id)} size="small">
                  Open in API workbench
                </Button>
              </Stack>
            </Stack>
          </Stack>
        )}

        <Divider />

        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="baseline" sx={{ minWidth: 0 }}>
            <Typography id={bossesHeadingId} variant="subtitle1" component="h3" sx={{ m: 0 }}>
              Bosses
            </Typography>
            {bossCount > 0 ? (
              <Typography variant="caption" color="text.secondary" component="span">
                {formatNumber(bossCount)}
              </Typography>
            ) : null}
          </Stack>
          {renderBosses()}
        </Stack>
      </Stack>
    </Paper>
  );
};

export default InstanceOverview;
