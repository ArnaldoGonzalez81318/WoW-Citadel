import { Avatar, Box, Chip, Stack, Tooltip, Typography } from "@mui/material";

import { formatTimer } from "@/features/mythicKeystone/services/mythicKeystoneService";
import type { KeystoneTimer } from "@/features/mythicKeystone/types";
import { titleFromSlug } from "@/features/mythicLeaderboard/services/leaderboardService";
import type {
  LeaderboardMember,
  LeaderboardRun,
  Specialization,
} from "@/features/mythicLeaderboard/types";
import { env } from "@/lib/env";
import { formatNumber, formatRelativeTime } from "@/lib/format";
import { visuallyHidden } from "@/theme";

export type LeaderboardRunListProps = {
  runs: LeaderboardRun[];
  /** The dungeon's keystone timers (+1 first), to rate each clear. */
  timers: KeystoneTimer[];
  specs: ReadonlyMap<number, Specialization>;
  /** Realm slug -> display name, from the connected-realm catalog. */
  realmNames: ReadonlyMap<string, string>;
  now: number;
};

const ROLE_ORDER: Record<NonNullable<Specialization["role"]>, number> = {
  TANK: 0,
  HEALER: 1,
  DAMAGE: 2,
};

/** Tank, healer, then damage, as every M+ tool lists a party; Blizzard's order is arbitrary. */
const byRole =
  (specs: ReadonlyMap<number, Specialization>) =>
  (left: LeaderboardMember, right: LeaderboardMember): number => {
    const rank = (member: LeaderboardMember): number => {
      const role = member.specId ? specs.get(member.specId)?.role : undefined;
      return role ? ROLE_ORDER[role] : 3;
    };
    return rank(left) - rank(right);
  };

/** "+3" for a clear under the +3 threshold, … "+1" in time, "Over time" otherwise. */
const upgradeOf = (durationMs: number, timers: KeystoneTimer[]): string | undefined => {
  if (timers.length === 0) {
    return undefined;
  }
  const earned = [...timers]
    .reverse()
    .find((timer) => durationMs <= timer.durationMs);
  return earned ? `+${earned.level}` : "Over time";
};

/** The official armory page: regional site, lowercase name. */
const armoryUrl = (member: LeaderboardMember): string | undefined =>
  member.realmSlug
    ? `https://worldofwarcraft.blizzard.com/${env.locale.toLowerCase().replace("_", "-")}/character/${env.region}/${member.realmSlug}/${encodeURIComponent(member.name.toLowerCase())}`
    : undefined;

const MemberChip = ({
  member,
  spec,
  realmName,
}: {
  member: LeaderboardMember;
  spec?: Specialization;
  realmName: string;
}): JSX.Element => {
  const specLabel = spec ? [spec.name, spec.className].filter(Boolean).join(" ") : undefined;
  const description = [specLabel, realmName].filter(Boolean).join(" · ");
  const href = armoryUrl(member);
  return (
    // Not describeChild: the chip's aria-label already carries the spec and realm.
    <Tooltip title={description}>
      <Chip
        size="small"
        variant="outlined"
        avatar={
          <Avatar alt="" src={spec?.iconUrl ?? undefined}>
            {member.name.charAt(0)}
          </Avatar>
        }
        label={member.name}
        aria-label={`${member.name}, ${description}`}
        {...(href
          ? { component: "a", href, target: "_blank", rel: "noreferrer", clickable: true }
          : {})}
        sx={{ maxWidth: 180 }}
      />
    </Tooltip>
  );
};

/**
 * The page's runs, best first: rank, key level, clear time against the
 * timer (and the upgrade it earned), rating in Blizzard's colour, the party
 * as spec-icon chips linking to the armory, and when it was completed.
 */
