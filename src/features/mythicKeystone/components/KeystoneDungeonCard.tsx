import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import {
  Box,
  Card,
  CardActionArea,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";

import MediaTile from "@/components/common/MediaTile";
import { keystoneDungeonQuery } from "@/features/mythicKeystone/hooks/keystoneQueries";
import { formatTimer } from "@/features/mythicKeystone/services/mythicKeystoneService";
import type {
  KeystoneDungeon,
  KeystoneDungeonSummary,
} from "@/features/mythicKeystone/types";
import useNearViewport from "@/hooks/useNearViewport";
import { mixins } from "@/theme";

export type KeystoneDungeonCardProps = {
  summary: KeystoneDungeonSummary;
  /** This season's card: description, bosses and every upgrade timer. */
  featured?: boolean;
  /** Only load once the card nears the viewport (the archive of past dungeons). */
  lazy?: boolean;
  onSelect: (summary: KeystoneDungeonSummary) => void;
};

const MOTION_HOVER = "@media (hover: hover)";
const MOTION_HOVER_LIFT =
  "@media (hover: hover) and (prefers-reduced-motion: no-preference)";

const cardSx = (theme: Theme) => ({
  height: "100%",
  display: "flex",
  overflow: "hidden",
  transition: theme.transitions.create(
    ["border-color", "box-shadow", "transform"],
    { duration: theme.wc.motion.base, easing: theme.wc.motion.easing },
  ),
  [MOTION_HOVER]: {
    "&:hover": {
      borderColor: theme.palette.border.strong,
      boxShadow: theme.palette.glow.card,
    },
  },
  [MOTION_HOVER_LIFT]: {
    "&:hover": { transform: "translateY(-2px)" },
  },
});

/** "Midnight · Harandar" */
const originLine = (dungeon: KeystoneDungeon | undefined): string =>
  [dungeon?.expansion, dungeon?.location].filter(Boolean).join(" · ");

/**
 * One keystone dungeon: its zone art as a 2:1 banner, name, expansion and
 * location, and the keystone timer. The featured (current season) variant
 * adds the +2/+3 thresholds, boss count and a two-line description. The whole
 * card opens the detail dialog.
 */
const KeystoneDungeonCard = ({
  summary,
  featured = false,
  lazy = false,
  onSelect,
}: KeystoneDungeonCardProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const query = useQuery({
    ...keystoneDungeonQuery(summary.id),
    enabled: !lazy || near,
  });
  const dungeon = query.data;
  const loading = query.isPending;
  const [timer, ...upgrades] = dungeon?.timers ?? [];
  const origin = originLine(dungeon);
  // A split wing's journal lists the whole instance's bosses; no count then.
  const bossCount =
    dungeon && (!dungeon.instanceName || dungeon.instanceName === dungeon.name)
      ? dungeon.bosses.length
      : 0;
  // The button's aria-label replaces its content, so the visible details are
  // its description: the only way to tell same-name entries apart by ear.
  const detailsId = useId();

  return (
    <Card ref={nearRef} variant="outlined" sx={cardSx}>
      <CardActionArea
        onClick={() => onSelect(summary)}
        aria-label={`View ${summary.name} details`}
        aria-describedby={`${detailsId}-origin ${detailsId}-footer`}
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "flex-start",
          textAlign: "left",
          "& .MuiCardActionArea-focusHighlight": { display: "none" },
        }}
      >
        {/* The tile fills its parent; this box gives it the art's 2:1 shape
            (600×300) instead of the card's full height. */}
        <Box sx={{ width: "100%", aspectRatio: "2 / 1", flexShrink: 0 }}>
          <MediaTile
            size="fill"
            aspect="2 / 1"
            src={dungeon?.imageUrl ?? undefined}
            alt=""
            fallbackLabel={summary.name}
            loading={loading}
          />
        </Box>
        {/* useFlexGap: Stack's sibling margins would override the footer's marginTop auto. */}
        <Stack
          spacing={1}
          useFlexGap
          sx={{ p: featured ? 2.5 : 2, flex: 1, minWidth: 0 }}
        >
          {/* A heading may not sit inside the action area's <button>;
              its aria-label names the card instead. */}
          <Typography
            variant={featured ? "h5" : "subtitle1"}
            component="span"
            sx={{ ...mixins.truncate, display: "block", margin: 0 }}
          >
            {summary.name}
          </Typography>

          {loading ? (
            <Skeleton variant="text" width="60%" sx={{ fontSize: "0.75rem" }} />
          ) : origin ? (
            <Typography
              id={`${detailsId}-origin`}
              variant="caption"
              color="text.secondary"
              component="p"
              sx={{ ...mixins.truncate, margin: 0 }}
            >
              {origin}
            </Typography>
          ) : null}

          {/* Placeholders in the loaded card's shape, so the grid does not jump when data lands. */}
          {featured && loading ? <Skeleton variant="rounded" height={44} /> : null}

          {featured && dungeon?.description ? (
            <Typography
              variant="body2"
              color="text.secondary"
              component="p"
              sx={{ ...mixins.lineClamp(2), margin: 0 }}
            >
              {dungeon.description}
            </Typography>
          ) : null}

          {query.isError && !dungeon ? (
            <Typography variant="caption" color="text.secondary" component="p" sx={{ margin: 0 }}>
              Details unavailable
            </Typography>
          ) : null}

          {loading ? (
            <Skeleton
              variant="rounded"
              width={72}
              height={28}
              sx={{ marginTop: "auto" }}
            />
          ) : null}

          {timer || (featured && bossCount > 0) ? (
            <Stack
              id={`${detailsId}-footer`}
              direction="row"
              flexWrap="wrap"
              useFlexGap
              gap={1}
              alignItems="center"
              sx={{ marginTop: "auto", pt: 0.5 }}
            >
              {timer ? (
                <Chip
                  size="small"
                  icon={<TimerOutlinedIcon />}
                  label={formatTimer(timer.durationMs)}
                  aria-label={`Timer ${formatTimer(timer.durationMs)}`}
                />
              ) : null}
              {featured && upgrades.length > 0 ? (
                <Box
                  component="span"
                  sx={{ typography: "caption", color: "text.secondary" }}
                >
                  {upgrades
                    .map((upgrade) => `+${upgrade.level} ${formatTimer(upgrade.durationMs)}`)
                    .join(" · ")}
                </Box>
              ) : null}
              {featured && bossCount > 0 ? (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${bossCount} ${bossCount === 1 ? "boss" : "bosses"}`}
                />
              ) : null}
            </Stack>
          ) : null}
        </Stack>
      </CardActionArea>
    </Card>
  );
};

export default KeystoneDungeonCard;
