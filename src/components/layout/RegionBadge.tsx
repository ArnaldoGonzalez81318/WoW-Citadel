import { Box, Chip } from "@mui/material";

import { env } from "@/lib/env";
import { formatLocale } from "@/lib/format";
import { visuallyHidden } from "@/theme";

export type RegionBadgeProps = {
  size?: "small" | "medium";
};

/**
 * The API region and locale the app is actually configured with. The Chip is
 * not interactive (a generic div), where aria-label is prohibited and would
 * replace the value; the spoken prefix is real text, hidden visually.
 */
const RegionBadge = ({ size = "small" }: RegionBadgeProps): JSX.Element => (
  <Chip
    size={size}
    variant="outlined"
    label={
      <>
        <Box component="span" sx={visuallyHidden}>
          API region and locale:{" "}
        </Box>
        {`Region ${env.region.toUpperCase()} · ${formatLocale(env.locale)}`}
      </>
    }
    sx={{ color: "text.secondary", alignSelf: "flex-start" }}
  />
);

export default RegionBadge;
