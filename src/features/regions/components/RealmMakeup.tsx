import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import { Box, Button, Stack, Typography } from "@mui/material";
import { useId } from "react";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import type { GridColumns } from "@/components/common/gridColumns";
import {
  EmptyState,
  ErrorState,
  LiveStatus,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import BarList from "@/features/regions/components/BarList";
import type { BarListEntry } from "@/features/regions/components/BarList";
import type { RegionColumn } from "@/features/regions/hooks/useRegionOverview";
import { realmStatusUrl } from "@/features/regions/services/regionService";
import type { RegionRealmMakeup } from "@/features/regions/types";
import { env } from "@/lib/env";
import {
  formatNumber,
  formatRelativeTime,
  formatTimezone,
  toBcp47,
} from "@/lib/format";
import { visuallyHidden } from "@/theme";

export type RealmMakeupProps = {
  column: RegionColumn;
  now: number;
};

const PANEL_COLS: GridColumns = { xs: 1, md: 2, lg: 3 };
/**
 * A typical panel (heading, note, five or six bars); the real ones range from
 * one bar (Korea's single time zone) to seven (Europe's languages).
 */
const PANEL_SKELETON_HEIGHT = 320;
const PANEL_COUNT = 6;
const REALMS_PATH = "/category/realm";
const CONNECTED_REALMS_PATH = "/connected-realms";
const REALM_UNIT = ["realm", "realms"] as const;
const CONNECTED_UNIT = ["connected realm", "connected realms"] as const;

/** One formatter per zone; an unknown zone yields none (no clock shown). */
const clockFormatters = new Map<string, Intl.DateTimeFormat | null>();

const clockFor = (timeZone: string): Intl.DateTimeFormat | null => {
  if (!clockFormatters.has(timeZone)) {
    try {
      clockFormatters.set(
        timeZone,
        new Intl.DateTimeFormat(toBcp47(env.locale), {
          timeZone,
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
        }),
      );
    } catch {
      clockFormatters.set(timeZone, null);
    }
  }
  return clockFormatters.get(timeZone) ?? null;
};

const Panel = ({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}): JSX.Element => {
  const titleId = useId();
  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={(theme) => ({
        minWidth: 0,
        p: 2,
        border: `1px solid ${theme.palette.border.subtle}`,
        borderRadius: `${theme.wc.radius.md}px`,
        backgroundColor: theme.palette.surface.sunken,
      })}
    >
      <Typography id={titleId} variant="subtitle1" component="h3" sx={{ m: 0, fontWeight: 700 }}>
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0, mb: 1.5 }}>
        {note}
      </Typography>
      {children}
    </Box>
  );
};

