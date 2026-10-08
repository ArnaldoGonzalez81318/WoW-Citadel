import { Box } from "@mui/material";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import { LoadingSkeleton } from "@/components/common/StateBlocks";
import MediaRecordCard, {
  CARD_TEXT_HEIGHT,
} from "@/features/mediaSearch/components/MediaRecordCard";
import { LAYOUTS } from "@/features/mediaSearch/config/mediaKinds";
import type { MediaLayout, MediaRecord } from "@/features/mediaSearch/types";

/** Tighter on phones, where three icon columns share about 250px. */
const GRID_GAP = { xs: "8px", sm: "12px" };
const SKELETON_GAP_PX = 12;
/** The outlined card's top and bottom border. */
const CARD_BORDER_PX = 2;

export type MediaRecordGridProps = {
  /** Accessible name of the list. */
  label: string;
  records: readonly MediaRecord[];
  layout: MediaLayout;
  showKind?: boolean;
  /** A newer page is loading over this one. */
  busy?: boolean;
  onSelect: (record: MediaRecord) => void;
};

/** A list of media cards in the layout's columns. */
const MediaRecordGrid = ({
  label,
  records,
  layout,
  showKind = false,
  busy = false,
  onSelect,
}: MediaRecordGridProps): JSX.Element => (
  <Box
    component="ul"
    // Safari drops list semantics from a ul without bullets unless told.
    role="list"
    aria-label={label}
    aria-busy={busy || undefined}
    sx={(theme) => ({
      display: "grid",
      gap: GRID_GAP,
      listStyle: "none",
      margin: 0,
      padding: 0,
      ...gridTemplateColumnsSx(LAYOUTS[layout].columns),
      // The page being replaced dims until the next one lands.
      opacity: busy ? 0.6 : 1,
      transition: theme.transitions.create("opacity", {
        duration: theme.wc.motion.fast,
      }),
    })}
  >
    {records.map((record) => (
      <Box component="li" key={record.path} sx={{ minWidth: 0 }}>
        <MediaRecordCard
          record={record}
          layout={layout}
          showKind={showKind}
          onSelect={onSelect}
        />
      </Box>
    ))}
  </Box>
);

export type MediaGridSkeletonProps = {
  layout: MediaLayout;
  count: number;
  label: string;
};

/**
 * Skeleton cells in the cards' shape: a fixed icon stage, or art as tall as
 * its aspect ratio makes it at the cell's width, plus the text block, so
 * the grid does not jump at any breakpoint when the page lands.
 */
export const MediaGridSkeleton = ({
  layout,
  count,
  label,
}: MediaGridSkeletonProps): JSX.Element => {
  const { columns, stage } = LAYOUTS[layout];
  const textHeight = CARD_TEXT_HEIGHT + CARD_BORDER_PX;

  if ("height" in stage) {
    return (
      <LoadingSkeleton
        variant="grid"
        columns={columns}
        gap={SKELETON_GAP_PX}
        itemHeight={stage.height + textHeight}
        count={count}
        label={label}
        sx={{ gap: GRID_GAP }}
      />
    );
  }

  return (
    <LoadingSkeleton
      variant="grid"
      columns={columns}
      gap={SKELETON_GAP_PX}
      count={count}
      label={label}
      sx={{
        gap: GRID_GAP,
        "& > .MuiSkeleton-root": { height: "auto" },
        "& > .MuiSkeleton-root::before": {
          content: '""',
          display: "block",
          paddingTop: `calc(${stage.ratioPercent}% + ${textHeight}px)`,
        },
      }}
    />
  );
};

export default MediaRecordGrid;
