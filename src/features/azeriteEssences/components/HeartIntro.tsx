import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import CircleRounded from "@mui/icons-material/CircleRounded";
import DiamondRounded from "@mui/icons-material/DiamondRounded";
import LayersRounded from "@mui/icons-material/LayersRounded";
import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import { Box, Chip, Link, Skeleton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";

import MediaTile from "@/components/common/MediaTile";
import SectionCard from "@/components/common/SectionCard";
import { ErrorState } from "@/components/common/StateBlocks";
import {
  heartItemQuery,
  itemIconQuery,
} from "@/features/azeriteEssences/hooks/essenceQueries";
import { HEART_OF_AZEROTH_ITEM_ID } from "@/features/azeriteEssences/services/azeriteEssenceService";
import { WOWHEAD_LABEL, wowheadUrl } from "@/lib/externalLinks";
import { qualityColor, visuallyHidden } from "@/theme";

type Fact = {
  key: string;
  icon: ReactNode;
  title: string;
  text: string;
};

/* Game knowledge: Blizzard's API lists essences and their spells, not how the slots worked. */
const FACTS: readonly Fact[] = [
  {
    key: "major",
    icon: <DiamondRounded sx={(theme) => ({ color: theme.palette.secondary.main })} />,
    title: "The major slot",
    text: "One essence sat in the major slot and granted both of its powers: the major power, usually an ability to activate, and the minor power.",
  },
  {
    key: "minor",
    icon: <CircleRounded sx={(theme) => ({ color: theme.palette.primary.light, fontSize: 16 })} />,
    title: "The minor slots",
    text: "Up to three more essences sat in minor slots, each granting only its minor power, a passive bonus.",
  },
  {
    key: "ranks",
    icon: <LayersRounded sx={(theme) => ({ color: theme.palette.secondary.light })} />,
    title: "Ranks 1 to 4",
    text: "Ranks 1 to 3 strengthened both powers. Rank 4 was a cosmetic upgrade to how the major power looked.",
  },
];

/** The neck item itself: Blizzard's name, quality, icon and equip line for it. */
const HeartTile = (): JSX.Element | null => {
  const item = useQuery(heartItemQuery());
  const icon = useQuery(itemIconQuery(HEART_OF_AZEROTH_ITEM_ID));

  // A Retry puts an item with no data back to pending; errorUpdateCount
  // survives it, so the error (and its focused Retry button) stays up.
  const failed = item.data === undefined && item.errorUpdateCount > 0;
  const [lastError, setLastError] = useState<unknown>(null);
  if (item.error && item.error !== lastError) {
    setLastError(item.error);
  }

  if (failed) {
    const retrying = item.fetchStatus !== "idle";
    return (
      <ErrorState
        compact
        error={item.error ?? lastError}
        context="the Heart of Azeroth item"
        onRetry={() => {
          if (!retrying) {
            void item.refetch();
          }
        }}
        retryLabel={retrying ? "Retrying…" : "Retry"}
      />
    );
  }
  if (item.isPending) {
    return (
      // The loaded tile's lines: name, quality, a three-line equip text, the link.
      <Stack direction="row" spacing={1.5} role="status" aria-label="Loading the Heart of Azeroth">
        <Skeleton variant="rounded" width={56} height={56} sx={{ flexShrink: 0 }} />
        <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
          <Skeleton variant="text" width="55%" sx={{ fontSize: "1rem" }} />
          <Skeleton variant="text" width="25%" sx={{ fontSize: "0.75rem" }} />
          {["100%", "100%", "70%"].map((width, index) => (
            <Skeleton key={index} variant="text" width={width} sx={{ fontSize: "0.875rem" }} />
          ))}
          <Skeleton variant="text" width={120} sx={{ fontSize: "0.875rem" }} />
        </Stack>
      </Stack>
    );
  }
  if (!item.data) {
    return null;
  }

  const heart = item.data;
  const link = wowheadUrl("item", heart.id);
  return (
    <Stack direction="row" spacing={1.5} sx={{ minWidth: 0 }}>
      <MediaTile
        src={icon.data}
        alt=""
        size={56}
        fallbackLabel={heart.name}
        quality={heart.qualityType}
        loading={icon.isPending}
      />
      <Stack spacing={0.25} sx={{ minWidth: 0 }}>
        <Typography
          component="p"
          variant="subtitle1"
          sx={(theme) => ({
            margin: 0,
            fontWeight: 600,
            color: qualityColor(theme, heart.qualityType),
          })}
        >
          {heart.name}
        </Typography>
        {heart.qualityName ? (
          <Typography component="p" variant="caption" color="text.secondary" sx={{ margin: 0 }}>
            {heart.qualityName}
          </Typography>
        ) : null}
        {heart.effect ? (
          <Typography component="p" variant="body2" color="text.secondary" sx={{ margin: 0 }}>
            {heart.effect}
          </Typography>
        ) : null}
        {link ? (
          <Link
            href={link}
            target="_blank"
            rel="noreferrer"
            variant="body2"
            underline="hover"
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, alignSelf: "flex-start" }}
          >
            {WOWHEAD_LABEL}
            <OpenInNewRounded aria-hidden="true" sx={{ fontSize: 14 }} />
            <Box component="span" sx={visuallyHidden}>
              {" (opens in a new tab)"}
            </Box>
          </Link>
        ) : null}
      </Stack>
    </Stack>
  );
};

