import CastleRounded from "@mui/icons-material/CastleRounded";
import MilitaryTechRounded from "@mui/icons-material/MilitaryTechRounded";
import TimerOutlined from "@mui/icons-material/TimerOutlined";
import { Box, Paper, Skeleton, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import SectionCard from "@/components/common/SectionCard";
import { TileGridSkeleton } from "@/features/home/components/SeasonTile";
import { HOME_PANELS } from "@/features/home/config/panels";
import { journalTierQuery } from "@/features/journal/hooks/journalQueries";
import { CURRENT_SEASON_TIER_ID } from "@/features/journal/services/journalService";
import { keystoneSeasonQuery } from "@/features/mythicKeystone/hooks/keystoneQueries";
import { tokens } from "@/theme";

/** One card per bracket: Arena 3v3, Rated Battlegrounds, Solo Shuffle and Blitz today. */
export const PVP_COLUMNS: GridColumns = { xs: 1, sm: 2, lg: 4 };
const PVP_SKELETON_COUNT = 4;

/**
 * How many tiles a panel's skeleton draws while its record is not cached
 * yet. Every Mythic+ season since Dragonflight has rotated eight dungeons
 * (game knowledge), and two rows of four at lg also hold the seven entries
 * Blizzard's Current Season tier lists today, so the grid grows or shrinks
 * by a row at most when the record lands. Once it is cached, its own count
 * is drawn instead.
 */
export const TILE_SKELETON_COUNT = 8;

/** A bracket card's shape: icon and label, two title rows, each with its number. */
export const PvpCardSkeletons = ({ label }: { label: string }): JSX.Element => (
  <Box
    role="status"
    aria-label={label}
    aria-busy="true"
    sx={{ display: "grid", gap: 2, ...gridTemplateColumnsSx(PVP_COLUMNS) }}
  >
    {Array.from({ length: PVP_SKELETON_COUNT }, (_, index) => (
      <Paper
        key={index}
        variant="outlined"
        sx={(theme) => ({ p: 2, borderRadius: `${theme.wc.radius.lg}px` })}
      >
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Skeleton variant="rounded" width={40} height={40} />
            <Skeleton variant="text" width="45%" sx={{ fontSize: "0.75rem" }} />
          </Stack>
          {[0, 1].map((row) => (
            <Stack key={row} direction="row" spacing={2} alignItems="center">
              <Skeleton variant="text" sx={{ flex: 1, fontSize: "0.875rem" }} />
              <Skeleton variant="text" width={56} sx={{ fontSize: "1.25rem" }} />
            </Stack>
          ))}
        </Stack>
      </Paper>
    ))}
  </Box>
);

/** A panel's one-line description while the record it quotes loads. */
export const PanelDescriptionSkeleton = (): JSX.Element => (
  <Skeleton variant="text" width="min(560px, 85%)" />
);

/**
 * Stands in for the lazy panels while their chunk loads: the same three
 * frames, with their real titles and icons (so the headings are there at
 * once), over skeletons shaped like the tiles and cards they will hold,
 * as many tiles as the season and tier records hold when they are cached.
 */
const HomePanelsFallback = (): JSX.Element => {
  // Cache readers only, never fetched here: the strip above already asks
  // for both records under these keys, and this module is in its chunk.
  const season = useQuery({ ...keystoneSeasonQuery(), enabled: false }).data;
  const tier = useQuery({ ...journalTierQuery(CURRENT_SEASON_TIER_ID), enabled: false }).data;

  return (
    <Stack spacing={tokens.wc.layout.sectionGap}>
      <SectionCard
        id={HOME_PANELS.mythicPlus.id}
        title={HOME_PANELS.mythicPlus.title}
        icon={<TimerOutlined />}
        description={<PanelDescriptionSkeleton />}
      >
        <TileGridSkeleton
          count={season?.dungeons.length || TILE_SKELETON_COUNT}
          label="Loading the Mythic+ rotation"
        />
      </SectionCard>
      <SectionCard
        id={HOME_PANELS.raids.id}
        title={HOME_PANELS.raids.title}
        icon={<CastleRounded />}
        description={<PanelDescriptionSkeleton />}
      >
        <TileGridSkeleton
          count={tier?.raids.length || TILE_SKELETON_COUNT}
          label="Loading this season's raids"
        />
      </SectionCard>
      <SectionCard
        id={HOME_PANELS.pvp.id}
        title={HOME_PANELS.pvp.title}
        icon={<MilitaryTechRounded />}
        description={<PanelDescriptionSkeleton />}
      >
        <PvpCardSkeletons label="Loading the PvP title cutoffs" />
      </SectionCard>
    </Stack>
  );
};

export default HomePanelsFallback;
