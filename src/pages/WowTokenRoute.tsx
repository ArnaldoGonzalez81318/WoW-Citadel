import MonetizationOnRoundedIcon from "@mui/icons-material/MonetizationOnRounded";
import { Stack } from "@mui/material";

import PageHeader from "@/components/common/PageHeader";
import WowTokenPage from "@/features/search/components/WowTokenPage";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

/**
 * /category/wow-token: the live regional token price plus the price history
 * collected while the app is open.
 *
 * This route owns the single h1; WowTokenPage renders the ticker (which
 * carries the refresh cadence read from the query config) and the session
 * history section, with no page-level heading of its own.
 */
const WowTokenRoute = ({
  eyebrow,
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => (
  <Stack sx={{ gap: (theme) => theme.wc.layout.sectionGap }}>
    <PageHeader
      eyebrow={eyebrow}
      breadcrumbs={breadcrumbs}
      title="WoW Token"
      description="Current regional WoW Token price from Blizzard's commodity endpoint, with the price history collected during this session."
      documentTitle="WoW Token"
      icon={<MonetizationOnRoundedIcon />}
    />
    <WowTokenPage />
  </Stack>
);

export default WowTokenRoute;
