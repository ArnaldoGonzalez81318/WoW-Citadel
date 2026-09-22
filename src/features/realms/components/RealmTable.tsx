import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import {
  Box,
  ButtonBase,
  Chip,
  Skeleton,
  Tooltip,
  Typography,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { memo } from "react";
import type { ReactNode } from "react";

import { LoadingSkeleton } from "@/components/common/StateBlocks";
import VirtualizedCardGrid from "@/components/common/VirtualizedCardGrid";
import { statusChipColor } from "@/features/connectedRealms/services/connectedRealmService";
import type {
  RealmSort,
  RealmSortDirection,
  RealmSortKey,
} from "@/features/realms/hooks/useRealmDirectory";
import {
  parseRealmSort,
  REALM_ROW_HEIGHT,
  realmTypeLabel,
} from "@/features/realms/hooks/useRealmDirectory";
import type { RealmDirectoryRow } from "@/features/realms/types";
import { formatLocale, formatTimezone } from "@/lib/format";
import { focusRing, truncate } from "@/theme";

const SKELETON_ROWS = 12;

const GRID_TEMPLATE = "minmax(200px,2fr) 1fr 1.2fr 1.4fr 1.2fr 0.9fr";

const EMPTY = "—";

type ColumnDefinition = {
  key: RealmSortKey;
  label: string;
};

const COLUMNS: readonly ColumnDefinition[] = [
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
  { key: "category", label: "Category" },
  { key: "timezone", label: "Time zone" },
  { key: "locale", label: "Locale" },
  { key: "status", label: "Status" },
];

const rowAriaLabel = (row: RealmDirectoryRow): string =>
  [
    row.name,
    realmTypeLabel(row),
    row.category,
    row.timezone ? formatTimezone(row.timezone) : undefined,
    row.locale ? formatLocale(row.locale) : undefined,
    row.statusLabel,
  ]
    .filter((part): part is string => Boolean(part && part.length > 0))
    .join(", ");

const cellSx = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 1,
  paddingInline: 1.5,
};

const rowGridSx = {
  display: "grid",
  gridTemplateColumns: GRID_TEMPLATE,
  alignItems: "center",
  width: "100%",
};

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

type HeaderCellProps = {
  column: ColumnDefinition;
  activeKey: RealmSortKey;
  direction: RealmSortDirection;
  onSort: (key: RealmSortKey) => void;
};

const HeaderCell = ({
  column,
  activeKey,
  direction,
  onSort,
}: HeaderCellProps): JSX.Element => {
  const active = column.key === activeKey;
  const directionLabel = direction === "asc" ? "ascending" : "descending";
  const label = active
    ? `Sort by ${column.label.toLowerCase()}, ${directionLabel}`
    : `Sort by ${column.label.toLowerCase()}`;
  const Arrow = direction === "asc" ? ArrowUpwardRounded : ArrowDownwardRounded;

  return (
    <ButtonBase
      aria-label={label}
      aria-pressed={active}
      onClick={() => onSort(column.key)}
      sx={(theme: Theme) => ({
        ...cellSx,
        justifyContent: "flex-start",
        height: 40,
        borderRadius: `${theme.wc.radius.sm}px`,
        color: active ? theme.palette.text.primary : theme.palette.text.secondary,
        transition: theme.transitions.create(["color", "background-color"], {
          duration: theme.wc.motion.fast,
        }),
        "&:hover": { backgroundColor: theme.palette.action.hover },
        "&.Mui-focusVisible": focusRing(theme, true),
      })}
    >
      <Typography
        variant="overline"
        component="span"
        sx={{ ...truncate, color: "inherit", lineHeight: 1 }}
      >
        {column.label}
      </Typography>
      <Arrow
        aria-hidden="true"
        sx={{
          fontSize: 14,
          flexShrink: 0,
          opacity: active ? 1 : 0,
        }}
      />
    </ButtonBase>
  );
};

/* ------------------------------------------------------------------ */
/* Cells                                                               */
/* ------------------------------------------------------------------ */

type TextCellProps = {
  children: ReactNode;
  title?: string;
  emphasis?: boolean;
};

const TextCell = ({ children, title, emphasis = false }: TextCellProps): JSX.Element => (
  <Typography
    variant={emphasis ? "subtitle2" : "body2"}
    component="span"
    title={title}
    sx={{
      ...truncate,
      display: "block",
      minWidth: 0,
      fontVariantNumeric: "tabular-nums",
      color: emphasis ? "text.primary" : "text.secondary",
    }}
  >
    {children}
  </Typography>
);

const StatusCell = ({
  row,
  pending,
}: {
  row: RealmDirectoryRow;
  pending: boolean;
}): JSX.Element => {
  if (row.statusLabel) {
    return (
      <Chip
        size="small"
        label={row.statusLabel}
        color={statusChipColor(row.statusType)}
        variant={row.statusType ? "filled" : "outlined"}
      />
    );
  }

  if (pending) {
    return <Skeleton variant="text" width={48} sx={{ fontSize: "0.875rem" }} />;
  }

  return (
    <Typography
      variant="body2"
      component="span"
      color="text.secondary"
      aria-label="Status unavailable"
    >
      {EMPTY}
    </Typography>
  );
};

/* ------------------------------------------------------------------ */
/* Row                                                                 */
/* ------------------------------------------------------------------ */

