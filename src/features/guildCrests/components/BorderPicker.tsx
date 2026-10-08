import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import { Box, ButtonBase, Skeleton, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { memo } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import GuildCrest from "@/features/guildCrests/components/GuildCrest";
import useCrestArt from "@/features/guildCrests/hooks/useCrestArt";
import type { CrestColor, CrestPart } from "@/features/guildCrests/types";

/** Six borders: one row on wide screens, tiles big enough to tell them apart. */
export const BORDER_COLS: GridColumns = { xs: 2, sm: 3, lg: 6 };
/** The `border` framing's aspect ratio (see GuildCrest). */
export const BORDER_TILE_ASPECT = "159 / 171";

type SharedLook = {
  emblemSrc?: string;
  emblemColor?: CrestColor;
  borderColor?: CrestColor;
  backgroundColor?: CrestColor;
  /** Bumped by the designer's Retry: remounts each tile's crest, so a failed cloth loads again. */
  clothAttempt?: number;
  onClothError?: () => void;
};

type BorderTileProps = SharedLook & {
  border: CrestPart;
  pressed: boolean;
  onSelect: (borderId: number) => void;
};

/** One border, previewed on the crest as it stands (emblem and colours included). */
const BorderTile = memo(function BorderTile({
  border,
  pressed,
  emblemSrc,
  emblemColor,
  borderColor,
  backgroundColor,
  clothAttempt = 0,
  onClothError,
  onSelect,
}: BorderTileProps): JSX.Element {
  const art = useCrestArt("border", border);

  return (
    <ButtonBase
      aria-pressed={pressed}
      aria-label={`Border ${border.id}${art.missing ? " (art unavailable)" : ""}`}
      onClick={() => onSelect(border.id)}
      sx={(theme) => ({
        position: "relative",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        overflow: "hidden",
        borderRadius: `${theme.wc.radius.md}px`,
        border: `1px solid ${pressed ? theme.palette.primary.main : theme.palette.border.subtle}`,
        boxShadow: pressed ? `inset 0 0 0 1px ${theme.palette.primary.main}` : "none",
        backgroundColor: theme.palette.surface.sunken,
        color: pressed ? theme.palette.text.primary : theme.palette.text.secondary,
        transition: theme.transitions.create(["border-color", "box-shadow"], {
          duration: theme.wc.motion.fast,
        }),
        "@media (hover: hover)": {
          "&:hover": {
            borderColor: pressed ? theme.palette.primary.main : theme.palette.border.strong,
          },
        },
      })}
    >
      <Box sx={{ position: "relative", width: "100%", aspectRatio: BORDER_TILE_ASPECT }}>
        {art.loading ? (
          <Skeleton
            variant="rectangular"
            animation="wave"
            sx={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          />
        ) : (
          <GuildCrest
            key={clothAttempt}
            framing="border"
            emblemSrc={emblemSrc}
            borderSrc={art.src}
            emblemColor={emblemColor}
            borderColor={borderColor}
            backgroundColor={backgroundColor}
            onBorderError={art.onError}
            onClothError={onClothError}
          />
        )}
        {art.missing ? (
          <Typography
            component="span"
            variant="caption"
            aria-hidden="true"
            sx={(theme) => ({
              position: "absolute",
              left: 8,
              right: 8,
              bottom: 8,
              textAlign: "center",
              borderRadius: `${theme.wc.radius.sm}px`,
              backgroundColor: alpha(theme.palette.surface.base, 0.8),
              color: theme.palette.text.secondary,
            })}
          >
            Art unavailable
          </Typography>
        ) : null}
        {pressed ? (
          <CheckCircleRounded
            aria-hidden="true"
            sx={(theme) => ({
              position: "absolute",
              top: 6,
              right: 6,
              fontSize: 20,
              color: theme.palette.primary.light,
              backgroundColor: theme.palette.surface.base,
              borderRadius: "50%",
            })}
          />
        ) : null}
      </Box>
      {/* The art is decorative; the label repeats this caption (plus a missing-art note). */}
      <Typography
        component="span"
        variant="caption"
        sx={{ display: "block", px: 1, py: 0.75, fontWeight: 600, textAlign: "center" }}
      >
        {`Border ${border.id}`}
      </Typography>
    </ButtonBase>
  );
});

export type BorderPickerProps = SharedLook & {
  borders: CrestPart[];
  value: number | null;
  onChange: (borderId: number) => void;
  /** Id of the visible "Borders" heading. */
  labelledBy: string;
};

/** Every border on the current crest, one pressed at a time. */
const BorderPicker = ({
  borders,
  value,
  onChange,
  labelledBy,
  ...look
}: BorderPickerProps): JSX.Element => (
  <Box
    component="ul"
    role="list"
    aria-labelledby={labelledBy}
    sx={{
      display: "grid",
      gap: 1.5,
      listStyle: "none",
      m: 0,
      p: 0,
      ...gridTemplateColumnsSx(BORDER_COLS),
    }}
  >
    {borders.map((border) => (
      <Box component="li" key={border.id} sx={{ minWidth: 0 }}>
        <BorderTile
          border={border}
          pressed={border.id === value}
          onSelect={onChange}
          {...look}
        />
      </Box>
    ))}
  </Box>
);

export default BorderPicker;
