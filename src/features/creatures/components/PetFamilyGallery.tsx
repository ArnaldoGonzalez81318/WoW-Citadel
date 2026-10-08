import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import PetsRoundedIcon from "@mui/icons-material/PetsRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import MediaTile from "@/components/common/MediaTile";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import PetFamilyTile, {
  FAMILY_TILE_HEIGHT,
} from "@/features/creatures/components/PetFamilyTile";
import { petSpecializationQuery } from "@/features/creatures/hooks/creatureQueries";
import type {
  PetFamilyCatalog,
  PetFamilyGroup,
} from "@/features/creatures/hooks/usePetFamilyCatalog";
import { pluralize } from "@/features/creatures/services/creatureService";
import type { CreatureFamily } from "@/features/creatures/types";
import { formatNumber } from "@/lib/format";
import { mixins } from "@/theme";

export type PetFamilyGalleryProps = {
  catalog: PetFamilyCatalog;
  selectedId: number | null;
  onSelect: (familyId: number) => void;
};

const FAMILY_COLS: GridColumns = { xs: 2, sm: 3, md: 4, lg: 6 };
const GALLERY_GAP_PX = 12;
/** About a third of the 84 families: one spec group's worth while they load. */
const SKELETON_TILE_COUNT = 24;

const TileGrid = ({
  labelledBy,
  families,
  selectedId,
  onSelect,
}: {
  labelledBy: string;
  families: CreatureFamily[];
  selectedId: number | null;
  onSelect: (familyId: number) => void;
}): JSX.Element => (
  <Box
    component="ul"
    // Safari drops the list role from a list-style:none list without it.
    role="list"
    aria-labelledby={labelledBy}
    sx={{
      display: "grid",
      gap: `${GALLERY_GAP_PX}px`,
      listStyle: "none",
      m: 0,
      p: 0,
      ...gridTemplateColumnsSx(FAMILY_COLS),
    }}
  >
    {families.map((family) => (
      <Box component="li" key={family.id} sx={{ minWidth: 0 }}>
        <PetFamilyTile
          family={family}
          selected={family.id === selectedId}
          onSelect={onSelect}
        />
      </Box>
    ))}
  </Box>
);

/**
 * One pet specialization: its icon, name and in-game blurb over its
 * families. The spec record is one small request per group (three in all).
 */
