import KeyRoundedIcon from "@mui/icons-material/KeyRounded";
import { Box, Chip, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import KeystoneDungeonCard from "@/features/mythicKeystone/components/KeystoneDungeonCard";
import KeystoneDungeonDialog from "@/features/mythicKeystone/components/KeystoneDungeonDialog";
import {
  keystoneIndexQuery,
  keystoneSeasonQuery,
} from "@/features/mythicKeystone/hooks/keystoneQueries";
import type { KeystoneDungeonSummary } from "@/features/mythicKeystone/types";
import { env } from "@/lib/env";
import { formatNumber, toBcp47 } from "@/lib/format";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

/** A season rotates eight dungeons: two even rows of four on large screens. */
const SEASON_COLS: GridColumns = { xs: 1, sm: 2, lg: 4 };
const ARCHIVE_COLS: GridColumns = { xs: 1, sm: 2, md: 3, lg: 4 };
const EXPECTED_SEASON_COUNT = 8;
const SEASON_CARD_HEIGHT = 340;
const ARCHIVE_CARD_HEIGHT = 240;
const EMPTY: KeystoneDungeonSummary[] = [];

/**
 * Skeleton cells shaped like the cards: the 2:1 art is half the cell's width,
 * plus the card's text block, so the grid does not jump at any breakpoint.
 */
const artCellSx = (textHeight: number) => ({
  "& > .MuiSkeleton-root": { height: "auto" },
  "& > .MuiSkeleton-root::before": {
    content: '""',
    display: "block",
    paddingTop: `calc(50% + ${textHeight}px)`,
  },
});
const SEASON_TEXT_HEIGHT = 176;
const ARCHIVE_TEXT_HEIGHT = 118;

const formatSeasonStart = (timestamp: number): string =>
  new Intl.DateTimeFormat(toBcp47(env.locale), { dateStyle: "medium" }).format(
    new Date(timestamp),
  );

type DungeonGridProps = {
  label: string;
  dungeons: KeystoneDungeonSummary[];
  columns: GridColumns;
  featured?: boolean;
  lazy?: boolean;
  onSelect: (dungeon: KeystoneDungeonSummary) => void;
};

const DungeonGrid = ({
  label,
  dungeons,
  columns,
  featured = false,
  lazy = false,
  onSelect,
}: DungeonGridProps): JSX.Element => (
  <Box
    component="ul"
    aria-label={label}
    sx={{
      display: "grid",
      gap: 2,
      listStyle: "none",
      margin: 0,
      padding: 0,
      ...gridTemplateColumnsSx(columns),
    }}
  >
    {dungeons.map((dungeon) => (
      <Box component="li" key={dungeon.id} sx={{ minWidth: 0 }}>
        <KeystoneDungeonCard
          summary={dungeon}
          featured={featured}
          lazy={lazy}
          onSelect={onSelect}
        />
      </Box>
    ))}
  </Box>
);

/**
 * Mythic Keystone Dungeons: this season's rotation as art cards with every
 * upgrade timer, then every other dungeon ever used for keystones, most
 * recently added first. Blizzard keeps the art two lookups from each dungeon (see the
 * service), so past dungeons only load as they near the viewport.
 */
const MythicKeystoneDungeonsPage = ({
  eyebrow = "Competitive & Economy",
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const indexQuery = useQuery(keystoneIndexQuery());
  const seasonQuery = useQuery(keystoneSeasonQuery());
  // The selection outlives the dialog's open flag so it never blanks while closing.
  const [selected, setSelected] = useState<KeystoneDungeonSummary | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const openDungeon = useCallback((dungeon: KeystoneDungeonSummary): void => {
    setSelected(dungeon);
    setDialogOpen(true);
  }, []);

  const season = seasonQuery.data ?? null;
  const seasonDungeons = season?.dungeons ?? EMPTY;
  const seasonIds = useMemo(
    () => new Set(seasonDungeons.map((dungeon) => dungeon.id)),
    [seasonDungeons],
  );
  const index = indexQuery.data ?? EMPTY;
  const archive = useMemo(
    () => index.filter((dungeon) => !seasonIds.has(dungeon.id)),
    [index, seasonIds],
  );

  const seasonDescription = season
    ? [
        season.name,
        season.startTimestamp
          ? `started ${formatSeasonStart(season.startTimestamp)}`
          : undefined,
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  const renderSeason = (): JSX.Element => {
    if (seasonQuery.isPending) {
      return (
        <LoadingSkeleton
          variant="grid"
          columns={SEASON_COLS}
          itemHeight={SEASON_CARD_HEIGHT}
          count={EXPECTED_SEASON_COUNT}
          label="Loading this season's dungeons"
          sx={artCellSx(SEASON_TEXT_HEIGHT)}
        />
      );
    }
    if (seasonQuery.isError) {
      return (
        <ErrorState
          compact
          error={seasonQuery.error}
          context="the current keystone season"
          onRetry={() => void seasonQuery.refetch()}
        />
      );
    }
    if (seasonDungeons.length === 0) {
      return (
        <EmptyState
          compact
          title={
            season
              ? `No dungeons listed for ${season.name}`
              : "No keystone season is running"
          }
          description="Blizzard lists no dungeons in the current rotation; every keystone dungeon is listed below."
        />
      );
    }
    return (
      <DungeonGrid
        label="This season's keystone dungeons"
        dungeons={seasonDungeons}
        columns={SEASON_COLS}
        featured
        onSelect={openDungeon}
      />
    );
  };

  const renderArchive = (): JSX.Element => {
    // Wait for the season too, so its dungeons never flash in this list first.
    if (indexQuery.isPending || seasonQuery.isPending) {
      return (
        <LoadingSkeleton
          variant="grid"
          columns={ARCHIVE_COLS}
          itemHeight={ARCHIVE_CARD_HEIGHT}
          count={8}
          label="Loading keystone dungeons"
          sx={artCellSx(ARCHIVE_TEXT_HEIGHT)}
        />
      );
    }
    if (indexQuery.isError) {
      return (
        <ErrorState
          compact
          error={indexQuery.error}
          context="keystone dungeons"
          onRetry={() => void indexQuery.refetch()}
        />
      );
    }
    return (
      <DungeonGrid
        label="Earlier keystone dungeons"
        dungeons={archive}
        columns={ARCHIVE_COLS}
        lazy
        onSelect={openDungeon}
      />
    );
  };

  return (
    <Stack
      sx={(theme) => ({
        gap: {
          xs: theme.spacing(theme.wc.layout.sectionGap.xs),
          md: theme.spacing(theme.wc.layout.sectionGap.md),
        },
      })}
    >
      <PageHeader
        eyebrow={eyebrow}
        breadcrumbs={breadcrumbs}
        title="Mythic Keystone Dungeons"
        documentTitle="Mythic Keystone Dungeons"
        icon={<KeyRoundedIcon />}
        description="This season's keystone dungeons with their upgrade timers, and every dungeon in Blizzard's keystone index, back to the Mists of Pandaria Challenge Modes."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {season ? <Chip size="small" label={season.name} /> : null}
            {index.length > 0 ? (
              <Chip
                size="small"
                label={`${formatNumber(index.length)} keystone dungeons`}
              />
            ) : null}
          </>
        }
      />

      <SectionCard title="This season" description={seasonDescription}>
        {renderSeason()}
      </SectionCard>

      <SectionCard
        title="Earlier keystone dungeons"
        description={
          archive.length > 0
            ? `${formatNumber(archive.length)} dungeons from earlier seasons, most recently added first`
            : undefined
        }
      >
        {renderArchive()}
      </SectionCard>

      <KeystoneDungeonDialog
        open={dialogOpen}
        dungeon={selected}
        inSeason={selected !== null && seasonIds.has(selected.id)}
        onClose={() => setDialogOpen(false)}
      />
    </Stack>
  );
};

export default MythicKeystoneDungeonsPage;
