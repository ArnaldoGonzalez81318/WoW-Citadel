import AutoStoriesRounded from "@mui/icons-material/AutoStoriesRounded";
import { Box, Link } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Link as RouterLink } from "react-router-dom";

import { isMouseLike } from "@/components/layout/navigation/navUtils";
import {
  journalInstance,
  preloadLink,
} from "@/features/home/config/homeLinks";
import {
  journalInstanceQuery,
  journalTierQuery,
} from "@/features/journal/hooks/journalQueries";
import { CURRENT_SEASON_TIER_ID } from "@/features/journal/services/journalService";
import type { JournalRef, JournalTier } from "@/features/journal/types";
import { mixins, visuallyHidden } from "@/theme";

const FADE_IN = "@media (prefers-reduced-motion: no-preference)";

const highestId = (refs: readonly JournalRef[]): number | undefined =>
  refs.length > 0
    ? refs.reduce((best, ref) => (ref.id > best ? ref.id : best), refs[0].id)
    : undefined;

/**
 * The raid Blizzard added to the Current Season tier last (journal ids grow
 * with each new instance), else its last-added dungeon. Game knowledge,
 * not a date the API states, which is why the caption never calls it new.
 */
const featuredInstanceId = (tier: JournalTier | null | undefined): number | undefined =>
  tier ? (highestId(tier.raids) ?? highestId(tier.dungeons)) : undefined;

/**
 * Decorative zone art for the hero's right side at lg+, with a caption link
 * to that instance in the Encounter Journal. It reads the tier and instance
 * entries the strip's Raids card and the Raids panel share, so it costs at
 * most the instance's two lookups and one image. Every failure (pending,
 * a 404, no instances, an error, a CDN 403 on the image) renders nothing
 * and leaves the hero as it is without art: those errors surface, with a
 * Retry, in the Raids card and the Raids panel, which use the same keys.
 */
const HeroSeasonArt = (): JSX.Element | null => {
  const tierQuery = useQuery(journalTierQuery(CURRENT_SEASON_TIER_ID));
  const featuredId = useMemo(() => featuredInstanceId(tierQuery.data), [tierQuery.data]);
  const instanceQuery = useQuery({
    ...journalInstanceQuery(featuredId ?? 0),
    enabled: featuredId !== undefined,
  });
  // Keyed by URL, so new art gets its own attempt without an effect.
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const instance = instanceQuery.data;
  const src = instance?.imageUrl;
  if (!instance || !src || failedSrc === src) {
    return null;
  }
  const loaded = loadedSrc === src;
  const to = journalInstance(instance.id);

  return (
    <>
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "46%",
          pointerEvents: "none",
          // Fades into the card on the left, so the art never meets the text.
          maskImage: "linear-gradient(to right, transparent, #000 40%)",
          WebkitMaskImage: "linear-gradient(to right, transparent, #000 40%)",
        }}
      >
        <Box
          component="img"
          src={src}
          alt=""
          decoding="async"
          onLoad={() => setLoadedSrc(src)}
          onError={() => setFailedSrc(src)}
          sx={(theme) => ({
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: loaded ? 1 : 0,
            [FADE_IN]: {
              transition: `opacity ${theme.wc.motion.slow}ms ${theme.wc.motion.easing}`,
            },
          })}
        />
      </Box>

      {/* Only once the image has painted: a caption under a blank area would point at nothing. */}
      {loaded ? (
        <Box
          sx={(theme) => ({
            position: "absolute",
            right: 12,
            bottom: 12,
            zIndex: 1,
            // Stays over the art, clear of the 58% text column.
            maxWidth: "calc(42% - 24px)",
            px: 1.25,
            py: 0.5,
            borderRadius: `${theme.wc.radius.pill}px`,
            bgcolor: alpha(theme.palette.background.default, 0.72),
            backdropFilter: "blur(4px)",
          })}
        >
          <Link
            component={RouterLink}
            to={to}
            underline="hover"
            color="text.primary"
            variant="caption"
            onPointerEnter={(event: ReactPointerEvent<HTMLAnchorElement>) => {
              if (isMouseLike(event)) {
                preloadLink(to);
              }
            }}
            onFocus={() => preloadLink(to)}
            sx={(theme) => ({
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              minWidth: 0,
              fontWeight: 600,
              borderRadius: `${theme.wc.radius.pill}px`,
              "&:focus-visible": mixins.focusRing(theme),
            })}
          >
            <AutoStoriesRounded aria-hidden="true" sx={{ fontSize: 16, flexShrink: 0 }} />
            <Box component="span" sx={{ ...mixins.truncate, minWidth: 0 }}>
              {instance.name}
              <Box component="span" sx={visuallyHidden}>
                {" in the Encounter Journal"}
              </Box>
            </Box>
          </Link>
        </Box>
      ) : null}
    </>
  );
};

export default HeroSeasonArt;
