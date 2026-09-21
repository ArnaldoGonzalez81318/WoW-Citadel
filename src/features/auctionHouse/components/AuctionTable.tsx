import {
  Box,
  Chip,
  Link,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";

import GoldAmount from "@/components/common/GoldAmount";
import MediaTile from "@/components/common/MediaTile";
import { EmptyState } from "@/components/common/StateBlocks";
import type {
  AuctionMarketView,
  AuctionSortKey,
  AuctionTableRow,
} from "@/features/auctionHouse/types";
import { formatNumber } from "@/lib/format";
import { getExternalLink } from "@/lib/externalLinks";
import { qualityColor, truncate } from "@/theme";

const SKELETON_ROWS = 10;
const ICON_SIZE = 40;

type SortableColumn = "name" | "quantity" | "price";

type AriaSort = "ascending" | "descending" | undefined;

const activeColumn = (sort: AuctionSortKey): SortableColumn =>
  sort === "name-asc" ? "name" : sort === "quantity-desc" ? "quantity" : "price";

const sortDirection = (sort: AuctionSortKey): "asc" | "desc" =>
  sort.endsWith("-asc") ? "asc" : "desc";

const nextSort = (column: SortableColumn, current: AuctionSortKey): AuctionSortKey => {
  switch (column) {
    case "name":
      return "name-asc";
    case "quantity":
      return "quantity-desc";
    default:
      return current === "price-desc" ? "price-asc" : "price-desc";
  }
};

const hideBelowSm: SxProps<Theme> = {
  display: { xs: "none", sm: "table-cell" },
};

const numericCell: SxProps<Theme> = {
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

/* ------------------------------------------------------------------ */
/* Cells                                                               */
/* ------------------------------------------------------------------ */

type SortHeaderProps = {
  column: SortableColumn;
  label: string;
  sort: AuctionSortKey;
  onSortChange: (sort: AuctionSortKey) => void;
  align?: "left" | "right";
  sx?: SxProps<Theme>;
};

const SortHeader = ({
  column,
  label,
  sort,
  onSortChange,
  align = "left",
  sx,
}: SortHeaderProps): JSX.Element => {
  const active = activeColumn(sort) === column;
  const direction = sortDirection(sort);
  const ariaSort: AriaSort = active
    ? direction === "asc"
      ? "ascending"
      : "descending"
    : undefined;

  return (
    <TableCell align={align} aria-sort={ariaSort} sx={sx}>
      <TableSortLabel
        active={active}
        direction={active ? direction : column === "name" ? "asc" : "desc"}
        onClick={() => onSortChange(nextSort(column, sort))}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );
};

const ItemCell = ({ row }: { row: AuctionTableRow }): JSX.Element => {
  const name = row.name ?? `Item #${row.itemId}`;
  const link = getExternalLink("item", row.itemId, row.name);
  const classLine = [row.itemClass, row.itemSubclass]
    .filter(
      (part, index, parts): part is string =>
        typeof part === "string" && part.length > 0 && parts.indexOf(part) === index,
    )
    .join(" · ");

  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
      <MediaTile
        src={row.mediaUrl}
        alt=""
        size={ICON_SIZE}
        fallbackLabel={name}
        quality={row.qualityKey}
        loading={row.summaryPending && !row.mediaUrl}
        radius="sm"
      />
      <Box sx={{ minWidth: 0 }}>
        {row.summaryPending ? (
          <>
            <Skeleton variant="text" width={160} sx={{ fontSize: "0.875rem" }} />
            <Skeleton variant="text" width={96} sx={{ fontSize: "0.75rem" }} />
          </>
        ) : (
          <>
            {link ? (
              <Link
                href={link.url}
                target="_blank"
                rel="noreferrer"
                variant="subtitle2"
                title={name}
                sx={(theme) => ({
                  ...truncate,
                  display: "block",
                  color: qualityColor(theme, row.qualityKey),
                })}
              >
                {name}
              </Link>
            ) : (
              <Typography
                variant="subtitle2"
                component="span"
                title={name}
                sx={(theme) => ({
                  ...truncate,
                  display: "block",
                  color: qualityColor(theme, row.qualityKey),
                })}
              >
                {name}
              </Typography>
            )}
            {classLine ? (
              <Typography
                variant="caption"
                component="span"
                color="text.secondary"
                title={classLine}
                sx={{ ...truncate, display: "block" }}
              >
                {classLine}
              </Typography>
            ) : null}
          </>
        )}
      </Box>
    </Stack>
  );
};

const TimeLeftCell = ({ row }: { row: AuctionTableRow }): JSX.Element => {
  const short = row.timeLeft === "SHORT";
  const chip = (
    <Chip
      size="small"
      label={row.timeLeftLabel}
      color={short ? "warning" : "default"}
      variant={short ? "filled" : "outlined"}
    />
  );

  return row.timeLeftHint ? (
    <Tooltip title={row.timeLeftHint} enterTouchDelay={0}>
      {chip}
    </Tooltip>
  ) : (
    chip
  );
};

const SkeletonRows = ({ columns }: { columns: number }): JSX.Element => (
  <>
    {Array.from({ length: SKELETON_ROWS }, (_, index) => (
      <TableRow key={index}>
        <TableCell>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Skeleton variant="rounded" width={ICON_SIZE} height={ICON_SIZE} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="60%" sx={{ fontSize: "0.875rem" }} />
              <Skeleton variant="text" width="35%" sx={{ fontSize: "0.75rem" }} />
            </Box>
          </Stack>
        </TableCell>
        {Array.from({ length: columns - 1 }, (_, cell) => (
          <TableCell key={cell} align="right">
            <Skeleton variant="text" width={64} sx={{ marginLeft: "auto" }} />
          </TableCell>
        ))}
      </TableRow>
    ))}
  </>
);

/* ------------------------------------------------------------------ */
/* Table                                                               */
/* ------------------------------------------------------------------ */

export type AuctionTableProps = {
  rows: AuctionTableRow[];
  view: AuctionMarketView;
  sort: AuctionSortKey;
  onSortChange: (sort: AuctionSortKey) => void;
  /** First load (no rows yet): ten skeleton rows. */
  loading?: boolean;
  /** Replaces the default "No listings" copy (e.g. no realm picked yet). */
  emptyState?: ReactNode;
};

/**
 * Sortable listing table: Item, Quantity, Listings (commodities), Price and
 * Time left. Prices render as coins via `GoldAmount`; names link to Wowhead.
 */
const AuctionTable = ({
  rows,
  view,
  sort,
  onSortChange,
  loading = false,
  emptyState,
}: AuctionTableProps): JSX.Element => {
  const commodities = view === "commodities";
  const columnCount = commodities ? 5 : 4;
  const priceLabel = commodities ? "Unit price" : "Buyout";

  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ overflowX: "auto", minWidth: 0 }}
    >
      <Table size="small" aria-label="Auction listings">
        <TableHead>
          <TableRow>
            <SortHeader column="name" label="Item" sort={sort} onSortChange={onSortChange} />
            <SortHeader
              column="quantity"
              label="Quantity"
              align="right"
              sort={sort}
              onSortChange={onSortChange}
              sx={hideBelowSm}
            />
            {commodities ? (
              <TableCell align="right" sx={hideBelowSm}>
                Listings
              </TableCell>
            ) : null}
            <SortHeader
              column="price"
              label={priceLabel}
              align="right"
              sort={sort}
              onSortChange={onSortChange}
            />
            <TableCell>Time left</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading && rows.length === 0 ? (
            <SkeletonRows columns={columnCount} />
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnCount} sx={{ padding: 2, borderBottom: 0 }}>
                {emptyState ?? (
                  <EmptyState
                    title="No listings"
                    description="Try the other market view or another connected realm"
                  />
                )}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.key} hover>
                <TableCell sx={{ minWidth: 220 }}>
                  <ItemCell row={row} />
                </TableCell>
                <TableCell align="right" sx={{ ...hideBelowSm, ...numericCell }}>
                  {formatNumber(row.quantity)}
                </TableCell>
                {commodities ? (
                  <TableCell align="right" sx={{ ...hideBelowSm, ...numericCell }}>
                    {formatNumber(row.listingCount)}
                  </TableCell>
                ) : null}
                <TableCell align="right" sx={numericCell}>
                  <GoldAmount copper={row.priceCopper} />
                </TableCell>
                <TableCell>
                  <TimeLeftCell row={row} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default AuctionTable;
