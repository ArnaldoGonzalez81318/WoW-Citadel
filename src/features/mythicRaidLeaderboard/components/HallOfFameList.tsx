import { Box, Chip, Skeleton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";

import GuildName from "@/features/mythicRaidLeaderboard/components/GuildName";
import {
  FACTION_LABEL,
  firstLabel,
  formatGap,
  formatKillTime,
} from "@/features/mythicRaidLeaderboard/services/hallOfFameService";
import type {
  FactionView,
  HallOfFameFaction,
  HallOfFameRow,
} from "@/features/mythicRaidLeaderboard/types";
import { truncate, visuallyHidden } from "@/theme";

export type HallOfFameListProps = {
  /** This page's rows. */
  rows: HallOfFameRow[];
  view: FactionView;
  /** Epoch ms of position #1's kill: every gap is measured from it. */
  firstKill: number;
};

/** Alliance blue and Horde red, from the theme's own blue and red. */
const factionColor = (theme: Theme, faction: HallOfFameFaction): string =>
  faction === "alliance" ? theme.palette.primary.light : theme.palette.error.light;

const PODIUM = 3;

/*
 * One grid per row. md and up give every field its own column. Phones
 * stack the kill time under the guild; a lone region chip fits beside the
 * name, but with the faction chip too the name would shrink to a few
 * letters at 320px, so merged rows give the chips their own line.
 */
const rowSx = (merged: boolean) => (theme: Theme) => ({
  display: "grid",
  alignItems: "center",
  columnGap: { xs: 1.5, md: 2 },
  rowGap: 0.75,
  gridTemplateColumns: {
    xs: merged ? "36px minmax(0, 1fr)" : "36px minmax(0, 1fr) auto",
    md: `56px minmax(0, 1fr) ${merged ? 176 : 52}px 220px`,
  },
  gridTemplateAreas: {
    xs: merged
      ? `"rank guild" "rank tags" "rank when"`
      : `"rank guild tags" "rank when when"`,
    md: `"rank guild tags when"`,
  },
  px: 2,
  py: 1.5,
  border: `1px solid ${theme.palette.border.subtle}`,
  borderRadius: `${theme.wc.radius.md}px`,
  bgcolor: "background.paper",
});

const rankSx = { gridArea: "rank", alignSelf: { xs: "start", md: "center" } } as const;

const tagsSx = (merged: boolean) =>
  ({
    gridArea: "tags",
    minWidth: 0,
    justifySelf: { xs: merged ? "start" : "end", md: "start" },
  }) as const;

/** Time and gap share a line on phones when they fit, and stack from md. */
const WHEN_LAYOUT = {
  direction: { xs: "row", md: "column" },
  flexWrap: "wrap",
  useFlexGap: true,
  columnGap: 1,
  alignItems: { xs: "center", md: "flex-start" },
  sx: { gridArea: "when", minWidth: 0 },
} as const;

export type HallOfFameListSkeletonProps = {
  view: FactionView;
  count: number;
  /** Accessible label, announced by the status region. */
  label: string;
};

/**
 * Loading rows built on the same grid, type sizes and wrapping as the real
 * ones, so each placeholder is as tall as the row that replaces it at every
 * width. A fixed height per breakpoint cannot be: on phones the kill time
 * and its gap share a line from roughly 400px and wrap below it, which adds
 * a line mid-breakpoint (and the point moves with the locale's date format).
 */
export const HallOfFameListSkeleton = ({
  view,
  count,
  label,
}: HallOfFameListSkeletonProps): JSX.Element => {
  const merged = view === "both";

  return (
    <Box
      role="status"
      aria-label={label}
      aria-busy
      aria-live="polite"
      sx={{ display: "grid", gap: 1 }}
    >
      {Array.from({ length: count }, (_, index) => (
        <Box key={index} aria-hidden sx={rowSx(merged)}>
          <Typography component="span" variant="subtitle2" sx={rankSx}>
            <Skeleton variant="text" width={28} />
          </Typography>
          {/* No type variant on the first line: like the guild link's line, it
              takes the inherited body line height. */}
          <Box sx={{ gridArea: "guild", minWidth: 0 }}>
            <Skeleton variant="text" width="60%" />
            <Typography component="span" variant="caption" sx={{ display: "block" }}>
              <Skeleton variant="text" width="40%" />
            </Typography>
          </Box>
          <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75} sx={tagsSx(merged)}>
            <Skeleton variant="rounded" width={36} height={24} />
            {merged ? <Skeleton variant="rounded" width={96} height={24} /> : null}
          </Stack>
          {/* Widths of an en-US "Dec 23, 2022, 5:40 PM" and "+3d 4h after #1". */}
          <Stack {...WHEN_LAYOUT}>
            <Typography component="span" variant="body2">
              <Skeleton variant="text" width="10.5em" />
            </Typography>
            <Typography component="span" variant="caption">
              <Skeleton variant="text" width="7em" />
            </Typography>
          </Stack>
        </Box>
      ))}
    </Box>
  );
};

