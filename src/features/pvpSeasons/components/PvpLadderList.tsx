import {
  Avatar,
  Box,
  LinearProgress,
  Link,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";

import { titleFromSlug } from "@/features/mythicLeaderboard/services/leaderboardService";
import FactionTag from "@/features/pvpSeasons/components/FactionTag";
import type { PvpLadderEntry } from "@/features/pvpSeasons/types";
import type { PvpTier } from "@/features/pvpTiers/types";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import { mixins, visuallyHidden } from "@/theme";

export type PvpLadderListProps = {
  entries: readonly PvpLadderEntry[];
  /** Tier id -> tier (name, icon) for the tiers on this page. */
  tiers: ReadonlyMap<number, PvpTier>;
  /** Tier ids still loading, which show a placeholder rather than nothing. */
  pendingTiers: ReadonlySet<number>;
  /** Realm slug -> display name, from the connected-realm catalog. */
  realmNames: ReadonlyMap<string, string>;
};

/** The official armory page: regional site, lowercase name. */
const armoryUrl = (entry: PvpLadderEntry): string | undefined =>
  entry.realmSlug
    ? `https://worldofwarcraft.blizzard.com/${env.locale.toLowerCase().replace("_", "-")}/character/${env.region}/${entry.realmSlug}/${encodeURIComponent(entry.name.toLowerCase())}`
    : undefined;

const percent = (ratio: number): string =>
  formatNumber(ratio, { style: "percent", maximumFractionDigits: 0 });

const ROW_COLUMNS = {
  xs: "auto minmax(0, 1fr) auto",
  md: "56px minmax(0, 1.4fr) minmax(0, 1fr) 72px 150px",
};
const ROW_AREAS = {
  xs: `"rank player rating" "rank tier record"`,
  md: `"rank player tier rating record"`,
};

/** Column titles for sighted readers on wide screens; each cell carries its own hidden label. */
const HeaderRow = (): JSX.Element => (
  <Box
    aria-hidden="true"
    sx={{
      display: { xs: "none", md: "grid" },
      gridTemplateColumns: ROW_COLUMNS.md,
      gridTemplateAreas: ROW_AREAS.md,
      gap: 2,
      px: 2,
      // The rows' border width, so the titles line up with their columns.
      border: "1px solid transparent",
      typography: "caption",
      color: "text.secondary",
    }}
  >
    <Box sx={{ gridArea: "rank" }}>Rank</Box>
    <Box sx={{ gridArea: "player" }}>Player</Box>
    <Box sx={{ gridArea: "tier" }}>Tier</Box>
    <Box sx={{ gridArea: "rating" }}>Rating</Box>
    <Box sx={{ gridArea: "record" }}>Won–lost</Box>
  </Box>
);

const TierCell = ({
  tierId,
  tier,
  pending,
}: {
  tierId?: number;
  tier?: PvpTier;
  pending: boolean;
}): JSX.Element | null => {
  if (tierId === undefined) {
    return null;
  }
  if (!tier && pending) {
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <Skeleton variant="rounded" width={28} height={28} />
        <Skeleton variant="text" width={72} sx={{ fontSize: "0.75rem" }} />
      </Stack>
    );
  }
  if (!tier) {
    return null;
  }
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
      {/* Decorative: the tier's name is right beside it. */}
      <Avatar
        alt=""
        src={tier.iconUrl ?? undefined}
        variant="rounded"
        sx={{ width: { xs: 24, md: 28 }, height: { xs: 24, md: 28 }, fontSize: "0.75rem", flexShrink: 0 }}
      >
        {tier.name.charAt(0)}
      </Avatar>
      <Typography
        component="span"
        variant="caption"
        color="text.secondary"
        sx={{ ...mixins.truncate, minWidth: 0 }}
      >
        <Box component="span" sx={visuallyHidden}>Tier </Box>
        {tier.name}
      </Typography>
    </Stack>
  );
};

/**
 * One page of a PvP ladder, best first: rank, the character (linked to the
 * armory) with realm and faction, rating tier, rating, and the season's
 * record with its win rate. A two-line row on phones, one line from md.
 */
