import { Stack } from "@mui/material";
import { Suspense, lazy } from "react";

import { AppErrorBoundary } from "@/components/common/RouteErrorBoundary";
import ExplorerDirectory from "@/features/home/components/ExplorerDirectory";
import HomeHero from "@/features/home/components/HomeHero";
import HomePanelsFallback from "@/features/home/components/HomePanelsFallback";
import ThisWeekStrip from "@/features/home/components/ThisWeekStrip";
import { tokens } from "@/theme";

/**
 * The three season panels sit below the fold on every screen, so their code
 * (and the PvP cutoff grouping, faction tags and Hall of Fame config they
 * bring) loads in its own chunk instead of delaying the hero and the strip.
 */
const HomePanels = lazy(() => import("@/features/home/components/HomePanels"));

/**
 * Home: the hero (the page's h1 and primary search), this week's live
 * headlines, the season panels and the full explorer directory, in that
 * order at every width. Each block has its own error boundary, so one
 * failing source or render bug never blanks the rest of the page; the hero
 * and the directory need no request at all.
 */
const HomePage = (): JSX.Element => (
  <Stack spacing={tokens.wc.layout.sectionGap}>
    <HomeHero />
    <ThisWeekStrip />
    <AppErrorBoundary context="this season's highlights">
      <Suspense fallback={<HomePanelsFallback />}>
        <HomePanels />
      </Suspense>
    </AppErrorBoundary>
    <ExplorerDirectory />
  </Stack>
);

export default HomePage;
