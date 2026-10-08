import {
  Box,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import type { ReactNode } from "react";

import GoldAmount from "@/components/common/GoldAmount";
import Unavailable from "@/features/regions/components/Unavailable";
import type { RegionColumn } from "@/features/regions/hooks/useRegionOverview";
import type { MakeupEntry } from "@/features/regions/types";
import { formatNumber, formatRelativeTime, formatTimezone } from "@/lib/format";
import { focusRing, visuallyHidden } from "@/theme";

export type RegionComparisonTableProps = {
  columns: readonly RegionColumn[];
  now: number;
  /**
   * Id for the table's caption, which names the scroller. Not the section
   * title: the section is already a region with that name, and two nested
   * regions with one name read as a duplicate landmark.
   */
  captionId: string;
};

type Source = "record" | "token" | "counts" | "makeup";

type RowSpec = {
  key: string;
  label: string;
  /** A short note under the label, for rows whose meaning is not obvious. */
  hint?: string;
  /** Every query the cell needs; it waits for (and fails with) any of them. */
  sources: readonly Source[];
  render: (column: RegionColumn, now: number) => ReactNode;
  /**
   * A comparable value: when the regions disagree, cells that differ from
   * the most common value are marked (a patch still rolling out).
   */
  compare?: (column: RegionColumn) => string | undefined;
};

type GroupSpec = {
  key: string;
  label: string;
  rows: readonly RowSpec[];
};

/**
 * Narrower on phones, where the sticky fact column would otherwise leave
 * barely a region's width to scroll through.
 */
const FACT_COLUMN_WIDTH = { xs: 124, sm: 188 } as const;
const REGION_COLUMN_MIN_WIDTH = { xs: 136, sm: 156 } as const;

/** Opaque, with an edge, so the regions scrolling beneath it read as passing under. */
const stickyColumnSx = (theme: Theme) => ({
  position: "sticky" as const,
  left: 0,
  backgroundColor: theme.palette.background.paper,
  boxShadow: `inset -1px 0 0 ${theme.palette.border.subtle}`,
});

/** The app's own region, echoing its highlighted card above. */
const homeColumnSx = (theme: Theme) => ({
  backgroundColor: alpha(theme.palette.primary.main, 0.08),
});

const plural = (count: number, singular: string, many: string): string =>
  `${formatNumber(count)} ${count === 1 ? singular : many}`;

/** "6 · mostly Chicago (UTC−5)", or just the one entry when there is one. */
const mostly = (
  entries: readonly MakeupEntry[],
  format: (entry: MakeupEntry) => string,
): ReactNode => {
  const [top] = entries;
  if (!top) {
    return <Unavailable label="None listed" />;
  }
  return entries.length === 1
    ? format(top)
    : `${formatNumber(entries.length)} · mostly ${format(top)}`;
};

const GROUPS: readonly GroupSpec[] = [
  {
    key: "record",
    label: "Region record",
    rows: [
      {
        key: "name",
        label: "Name",
        sources: ["record"],
        render: ({ record }) => record.data?.name ?? <Unavailable label="Not listed" />,
      },
      {
        key: "id",
        label: "Region id",
        sources: ["record"],
        render: ({ record }) =>
          record.data ? formatNumber(record.data.id) : <Unavailable label="Not listed" />,
      },
      {
        key: "patch",
        label: "Patch",
        sources: ["record"],
        render: ({ record }) => record.data?.patch ?? <Unavailable label="Not listed" />,
        compare: ({ record }) => record.data?.patch,
      },
    ],
  },
  {
    key: "token",
    label: "WoW Token",
    rows: [
      {
        key: "price",
        label: "Price",
        sources: ["token"],
        render: ({ token }) => <GoldAmount copper={token.data?.price} />,
      },
      {
        key: "updated",
        label: "Updated",
        sources: ["token"],
        render: ({ token }, now) => {
          if (!token.data) {
            return <Unavailable />;
          }
          const at = Math.min(token.data.lastUpdated.getTime(), now);
          return (
            <time dateTime={token.data.lastUpdated.toISOString()}>
              {formatRelativeTime(at, now)}
            </time>
          );
        },
      },
    ],
  },
  {
    key: "realms",
    label: "Realms",
    rows: [
      {
        key: "connected",
        label: "Connected realms",
        sources: ["counts"],
        render: ({ counts }) => formatNumber(counts.data?.connectedRealms),
      },
      {
        key: "listed",
        label: "Realms listed",
        hint: "Every record in the realm index",
        sources: ["counts"],
        render: ({ counts }) => formatNumber(counts.data?.realms),
      },
      {
        key: "grouped",
        label: "In connected realms",
        hint: "The realms characters live on",
        sources: ["makeup"],
        render: ({ makeup }) => formatNumber(makeup.data?.realms),
      },
      {
        // Every realm record outside a connected realm was an internal
        // server in all four regions when checked (US1A Account Realm,
        // EU Arena Pass CSBG, GMSupport TW2-01, …), hence the label.
        key: "internal",
        label: "Internal servers",
        hint: "Account, instance, battleground and GM-support records",
        sources: ["counts", "makeup"],
        render: ({ counts, makeup }) =>
          counts.data && makeup.data
            ? formatNumber(Math.max(0, counts.data.realms - makeup.data.realms))
            : <Unavailable />,
      },
    ],
  },
  {
    key: "makeup",
    label: "Realm makeup",
    rows: [
      {
        key: "rulesets",
        label: "Rulesets",
        sources: ["makeup"],
        render: ({ makeup }) =>
          makeup.data && makeup.data.rulesets.length > 0
            ? makeup.data.rulesets
                .map((entry) => `${formatNumber(entry.count)} ${entry.label}`)
                .join(" · ")
            : <Unavailable label="None listed" />,
      },
      {
        key: "timezones",
        label: "Time zones",
        sources: ["makeup"],
        render: ({ makeup }, now) =>
          mostly(makeup.data?.timezones ?? [], (entry) =>
            formatTimezone(entry.key, new Date(now)),
          ),
      },
      {
        key: "languages",
        label: "Languages",
        sources: ["makeup"],
        render: ({ makeup }) =>
          mostly(makeup.data?.languages ?? [], (entry) => entry.label),
      },
      {
        key: "population",
        label: "Population",
        hint: "Connected realms per tier",
        sources: ["makeup"],
        render: ({ makeup }) =>
          makeup.data && makeup.data.population.length > 0
            ? makeup.data.population
                .map((entry) => `${formatNumber(entry.count)} ${entry.label}`)
                .join(" · ")
            : <Unavailable label="None listed" />,
      },
      {
        key: "status",
        label: "Status",
        sources: ["makeup"],
        render: ({ makeup }) => {
          const data = makeup.data;
          if (!data || data.connectedRealms === 0) {
            return <Unavailable label="None listed" />;
          }
          return data.down === 0
            ? `All ${formatNumber(data.connectedRealms)} up`
            : `${formatNumber(data.down)} of ${formatNumber(data.connectedRealms)} down`;
        },
      },
      {
        key: "queues",
        label: "Login queues",
        sources: ["makeup"],
        render: ({ makeup }) =>
          makeup.data
            ? makeup.data.queued === 0
              ? "None"
              : plural(makeup.data.queued, "connected realm", "connected realms")
            : <Unavailable />,
      },
    ],
  },
];

type CellState = "pending" | "error" | "ready";

const cellState = (column: RegionColumn, sources: readonly Source[]): CellState => {
  const queries = sources.map((source) => column[source]);
  if (queries.some((query) => query.isError && query.data === undefined)) {
    return "error";
  }
  if (queries.some((query) => query.isPending)) {
    return "pending";
  }
  return "ready";
};

/** Cells whose value differs from the row's most common one, by region. */
const outliersOf = (
  row: RowSpec,
  columns: readonly RegionColumn[],
): ReadonlySet<string> => {
  if (!row.compare) {
    return new Set();
  }
  const values = columns.map((column) => row.compare?.(column));
  const tally = new Map<string, number>();
  values.forEach((value) => {
    if (value !== undefined) {
      tally.set(value, (tally.get(value) ?? 0) + 1);
    }
  });
  if (tally.size < 2) {
    return new Set();
  }
  const [mode] = [...tally.entries()].sort((left, right) => right[1] - left[1])[0];
  return new Set(
    columns
      .filter((_, index) => values[index] !== undefined && values[index] !== mode)
      .map((column) => column.region),
  );
};

/**
 * Facts down the side, the four regions across the top. The app's own
 * region's column is tinted to match its card; a value that differs from
 * the other regions (a patch still rolling out) is marked in gold, with a
 * hidden note for screen readers. The fact column stays put while the
 * regions scroll sideways on narrow screens; the scroller takes focus so a
 * keyboard can scroll it too.
 */
const RegionComparisonTable = ({
  columns,
  now,
  captionId,
}: RegionComparisonTableProps): JSX.Element => (
  <TableContainer
    role="region"
    aria-labelledby={captionId}
    tabIndex={0}
    sx={(theme) => ({
      overflowX: "auto",
      minWidth: 0,
      "&:focus-visible": focusRing(theme, true),
    })}
  >
    <Table
      size="small"
      sx={{
        minWidth: {
          xs: FACT_COLUMN_WIDTH.xs + columns.length * REGION_COLUMN_MIN_WIDTH.xs,
          sm: FACT_COLUMN_WIDTH.sm + columns.length * REGION_COLUMN_MIN_WIDTH.sm,
        },
        tableLayout: "fixed",
      }}
    >
      <Box component="caption" id={captionId} sx={visuallyHidden}>
        Region facts compared across the four API regions
      </Box>
      <TableHead>
        <TableRow>
          <TableCell
            scope="col"
            sx={(theme) => ({
              ...stickyColumnSx(theme),
              zIndex: 2,
              width: FACT_COLUMN_WIDTH,
            })}
          >
            Fact
          </TableCell>
          {columns.map((column) => (
            <TableCell
              key={column.region}
              scope="col"
              sx={(theme) => ({
                ...(column.isHome
                  ? {
                      ...homeColumnSx(theme),
                      boxShadow: `inset 0 -2px 0 ${theme.palette.primary.main}`,
                    }
                  : {}),
              })}
            >
              <Box
                component="span"
                sx={{ display: "block", fontWeight: 800, letterSpacing: "0.04em" }}
              >
                {column.tag}
              </Box>
              {column.isHome ? (
                <Typography
                  variant="caption"
                  component="span"
                  sx={{ display: "block", color: "primary.light", textTransform: "none" }}
                >
                  This site&apos;s region
                </Typography>
              ) : null}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      {GROUPS.map((group) => (
        <TableBody key={group.key}>
          <TableRow>
            <TableCell
              component="th"
              scope="rowgroup"
              colSpan={columns.length + 1}
              sx={(theme) => ({
                backgroundColor: theme.palette.surface.sunken,
                py: 0.75,
              })}
            >
              {/* The cell spans the scroller; its text sticks like the fact column. */}
              <Typography
                variant="overline"
                component="span"
                sx={{
                  position: "sticky",
                  left: 16,
                  display: "inline-block",
                  color: "secondary.main",
                  lineHeight: 1.6,
                }}
              >
                {group.label}
              </Typography>
            </TableCell>
          </TableRow>
          {group.rows.map((row) => {
            const outliers = outliersOf(row, columns);
            return (
              <TableRow key={row.key}>
                <TableCell
                  component="th"
                  scope="row"
                  sx={(theme) => ({
                    ...stickyColumnSx(theme),
                    zIndex: 1,
                    width: FACT_COLUMN_WIDTH,
                  })}
                >
                  <Typography variant="body2" component="span" sx={{ display: "block", fontWeight: 700 }}>
                    {row.label}
                  </Typography>
                  {row.hint ? (
                    <Typography
                      variant="caption"
                      component="span"
                      color="text.secondary"
                      sx={{ display: "block", lineHeight: 1.4 }}
                    >
                      {row.hint}
                    </Typography>
                  ) : null}
                </TableCell>
                {columns.map((column) => {
                  const state = cellState(column, row.sources);
                  const differs = outliers.has(column.region);
                  return (
                    <TableCell
                      key={column.region}
                      sx={(theme) => ({
                        typography: "body2",
                        fontVariantNumeric: "tabular-nums",
                        overflowWrap: "anywhere",
                        color: differs
                          ? theme.palette.secondary.light
                          : theme.palette.text.primary,
                        fontWeight: differs ? 700 : undefined,
                        ...(column.isHome ? homeColumnSx(theme) : {}),
                      })}
                    >
                      {state === "pending" ? (
                        <>
                          <Skeleton width="60%" aria-hidden="true" />
                          <Box component="span" sx={visuallyHidden}>
                            Loading
                          </Box>
                        </>
                      ) : state === "error" ? (
                        <Unavailable label="Not loaded" />
                      ) : (
                        <>
                          {row.render(column, now)}
                          {differs ? (
                            <Box component="span" sx={visuallyHidden}>
                              {" (differs from the other regions)"}
                            </Box>
                          ) : null}
                        </>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      ))}
    </Table>
  </TableContainer>
);

export default RegionComparisonTable;
