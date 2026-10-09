import CastleRounded from "@mui/icons-material/CastleRounded";
import EmojiEventsRounded from "@mui/icons-material/EmojiEventsRounded";
import { Box, Button, Chip, Link, Stack, Typography } from "@mui/material";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import SectionCard from "@/components/common/SectionCard";
import {
  EmptyState,
  ErrorState,
  LiveStatus,
} from "@/components/common/StateBlocks";
import {
  PanelDescriptionSkeleton,
  TILE_SKELETON_COUNT,
} from "@/features/home/components/HomePanelsFallback";
import {
  PanelFooterAction,
  PanelHeaderAction,
} from "@/features/home/components/PanelAction";
import SeasonTile, {
  TILE_COLUMNS,
  TileGridSkeleton,
} from "@/features/home/components/SeasonTile";
import TileRetryAlert from "@/features/home/components/TileRetryAlert";
import {
  HOME_PATHS,
  journalInstance,
  journalSeason,
} from "@/features/home/config/homeLinks";
import { HOME_PANELS } from "@/features/home/config/panels";
import useFocusAfterRetry from "@/features/home/hooks/useFocusAfterRetry";
import useNearIds from "@/features/home/hooks/useNearIds";
import useTileRetry from "@/features/home/hooks/useTileRetry";
import {
  journalInstanceQuery,
  journalTierQuery,
} from "@/features/journal/hooks/journalQueries";
import {
  CURRENT_SEASON_TIER_ID,
  categoryLabel,
  pluralize,
} from "@/features/journal/services/journalService";
import type { JournalInstance, JournalRef } from "@/features/journal/types";
import {
  HALL_OF_FAME_RAIDS,
  LATEST_RAID,
} from "@/features/mythicRaidLeaderboard/config/hallOfFameRaids";
import useStickyError from "@/features/wowToken/hooks/useStickyError";

const PANEL = HOME_PANELS.raids;
const EMPTY: readonly JournalRef[] = [];

/** The config lists the boards newest first, so its last is where the Hall of Fame begins. */
const FIRST_HALL_OF_FAME_RAID = HALL_OF_FAME_RAIDS[HALL_OF_FAME_RAIDS.length - 1];

/** "Midnight · Voidstorm"; "Midnight" alone when Blizzard gives no location. */
const originLine = (instance: JournalInstance): string | undefined =>
  [instance.expansion?.name, instance.location].filter(Boolean).join(" · ") ||
  categoryLabel(instance.category);

/**
 * Why there is no race to world first here: the API's Hall of Fame ends
 * with the newest board in the Hall of Fame config (every later raid's
 * board is a 404, checked live there), so this season's raids have no
 * standings to show. The note reads both ends from that config rather than
 * repeating them.
 */
const HallOfFameNote = (): JSX.Element => (
  <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ minWidth: 0 }}>
    <EmojiEventsRounded
      aria-hidden="true"
      sx={{ fontSize: 18, mt: "2px", flexShrink: 0, color: "text.secondary" }}
    />
    <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0, minWidth: 0 }}>
      {`Race to World First: Blizzard's Hall of Fame covers ${FIRST_HALL_OF_FAME_RAID.name} through ${LATEST_RAID.name}, so this season's raids have no standings in its API. `}
      <Link component={RouterLink} to={HOME_PATHS.hallOfFame}>
        Hall of Fame
      </Link>
    </Typography>
  </Stack>
);

/**
 * Every raid the Encounter Journal's Current Season tier lists, as art
 * tiles with their boss counts, each opening that raid in the Journal. The
 * tier is the strip's cached entry; each tile loads the Journal's own
 * instance record (two lookups and one zone image) as it nears the
 * viewport. Art Blizzard's CDN refuses (it answers 403 for some of the
 * newest zones) leaves the tile's letter in its place.
 */
