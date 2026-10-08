import NavigateBeforeRoundedIcon from "@mui/icons-material/NavigateBeforeRounded";
import NavigateNextRoundedIcon from "@mui/icons-material/NavigateNextRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
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
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useId } from "react";
import type { Ref } from "react";
import { Link as RouterLink } from "react-router-dom";

import MediaTile from "@/components/common/MediaTile";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import { creatureDisplayRenderQuery } from "@/features/creatures/hooks/creatureDisplayQueries";
import AbilityTree from "@/features/journal/components/AbilityTree";
import {
  focusTargetSx,
  panelSx,
} from "@/features/journal/components/journalStyles";
import LootList from "@/features/journal/components/LootList";
import {
  categoryLabel,
  workbenchUrl,
} from "@/features/journal/services/journalService";
import type {
  JournalCreature,
  JournalEncounter,
  JournalInstance,
  JournalRef,
} from "@/features/journal/types";
import IconBackdrop from "@/features/professions/components/IconBackdrop";
import { WOWHEAD_LABEL, wowheadSearchUrl } from "@/lib/externalLinks";
import { formatNumber } from "@/lib/format";
import { mixins, visuallyHidden } from "@/theme";

export type EncounterViewProps = {
  encounterId: number;
  query: UseQueryResult<JournalEncounter | null>;
  /** The encounter's instance once known: its boss order drives Previous / Next. */
  instance: JournalInstance | null;
  /** The h2, focusable from script: picking a boss moves focus here. */
  headingRef?: Ref<HTMLHeadingElement>;
  onSelectEncounter: (encounter: JournalRef) => void;
  /** Leaves an encounter Blizzard does not have (an old link). */
  onClose: () => void;
};

/** The model column: a capped square on phones, a fixed one beside the text from sm up. */
const renderBoxSx = {
  width: { xs: "100%", sm: 220, md: 240 },
  maxWidth: { xs: 280, sm: "none" },
  flexShrink: 0,
  aspectRatio: "1 / 1",
  alignSelf: { xs: "center", sm: "flex-start" },
} as const;

const HeaderSkeleton = (): JSX.Element => (
  <Stack
    role="status"
    aria-label="Loading the encounter"
    aria-busy
    direction={{ xs: "column", sm: "row" }}
    spacing={{ xs: 2, md: 3 }}
    useFlexGap
  >
    <Skeleton variant="rectangular" sx={{ ...renderBoxSx, height: "auto", borderRadius: 1 }} />
    <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
      <Skeleton variant="text" width={140} sx={{ fontSize: "0.75rem" }} />
      <Skeleton variant="text" width="50%" sx={{ fontSize: "2rem" }} />
      <Skeleton variant="text" width={120} sx={{ fontSize: "0.75rem" }} />
      <Skeleton variant="text" sx={{ fontSize: "1rem" }} />
      <Skeleton variant="text" sx={{ fontSize: "1rem" }} />
      <Skeleton variant="text" width="60%" sx={{ fontSize: "1rem" }} />
      <Stack direction="row" spacing={1}>
        <Skeleton variant="rounded" width={88} height={24} />
        <Skeleton variant="rounded" width={72} height={24} />
        <Skeleton variant="rounded" width={72} height={24} />
      </Stack>
    </Stack>
  </Stack>
);

const CreatureTile = ({ creature }: { creature: JournalCreature }): JSX.Element => {
  const query = useQuery({
    ...creatureDisplayRenderQuery(creature.displayId ?? 0),
    enabled: creature.displayId !== undefined,
  });
  return (
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
      <MediaTile
        size={56}
        src={query.data ?? null}
        alt=""
        fallbackLabel={creature.name}
        loading={creature.displayId !== undefined && query.isPending}
        radius="md"
      />
      <Typography variant="body2" component="span" sx={{ ...mixins.lineClamp(2), minWidth: 0 }}>
        {creature.name}
      </Typography>
    </Stack>
  );
};

/**
 * One encounter in full: the boss's model over a blurred wash of it, its
 * instance and place in the boss order, Blizzard's description and
 * difficulties, every creature in the fight, the ability tree and the loot
 * table. Previous / Next step through the instance's bosses without
 * scrolling back up to the cards.
 */
