import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

import { toSxArray } from "@/lib/sx";

export type IconBackdropProps = {
  src?: string | null;
  /** Peak opacity of the blurred art (it fades out towards the bottom). */
  opacity?: number;
  sx?: SxProps<Theme>;
};

/**
 * A blurred, enlarged copy of an icon behind a tile or header. Blizzard's
 * profession and recipe icons top out at 56px, too small to show as art;
 * blurred they still give each card its profession's colour. Purely
 * decorative: hidden from assistive tech, and nothing when there is no icon.
 */
const IconBackdrop = ({ src, opacity = 0.4, sx }: IconBackdropProps): JSX.Element | null => {
  if (!src) {
    return null;
  }
  return (
    <Box
      aria-hidden="true"
      sx={[
        {
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          maskImage: "linear-gradient(to bottom, #000 0%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, #000 0%, transparent 100%)",
        },
        ...toSxArray(sx),
      ]}
    >
      <Box
        component="img"
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        sx={{
          position: "absolute",
          top: "-25%",
          left: "-25%",
          width: "150%",
          height: "150%",
          objectFit: "cover",
          filter: "blur(24px) saturate(1.4)",
          opacity,
        }}
      />
    </Box>
  );
};

export default IconBackdrop;