const RaidsPanel = (): JSX.Element => {
  const tierQuery = useQuery(journalTierQuery(CURRENT_SEASON_TIER_ID));
  const tierError = useStickyError(tierQuery);
  const tier = tierQuery.data;
  const raids = tier?.raids ?? EMPTY;

  const [nearIds, markNear] = useNearIds();
  // Read by index on every render, never copied into state, and no
  // `combine`: react-query 5.90 hands back the previous list's combine
  // result for one render when the list changes.
  const results = useQueries({
    queries: raids.map((raid) => ({
      ...journalInstanceQuery(raid.id),
      enabled: nearIds.has(raid.id),
    })),
  });
  const tileRetry = useTileRetry(results, "Raid details loaded");
  // A successful Retry removes its alert; the tiles take the focus it held.
  const afterTierRetry = useFocusAfterRetry(
    tileRetry.listRef,
    raids.length > 0,
    tier === undefined ? tierError : null,
  );

  const description = tier
    ? `The Encounter Journal's ${tier.name} tier: zone art and boss counts for every raid it lists.`
    : tier === undefined && !tierError
      ? <PanelDescriptionSkeleton />
      : undefined;

  const renderBody = (): JSX.Element => {
    if (tier === undefined) {
      if (tierError) {
        return (
          <ErrorState
            compact
            // The strip's Raids card reads the same query and announces this failure.
            announce={false}
            error={tierError}
            context="this season's raids"
            onRetry={afterTierRetry(() => void tierQuery.refetch())}
          />
        );
      }
      return (
        <TileGridSkeleton count={TILE_SKELETON_COUNT} label="Loading this season's raids" />
      );
    }

    if (tier === null) {
      return (
        <EmptyState
          compact
          title="The journal has no Current Season tier right now"
          action={
            <Button component={RouterLink} to={HOME_PATHS.journal} variant="outlined" size="small">
              Open the Journal
            </Button>
          }
        />
      );
    }

    if (raids.length === 0) {
      return (
        <EmptyState
          compact
          title="No raids in the Current Season tier"
          action={
            <Button component={RouterLink} to={journalSeason()} variant="outlined" size="small">
              Open the Journal
            </Button>
          }
        />
      );
    }

    return (
      <Stack spacing={2}>
        <Box
          component="ul"
          ref={tileRetry.listRef}
          // Safari drops the list role from a list-style:none list without it.
          role="list"
          aria-label="This season's raids"
          // Takes focus when a successful Retry removes the alert that held it.
          tabIndex={-1}
          sx={{
            listStyle: "none",
            m: 0,
            p: 0,
            display: "grid",
            gap: 2,
            outline: "none",
            ...gridTemplateColumnsSx(TILE_COLUMNS),
          }}
        >
          {raids.map((raid, index) => {
            const result = results[index];
            const instance = result?.data;
            const bossCount = instance?.encounters.length ?? 0;
            return (
              <Box component="li" key={raid.id} sx={{ minWidth: 0 }}>
                <SeasonTile
                  id={raid.id}
                  name={raid.name}
                  to={journalInstance(raid.id)}
                  ariaLabel={`${raid.name} in the Encounter Journal`}
                  imageUrl={instance?.imageUrl}
                  pending={result?.isPending ?? true}
                  failed={result?.isError === true && instance === undefined}
                  origin={instance ? originLine(instance) : undefined}
                  // A 404: Blizzard lists the raid in the tier but has no record for it.
                  note={instance === null ? "Not in the journal" : undefined}
                  footer={
                    bossCount > 0 ? (
                      <Chip size="small" label={pluralize(bossCount, "boss", "bosses")} />
                    ) : undefined
                  }
                  onNear={markNear}
                />
              </Box>
            );
          })}
        </Box>

        <TileRetryAlert tileRetry={tileRetry} one="raid" many="raids" />

        <HallOfFameNote />
      </Stack>
    );
  };

  return (
    <SectionCard
      id={PANEL.id}
      title={PANEL.title}
      icon={<CastleRounded />}
      description={description}
      actions={<PanelHeaderAction to={journalSeason()}>Open the Journal</PanelHeaderAction>}
    >
      {renderBody()}
      <PanelFooterAction to={journalSeason()}>Open the Journal</PanelFooterAction>
      {/* Always mounted: a live region inserted with its first text is not reliably announced. */}
      <LiveStatus visuallyHidden>{tileRetry.announcement}</LiveStatus>
    </SectionCard>
  );
};

export default RaidsPanel;
