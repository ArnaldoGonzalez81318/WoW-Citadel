import { Box, Card, CardActionArea, Typography } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { memo, useId } from "react";

import MediaTile from "@/components/common/MediaTile";
import {
  LAYOUTS,
  assetKeyLabel,
  kindConfig,
  lowerFirst,
} from "@/features/mediaSearch/config/mediaKinds";
import type {
  MediaAsset,
  MediaLayout,
  MediaRecord,
} from "@/features/mediaSearch/types";
import { mixins } from "@/theme";

/** Two 18px caption lines, 4px apart, in 8px padding: the skeleton's text height. */
export const CARD_TEXT_HEIGHT = 56;
const LINE_HEIGHT = "18px";

const MOTION_HOVER = "@media (hover: hover)";
const MOTION_HOVER_LIFT =
  "@media (hover: hover) and (prefers-reduced-motion: no-preference)";

const cardSx = (theme: Theme) => ({
  height: "100%",
  display: "flex",
  overflow: "hidden",
  transition: theme.transitions.create(
    ["border-color", "box-shadow", "transform"],
    { duration: theme.wc.motion.base, easing: theme.wc.motion.easing },
  ),
  [MOTION_HOVER]: {
    "&:hover": {
      borderColor: theme.palette.border.strong,
      boxShadow: theme.palette.glow.card,
    },
  },
  [MOTION_HOVER_LIFT]: {
    "&:hover": { transform: "translateY(-2px)" },
  },
});

export type MediaStageProps = {
  asset: MediaAsset | undefined;
  layout: MediaLayout;
  /** Its first letter stands in when there is no image. */
  fallbackLabel: string;
};

/**
 * The image area of a card. Icons sit at their native 56 px (scaled up they
 * blur) on a fixed stage; renders and zone tiles fill a stage in their own
 * aspect ratio. In a mixed grid (Everything), anything that is not a 56 px
 * icon is fitted into a 72 px square so crests and atlases keep their shape.
 */
export const MediaStage = ({
  asset,
  layout,
  fallbackLabel,
}: MediaStageProps): JSX.Element => {
  const { stage } = LAYOUTS[layout];

  if ("aspect" in stage) {
    return (
      <Box sx={{ width: "100%", aspectRatio: stage.aspect, flexShrink: 0 }}>
        <MediaTile
          size="fill"
          aspect={stage.aspect}
          src={asset?.url}
          alt=""
          fallbackLabel={fallbackLabel}
        />
      </Box>
    );
  }

  return (
    <Box
      sx={(theme) => ({
        height: stage.height,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.palette.surface.sunken,
        borderBottom: `1px solid ${theme.palette.border.subtle}`,
      })}
    >
      {asset && asset.key !== "icon" ? (
        <Box sx={{ width: 72, height: 72 }}>
          <MediaTile
            size="fill"
            aspect="1 / 1"
            fit="contain"
            radius="sm"
            src={asset.url}
            alt=""
            fallbackLabel={fallbackLabel}
          />
        </Box>
      ) : (
        <MediaTile
          size={56}
          src={asset?.url}
          alt=""
          fallbackLabel={fallbackLabel}
        />
      )}
    </Box>
  );
};

/** The card's second line: the kind in a mixed grid, else the file id or the asset kind. */
const detailLine = (record: MediaRecord, showKind: boolean): string => {
  const kind = kindConfig(record.kind).label;
  if (showKind) {
    return kind;
  }
  const [asset] = record.assets;
  if (!asset) {
    return "No image";
  }
  if (asset.fileDataId !== null) {
    return `File ${asset.fileDataId}`;
  }
  return assetKeyLabel(asset.key);
};

export type MediaRecordCardProps = {
  record: MediaRecord;
  layout: MediaLayout;
  /** Name the kind on the card (Everything mixes them). */
  showKind?: boolean;
  onSelect: (record: MediaRecord) => void;
};

/**
 * One media record: its first image, its id and a detail line. The whole
 * card opens the detail dialog with every size and link.
 */
const MediaRecordCard = ({
  record,
  layout,
  showKind = false,
  onSelect,
}: MediaRecordCardProps): JSX.Element => {
  const kind = kindConfig(record.kind).label;
  // The button's aria-label replaces its content, so the visible detail line
  // is its description: the file id, or the kind in a mixed grid.
  const detailsId = useId();
  const [asset] = record.assets;

  return (
    <Card variant="outlined" sx={cardSx}>
      <CardActionArea
        onClick={() => onSelect(record)}
        aria-label={`View ${lowerFirst(kind)} media ${record.id}`}
        aria-describedby={detailsId}
        sx={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "flex-start",
          textAlign: "left",
          "& .MuiCardActionArea-focusHighlight": { display: "none" },
        }}
      >
        <MediaStage asset={asset} layout={layout} fallbackLabel={kind} />
        <Box
          sx={{
            height: CARD_TEXT_HEIGHT,
            px: { xs: 0.75, sm: 1 },
            py: 1,
            display: "flex",
            flexDirection: "column",
            gap: 0.5,
            minWidth: 0,
          }}
        >
          <Typography
            variant="body2"
            component="span"
            sx={{
              ...mixins.truncate,
              display: "block",
              lineHeight: LINE_HEIGHT,
              // Seven-digit spell ids fit a 320px phone's three columns.
              fontSize: { xs: "0.8125rem", sm: "0.875rem" },
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            #{record.id}
          </Typography>
          <Typography
            id={detailsId}
            variant="caption"
            component="span"
            color="text.secondary"
            sx={{
              ...mixins.truncate,
              display: "block",
              lineHeight: LINE_HEIGHT,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {detailLine(record, showKind)}
          </Typography>
        </Box>
      </CardActionArea>
    </Card>
  );
};

export default memo(MediaRecordCard);
