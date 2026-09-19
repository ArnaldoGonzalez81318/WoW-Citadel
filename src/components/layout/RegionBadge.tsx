import { Chip } from "@mui/material";

import { env } from "@/lib/env";
import { formatLocale } from "@/lib/format";

export type RegionBadgeProps = {
  size?: "small" | "medium";
};

/** The API region and locale the app is actually configured with. */
const RegionBadge = ({ size = "small" }: RegionBadgeProps): JSX.Element => (
  <Chip
    size={size}
    variant="outlined"
    aria-label="API region and locale"
    label={`Region ${env.region.toUpperCase()} · ${formatLocale(env.locale)}`}
    sx={{ color: "text.secondary", alignSelf: "flex-start" }}
  />
);

export default RegionBadge;
