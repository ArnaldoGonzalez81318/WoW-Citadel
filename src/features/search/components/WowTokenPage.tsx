import TokenRounded from "@mui/icons-material/TokenRounded";
import { Chip, Stack } from "@mui/material";

import PageHeader from "@/components/common/PageHeader";
import { NAV_SECTIONS } from "@/components/layout/navigation/navConfig";
import TokenTicker from "@/features/search/components/TokenTicker";
import { env } from "@/lib/env";
import { tokens } from "@/theme";

const SECTION_GAP = tokens.wc.layout.sectionGap;

const WOW_TOKEN_PATH = "/category/wow-token";

/** The nav section that lists the WoW Token, used as the page eyebrow. */
const EYEBROW =
  NAV_SECTIONS.find((section) =>
    section.items.some((item) => item.path === WOW_TOKEN_PATH),
  )?.label ?? "Economy";

/**
 * WoW Token explorer: the live regional token price. Not routed yet —
 * `CategoryPage` still serves `/category/wow-token` until the search package
 * switches it over to this page.
 */
const WowTokenPage = (): JSX.Element => (
  <Stack spacing={SECTION_GAP}>
    <PageHeader
      eyebrow={EYEBROW}
      title="WoW Token"
      description="The current WoW Token price for your region, straight from Blizzard's Game Data API."
      icon={<TokenRounded />}
      meta={<Chip size="small" label={`Region ${env.region.toUpperCase()}`} />}
    />
    <TokenTicker />
  </Stack>
);

export default WowTokenPage;
