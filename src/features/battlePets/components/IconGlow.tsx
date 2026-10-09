import { Box } from "@mui/material";
import { useState } from "react";

/**
 * A blurred, enlarged copy of a 56px icon behind a card's header: too small
 * to show as art, blurred it still gives each card the pet's own colours.
 * Decorative (hidden from assistive tech), and nothing at all when there is
 * no icon or it fails to load (Blizzard's render host has not caught up
 * with the newest pets' icons yet).
 */
const IconGlow = ({ src }: { src: string | null | undefined }): JSX.Element | null => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) {
    return null;
  }
  return (
    <Box
      aria-hidden="true"
      sx={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        maskImage: "linear-gradient(to bottom, #000 0%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, #000 0%, transparent 100%)",
      }}
    >
      <Box
        component="img"
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailedSrc(src)}
        sx={{
          position: "absolute",
          top: "-30%",
          left: "-15%",
          width: "130%",
          height: "160%",
          objectFit: "cover",
          filter: "blur(22px) saturate(1.4)",
          opacity: 0.45,
        }}
      />
    </Box>
  );
};

export default IconGlow;