type RealmRowProps = {
  row: RealmDirectoryRow;
  statusPending: boolean;
  onSelect: (row: RealmDirectoryRow) => void;
};

// Memoised: the virtual grid re-renders on every range change while `rows`,
// `onSelect` and `statusPending` stay referentially stable.
const RealmRow = memo(({ row, statusPending, onSelect }: RealmRowProps): JSX.Element => {
  const typeLabel = realmTypeLabel(row);
  const timezone = row.timezone ? formatTimezone(row.timezone) : undefined;
  const locale = row.locale ? formatLocale(row.locale) : undefined;

  return (
    <ButtonBase
      aria-label={rowAriaLabel(row)}
      onClick={() => onSelect(row)}
      sx={(theme: Theme) => ({
        ...rowGridSx,
        height: REALM_ROW_HEIGHT,
        textAlign: "left",
        borderBottom: `1px solid ${theme.palette.border.subtle}`,
        borderRadius: `${theme.wc.radius.sm}px`,
        transition: theme.transitions.create("background-color", {
          duration: theme.wc.motion.fast,
        }),
        "&:hover": { backgroundColor: theme.palette.action.hover },
        "&.Mui-focusVisible": focusRing(theme, true),
      })}
    >
      <Box sx={cellSx}>
        <TextCell emphasis title={row.name}>
          {row.name}
        </TextCell>
        {row.isTournament ? (
          <Chip size="small" label="Tournament" color="warning" variant="outlined" />
        ) : null}
      </Box>
      <Box sx={cellSx}>
        <TextCell>{typeLabel || EMPTY}</TextCell>
      </Box>
      <Box sx={cellSx}>
        <TextCell title={row.category}>{row.category || EMPTY}</TextCell>
      </Box>
      <Box sx={cellSx}>
        {timezone ? (
          <Tooltip title={row.timezone ?? ""} enterTouchDelay={0}>
            <Typography
              variant="body2"
              component="span"
              sx={{
                ...truncate,
                display: "block",
                minWidth: 0,
                fontVariantNumeric: "tabular-nums",
                color: "text.secondary",
              }}
            >
              {timezone}
            </Typography>
          </Tooltip>
        ) : (
          <TextCell>{EMPTY}</TextCell>
        )}
      </Box>
      <Box sx={cellSx}>
        <TextCell title={row.locale}>{locale || EMPTY}</TextCell>
      </Box>
      <Box sx={cellSx}>
        <StatusCell row={row} pending={statusPending} />
      </Box>
    </ButtonBase>
  );
});

RealmRow.displayName = "RealmRow";

/* ------------------------------------------------------------------ */
/* Table                                                               */
/* ------------------------------------------------------------------ */

export type RealmTableProps = {
  rows: RealmDirectoryRow[];
  sort: RealmSort;
  onSortChange: (sort: RealmSort) => void;
  onSelect: (row: RealmDirectoryRow) => void;
  /** Connected-realm status still loading: status cells show a skeleton. */
  statusPending?: boolean;
  /** Distance from the viewport top at which the header sticks (px). */
  stickyOffset?: number;
  /** First load: the header stays and the rows become a same-height skeleton. */
  loading?: boolean;
  emptyState?: ReactNode;
};

/**
 * Sortable realm directory for md+ screens: a sticky header row above a
 * window-virtualised list of 56px rows.
 */
const RealmTable = ({
  rows,
  sort,
  onSortChange,
  onSelect,
  statusPending = false,
  stickyOffset,
  loading = false,
  emptyState,
}: RealmTableProps): JSX.Element => {
  const { key: activeKey, direction } = parseRealmSort(sort);

  const handleSort = (key: RealmSortKey): void => {
    if (key === activeKey) {
      onSortChange(`${key}-${direction === "asc" ? "desc" : "asc"}`);
      return;
    }
    onSortChange(`${key}-asc`);
  };

  return (
    <Box sx={{ minWidth: 0 }}>
      <Box
        role="group"
        aria-label="Sort realms"
        sx={(theme: Theme) => ({
          ...rowGridSx,
          position: { md: "sticky" },
          top: { md: stickyOffset ?? theme.wc.layout.headerHeight.md },
          zIndex: theme.zIndex.appBar - 2,
          backgroundColor: theme.palette.surface.base,
          borderBottom: `1px solid ${theme.palette.border.default}`,
        })}
      >
        {COLUMNS.map((column) => (
          <HeaderCell
            key={column.key}
            column={column}
            activeKey={activeKey}
            direction={direction}
            onSort={handleSort}
          />
        ))}
      </Box>

      {loading ? (
        <LoadingSkeleton
          variant="rows"
          itemHeight={REALM_ROW_HEIGHT}
          count={SKELETON_ROWS}
          gap={0}
          label="Loading realms"
        />
      ) : (
        <VirtualizedCardGrid
          items={rows}
          columns={{ xs: 1 }}
          itemHeight={REALM_ROW_HEIGHT}
          gap={0}
          aria-label="Realms"
          getItemKey={(row) => row.id}
          renderItem={(row) => (
            <RealmRow row={row} statusPending={statusPending} onSelect={onSelect} />
          )}
          emptyState={emptyState}
        />
      )}
    </Box>
  );
};

export default RealmTable;
