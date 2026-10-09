import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import {
  Box,
  Button,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";

import DetailDialog from "@/components/common/DetailDialog";
import type { DetailDialogRow, DetailDialogSection } from "@/components/common/DetailDialog";
import GoldAmount from "@/components/common/GoldAmount";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import { idTextSx } from "@/features/housingDecor/components/housingStyles";
import {
  decorIconQuery,
  decorItemQuery,
  decorQuery,
} from "@/features/housingDecor/hooks/housingQueries";
import useHeldFailure from "@/features/housingDecor/hooks/useHeldFailure";
import { pluralize } from "@/features/housingDecor/services/housingCatalog";
import type { DecorItem, DyeSlot } from "@/features/housingDecor/types";
import { WOWHEAD_LABEL, wowheadUrl } from "@/lib/externalLinks";
import { formatNumber } from "@/lib/format";
import { qualityColor, visuallyHidden } from "@/theme";

export type DecorDialogProps = {
  /** Whether the dialog is showing; `decorId` stays set through the close transition. */
  open: boolean;
  /** The decor to show (the last one opened). */
  decorId: number | null;
  /** Its name from the index, shown until the record lands. */
  fallbackName?: string;
  onClose: () => void;
};

/** The raw decor record, in the API workbench (catalog slug and endpoint id). */
const workbenchUrl = (decorId: number): string =>
  `/api-explorer/housing-decor?${new URLSearchParams({
    endpoint: "decor",
    decorId: String(decorId),
  }).toString()}`;

const Mono = ({ children }: { children: number }): JSX.Element => (
  <Box component="span" sx={idTextSx}>
    {children}
  </Box>
);

/** Dye slots in Blizzard's order, each with the dye family it takes. */
const DyeSlotList = ({ slots }: { slots: DyeSlot[] }): JSX.Element => (
  <Stack
    component="ul"
    role="list"
    direction="row"
    flexWrap="wrap"
    useFlexGap
    gap={0.75}
    sx={{ listStyle: "none", m: 0, p: 0 }}
  >
    {slots.map((slot) => (
      <Box component="li" key={`${slot.index}-${slot.category}`}>
        <Chip
          size="small"
          variant="outlined"
          label={`Slot ${slot.index + 1} · ${slot.category}`}
        />
      </Box>
    ))}
  </Stack>
);

/** The item's tooltip lines, as rows of the dialog's fact list. */
const itemRows = (item: DecorItem): DetailDialogRow[] => {
  const rows: DetailDialogRow[] = [];
  if (item.qualityName) {
    rows.push({
      label: "Quality",
      value: (
        <Box
          component="span"
          sx={(theme) => ({ color: qualityColor(theme, item.quality), fontWeight: 600 })}
        >
          {item.qualityName}
        </Box>
      ),
    });
  }
  if (item.binding) {
    rows.push({ label: "Binding", value: item.binding });
  }
  item.requirements.forEach((requirement) => {
    rows.push({ label: "Requirement", value: requirement });
  });
  rows.push({
    label: "Sell price",
    value:
      item.sellPrice > 0 ? <GoldAmount copper={item.sellPrice} /> : "Vendors don't buy it",
  });
  return rows;
};

/**
 * A decor in full: the icon and quality of the item that adds it to the
 * House Chest, that item's binding, use text, requirements, flavor text and
 * sell price, the decor's dye slots and default collection count, and links
 * to Wowhead (by item) and the raw record. Blizzard's API has no decor
 * renders, so the item's 56px icon is the only image.
 */
const DecorDialog = ({
  open,
  decorId,
  fallbackName,
  onClose,
}: DecorDialogProps): JSX.Element => {
  const enabled = decorId !== null;
  const query = useQuery({ ...decorQuery(decorId ?? 0), enabled });
  const failure = useHeldFailure(query);
  const decor = enabled ? query.data : undefined;
  const notFound = enabled && query.data === null;

  const itemId = decor?.item?.id;
  const itemQuery = useQuery({ ...decorItemQuery(itemId ?? 0), enabled: itemId !== undefined });
  const itemFailure = useHeldFailure(itemQuery);
  const item = itemId !== undefined ? itemQuery.data : undefined;
  const iconQuery = useQuery({ ...decorIconQuery(itemId ?? 0), enabled: itemId !== undefined });

  const title =
    decor?.name ?? fallbackName ?? (decorId !== null ? `Decor #${decorId}` : "");
  const firstLoad = enabled && query.isPending && !failure.failed;

  const rows: DetailDialogRow[] = [];
  const sections: DetailDialogSection[] = [];
  // While the item loads, stand-ins for what nearly every decor item has (a
  // quality, a binding, a sell price and its "Use:" line), so the dialog
  // does not grow under the reader when it lands.
  const itemPending = itemId !== undefined && itemQuery.isPending && !itemFailure.failed;
  if (decor) {
    if (item) {
      rows.push(...itemRows(item));
    } else if (itemPending) {
      ["Quality", "Binding", "Sell price"].forEach((label) => {
        rows.push({ label, value: <Skeleton variant="text" width={120} /> });
      });
    }
    rows.push({
      label: "Dye slots",
      value: decor.dyeSlots.length > 0 ? <DyeSlotList slots={decor.dyeSlots} /> : "None",
    });
    if (decor.defaultCollectionCount !== undefined) {
      rows.push({
        label: "Default collection count",
        value: formatNumber(decor.defaultCollectionCount),
      });
    }
    if (decor.item) {
      rows.push({ label: "Item ID", value: <Mono>{decor.item.id}</Mono> });
    }
    rows.push({ label: "Decor ID", value: <Mono>{decor.id}</Mono> });

    if (itemPending) {
      sections.push({ heading: "Use", content: <Skeleton variant="text" width="80%" /> });
    } else if (item && item.effects.length > 0) {
      sections.push({
        heading: "Use",
        content: (
          <Stack spacing={0.5}>
            {item.effects.map((effect) => (
              <Typography
                key={effect}
                variant="body2"
                component="p"
                sx={{ m: 0, color: "success.light" }}
              >
                {effect}
              </Typography>
            ))}
          </Stack>
        ),
      });
    }
    if (item?.description) {
      sections.push({
        heading: "Description",
        content: (
          <Typography
            variant="body2"
            component="p"
            sx={{ m: 0, fontStyle: "italic", color: "secondary.light" }}
          >
            {item.description}
          </Typography>
        ),
      });
    }
  }

  const renderNotes = (): JSX.Element | null => {
    if (!decor) {
      return null;
    }
    if (!decor.item) {
      return (
        <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
          Blizzard&apos;s record links no item to this decor, so there is no icon or
          item detail to show.
        </Typography>
      );
    }
    if (itemFailure.failed) {
      return (
        <ErrorState
          compact
          error={itemFailure.error}
          context="the item's details"
          onRetry={itemFailure.retry}
          retryLabel={itemFailure.retrying ? "Retrying…" : "Retry"}
        />
      );
    }
    if (item === null) {
      return (
        <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
          {`Blizzard has no record of item ${decor.item.id}, the item this decor names.`}
        </Typography>
      );
    }
    return null;
  };

  const wowhead = itemId !== undefined ? wowheadUrl("item", itemId) : undefined;

  return (
    <DetailDialog
      open={open && enabled}
      onClose={onClose}
      title={title}
      subtitle={
        item?.typeLine ??
        (decor?.dyeSlots.length
          ? `Housing decor · ${pluralize(decor.dyeSlots.length, "dye slot", "dye slots")}`
          : "Housing decor")
      }
      quality={item?.quality}
      media={
        notFound
          ? undefined
          : {
              kind: "icon",
              src: iconQuery.data ?? null,
              alt: "",
              loading: firstLoad || (itemId !== undefined && iconQuery.isPending),
            }
      }
      rows={rows.length > 0 ? rows : undefined}
      sections={sections.length > 0 ? sections : undefined}
      loading={firstLoad}
      error={failure.failed ? failure.error : undefined}
      onRetry={failure.retry}
      errorContext="this decor"
      actions={
        decorId !== null ? (
          // Wraps at phone width instead of pushing the dialog sideways.
          <Stack
            direction="row"
            flexWrap="wrap"
            useFlexGap
            gap={1}
            justifyContent="flex-end"
            sx={{ width: "100%" }}
          >
            <Button component={RouterLink} to={workbenchUrl(decorId)} size="small">
              Open in API workbench
            </Button>
            {wowhead ? (
              <Button
                href={wowhead}
                target="_blank"
                rel="noreferrer"
                size="small"
                endIcon={<OpenInNewRoundedIcon />}
              >
                {WOWHEAD_LABEL}
                <Box component="span" sx={visuallyHidden}>
                  {`: ${title}, opens in a new tab`}
                </Box>
              </Button>
            ) : null}
          </Stack>
        ) : null
      }
    >
      {notFound ? (
        <EmptyState
          compact
          title="Decor not found"
          description={`Blizzard has no decor #${decorId ?? ""} in its game data.`}
        />
      ) : (
        renderNotes()
      )}
    </DetailDialog>
  );
};

export default DecorDialog;
