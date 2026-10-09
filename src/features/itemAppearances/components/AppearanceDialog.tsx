import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Box, Button, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";

import DetailDialog from "@/components/common/DetailDialog";
import type { DetailDialogRow } from "@/components/common/DetailDialog";
import { EmptyState } from "@/components/common/StateBlocks";
import AppearanceItemList from "@/features/itemAppearances/components/AppearanceItemList";
import {
  appearanceItemQuery,
  appearanceKeys,
  appearanceQuery,
  itemIconQuery,
} from "@/features/itemAppearances/hooks/appearanceQueries";
import useRetainedFailure from "@/features/itemAppearances/hooks/useRetainedFailure";
import { appearanceTypeLine } from "@/features/itemAppearances/services/appearanceService";
import { WOWHEAD_LABEL, wowheadUrl } from "@/lib/externalLinks";
import { formatNumber } from "@/lib/format";
import { visuallyHidden } from "@/theme";

export type AppearanceDialogProps = {
  /** Whether the dialog is showing; `appearanceId` stays set through the close transition. */
  open: boolean;
  appearanceId: number | null;
  onClose: () => void;
};

/** The raw appearance record, in the API workbench (catalog slug and endpoint id). */
const workbenchUrl = (appearanceId: number): string =>
  `/api-explorer/item-appearance?${new URLSearchParams({
    endpoint: "item-appearance",
    appearanceId: String(appearanceId),
  }).toString()}`;

const Mono = ({ value }: { value: number }): JSX.Element => (
  <Box component="span" sx={(theme) => ({ fontFamily: theme.wc.fontMono })}>
    {value}
  </Box>
);

/**
 * One look in full, named after the first item that wears it (appearances
 * have no name of their own) and coloured by that item's quality: its slot,
 * armor or weapon type, the display info id the game client draws it from,
 * and every item that shares it. Blizzard's API serves no render of the
 * look itself, so the icon is the first item's.
 */
const AppearanceDialog = ({ open, appearanceId, onClose }: AppearanceDialogProps): JSX.Element => {
  const enabled = appearanceId !== null;
  const query = useQuery({ ...appearanceQuery(appearanceId ?? 0, "dialog"), enabled });
  const failure = useRetainedFailure(appearanceKeys.appearance(appearanceId ?? 0), query);
  const appearance = enabled ? query.data : undefined;
  const notFound = enabled && query.data === null;

  const [firstItem] = appearance?.items ?? [];
  const firstRecord = useQuery({
    ...appearanceItemQuery(firstItem?.id ?? 0),
    enabled: firstItem !== undefined,
  });
  const icon = useQuery({
    ...itemIconQuery(firstItem?.id ?? 0, "dialog"),
    enabled: firstItem !== undefined,
  });

  const title = firstItem?.name ?? (appearanceId !== null ? `Appearance ${appearanceId}` : "");
  const typeLine = appearance ? appearanceTypeLine(appearance) : "";
  const subtitle = appearance
    ? [appearance.slot?.name ? `${appearance.slot.name} appearance` : "Appearance", typeLine]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  const rows: DetailDialogRow[] = [];
  if (appearance) {
    if (appearance.slot) {
      rows.push({ label: "Slot", value: appearance.slot.name || appearance.slot.type });
    }
    if (appearance.itemClass) {
      rows.push({ label: "Item class", value: appearance.itemClass.name });
    }
    if (appearance.itemSubclass) {
      rows.push({ label: "Type", value: appearance.itemSubclass.name });
    }
    rows.push({ label: "Items with this look", value: formatNumber(appearance.items.length) });
    if (appearance.displayInfoId !== undefined) {
      rows.push({ label: "Display info ID", value: <Mono value={appearance.displayInfoId} /> });
    }
    rows.push({ label: "Appearance ID", value: <Mono value={appearance.id} /> });
  }

  const wowhead = firstItem ? wowheadUrl("item", firstItem.id) : undefined;

  const renderBody = (): JSX.Element | null => {
    if (notFound) {
      return (
        <EmptyState
          compact
          title="Appearance not found"
          description={`Blizzard has no item appearance #${appearanceId ?? ""} in its game data.`}
        />
      );
    }
    if (!appearance) {
      return null;
    }
    return (
      <Stack spacing={2}>
        <AppearanceItemList key={appearance.id} items={appearance.items} />
        <Typography
          variant="caption"
          color="text.secondary"
          component="p"
          sx={{ m: 0, maxWidth: "72ch" }}
        >
          Blizzard&apos;s API serves no model render or 3D preview of an appearance: the icon is the
          first item&apos;s, and the display info id names the model only inside the game client.
        </Typography>
      </Stack>
    );
  };

  return (
    <DetailDialog
      open={open && enabled}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      quality={firstRecord.data?.quality}
      media={{
        kind: "icon",
        src: icon.data ?? null,
        alt: "",
        loading:
          (enabled && query.isPending && !failure.failed) ||
          (firstItem !== undefined && icon.isPending),
      }}
      rows={rows}
      maxWidth="sm"
      loading={enabled && query.isPending && !failure.failed}
      error={failure.error ?? undefined}
      onRetry={failure.retry}
      errorContext="this appearance"
      actions={
        appearanceId !== null ? (
          // Wraps at phone width instead of pushing the dialog sideways.
          <Stack
            direction="row"
            flexWrap="wrap"
            useFlexGap
            gap={1}
            justifyContent="flex-end"
            sx={{ width: "100%" }}
          >
            <Button component={RouterLink} to={workbenchUrl(appearanceId)} size="small">
              Open in API workbench
            </Button>
            {wowhead && firstItem ? (
              <Button
                href={wowhead}
                target="_blank"
                rel="noreferrer"
                size="small"
                endIcon={<OpenInNewRoundedIcon />}
              >
                {WOWHEAD_LABEL}
                <Box component="span" sx={visuallyHidden}>
                  {`: ${firstItem.name}, opens in a new tab`}
                </Box>
              </Button>
            ) : null}
          </Stack>
        ) : null
      }
    >
      {renderBody()}
    </DetailDialog>
  );
};

export default AppearanceDialog;