/**
 * What the Heart of Azeroth was and how its essences slotted in, labelled
 * as game knowledge: none of it is in Blizzard's essence data. The item's
 * own name, icon and equip line come from the API.
 */
const HeartIntro = (): JSX.Element => (
  <SectionCard
    title="How the Heart of Azeroth worked"
    icon={<AutoAwesomeRounded />}
    tone="gold"
    // The label rides in the description, not `actions`: beside the icon a
    // chip there squeezes the title into a sliver at phone width.
    description={
      <>
        <Chip
          size="small"
          variant="outlined"
          label="Game knowledge"
          sx={{ mr: 1, mb: 0.5, verticalAlign: "middle" }}
        />
        Background from the game, not from Blizzard&apos;s API, which lists each
        essence&apos;s powers and who could use them but not how the system played.
      </>
    }
  >
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(240px, 320px) minmax(0, 1fr)" },
        gap: { xs: 2.5, md: 3 },
        alignItems: "start",
      }}
    >
      <Stack spacing={1.5} sx={{ minWidth: 0 }}>
        <HeartTile />
        <Typography variant="body2" color="text.secondary" component="p" sx={{ margin: 0 }}>
          The Heart of Azeroth was the neck item every character carried through Battle for
          Azeroth. Patch 8.2 gave it essences, earned from raids, dungeons, PvP and the world.
          The system did not carry on past that expansion; Blizzard still serves its data.
        </Typography>
      </Stack>
      <Box
        component="ul"
        role="list"
        aria-label="Essence slots and ranks"
        sx={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(3, minmax(0, 1fr))" },
          gap: 1.5,
        }}
      >
        {FACTS.map((fact) => (
          <Box
            component="li"
            key={fact.key}
            sx={(theme) => ({
              minWidth: 0,
              padding: 1.75,
              borderRadius: `${theme.wc.radius.md}px`,
              border: `1px solid ${theme.palette.border.subtle}`,
              background: `linear-gradient(160deg, ${alpha(theme.palette.secondary.main, 0.06)} 0%, ${theme.palette.surface.inset} 70%)`,
            })}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
              <Box
                aria-hidden="true"
                sx={{ display: "inline-flex", alignItems: "center", "& svg": { fontSize: 18 } }}
              >
                {fact.icon}
              </Box>
              <Typography component="h3" variant="subtitle2" sx={{ margin: 0 }}>
                {fact.title}
              </Typography>
            </Stack>
            <Typography component="p" variant="body2" color="text.secondary" sx={{ margin: 0 }}>
              {fact.text}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  </SectionCard>
);

export default HeartIntro;
