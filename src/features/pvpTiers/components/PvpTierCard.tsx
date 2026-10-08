import { Box, Card, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import { useState } from "react";

import MediaTile from "@/components/common/MediaTile";
import RatingRange from "@/features/pvpTiers/components/RatingRange";
import type { PvpTierIcon } from "@/features/pvpTiers/hooks/usePvpTierIcons";
import {
  isOpenEnded,
  isUnrated,
  scalePercent,
} from "@/features/pvpTiers/services/tierLadder";
import type { PvpRatingScale, PvpTier } from "@/features/pvpTiers/types";
import { visuallyHidden } from "@/theme";

/**
 * The card's floor height per breakpoint: a row (emblem beside the text) on
 * phones, a column (emblem banner on top) from `sm`. The page's skeleton
 * cells use the same numbers, so nothing jumps when the tiers land.
 */
export const TIER_CARD_HEIGHT = { xs: 108, sm: 212 } as const;
const BANNER_HEIGHT = 96;
const BANNER_WIDTH_XS = 88;

type Accent = "primary" | "summit" | "muted";

const accentColor = (theme: Theme, accent: Accent): string => {
  if (accent === "summit") {
    return theme.palette.secondary.main;
  }
  if (accent === "muted") {
    return theme.palette.text.secondary;
  }
  return theme.palette.primary.main;
};

export type PvpTierCardProps = {
  tier: PvpTier;
  /** 1-based position in the bracket's ladder (lowest first). */
  step: number;
  /** Every tier of the bracket, lowest first: the scale's boundary ticks. */
  ladder: readonly PvpTier[];
  scale: PvpRatingScale;
  /**
   * Some of the bracket's tiers did not load, so `step` is not the tier's
   * real place in the ladder and the last tier shown may not be the top.
   */
  partial: boolean;
  /** The tier's icon (loaded for the bracket on screen only). */
  icon: PvpTierIcon | undefined;
};

/**
 * The tier's 56px icon, crisp, over the same icon blown up and blurred into a
 * colour wash: Blizzard only serves tier icons at 56px, so upscaling the real
 * one would blur it, while the wash gives each card its emblem's colours.
 */
const TierEmblem = ({
  tier,
  icon,
}: {
  tier: PvpTier;
  icon: PvpTierIcon | undefined;
}): JSX.Element => {
  const [backdropFailed, setBackdropFailed] = useState(false);
  const loading = icon?.loading ?? false;
  const src = loading ? undefined : (icon?.url ?? undefined);

  return (
    <Box
      sx={(theme) => ({
        position: "relative",
        flexShrink: 0,
        alignSelf: "stretch",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        width: { xs: BANNER_WIDTH_XS, sm: "100%" },
        height: { xs: "auto", sm: BANNER_HEIGHT },
        backgroundColor: theme.palette.surface.sunken,
        borderRight: {
          xs: `1px solid ${theme.palette.border.subtle}`,
          sm: "none",
        },
        borderBottom: {
          xs: "none",
          sm: `1px solid ${theme.palette.border.subtle}`,
        },
      })}
    >
      {src && !backdropFailed ? (
        <Box
          component="img"
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setBackdropFailed(true)}
          sx={{
            position: "absolute",
            top: "-30%",
            left: "-30%",
            width: "160%",
            height: "160%",
            objectFit: "cover",
            filter: "blur(20px) saturate(1.4)",
            opacity: 0.5,
            pointerEvents: "none",
          }}
        />
      ) : null}
      <MediaTile
        size={56}
        src={src}
        alt=""
        fallbackLabel={tier.name}
        loading={loading}
        radius="md"
        sx={(theme) => ({
          position: "relative",
          boxShadow: theme.palette.glow.card,
        })}
      />
    </Box>
  );
};

/**
 * The bracket's whole rating scale as a track, a tick at every tier's floor,
 * and this tier's range lit on it. An open-ended tier fades out towards the
 * end instead of stopping at a ceiling it does not have. Decorative: the
 * range is in the text above it.
 */
