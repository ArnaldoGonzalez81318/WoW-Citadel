import { Box } from "@mui/material";
import { alpha } from "@mui/material/styles";

import type { HeirloomTier } from "@/features/heirlooms/types";
import { qualityColor } from "@/theme";

export type TierBarsProps = {
  tiers: readonly HeirloomTier[];
  /** The item level a full bar stands for (the collection's highest), so cards compare. */
  ceiling: number;
  /** Bar height in px. */
  height?: number;
};

/** Below this share of the ceiling a bar would vanish; it still shows a stub. */
const MIN_SHARE = 0.18;

/**
 * An heirloom's upgrade ladder at a glance: one bar per upgrade level,
 * as tall as its item level against the collection's highest. Purely
 * decorative (the card says "Item level 34–69" in words, and the upgrade
 * count to screen readers).
 */
const TierBars = ({ tiers, ceiling, height = 16 }: TierBarsProps): JSX.Element | null => {
  if (tiers.length === 0) {
    return null;
  }
  const last = tiers.length - 1;
  return (
    <Box
      aria-hidden="true"
      sx={{ display: "flex", alignItems: "flex-end", gap: "2px", height, flexShrink: 0 }}
    >
      {tiers.map((tier, index) => {
        const share =
          tier.itemLevel !== null && ceiling > 0
            ? Math.min(1, Math.max(MIN_SHARE, tier.itemLevel / ceiling))
            : MIN_SHARE;
        return (
          <Box
            key={tier.upgrade ?? `i${index}`}
            sx={(theme) => ({
              width: 4,
              height: `${share * 100}%`,
              borderRadius: "1px",
              // Brighter as the ladder climbs: the top upgrade reads first.
              backgroundColor: alpha(
                qualityColor(theme, "heirloom"),
                last === 0 ? 0.9 : 0.35 + (0.55 * index) / last,
              ),
            })}
          />
        );
      })}
    </Box>
  );
};

export default TierBars;