const LeaderboardRunList = ({
  runs,
  timers,
  specs,
  realmNames,
  now,
}: LeaderboardRunListProps): JSX.Element => {
  const [timer] = timers;
  const order = byRole(specs);

  return (
    <Box
      component="ol"
      // Safari drops the list role from a list-style:none list without it.
      role="list"
      aria-label="Top runs"
      sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1 }}
    >
      {runs.map((run) => {
        const upgrade = upgradeOf(run.durationMs, timers);
        const overTime = upgrade === "Over time";
        return (
          <Box
            component="li"
            key={`${run.ranking}-${run.completedTimestamp ?? ""}-${run.members.map((member) => member.name).join()}`}
            sx={(theme) => ({
              display: "grid",
              alignItems: "center",
              gap: { xs: 1, md: 2 },
              gridTemplateColumns: {
                xs: "auto auto 1fr auto",
                md: "48px 56px 150px minmax(0, 1fr) 84px 110px",
              },
              gridTemplateAreas: {
                xs: `"rank level time rating" "party party party party" "when when when when"`,
                md: `"rank level time party rating when"`,
              },
              px: 2,
              py: 1.5,
              border: `1px solid ${theme.palette.border.subtle}`,
              borderRadius: `${theme.wc.radius.md}px`,
              bgcolor: "background.paper",
            })}
          >
            <Typography
              component="span"
              variant="subtitle2"
              color="text.secondary"
              sx={{ gridArea: "rank", fontVariantNumeric: "tabular-nums" }}
            >
              <Box component="span" sx={visuallyHidden}>Rank </Box>#{run.ranking}
            </Typography>
            <Typography
              component="span"
              variant="h6"
              sx={{ gridArea: "level", margin: 0, fontVariantNumeric: "tabular-nums" }}
            >
              <Box component="span" sx={visuallyHidden}>Keystone level </Box>+{run.keystoneLevel}
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ gridArea: "time", minWidth: 0 }}
            >
              <Typography
                component="span"
                variant="body2"
                sx={{ fontVariantNumeric: "tabular-nums" }}
              >
                {/* Rounded up: 30:00.3 is over a 30:00 timer and must not read as 30:00. */}
                {formatTimer(Math.ceil(run.durationMs / 1000) * 1000)}
                {timer ? (
                  <Typography component="span" variant="caption" color="text.secondary">
                    {` / ${formatTimer(timer.durationMs)}`}
                  </Typography>
                ) : null}
              </Typography>
              {upgrade ? (
                <Chip
                  size="small"
                  label={upgrade}
                  color={overTime ? "default" : "success"}
                  variant={overTime ? "outlined" : "filled"}
                />
              ) : null}
            </Stack>
            <Stack
              direction="row"
              flexWrap="wrap"
              useFlexGap
              gap={0.75}
              sx={{ gridArea: "party", minWidth: 0 }}
              role="group"
              aria-label="Party"
            >
              {/* Re-sorted once every spec is known, so chips do not move under the pointer. */}
              {(run.members.every(
                (member) => member.specId === undefined || specs.has(member.specId),
              )
                ? [...run.members].sort(order)
                : run.members
              ).map((member) => (
                <MemberChip
                  key={`${member.name}-${member.realmSlug}`}
                  member={member}
                  spec={member.specId ? specs.get(member.specId) : undefined}
                  realmName={realmNames.get(member.realmSlug) ?? titleFromSlug(member.realmSlug)}
                />
              ))}
            </Stack>
            <Typography
              component="span"
              variant="subtitle2"
              sx={{
                gridArea: "rating",
                justifySelf: { xs: "end", md: "start" },
                color: run.rating?.color ?? "text.primary",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <Box component="span" sx={visuallyHidden}>Rating </Box>
              {run.rating ? formatNumber(run.rating.value, { maximumFractionDigits: 1 }) : "—"}
            </Typography>
            <Typography
              component="span"
              variant="caption"
              color="text.secondary"
              sx={{ gridArea: "when" }}
            >
              {/* Clamped: a client clock behind Blizzard's must not read "in 2 minutes". */}
              {run.completedTimestamp
                ? formatRelativeTime(Math.min(run.completedTimestamp, now), now)
                : ""}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

export default LeaderboardRunList;
