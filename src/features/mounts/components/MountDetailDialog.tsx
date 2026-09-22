import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Box, Button, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";

import DetailDialog from "@/components/common/DetailDialog";
import type {
  DetailDialogRow,
  DetailDialogSection,
} from "@/components/common/DetailDialog";
import {
  fetchCreatureDisplayImage,
  fetchMountDetail,
  mountKeys,
} from "@/features/mounts/services/mountService";
import type { MountGalleryResult } from "@/features/mounts/types";
import { getExternalLink } from "@/lib/externalLinks";

export type MountDetailDialogProps = {
  mount: MountGalleryResult | null;
  open: boolean;
  onClose: () => void;
};

/**
 * Mount detail dialog on top of the shared `DetailDialog`. Artwork comes
 * from the card when it already loaded it; otherwise the creature display
 * id (from the search row or the detail record) fetches it on demand.
 */
const MountDetailDialog = ({
  mount,
  open,
  onClose,
}: MountDetailDialogProps): JSX.Element | null => {
  // Keep the last mount through the close transition so the title never blanks.
  const lastMountRef = useRef<MountGalleryResult | null>(null);
  if (mount) {
    lastMountRef.current = mount;
  }
  const shown = mount ?? lastMountRef.current;
  const mountId = shown?.id ?? 0;
  const isActive = open && mount !== null;

  const detailQuery = useQuery({
    queryKey: mountKeys.detail(mountId),
    queryFn: ({ signal }) => fetchMountDetail(mountId, signal),
    enabled: isActive,
  });

  const detail = detailQuery.data;
  const displayId = shown?.displayId ?? detail?.displayId;
  const needsMedia = isActive && !shown?.mediaUrl;

  const mediaQuery = useQuery({
    queryKey: mountKeys.artwork(mountId, displayId),
    queryFn: ({ signal }) =>
      fetchCreatureDisplayImage(displayId as number, signal),
    enabled: needsMedia && typeof displayId === "number",
  });

  if (!shown) {
    return null;
  }

  const source = detail?.source ?? shown.summary;
  const description = (detail?.description ?? shown.details)?.trim() ?? "";

  // `source` is Blizzard's localized display name ("Trading Card Game"),
  // not an enum code, so it is shown as-is to match the card's meta line.
  const rows: DetailDialogRow[] = [];
  if (source) {
    rows.push({ label: "Source", value: source });
  }
  rows.push({
    label: "Mount ID",
    value: (
      <Box component="span" sx={(theme) => ({ fontFamily: theme.wc.fontMono })}>
        {shown.id}
      </Box>
    ),
  });

  const sections: DetailDialogSection[] = description
    ? [{ heading: "Description", content: description }]
    : detailQuery.isSuccess
      ? [
          {
            heading: "Description",
            content: (
              <Typography
                variant="body2"
                component="p"
                color="text.secondary"
                sx={{ margin: 0 }}
              >
                No description available.
              </Typography>
            ),
          },
        ]
      : [];

  const external =
    shown.externalUrl !== undefined
      ? { url: shown.externalUrl, label: shown.externalLabel ?? "View on Wowhead" }
      : getExternalLink("mount", shown.id, shown.name);

  // Artwork is still on its way while the detail record (which carries the
  // display id) or the media itself is pending.
  const mediaLoading =
    !shown.mediaUrl &&
    (mediaQuery.isPending &&
      (typeof displayId === "number" || detailQuery.isPending));

  return (
    <DetailDialog
      open={open}
      onClose={onClose}
      title={shown.name}
      media={{
        src: shown.mediaUrl ?? mediaQuery.data,
        alt: shown.name,
        kind: "artwork",
        loading: mediaLoading,
      }}
      loading={detailQuery.isPending}
      error={detailQuery.error ?? undefined}
      onRetry={() => {
        void detailQuery.refetch();
      }}
      errorContext="mount details"
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
      maxWidth="md"
    />
  );
};

export default MountDetailDialog;