const PvpLadderList = ({
  entries,
  tiers,
  pendingTiers,
  realmNames,
}: PvpLadderListProps): JSX.Element => (
  <Stack spacing={1}>
    <HeaderRow />
    <Box
      component="ol"
      // Safari drops the list role from a list-style:none list without it.
      role="list"
      aria-label="Ranked players"
      sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1 }}
    >
      {entries.map((entry) => {
        const href = armoryUrl(entry);
        const realm = realmNames.get(entry.realmSlug) ?? titleFromSlug(entry.realmSlug);
        const decided = entry.won + entry.lost;
        const ratio = decided > 0 ? entry.won / decided : undefined;
        const podium = entry.rank <= 3;
        return (
          <Box
            component="li"
            key={`${entry.rank}-${entry.characterId ?? entry.name}-${entry.realmSlug}`}
            sx={(theme) => ({
              display: "grid",
              alignItems: "center",
              columnGap: { xs: 1.5, md: 2 },
              rowGap: 0.75,
              gridTemplateColumns: ROW_COLUMNS,
              gridTemplateAreas: ROW_AREAS,
              px: { xs: 1.5, md: 2 },
              py: 1.25,
              border: `1px solid ${podium ? theme.palette.border.gold : theme.palette.border.subtle}`,
              borderRadius: `${theme.wc.radius.md}px`,
              bgcolor: "background.paper",
            })}
          >
            <Typography
              component="span"
              variant="subtitle2"
              sx={{
                gridArea: "rank",
                alignSelf: { xs: "start", md: "center" },
                color: podium ? "secondary.main" : "text.secondary",
                fontVariantNumeric: "tabular-nums",
                minWidth: { xs: 36, md: 0 },
              }}
            >
              <Box component="span" sx={visuallyHidden}>Rank </Box>#{formatNumber(entry.rank)}
            </Typography>

            <Box sx={{ gridArea: "player", minWidth: 0 }}>
              {href ? (
                <Link
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  underline="hover"
                  color="text.primary"
                  variant="subtitle2"
                  sx={{ ...mixins.truncate, display: "block" }}
                >
                  {entry.name}
                  <Box component="span" sx={visuallyHidden}> (armory, opens in a new tab)</Box>
                </Link>
              ) : (
                <Typography variant="subtitle2" component="span" sx={{ ...mixins.truncate, display: "block" }}>
                  {entry.name}
                </Typography>
              )}
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}
              >
                <Box component="span" sx={{ ...mixins.truncate, minWidth: 0 }}>{realm}</Box>
                {entry.faction ? (
                  <>
                    <Box component="span" aria-hidden="true">·</Box>
                    <FactionTag faction={entry.faction} />
                  </>
                ) : null}
              </Typography>
            </Box>

            <Box sx={{ gridArea: "tier", minWidth: 0 }}>
              <TierCell
                tierId={entry.tierId}
                tier={entry.tierId !== undefined ? tiers.get(entry.tierId) : undefined}
                pending={entry.tierId !== undefined && pendingTiers.has(entry.tierId)}
              />
            </Box>

            <Typography
              component="span"
              variant="h6"
              sx={{
                gridArea: "rating",
                margin: 0,
                justifySelf: { xs: "end", md: "start" },
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <Box component="span" sx={visuallyHidden}>Rating </Box>
              {formatNumber(entry.rating)}
            </Typography>

            <Stack
              spacing={0.5}
              sx={{ gridArea: "record", minWidth: 0, alignItems: { xs: "flex-end", md: "stretch" } }}
            >
              {/* Caption-sized on phones, so the name keeps most of a 320px row. */}
              <Typography
                component="span"
                sx={{
                  typography: { xs: "caption", md: "body2" },
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                }}
              >
                <Box component="span" sx={visuallyHidden}>Won </Box>
                {formatNumber(entry.won)}
                <Box component="span" aria-hidden="true">–</Box>
                <Box component="span" sx={visuallyHidden}>, lost </Box>
                {formatNumber(entry.lost)}
                {ratio !== undefined ? (
                  <Typography component="span" variant="caption" color="text.secondary">
                    {` · ${percent(ratio)}`}
                    <Box component="span" sx={visuallyHidden}> won</Box>
                  </Typography>
                ) : null}
              </Typography>
              {ratio !== undefined ? (
                // Decorative: the percentage is written out just above.
                <LinearProgress
                  aria-hidden="true"
                  variant="determinate"
                  value={ratio * 100}
                  color={ratio >= 0.5 ? "success" : "inherit"}
                  sx={{ display: { xs: "none", md: "block" }, height: 4, borderRadius: 2 }}
                />
              ) : null}
            </Stack>
          </Box>
        );
      })}
    </Box>
  </Stack>
);

export default PvpLadderList;