const EncounterView = ({
  encounterId,
  query,
  instance,
  headingRef,
  onSelectEncounter,
  onClose,
}: EncounterViewProps): JSX.Element => {
  const titleId = useId();
  const modesId = useId();
  const creaturesHeadingId = useId();
  const encounter = query.data ?? null;
  const bossDisplayId = encounter?.creatures[0]?.displayId;
  const renderQuery = useQuery({
    ...creatureDisplayRenderQuery(bossDisplayId ?? 0),
    enabled: bossDisplayId !== undefined,
  });

  if (query.isError && !encounter) {
    return (
      <ErrorState
        error={query.error}
        context="this encounter"
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (!query.isPending && !encounter) {
    return (
      <EmptyState
        icon={<PersonSearchRoundedIcon />}
        title="Encounter not found"
        description={`Blizzard's journal has no encounter #${encounterId}.`}
        action={
          <Button variant="outlined" size="small" onClick={onClose}>
            Close encounter
          </Button>
        }
      />
    );
  }

  // Previous / Next only once the encounter's own instance is on screen.
  const order =
    instance && encounter && instance.id === encounter.instance?.id ? instance.encounters : [];
  const position = order.findIndex((entry) => entry.id === encounterId);
  const previous = position > 0 ? order[position - 1] : undefined;
  const next = position >= 0 && position < order.length - 1 ? order[position + 1] : undefined;

  const overline = encounter
    ? [categoryLabel(encounter.category), encounter.instance?.name].filter(Boolean).join(" · ")
    : "";
  const wowhead = encounter ? wowheadSearchUrl(encounter.name) : undefined;
  const renderUrl = renderQuery.data ?? null;

  return (
    <Paper component="section" variant="outlined" aria-labelledby={titleId} sx={panelSx}>
      <IconBackdrop src={renderUrl} opacity={0.3} sx={{ height: 300, bottom: "auto" }} />
      <Stack spacing={3} sx={{ position: "relative", p: { xs: 2, md: 3 } }}>
        {!encounter ? (
          <HeaderSkeleton />
        ) : (
          // useFlexGap: a CSS gap, so the stacked phone layout gets no stray margin.
          <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 2, md: 3 }} useFlexGap>
            <Box
              sx={(theme) => ({
                ...renderBoxSx,
                borderRadius: `${theme.wc.radius.md}px`,
                overflow: "hidden",
                boxShadow: theme.palette.glow.card,
              })}
            >
              <MediaTile
                size="fill"
                aspect="1 / 1"
                src={renderUrl}
                alt=""
                fallbackLabel={encounter.name}
                loading={bossDisplayId !== undefined && renderQuery.isPending}
              />
            </Box>
            <Stack spacing={1.5} sx={{ minWidth: 0, flex: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                {overline ? (
                  <Typography
                    variant="overline"
                    component="p"
                    sx={{ m: 0, color: "secondary.main", lineHeight: 1.4, overflowWrap: "anywhere" }}
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
                  {encounter.name}
                </Typography>
                {position >= 0 ? (
                  <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0, mt: 0.5 }}>
                    {`Encounter ${formatNumber(position + 1)} of ${formatNumber(order.length)}`}
                  </Typography>
                ) : null}
              </Box>

              {encounter.description ? (
                <Typography variant="body1" color="text.secondary" component="p" sx={{ m: 0, maxWidth: "72ch" }}>
                  {encounter.description}
                </Typography>
              ) : null}

              {encounter.modes.length > 0 ? (
                <Stack spacing={0.75}>
                  <Typography id={modesId} variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
                    Difficulties
                  </Typography>
                  <Stack
                    component="ul"
                    role="list"
                    aria-labelledby={modesId}
                    direction="row"
                    flexWrap="wrap"
                    useFlexGap
                    gap={1}
                    sx={{ m: 0, p: 0, listStyle: "none" }}
                  >
                    {encounter.modes.map((mode, index) => (
                      <Box component="li" key={`${mode.type}-${index}`}>
                        <Chip size="small" variant="outlined" label={mode.name} />
                      </Box>
                    ))}
                  </Stack>
                </Stack>
              ) : null}

              <Stack direction="row" flexWrap="wrap" useFlexGap gap={1} alignItems="center" sx={{ pt: 0.5 }}>
                {previous ? (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<NavigateBeforeRoundedIcon />}
                    onClick={() => onSelectEncounter(previous)}
                  >
                    Previous boss
                    <Box component="span" sx={visuallyHidden}>
                      {`: ${previous.name}`}
                    </Box>
                  </Button>
                ) : null}
                {next ? (
                  <Button
                    size="small"
                    variant="outlined"
                    endIcon={<NavigateNextRoundedIcon />}
                    onClick={() => onSelectEncounter(next)}
                  >
                    Next boss
                    <Box component="span" sx={visuallyHidden}>
                      {`: ${next.name}`}
                    </Box>
                  </Button>
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
                <Button component={RouterLink} to={workbenchUrl("journal-encounter", encounter.id)} size="small">
                  Open in API workbench
                </Button>
              </Stack>
            </Stack>
          </Stack>
        )}

        {encounter && encounter.creatures.length > 1 ? (
          <Stack component="section" aria-labelledby={creaturesHeadingId} spacing={1.5}>
            <Typography id={creaturesHeadingId} variant="subtitle1" component="h3" sx={{ m: 0 }}>
              In this encounter
            </Typography>
            <Box
              component="ul"
              role="list"
              aria-labelledby={creaturesHeadingId}
              sx={{
                display: "grid",
                gap: 1.5,
                listStyle: "none",
                m: 0,
                p: 0,
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))",
              }}
            >
              {encounter.creatures.map((creature, index) => (
                <Box component="li" key={`${creature.id}-${index}`} sx={{ minWidth: 0 }}>
                  <CreatureTile creature={creature} />
                </Box>
              ))}
            </Box>
          </Stack>
        ) : null}

        <Divider />

        {encounter ? (
          <AbilityTree key={encounter.id} sections={encounter.sections} encounterName={encounter.name} />
        ) : (
          <LoadingSkeleton variant="rows" count={4} itemHeight={48} gap={8} label="Loading abilities" />
        )}

        {encounter ? (
          <>
            <Divider />
            <LootList key={encounter.id} loot={encounter.loot} encounterName={encounter.name} />
          </>
        ) : null}
      </Stack>
    </Paper>
  );
};

export default EncounterView;
