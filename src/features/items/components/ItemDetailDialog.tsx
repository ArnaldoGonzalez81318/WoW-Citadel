import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Button } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef } from "react";

import DetailDialog from "@/components/common/DetailDialog";
import type {
  DetailDialogRow,
  DetailDialogSection,
} from "@/components/common/DetailDialog";
import GoldAmount from "@/components/common/GoldAmount";
import {
  fetchItemDetail,
  fetchItemMediaUrl,
  itemKeys,
} from "@/features/items/services/itemService";
import type { ItemDetail } from "@/features/items/types";
import type { SearchResult } from "@/features/search/types";
import { getExternalLink } from "@/lib/externalLinks";
import { formatNumber, humanizeEnum } from "@/lib/format";

export type ItemDetailDialogProps = {
  item: SearchResult | null;
  open: boolean;
  onClose: () => void;
};

const isPositive = (value: number | undefined): value is number =>
  typeof value === "number" && value > 0;

const buildRows = (detail: ItemDetail | undefined): DetailDialogRow[] => {
  if (!detail) {
    return [];
  }

  const rows: DetailDialogRow[] = [];

  if (detail.quality) {
    rows.push({ label: "Quality", value: humanizeEnum(detail.quality) });
  }
  if (typeof detail.level === "number") {
    rows.push({ label: "Item level", value: formatNumber(detail.level) });
  }
  if (typeof detail.requiredLevel === "number") {
    rows.push({
      label: "Requires level",
      value: formatNumber(detail.requiredLevel),
    });
  }
  if (detail.itemClass) {
    rows.push({ label: "Class", value: detail.itemClass });
  }
  if (detail.itemSubclass) {
    rows.push({ label: "Subclass", value: detail.itemSubclass });
  }
  if (detail.inventoryType) {
    rows.push({ label: "Slot", value: detail.inventoryType });
  }
  if (detail.binding) {
    rows.push({ label: "Binding", value: detail.binding });
  }
  if (detail.isEquippable) {
    rows.push({ label: "Equippable", value: "Yes" });
  }
  if (isPositive(detail.maxCount) && detail.maxCount > 1) {
    rows.push({ label: "Max stack", value: formatNumber(detail.maxCount) });
  }
  if (isPositive(detail.purchasePrice)) {
    rows.push({
      label: "Purchase price",
      value: <GoldAmount copper={detail.purchasePrice} />,
    });
  }
  if (isPositive(detail.sellPrice)) {
    rows.push({
      label: "Sell price",
      value: <GoldAmount copper={detail.sellPrice} />,
    });
  }

  return rows;
};

/**
 * Item detail dialog on top of the shared `DetailDialog`. The media query
 * shares the card's cache key, so an already-loaded icon shows instantly.
 */
const ItemDetailDialog = ({
  item,
  open,
  onClose,
}: ItemDetailDialogProps): JSX.Element | null => {
  // Keep the last item through the close transition so the title never blanks.
  const lastItemRef = useRef<SearchResult | null>(null);
  if (item) {
    lastItemRef.current = item;
  }
  const shown = item ?? lastItemRef.current;
  const itemId = shown?.id ?? 0;
  const isActive = open && item !== null;

  const detailQuery = useQuery({
    queryKey: itemKeys.detail(itemId),
    queryFn: ({ signal }) => fetchItemDetail(itemId, signal),
    enabled: isActive,
  });

  const mediaQuery = useQuery({
    queryKey: itemKeys.media(itemId),
    queryFn: ({ signal }) => fetchItemMediaUrl(itemId, signal),
    enabled: isActive && !shown?.mediaUrl,
  });

  const detail = detailQuery.data;
  const fallbackDetails = shown?.details;
  const isDetailPending = detailQuery.isPending;
  // Facts from the detail record; while it is still loading, the card's
  // metadata line stands in as a single "Summary" row (never as prose).
  const rows = useMemo(
    () =>
      detail
        ? buildRows(detail)
        : isDetailPending && fallbackDetails
          ? [{ label: "Summary", value: fallbackDetails }]
          : [],
    [detail, fallbackDetails, isDetailPending],
  );

  if (!shown) {
    return null;
  }

  const sections: DetailDialogSection[] = detail?.description
    ? [{ heading: "Description", content: detail.description }]
    : [];

  const external =
    shown.externalUrl !== undefined
      ? { url: shown.externalUrl, label: shown.externalLabel ?? "View on Wowhead" }
      : getExternalLink("item", shown.id, shown.name);

  return (
    <DetailDialog
      open={open}
      onClose={onClose}
      title={shown.name}
      subtitle={detail?.itemSubclass ?? shown.subtitle}
      quality={shown.quality}
      media={{
        src: shown.mediaUrl ?? mediaQuery.data,
        alt: shown.name,
        kind: "icon",
        loading: !shown.mediaUrl && mediaQuery.isPending,
      }}
      loading={isDetailPending && rows.length === 0}
      error={detailQuery.error ?? undefined}
      onRetry={() => {
        void detailQuery.refetch();
      }}
      errorContext="item details"
      rows={rows}
      sections={sections}
      actions={
        external ? (
          <Button
            component="a"
            href={external.url}
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            endIcon={<OpenInNewRoundedIcon />}
          >
            {external.label}
          </Button>
        ) : undefined
      }
      maxWidth="sm"
    />
  );
};

export default ItemDetailDialog;