const SpecGroup = ({
  group,
  selectedId,
  onSelect,
}: {
  group: PetFamilyGroup;
  selectedId: number | null;
  onSelect: (familyId: number) => void;
}): JSX.Element => {
  const headingId = useId();
  const specQuery = useQuery(petSpecializationQuery(group.specialization.id));
  const spec = specQuery.data;

  return (
    <Stack spacing={1.5} sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
        <MediaTile
          size={40}
          src={spec?.iconUrl ?? null}
          alt=""
          fallbackLabel={group.specialization.name}
          loading={specQuery.isPending}
          radius="md"
        />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap" useFlexGap>
            <Typography id={headingId} variant="subtitle1" component="h3" sx={{ m: 0 }}>
              {group.specialization.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="span">
              {pluralize(group.families.length, "family", "families")}
            </Typography>
          </Stack>
          {spec?.description ? (
            <Typography
              variant="caption"
              color="text.secondary"
              component="p"
              sx={{ ...mixins.lineClamp(2), m: 0, maxWidth: "72ch" }}
            >
              {spec.description}
            </Typography>
          ) : specQuery.isPending ? (
            <Skeleton variant="text" width="60%" sx={{ fontSize: "0.75rem" }} />
          ) : null}
        </Box>
      </Stack>
      <TileGrid
        labelledBy={headingId}
        families={group.families}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </Stack>
  );
};

/**
 * The families no hunter tames, by name only. Not buttons: Blizzard's
 * creature search lists no creatures for any of them (warlock demons,
 * elementals, ghouls and the like), so a filter on one could only ever come
 * back empty. Names only, so opening the section costs no requests.
 */
const OtherFamilyList = ({
  labelledBy,
  families,
}: {
  labelledBy: string;
  families: CreatureFamily[];
}): JSX.Element => (
  <Box
    component="ul"
    // Safari drops the list role from a list-style:none list without it.
    role="list"
    aria-labelledby={labelledBy}
    sx={{
      display: "flex",
      flexWrap: "wrap",
      gap: 1,
      listStyle: "none",
      m: 0,
      p: 0,
    }}
  >
    {families.map((family) => (
      <Box component="li" key={family.id} sx={{ minWidth: 0, maxWidth: "100%" }}>
        <Chip
          size="small"
          variant="outlined"
          label={family.name}
          sx={{ maxWidth: "100%" }}
        />
      </Box>
    ))}
  </Box>
);

/**
 * Every creature family as an icon tile, grouped by the hunter pet
 * specialization its pets take (Cunning, Ferocity, Tenacity); pressing one
 * lists its creatures. The families no hunter tames sit collapsed at the
 * end as plain names, since the search has no creatures to list for them.
 */
const PetFamilyGallery = ({
  catalog,
  selectedId,
  onSelect,
}: PetFamilyGalleryProps): JSX.Element => {
  const otherId = useId();
  const { index, groups, others } = catalog;
  const loadedCount = catalog.families.length;

  // Only a first load holds the whole gallery back. Retrying a few records
  // keeps the loaded tiles, the selection and the focused Retry button on
  // screen; with nothing loaded at all, a retry looks like the first load.
  if (
    index.isPending ||
    (index.isSuccess && (catalog.pending || (catalog.retrying && loadedCount === 0)))
  ) {
    return (
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Skeleton variant="rounded" width={40} height={40} />
          <Skeleton variant="text" width={180} sx={{ fontSize: "1rem" }} />
        </Stack>
        <LoadingSkeleton
          variant="grid"
          columns={FAMILY_COLS}
          itemHeight={FAMILY_TILE_HEIGHT.sm}
          count={SKELETON_TILE_COUNT}
          gap={GALLERY_GAP_PX}
          label="Loading creature families"
          // The tiles stack on phones, so the cells grow with them.
          sx={{ "& > .MuiSkeleton-root": { height: FAMILY_TILE_HEIGHT } }}
        />
      </Stack>
    );
  }
  if (index.isError) {
    return (
      <ErrorState
        compact
        error={index.error}
        context="creature families"
        onRetry={() => void index.refetch()}
      />
    );
  }
  if ((index.data ?? []).length === 0) {
    return (
      <EmptyState
        compact
        icon={<PetsRoundedIcon />}
        title="No creature families listed"
        description="Blizzard returned an empty creature family index for this region."
      />
    );
  }
  if (loadedCount === 0 && catalog.failed.length > 0) {
    return (
      <ErrorState
        compact
        error={catalog.shownError}
        context="creature families"
        onRetry={catalog.retryFailed}
      />
    );
  }

  return (
    <Stack spacing={3}>
      {/* No error yet only when a remount is already retrying records this
          page never saw fail: their tiles or the banner follow. */}
      {catalog.failed.length > 0 && catalog.shownError ? (
        <ErrorState
          compact
          error={catalog.shownError}
          title={`${pluralize(catalog.failed.length, "family", "families")} could not be loaded`}
          context="these families"
          onRetry={catalog.retryFailed}
          retryLabel={catalog.retrying ? "Retrying…" : "Retry"}
        />
      ) : null}

      {groups.map((group) => (
        <SpecGroup
          key={group.specialization.id}
          group={group}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}

      {others.length > 0 ? (
        <Accordion
          disableGutters
          slotProps={{ transition: { unmountOnExit: true } }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreRoundedIcon />}
            id={`${otherId}-summary`}
            aria-controls={`${otherId}-details`}
            sx={{ px: 2 }}
          >
            <Stack spacing={0.25} sx={{ minWidth: 0, py: 0.5 }}>
              <Typography id={`${otherId}-title`} variant="subtitle1" component="span">
                {`Other families (${formatNumber(others.length)})`}
              </Typography>
              <Typography variant="caption" color="text.secondary" component="span">
                Families with no hunter pet specialization, such as warlock
                demons and other classes&apos; summoned minions
              </Typography>
            </Stack>
          </AccordionSummary>
          {/* The Accordion gives its region the summary's aria-controls as id. */}
          <AccordionDetails sx={{ px: 2, pb: 2 }}>
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
                Blizzard&apos;s creature search lists no creatures for these
                families, so they are here for reference only.
              </Typography>
              <OtherFamilyList labelledBy={`${otherId}-title`} families={others} />
            </Stack>
          </AccordionDetails>
        </Accordion>
      ) : null}
    </Stack>
  );
};

export default PetFamilyGallery;