const StatusFacts = ({ makeup }: { makeup: RegionRealmMakeup }): JSX.Element => {
  const facts: Array<{ label: string; value: number }> = [
    { label: "Up", value: makeup.connectedRealms - makeup.down },
    { label: "Down", value: makeup.down },
    { label: "With a login queue", value: makeup.queued },
    { label: "Tournament realms", value: makeup.tournamentRealms },
  ];
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 1,
      }}
    >
      {facts.map((fact) => (
        <Box
          key={fact.label}
          sx={(theme) => ({
            minWidth: 0,
            px: 1.5,
            py: 1,
            borderRadius: `${theme.wc.radius.sm}px`,
            backgroundColor: theme.palette.surface.inset,
          })}
        >
          <Typography component="dt" variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {fact.label}
          </Typography>
          <Typography
            component="dd"
            variant="h5"
            sx={{ m: 0, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
          >
            {formatNumber(fact.value)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

/**
 * One region's realms broken down six ways from its connected-realm search:
 * population tiers (per connected realm), time zones with the local time
 * there, languages, Blizzard's realm categories, rulesets, and status. Links
 * lead to the app's realm explorers for its own region and to Blizzard's
 * status page for any region.
 */
const RealmMakeup = ({ column, now }: RealmMakeupProps): JSX.Element => {
  const { region, isHome, tag, record, makeup } = column;
  const name = record.data?.name ?? tag;
  const data = makeup.data;
  const at = new Date(now);

  const summary = (() => {
    if (data) {
      return `${name}: ${formatNumber(data.connectedRealms)} connected realms holding ${formatNumber(data.realms)} realms`;
    }
    if (makeup.isError) {
      return `${name}: realm makeup unavailable`;
    }
    return `Loading ${name}'s realm makeup`;
  })();

  const renderBody = (): JSX.Element => {
    if (makeup.isPending) {
      return (
        <LoadingSkeleton
          variant="grid"
          columns={PANEL_COLS}
          itemHeight={PANEL_SKELETON_HEIGHT}
          count={PANEL_COUNT}
          label={`Loading ${name}'s realm makeup`}
        />
      );
    }
    if (makeup.isError || !data) {
      return (
        <ErrorState
          error={makeup.error}
          context={`${name}'s connected realms`}
          onRetry={() => void makeup.refetch()}
        />
      );
    }
    if (data.connectedRealms === 0) {
      return (
        <EmptyState
          icon={<LayersRoundedIcon />}
          title={`No connected realms listed for ${name}`}
          description="Blizzard's connected-realm search for this region came back empty. The counts above still come from its realm indexes."
        />
      );
    }

    const timezoneEntries: BarListEntry[] = data.timezones.map((entry) => {
      const clock = clockFor(entry.key);
      return {
        key: entry.key,
        label: formatTimezone(entry.key, at),
        count: entry.count,
        detail: clock ? `Now ${clock.format(at)}` : entry.key,
      };
    });

    return (
      <Box sx={{ display: "grid", gap: 2, ...gridTemplateColumnsSx(PANEL_COLS) }}>
        <Panel title="Population" note="Connected realms per login population tier">
          <BarList
            label={`Population tiers in ${tag}`}
            entries={data.population}
            total={data.connectedRealms}
            unit={CONNECTED_UNIT}
          />
        </Panel>
        <Panel title="Time zones" note="Realms per server time zone, with the time there now">
          <BarList
            label={`Time zones in ${tag}`}
            entries={timezoneEntries}
            total={data.realms}
            unit={REALM_UNIT}
          />
        </Panel>
        <Panel title="Languages" note="Realms per game client language">
          <BarList
            label={`Realm languages in ${tag}`}
            entries={data.languages}
            total={data.realms}
            unit={REALM_UNIT}
          />
        </Panel>
        <Panel title="Categories" note="Blizzard's own realm list groupings">
          <BarList
            label={`Realm categories in ${tag}`}
            entries={data.categories}
            total={data.realms}
            unit={REALM_UNIT}
          />
        </Panel>
        <Panel title="Rulesets" note="Realms per ruleset">
          <BarList
            label={`Rulesets in ${tag}`}
            entries={data.rulesets}
            total={data.realms}
            unit={REALM_UNIT}
          />
        </Panel>
        {/* The makeup is not polled (it is the page's heavy request), so the
            note dates the counts by when they were fetched instead of
            calling them live; the page clock moves it along. */}
        <Panel
          title="Status"
          note={`Connected realms as of ${formatRelativeTime(Math.min(makeup.dataUpdatedAt, now), now)}, and tournament realms`}
        >
          <StatusFacts makeup={data} />
        </Panel>
      </Box>
    );
  };

  return (
    <Stack spacing={2} useFlexGap sx={{ minWidth: 0 }}>
      <LiveStatus busy={makeup.isFetching}>{summary}</LiveStatus>

      {renderBody()}

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        useFlexGap
        flexWrap="wrap"
        alignItems={{ xs: "stretch", sm: "center" }}
      >
        {isHome ? (
          <>
            <Button size="small" variant="outlined" component={RouterLink} to={REALMS_PATH}>
              Browse {tag} realms
            </Button>
            <Button size="small" variant="outlined" component={RouterLink} to={CONNECTED_REALMS_PATH}>
              Browse {tag} connected realms
            </Button>
          </>
        ) : null}
        <Button
          size="small"
          variant="text"
          href={realmStatusUrl(region, env.locale)}
          target="_blank"
          rel="noreferrer"
          endIcon={<LaunchRoundedIcon />}
        >
          {tag} realm status on Blizzard
          <Box component="span" sx={visuallyHidden}>
            {" (opens in a new tab)"}
          </Box>
        </Button>
      </Stack>
      {isHome ? null : (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
          This site&apos;s Realms and Connected Realms explorers cover{" "}
          {env.region.toUpperCase()} only, the region it is built for.
        </Typography>
      )}
    </Stack>
  );
};

export default RealmMakeup;
