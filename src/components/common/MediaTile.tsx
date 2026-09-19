import { Box, Skeleton } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import type { SxProps, Theme } from "@mui/material/styles";
import { useState } from "react";

import { qualityColor } from "@/theme";
import type { WcRadius } from "@/theme";

export type MediaTileSize = 40 | 56 | "fill";

export type MediaTileRadius = keyof WcRadius | "none";

export type MediaTileProps = {
  /** Image URL. Missing or failed images fall back to an initial-letter tile. */
  src?: string | null;
  /**
   * Alt text. Pass `""` when the entity name is rendered next to the tile
   * (the image is then decorative and not announced twice).
   */
  alt: string;
  /** 40 / 56 px square icon tile, or `fill` the parent (16:9 by default). */
  size?: MediaTileSize;
  /** CSS aspect ratio used by `fill` when the parent has no fixed height. */
  aspect?: string;
  /** Text whose first letter is shown when there is no image. */
  fallbackLabel: string;
  /** WoW item quality; tints the tile border. */
  quality?: string | null;
  /** Renders a skeleton instead of the image. */
  loading?: boolean;
  /** Corner radius token (defaults: `sm` for icons, `none` for `fill`). */
  radius?: MediaTileRadius;
  /** How `fill` media is fitted (default `cover`; `contain` frames artwork). */
  fit?: "cover" | "contain";
  sx?: SxProps<Theme>;
};

const initialOf = (label: string): string => {
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed.charAt(0).toLocaleUpperCase() : "?";
};

/**
 * Plain `img` (not Box: Box would turn the `width` / `height` attributes into
 * CSS and drop them from the markup).
 */
const Img = styled("img")({
  display: "block",
  width: "100%",
  height: "100%",
  imageRendering: "auto",
});

const fallbackFontSize = (size: MediaTileSize): string => {
  if (size === 40) {
    return "1rem";
  }
  if (size === 56) {
    return "1.375rem";
  }
  return "2rem";
};

/**
 * One image tile for every card, dialog and list row: lazy, async-decoded,
 * sized up front (no layout shift), with an initial-letter fallback.
 */
const MediaTile = ({
  src,
  alt,
  size = 56,
  aspect = "16/9",
  fallbackLabel,
  quality,
  loading = false,
  radius,
  fit = "cover",
  sx,
}: MediaTileProps): JSX.Element => {
  // Remember which URL failed so a new `src` gets a fresh attempt without an effect.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const hasSrc = typeof src === "string" && src.length > 0;
  const failed = hasSrc && failedSrc === src;
  const showImage = hasSrc && !failed && !loading;
  const isFill = size === "fill";
  const resolvedRadius: MediaTileRadius = radius ?? (isFill ? "none" : "sm");
  const decorative = alt.trim().length === 0;

  const rootSx: SxProps<Theme> = (theme) => ({
    position: "relative",
    flexShrink: 0,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    backgroundColor: theme.palette.surface.sunken,
    border: `1px solid ${
      quality
        ? alpha(qualityColor(theme, quality), 0.6)
        : theme.palette.border.subtle
    }`,
    borderRadius:
      resolvedRadius === "none" ? "0" : `${theme.wc.radius[resolvedRadius]}px`,
    ...(isFill
      ? {
          width: "100%",
          // Fills a fixed-height parent; otherwise the aspect ratio sizes it.
          height: "100%",
          aspectRatio: aspect,
        }
      : {
          width: size,
          height: size,
        }),
  });

  return (
    <Box sx={[rootSx, ...(Array.isArray(sx) ? sx : [sx])]}>
      {loading ? (
        <Skeleton
          variant="rectangular"
          animation="wave"
          sx={{ width: "100%", height: "100%", borderRadius: "0" }}
        />
      ) : showImage ? (
        <Img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          width={isFill ? undefined : size}
          height={isFill ? undefined : size}
          onError={() => setFailedSrc(src)}
          sx={{ objectFit: isFill ? fit : "contain" }}
        />
      ) : (
        <Box
          component="span"
          role={decorative ? undefined : "img"}
          aria-label={decorative ? undefined : alt}
          aria-hidden={decorative ? true : undefined}
          sx={(theme) => ({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            fontWeight: 700,
            fontSize: fallbackFontSize(size),
            lineHeight: 1,
            letterSpacing: "-0.02em",
            userSelect: "none",
            color: quality
              ? qualityColor(theme, quality)
              : theme.palette.text.secondary,
          })}
        >
          {initialOf(fallbackLabel)}
        </Box>
      )}
    </Box>
  );
};

export default MediaTile;
