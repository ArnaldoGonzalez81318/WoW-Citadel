import {
  Box,
  Card,
  CardActionArea,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useId } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import MediaTile from "@/components/common/MediaTile";
import {
  isMouseLike,
  preloadRouteChunk,
} from "@/components/layout/navigation/navUtils";
import {
  cardActionAreaSx,
  selectableCardSx,
} from "@/features/professions/components/cardStyles";
import useNearViewport from "@/hooks/useNearViewport";
import { mixins } from "@/theme";

/*
 * Kept light on purpose (MUI, MediaTile, the shared card styles, the
 * viewport hook and the shell's route preloader): the eager Suspense
 * fallback imports TileSkeleton from here, so this module must not pull
 * any query or service code into the home page's first chunk.
 */

/** Both panels' grids: 8 dungeons fill two rows of four on large screens, 7 raids four and three. */
export const TILE_COLUMNS: GridColumns = { xs: 1, sm: 2, md: 3, lg: 4 };

/** A tile starts its requests one short scroll before it shows. */
const TILE_MARGIN = "0px 0px 160px 0px";

/** Phones: a row with a 112px-wide thumbnail. From sm up: the explorers' 2:1 art card. */
const ART_SX = {
  width: { xs: 112, sm: "100%" },
  flexShrink: 0,
  aspectRatio: "2 / 1",
} as const;

/** Phones keep the row short (about 90px): 15 tiles are a long scroll otherwise. */
const TEXT_SX = {
  p: { xs: 1.25, sm: 2 },
  gap: { xs: 0.5, sm: 1 },
  minWidth: 0,
  flex: 1,
  minHeight: { sm: 104 },
} as const;

const LAYOUT_SX = {
  flexDirection: { xs: "row", sm: "column" },
  alignItems: { xs: "center", sm: "stretch" },
} as const;

export type SeasonTileProps = {
  id: number;
  /** Shown at once, from the season or tier record. */
  name: string;
  to: string;
  /** Starts with the visible name (WCAG 2.5.3), e.g. "Altar of Fangs, this week's top runs". */
  ariaLabel: string;
  imageUrl?: string | null;
  /** The tile's record is not in yet (or not requested yet). */
  pending: boolean;
  /** The record failed and there is nothing to show. */
  failed: boolean;
  /** "Battle for Azeroth · Zuldazar". */
  origin?: string;
  /** Shown in place of the origin when the record says there is nothing (a 404). */
  note?: string;
  footer?: ReactNode;
  onNear: (id: number) => void;
};

/**
 * One dungeon or raid: its zone art, its name and where it is, and a
 * footer of facts. The whole card is one link. It reports when it nears
 * the viewport, and the panel then enables its query (see useNearIds).
 */
const SeasonTile = ({
  id,
  name,
  to,
  ariaLabel,
  imageUrl,
  pending,
  failed,
  origin,
  note,
  footer,
  onNear,
}: SeasonTileProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>(TILE_MARGIN);
  useEffect(() => {
    if (near) {
      onNear(id);
    }
  }, [near, id, onNear]);

  // The link's aria-label replaces its content, so the visible details are
  // its description: what tells two tiles apart by ear.
  const detailsId = useId();
  const originText = pending ? undefined : (origin ?? note);
  // The chunk preloader keys category routes on the path; a query string would read as the slug.
  const preload = (): void => preloadRouteChunk(to.split("?")[0]);
  const describedBy = [
    originText ? `${detailsId}-origin` : undefined,
    failed ? `${detailsId}-failed` : undefined,
    !pending && footer ? `${detailsId}-footer` : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Card ref={nearRef} variant="outlined" sx={selectableCardSx()}>
      <CardActionArea
        component={RouterLink}
        to={to}
        aria-label={ariaLabel}
        aria-describedby={describedBy || undefined}
        onPointerEnter={(event: ReactPointerEvent<HTMLAnchorElement>) => {
          if (isMouseLike(event)) {
            preload();
          }
        }}
        onFocus={preload}
        sx={{ ...cardActionAreaSx, ...LAYOUT_SX }}
      >
        {/* The tile fills its parent; this box gives it the art's 2:1 shape (600×300). */}
        <Box sx={ART_SX}>
          <MediaTile
            size="fill"
            aspect="2 / 1"
            src={imageUrl ?? undefined}
            alt=""
            fallbackLabel={name}
            loading={pending}
          />
        </Box>
        {/* useFlexGap: Stack's sibling margins would override the footer's marginTop auto. */}
        <Stack useFlexGap sx={TEXT_SX}>
          {/*
            No heading inside a link; its aria-label names the card. The
            name wraps to a second line rather than truncating: at 320px the
            phone row leaves it about 114px, and touch has no tooltip.
          */}
          <Typography variant="subtitle1" component="span" sx={{ ...mixins.lineClamp(2), m: 0 }}>
            {name}
          </Typography>

          {pending ? (
            <Skeleton variant="text" width="60%" sx={{ fontSize: "0.75rem" }} />
          ) : originText ? (
            <Typography
              id={`${detailsId}-origin`}
              variant="caption"
              color="text.secondary"
              component="span"
              sx={{ ...mixins.truncate, display: "block", m: 0 }}
            >
              {originText}
            </Typography>
          ) : null}

          {failed ? (
            <Typography
              id={`${detailsId}-failed`}
              variant="caption"
              color="text.secondary"
              component="span"
              sx={{ display: "block", m: 0 }}
            >
              Details unavailable
            </Typography>
          ) : null}

          {pending ? (
            <Skeleton variant="rounded" width={72} height={24} sx={{ mt: "auto" }} />
          ) : footer ? (
            <Stack
              id={`${detailsId}-footer`}
              direction="row"
              flexWrap="wrap"
              useFlexGap
              gap={1}
              alignItems="center"
              sx={{ mt: "auto", minWidth: 0 }}
            >
              {footer}
            </Stack>
          ) : null}
        </Stack>
      </CardActionArea>
    </Card>
  );
};

/** A tile's shape with nothing in it: same art box, same text block, same footer. */
export const TileSkeleton = (): JSX.Element => (
  <Paper
    variant="outlined"
    sx={{ display: "flex", overflow: "hidden", height: "100%", ...LAYOUT_SX }}
  >
    <Box sx={ART_SX}>
      <Skeleton variant="rectangular" sx={{ width: "100%", height: "100%" }} />
    </Box>
    <Stack useFlexGap sx={TEXT_SX}>
      <Skeleton variant="text" width="70%" sx={{ fontSize: "1rem" }} />
      <Skeleton variant="text" width="60%" sx={{ fontSize: "0.75rem" }} />
      <Skeleton variant="rounded" width={72} height={24} sx={{ mt: "auto" }} />
    </Stack>
  </Paper>
);

/** A panel's grid while the season or tier record loads. */
export const TileGridSkeleton = ({
  count,
  label,
}: {
  count: number;
  label: string;
}): JSX.Element => (
  <Box
    role="status"
    aria-label={label}
    aria-busy="true"
    sx={{ display: "grid", gap: 2, ...gridTemplateColumnsSx(TILE_COLUMNS) }}
  >
    {Array.from({ length: count }, (_, index) => (
      <TileSkeleton key={index} />
    ))}
  </Box>
);

export default SeasonTile;
