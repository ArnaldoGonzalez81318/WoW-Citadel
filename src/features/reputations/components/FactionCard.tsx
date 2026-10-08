import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import {
  Box,
  Card,
  CardActionArea,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";

import FactionCrest, { monogramOf } from "@/features/reputations/components/FactionCrest";
import KindBadge from "@/features/reputations/components/KindBadge";
import LadderStrip from "@/features/reputations/components/LadderStrip";
import { factionQuery } from "@/features/reputations/hooks/reputationQueries";
import { useFactionVisual } from "@/features/reputations/hooks/useFactionVisual";
import {
  accentColor,
  sideColor,
} from "@/features/reputations/services/reputationPalette";
import type { AccentKey } from "@/features/reputations/services/reputationPalette";
import { pluralize } from "@/features/reputations/services/reputationService";
import type { FactionRef } from "@/features/reputations/types";
import useNearViewport from "@/hooks/useNearViewport";
import { mixins } from "@/theme";

/**
 * The card's height without a path line, and the path line's: the grids'
 * skeleton cells use them, so nothing jumps when the records land. Every
 * line is reserved whether or not the faction fills it.
 */
export const FACTION_CARD_HEIGHT = 252;
export const FACTION_CARD_PATH_HEIGHT = 24;
const BANNER_HEIGHT = 90;
const DESCRIPTION_LINES = 2;

const MOTION_HOVER = "@media (hover: hover)";
const MOTION_HOVER_LIFT =
  "@media (hover: hover) and (prefers-reduced-motion: no-preference)";

const cardSx = (minHeight: number) => (theme: Theme) => ({
  height: "100%",
  minHeight,
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

export type FactionCardProps = {
  faction: FactionRef;
  /** The group colour its crest and banner wear. */
  accent: AccentKey;
  /** Only load once the card nears the viewport (search results, sub-groups). */
  lazy?: boolean;
  /**
   * Where it sits ("Classic › Horde"), for lists that mix groups (search
   * results). Undefined drops the line; "" keeps its space empty (a parent
   * the page has not learned, see useFactionParents).
   */
  pathLabel?: string;
  onSelect: (faction: FactionRef) => void;
};

/**
 * One faction: a banner in its group's colour with its crest and ladder
 * kind, the ladder itself as a strip of standing colours, its summary
 * ("8 standings · Hated to Exalted"), two lines of description, and chips for
 * paragon, side and the factions it heads. The whole card opens the dialog.
 */
const FactionCard = ({
  faction,
  accent,
  lazy = false,
  pathLabel,
  onSelect,
}: FactionCardProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLDivElement>();
  const query = useQuery({ ...factionQuery(faction.id), enabled: !lazy || near });
  const record = query.data;
  const visual = useFactionVisual(record, accent, near, query.isError);
  const loading = query.isPending;
  const name = record?.name ?? faction.name;
  // The button's aria-label replaces its content, so the visible details are
  // its description: the only way to tell same-name factions apart by ear.
  const detailsId = useId();
  const describedBy = [
    record ? `${detailsId}-kind` : undefined,
    `${detailsId}-summary`,
    pathLabel ? `${detailsId}-path` : undefined,
    `${detailsId}-footer`,
  ]
    .filter(Boolean)
    .join(" ");

  let summary: string;
  if (record) {
    summary = visual.summary;
  } else if (query.isError) {
    summary = "Details unavailable";
  } else if (record === null) {
    summary = "Not in Blizzard's game data";
  } else {
    summary = "";
  }
  const headsFactions = record && record.kind !== "group" ? record.children.length : 0;

  return (
    <Card
      ref={nearRef}
      variant="outlined"
      sx={cardSx(FACTION_CARD_HEIGHT + (pathLabel !== undefined ? FACTION_CARD_PATH_HEIGHT : 0))}
    >
      <CardActionArea
        onClick={() => onSelect({ id: faction.id, name })}
        aria-label={`View ${name} details`}
        aria-describedby={describedBy}
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
        {/* Banner: the group's colour washed from the corner, the crest and kind
            on top and the ladder strip along the bottom edge. */}
        <Box
          sx={(theme) => {
            const color = accentColor(theme, accent);
            return {
              position: "relative",
              overflow: "hidden",
              height: BANNER_HEIGHT,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              px: 2,
              pt: 1.75,
              pb: 1.5,
              background: `linear-gradient(120deg, ${alpha(color, 0.26)} 0%, ${alpha(color, 0.08)} 55%, ${alpha(color, 0)} 100%)`,
              borderBottom: `1px solid ${theme.palette.border.subtle}`,
            };
          }}
        >
          {/* A large faint monogram as texture; the crest carries the same letters. */}
          <Box
            aria-hidden="true"
            sx={(theme) => ({
              position: "absolute",
              right: -6,
              top: -18,
              fontSize: 96,
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: "-0.04em",
              color: alpha(accentColor(theme, accent), 0.09),
              pointerEvents: "none",
              userSelect: "none",
            })}
          >
            {monogramOf(name)}
          </Box>
          <Stack
            direction="row"
            alignItems="flex-start"
            justifyContent="space-between"
            spacing={1}
            sx={{ position: "relative", minWidth: 0 }}
          >
            <FactionCrest name={name} accent={accent} kind={record?.kind} size={44} />
            {record ? (
              <KindBadge kind={record.kind} id={`${detailsId}-kind`} />
            ) : loading ? (
              <Skeleton variant="rounded" width={84} height={24} sx={{ borderRadius: 12 }} />
            ) : null}
          </Stack>
          <LadderStrip colors={visual.colors} sx={{ position: "relative" }} />
        </Box>

        {/* useFlexGap: Stack's sibling margins would override the footer's marginTop auto. */}
        <Stack spacing={0.75} useFlexGap sx={{ p: 2, flex: 1, minWidth: 0 }}>
          {/* A heading may not sit inside the action area's <button>;
              its aria-label names the card instead. */}
          <Typography
            variant="subtitle1"
            component="span"
            sx={{ ...mixins.truncate, display: "block", margin: 0, fontWeight: 600 }}
          >
            {name}
          </Typography>

          {summary ? (
            <Typography
              id={`${detailsId}-summary`}
              variant="caption"
              color="text.secondary"
              component="p"
              sx={{ ...mixins.truncate, margin: 0 }}
            >
              {summary}
            </Typography>
          ) : (
            <Skeleton
              id={`${detailsId}-summary`}
              variant="text"
              width="65%"
              sx={{ fontSize: "0.75rem" }}
            />
          )}

          {pathLabel !== undefined ? (
            <Typography
              id={`${detailsId}-path`}
              variant="caption"
              component="p"
              color="text.secondary"
              // Reserved even when empty, so every result card is the same height.
              sx={(theme) => ({
                ...mixins.truncate,
                margin: 0,
                minHeight: `${String(theme.typography.caption.lineHeight)}em`,
              })}
            >
              {pathLabel}
            </Typography>
          ) : null}

          <Box
            sx={(theme) => ({
              typography: "body2",
              minHeight: `calc(${DESCRIPTION_LINES} * ${String(theme.typography.body2.lineHeight)}em)`,
            })}
          >
            {loading ? (
              <>
                <Skeleton variant="text" width="100%" />
                <Skeleton variant="text" width="70%" />
              </>
            ) : record?.description ? (
              <Typography
                variant="body2"
                color="text.secondary"
                component="p"
                sx={{ ...mixins.lineClamp(DESCRIPTION_LINES), margin: 0 }}
              >
                {record.description}
              </Typography>
            ) : null}
          </Box>

          <Stack
            id={`${detailsId}-footer`}
            direction="row"
            flexWrap="wrap"
            useFlexGap
            gap={0.75}
            alignItems="center"
            sx={{ marginTop: "auto", minHeight: 24 }}
          >
            {headsFactions > 0 ? (
              <Chip
                size="small"
                variant="outlined"
                icon={<AccountTreeRoundedIcon />}
                label={pluralize(headsFactions, "faction", "factions")}
              />
            ) : null}
            {record?.canParagon ? (
              <Chip
                size="small"
                variant="outlined"
                label="Paragon"
                sx={(theme) => ({ borderColor: theme.palette.border.gold })}
              />
            ) : null}
            {record?.side ? (
              <Chip
                size="small"
                variant="outlined"
                label={record.side.name}
                sx={(theme) => ({
                  borderColor: alpha(sideColor(theme, record.side?.type ?? ""), 0.6),
                })}
              />
            ) : null}
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  );
};

export default FactionCard;
