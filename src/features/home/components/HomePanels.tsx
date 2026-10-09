import { Stack } from "@mui/material";

import { AppErrorBoundary } from "@/components/common/RouteErrorBoundary";
import MythicPlusPanel from "@/features/home/components/MythicPlusPanel";
import PvpCutoffsPanel from "@/features/home/components/PvpCutoffsPanel";
import RaidsPanel from "@/features/home/components/RaidsPanel";
import { tokens } from "@/theme";

/**
 * The home page's lazy chunk: this season's Mythic+ rotation, its raids and
 * the rated PvP title cutoffs. Each panel has its own boundary (with "Try
 * again", and the "new version" reload for a stale chunk), so a render bug
 * in one leaves the other two and the rest of the page in place.
 */
const HomePanels = (): JSX.Element => (
  <Stack spacing={tokens.wc.layout.sectionGap}>
    <AppErrorBoundary context="the Mythic+ rotation">
      <MythicPlusPanel />
    </AppErrorBoundary>
    <AppErrorBoundary context="this season's raids">
      <RaidsPanel />
    </AppErrorBoundary>
    <AppErrorBoundary context="the PvP title cutoffs">
      <PvpCutoffsPanel />
    </AppErrorBoundary>
  </Stack>
);

export default HomePanels;
