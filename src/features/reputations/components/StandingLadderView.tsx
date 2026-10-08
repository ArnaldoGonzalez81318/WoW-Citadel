import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { Box, Button, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useId, useState } from "react";

import LadderStrip from "@/features/reputations/components/LadderStrip";
import { ladderColors } from "@/features/reputations/services/reputationPalette";
import {
  isFinalTier,
  ladderSpan,
  tierNoun,
} from "@/features/reputations/services/reputationService";
import type { LadderKind, StandingLadder, StandingTier } from "@/features/reputations/types";
import { formatNumber } from "@/lib/format";
import { visuallyHidden } from "@/theme";

/** Longer ladders (a delve companion's 80 levels) open on their first ten. */
const COLLAPSE_OVER = 12;
const COLLAPSED_COUNT = 10;

/**
 * "3,000 – 9,000", or "From 42,000" for the final standing. Screen readers
 * skip an en dash between numbers, so it is hidden from them and the word
 * "to" from sight.
 */
const TierRange = ({ tier }: { tier: StandingTier }): JSX.Element => (
  <Box component="span" sx={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
    {isFinalTier(tier) ? (
      `From ${formatNumber(tier.min)}`
    ) : (
      <>
        {formatNumber(tier.min)}
        <span aria-hidden="true">{" – "}</span>
        <Box component="span" sx={visuallyHidden}>
          {" to "}
        </Box>
        {formatNumber(tier.max)}
      </>
    )}
  </Box>
);

export type StandingLadderViewProps = {
  ladder: StandingLadder;
  kind: LadderKind;
};

/**
 * A ladder in full: the strip of standing colours, then one row per standing
 * with its range and a bar as long as the points it takes (Revered's 21,000
 * dwarfs Friendly's 6,000), lowest first. The rows are the data; the strip
 * and the bars only draw it.
 */
const StandingLadderView = ({ ladder, kind }: StandingLadderViewProps): JSX.Element => {
  const theme = useTheme();
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const colors = ladderColors(theme, ladder);
  const tiers = ladder.tiers;
  const first = tiers[0];
  const last = tiers[tiers.length - 1];
  const widest = Math.max(1, ...tiers.map((tier) => (isFinalTier(tier) ? 0 : tier.max - tier.min)));
  const collapsible = tiers.length > COLLAPSE_OVER;
  const shown = collapsible && !expanded ? tiers.slice(0, COLLAPSED_COUNT) : tiers;
  const noun = kind === "standard" ? "Standings" : "Ranks";

  if (!first || !last) {
    return (
      <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
        Blizzard lists no standings for this ladder.
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
        {tierNoun(kind, tiers.length)}
        {first !== last
          ? ` · ${formatNumber(ladderSpan(ladder))} points from ${first.name} to ${last.name}`
          : null}
      </Typography>

      <Box>
        <LadderStrip colors={colors} height={10} />
        <Stack
          direction="row"
          justifyContent="space-between"
          aria-hidden="true"
          sx={{ mt: 0.5, typography: "caption", color: "text.secondary" }}
        >
          <span>{first.name}</span>
          {first !== last ? <span>{last.name}</span> : null}
        </Stack>
      </Box>

      <Box
        component="ol"
        id={listId}
        role="list"
        aria-label={noun}
        sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 0.75 }}
      >
        {shown.map((tier, index) => {
          const final = isFinalTier(tier);
          const span = tier.max - tier.min;
          return (
            <Box
              component="li"
              key={tier.id}
              sx={(themeArg) => ({
                display: "grid",
                alignItems: "center",
                columnGap: 1.25,
                rowGap: 0.5,
                gridTemplateColumns: {
                  xs: "12px minmax(0, 1fr) auto",
                  sm: "12px minmax(96px, 9.5rem) minmax(0, 1fr) minmax(7.5rem, auto)",
                },
                gridTemplateAreas: {
                  xs: `"swatch name range" ". bar bar"`,
                  sm: `"swatch name bar range"`,
                },
                px: 1.25,
                py: 0.75,
                borderRadius: `${themeArg.wc.radius.sm}px`,
                backgroundColor: themeArg.palette.surface.inset,
              })}
            >
              <Box
                aria-hidden="true"
                sx={{
                  gridArea: "swatch",
                  width: 12,
                  height: 12,
                  borderRadius: "3px",
                  backgroundColor: colors[index],
                }}
              />
              <Typography
                variant="body2"
                component="span"
                sx={{ gridArea: "name", fontWeight: 600, minWidth: 0, overflowWrap: "anywhere" }}
              >
                {tier.name}
              </Typography>
              <Box sx={{ gridArea: "bar", minWidth: 0, display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  aria-hidden="true"
                  sx={(themeArg) => ({
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: themeArg.palette.surface.sunken,
                    overflow: "hidden",
                  })}
                >
                  {final ? null : (
                    <Box
                      sx={{
                        height: "100%",
                        width: `${Math.max(2, (span / widest) * 100)}%`,
                        borderRadius: 3,
                        backgroundColor: colors[index],
                      }}
                    />
                  )}
                </Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  component="span"
                  sx={{ flexShrink: 0, fontVariantNumeric: "tabular-nums", minWidth: { sm: "6.5rem" } }}
                >
                  {final
                    ? kind === "standard"
                      ? "Top standing"
                      : "Top rank"
                    : `${formatNumber(span)} points`}
                </Typography>
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                component="span"
                sx={{ gridArea: "range", justifySelf: "end", textAlign: "right" }}
              >
                <TierRange tier={tier} />
              </Typography>
            </Box>
          );
        })}
      </Box>

      {collapsible ? (
        <Button
          size="small"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={listId}
          endIcon={
            <ExpandMoreRoundedIcon
              sx={(themeArg) => ({
                transform: expanded ? "rotate(180deg)" : "none",
                transition: themeArg.transitions.create("transform", {
                  duration: themeArg.wc.motion.fast,
                }),
              })}
            />
          }
          sx={{ alignSelf: "flex-start" }}
        >
          {expanded ? `Show the first ${COLLAPSED_COUNT}` : `Show all ${formatNumber(tiers.length)} ${noun.toLowerCase()}`}
        </Button>
      ) : null}
    </Stack>
  );
};

export default StandingLadderView;
