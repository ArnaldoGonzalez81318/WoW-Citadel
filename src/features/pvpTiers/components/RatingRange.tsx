import { Box } from "@mui/material";

import { isOpenEnded } from "@/features/pvpTiers/services/tierLadder";
import type { PvpTier } from "@/features/pvpTiers/types";
import { formatNumber } from "@/lib/format";
import { visuallyHidden } from "@/theme";

export type RatingRangeProps = {
  tier: Pick<PvpTier, "minRating" | "maxRating">;
};

/**
 * "1,925 – 2,100", or "2,275+" for a tier without a ceiling. Screen readers
 * skip an en dash between numbers and read "+" as "plus", so the symbols are
 * hidden from them and the words ("to", "and above") are hidden from sight.
 */
const RatingRange = ({ tier }: RatingRangeProps): JSX.Element => (
  <Box
    component="span"
    sx={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}
  >
    {formatNumber(tier.minRating)}
    {isOpenEnded(tier) ? (
      <>
        <span aria-hidden="true">+</span>
        <Box component="span" sx={visuallyHidden}>
          {" and above"}
        </Box>
      </>
    ) : (
      <>
        <span aria-hidden="true">{" – "}</span>
        <Box component="span" sx={visuallyHidden}>
          {" to "}
        </Box>
        {formatNumber(tier.maxRating)}
      </>
    )}
  </Box>
);

export default RatingRange;