const ScaleBar = ({
  tier,
  ladder,
  scale,
  accent,
}: {
  tier: PvpTier;
  ladder: readonly PvpTier[];
  scale: PvpRatingScale;
  accent: Accent;
}): JSX.Element => {
  const open = isOpenEnded(tier);
  const left = scalePercent(tier.minRating, scale);
  const right = open ? 100 : scalePercent(tier.maxRating, scale);
  const ticks = Array.from(new Set(ladder.map((entry) => entry.minRating))).filter(
    (value) => value > scale.min,
  );

  return (
    <Box
      aria-hidden="true"
      sx={(theme) => ({
        position: "relative",
        flexShrink: 0,
        height: 8,
        marginTop: "auto",
        borderRadius: `${theme.wc.radius.pill}px`,
        backgroundColor: theme.palette.surface.inset,
        boxShadow: `inset 0 0 0 1px ${theme.palette.border.subtle}`,
      })}
    >
      {ticks.map((value) => (
        <Box
          key={value}
          sx={(theme) => ({
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${scalePercent(value, scale)}%`,
            width: "1px",
            backgroundColor: theme.palette.border.strong,
          })}
        />
      ))}
      <Box
        sx={(theme) => {
          const color = accentColor(theme, accent);
          return {
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${left}%`,
            // A sliver at least, should a range ever be narrower than a pixel.
            width: `${Math.max(right - left, 1.5)}%`,
            borderRadius: `${theme.wc.radius.pill}px`,
            background: open
              ? `linear-gradient(90deg, ${color} 35%, ${alpha(color, 0)})`
              : color,
            boxShadow:
              accent === "muted" ? "none" : `0 0 10px ${alpha(color, 0.45)}`,
          };
        }}
      />
    </Box>
  );
};

/**
 * One rank of a bracket: its emblem, name, place in the ladder, rating range
 * and where that range sits on the bracket's scale. The top tier is edged in
 * gold; the unrated starting tier's bar is muted. Not interactive: the
 * comparison table below already shows the rank in every other bracket.
 *
 * The top tier is the one without a ceiling (Elite), not the last card: when
 * some of the bracket failed to load, the last card shown may be Duelist,
 * and gilding it would call it the bracket's highest rank. Only a complete
 * ladder with no open-ended tier falls back to its last card. A partial
 * ladder drops "Tier N of M" too: neither number can be trusted.
 */
const PvpTierCard = ({
  tier,
  step,
  ladder,
  scale,
  partial,
  icon,
}: PvpTierCardProps): JSX.Element => {
  const summit =
    ladder.length > 1 &&
    (isOpenEnded(tier) ||
      (!partial && !scale.openEnded && step === ladder.length));
  const accent: Accent = summit ? "summit" : isUnrated(tier) ? "muted" : "primary";

  return (
    <Card
      variant="outlined"
      sx={(theme) => ({
        height: "100%",
        minHeight: TIER_CARD_HEIGHT,
        display: "flex",
        flexDirection: { xs: "row", sm: "column" },
        overflow: "hidden",
        ...(summit ? { borderColor: theme.palette.border.gold } : {}),
      })}
    >
      <TierEmblem tier={tier} icon={icon} />
      {/* useFlexGap: Stack's sibling margins would override the bar's marginTop auto. */}
      <Stack
        spacing={0.75}
        useFlexGap
        sx={{ flex: 1, minWidth: 0, p: { xs: 1.5, sm: 2 } }}
      >
        <Stack
          direction="row"
          flexWrap="wrap"
          alignItems="baseline"
          columnGap={1}
          useFlexGap
        >
          <Typography
            variant="h4"
            component="h3"
            sx={{ margin: 0, minWidth: 0, overflowWrap: "anywhere" }}
          >
            {tier.name}
          </Typography>
          {partial ? null : (
            <Typography
              variant="caption"
              color="text.secondary"
              component="p"
              sx={{ margin: 0, marginLeft: "auto", whiteSpace: "nowrap" }}
            >
              {`Tier ${step} of ${ladder.length}`}
            </Typography>
          )}
        </Stack>
        <Typography
          variant="subtitle1"
          component="p"
          sx={{ margin: 0, fontWeight: 700 }}
        >
          <Box component="span" sx={visuallyHidden}>
            Rating{" "}
          </Box>
          <RatingRange tier={tier} />
        </Typography>
        <ScaleBar tier={tier} ladder={ladder} scale={scale} accent={accent} />
      </Stack>
    </Card>
  );
};

export default PvpTierCard;