/**
 * The page's guilds in list order: position (podium in gold), guild and
 * realm with an armory link, region, faction and its own rank when both
 * boards are merged, and the kill time with how far it trailed #1.
 */
const HallOfFameList = ({ rows, view, firstKill }: HallOfFameListProps): JSX.Element => {
  const merged = view === "both";

  return (
    <Box
      component="ol"
      // Safari drops the list role from a list-style:none list without it.
      role="list"
      aria-label="Hall of Fame guilds"
      sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1 }}
    >
      {rows.map((row) => {
        const podium = row.position <= PODIUM;
        return (
          <Box component="li" key={`${row.faction}-${row.rank}`} sx={rowSx(merged)}>
            <Typography
              component="span"
              variant="subtitle2"
              sx={(theme) => ({
                ...rankSx,
                fontVariantNumeric: "tabular-nums",
                fontWeight: podium ? 700 : 500,
                color: podium ? theme.palette.secondary.main : theme.palette.text.secondary,
              })}
            >
              <Box component="span" sx={visuallyHidden}>
                {merged ? "Position " : "Rank "}
              </Box>
              #{row.position}
            </Typography>

            <Box sx={{ gridArea: "guild", minWidth: 0 }}>
              <GuildName entry={row} />
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{ ...truncate, display: "block" }}
              >
                {row.guild.realmName}
              </Typography>
            </Box>

            <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75} sx={tagsSx(merged)}>
              <Chip
                size="small"
                variant="outlined"
                label={
                  <>
                    <Box component="span" sx={visuallyHidden}>
                      Region{" "}
                    </Box>
                    {row.region.toUpperCase() || "?"}
                  </>
                }
              />
              {merged ? (
                <Chip
                  size="small"
                  variant="outlined"
                  label={
                    <>
                      {FACTION_LABEL[row.faction]}{" "}
                      <Box component="span" sx={visuallyHidden}>
                        rank{" "}
                      </Box>
                      #{row.rank}
                    </>
                  }
                  sx={(theme) => ({
                    color: factionColor(theme, row.faction),
                    borderColor: alpha(factionColor(theme, row.faction), 0.5),
                    fontVariantNumeric: "tabular-nums",
                  })}
                />
              ) : null}
            </Stack>

            <Stack {...WHEN_LAYOUT}>
              <Typography
                component="time"
                dateTime={new Date(row.timestamp).toISOString()}
                variant="body2"
                sx={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatKillTime(row.timestamp)}
              </Typography>
              {row.position === 1 ? (
                <Typography
                  component="span"
                  variant="caption"
                  sx={{ color: "secondary.main", fontWeight: 600 }}
                >
                  {firstLabel(view)}
                </Typography>
              ) : (
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatGap(row.timestamp - firstKill)} after #1
                </Typography>
              )}
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
};

export default HallOfFameList;
