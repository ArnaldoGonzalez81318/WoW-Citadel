import { Stack } from "@mui/material";

import ExplorerDirectory from "@/features/search/components/ExplorerDirectory";
import HomeHero from "@/features/search/components/HomeHero";
import TokenTicker from "@/features/search/components/TokenTicker";
import { tokens } from "@/theme";

const SECTION_GAP = tokens.wc.layout.sectionGap;

/**
 * Home: the hero (h1 + search form), the explorer directory and the compact
 * WoW Token card. Results live on `/search`; this page renders none.
 */
const HomePage = (): JSX.Element => (
  <Stack spacing={SECTION_GAP}>
    <HomeHero />
    <ExplorerDirectory />
    <TokenTicker compact />
  </Stack>
);

export default HomePage;
