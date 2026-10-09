import { Box, Link, Stack, Typography } from "@mui/material";
import type { MouseEvent, ReactNode } from "react";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import { AppErrorBoundary } from "@/components/common/RouteErrorBoundary";
import MythicPlusCard from "@/features/home/components/MythicPlusCard";
import PvpSeasonCard from "@/features/home/components/PvpSeasonCard";
import RaidsCard from "@/features/home/components/RaidsCard";
import { StripFocusScope } from "@/features/home/components/StripCard";
import TokenCard from "@/features/home/components/TokenCard";
import { DIRECTORY_ID } from "@/features/home/config/directory";
import { useNow } from "@/features/search/hooks/useNow";
import { env } from "@/lib/env";

const TITLE_ID = "home-week-title";

/*
 * A same-document fragment click is a POP navigation to the data router:
 * the new entry has no history state, so it reads as the tab's "default"
 * key, and ScrollRestoration restores whatever position it saved under
 * that key (often the top) before it ever looks at the hash, undoing the
 * jump. Handled here, as SkipLink and the API dataset gallery do, the
 * router stays out of it; the href stays for semantics and without
 * JavaScript, the hash is still written to the URL, scrollIntoView honours
 * the directory's scroll-margin-top, and focus moves with it, so the next
 * Tab continues inside the directory. A modified click (new tab or window)
 * keeps the browser's own behaviour.
 */
const jumpToDirectory = (event: MouseEvent<HTMLAnchorElement>): void => {
  const target = document.getElementById(DIRECTORY_ID);
  const modified =
    event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
  if (!target || modified) {
    return;
  }
  event.preventDefault();
  window.history.replaceState(window.history.state, "", `#${DIRECTORY_ID}`);
  if (!target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
  }
  target.scrollIntoView({ block: "start" });
  target.focus({ preventScroll: true });
};

const Item = ({ context, children }: { context: string; children: ReactNode }): JSX.Element => (
  <Box component="li" sx={{ minWidth: 0 }}>
    {/* A render bug in one card leaves the other three standing. */}
    <AppErrorBoundary context={context}>{children}</AppErrorBoundary>
  </Box>
);

/**
 * "This week in Azeroth": four live headlines, each a link to the explorer
 * that goes deeper. On the first screen at every width, so it is kept to
 * nine small requests (about 18 KB, no images): the Mythic+ season and its
 * current week, the journal's Current Season tier, the rated PvP season and
 * the token price, all through the explorers' own query keys, so opening
 * one of them afterwards shows its data at once. One clock (30 s) drives
 * every relative time in the row.
 */
const ThisWeekStrip = (): JSX.Element => {
  const now = useNow();
  return (
    <Box component="section" aria-labelledby={TITLE_ID} sx={{ minWidth: 0 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "flex-end" }}
        flexWrap="wrap"
        useFlexGap
        gap={1}
        sx={{ mb: 2 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography id={TITLE_ID} variant="h5" component="h2" sx={{ m: 0 }}>
            This week in Azeroth
          </Typography>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
            {`Live from Blizzard's game-data API · ${env.region.toUpperCase()} region`}
          </Typography>
        </Box>
        <Link href={`#${DIRECTORY_ID}`} onClick={jumpToDirectory} variant="body2" underline="hover">
          All explorers
        </Link>
      </Stack>

      <StripFocusScope>
        <Box
          component="ul"
          // Safari drops the list role from a list-style:none list without it.
          role="list"
          sx={{
            listStyle: "none",
            m: 0,
            p: 0,
            display: "grid",
            gap: 2,
            ...gridTemplateColumnsSx({ xs: 1, sm: 2, lg: 4 }),
          }}
        >
          <Item context="the Mythic+ card">
            <MythicPlusCard now={now} />
          </Item>
          <Item context="the Raids card">
            <RaidsCard />
          </Item>
          <Item context="the rated PvP card">
            <PvpSeasonCard now={now} />
          </Item>
          <Item context="the WoW Token card">
            <TokenCard now={now} />
          </Item>
        </Box>
      </StripFocusScope>
    </Box>
  );
};

export default ThisWeekStrip;
