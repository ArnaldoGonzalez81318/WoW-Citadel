import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Box, Button, Skeleton, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";

import DetailDialog from "@/components/common/DetailDialog";
import type { DetailDialogRow } from "@/components/common/DetailDialog";
import { EmptyState, LiveStatus } from "@/components/common/StateBlocks";
import { findNavItemBySlug } from "@/components/layout/navigation/navConfig";
import AssetVariantList, {
  CopyButton,
} from "@/features/mediaSearch/components/AssetVariantList";
import {
  assetKeyLabel,
  kindConfig,
  lowerFirst,
  workbenchUrl,
} from "@/features/mediaSearch/config/mediaKinds";
import {
  mediaOwnerQuery,
  mediaRecordQuery,
} from "@/features/mediaSearch/hooks/mediaSearchQueries";
import useClipboardCopy from "@/features/mediaSearch/hooks/useClipboardCopy";
import { parseMediaPath } from "@/features/mediaSearch/services/mediaSearchService";
import type { MediaAsset, MediaRecord } from "@/features/mediaSearch/types";
import { getExternalLink } from "@/lib/externalLinks";

export type MediaDetailDialogProps = {
  /** Whether the dialog is showing; `path` stays set through the close transition. */
  open: boolean;
  /** The record's media path (the last one opened). */
  path: string | null;
  /** The record as the grid already has it; a shared link fetches it instead. */
  knownRecord?: MediaRecord;
  onClose: () => void;
};

const plural = (count: number, singular: string, pluralForm: string): string =>
  `${count} ${count === 1 ? singular : pluralForm}`;

/** "1 icon", "2 images": what the record's assets are. */
const describeAssets = (record: MediaRecord): string => {
  if (record.assets.length === 0) {
    return "None";
  }
  const keys = new Set(record.assets.map((asset) => asset.key));
  if (keys.size === 1) {
    const label = lowerFirst(assetKeyLabel(record.assets[0].key));
    return plural(record.assets.length, label, `${label}s`);
  }
  return plural(record.assets.length, "image", "images");
};

/** "Icon · file 135349", "Model render · key zoom", "Icon 2 · file 608953". */
const assetHeading = (asset: MediaAsset, index: number, count: number): string => {
  const label = assetKeyLabel(asset.key);
  return [
    count > 1 ? `${label} ${index + 1}` : label,
    label.toLowerCase() === asset.key ? undefined : `key ${asset.key}`,
    asset.fileDataId !== null ? `file ${asset.fileDataId}` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
};

/**
 * A media record in full: every asset at every size the render CDN serves
 * (each previewed and measured, with its URL to copy), the file id, the API
 * path, and the record it belongs to by name, with links to its explorer,
 * the API workbench and Wowhead where those exist.
 */
const MediaDetailDialog = ({
  open,
  path,
  knownRecord,
  onClose,
}: MediaDetailDialogProps): JSX.Element => {
  const parsed = path ? parseMediaPath(path) : null;
  const known = knownRecord && knownRecord.path === path ? knownRecord : undefined;

  const recordQuery = useQuery({
    ...mediaRecordQuery(path ?? ""),
    enabled: open && parsed !== null && known === undefined,
  });
  const record = known ?? recordQuery.data ?? undefined;
  const kind = kindConfig(parsed?.kind ?? "");

  const ownerQuery = useQuery({
    ...mediaOwnerQuery(parsed?.kind ?? "", parsed?.id ?? 0),
    enabled: open && parsed !== null && kind.ownerPath !== undefined,
  });

  const { status: copyStatus, copy } = useClipboardCopy();

  const title = parsed ? `${kind.label} media ${parsed.id}` : "";
  const apiPath = parsed ? `/data/wow/media/${parsed.path}` : "";
  const recordPending = known === undefined && recordQuery.isPending;
  const notFound = known === undefined && recordQuery.isSuccess && recordQuery.data === null;

  /* ---------------- Facts ---------------- */

  const rows: DetailDialogRow[] = [];
  if (parsed) {
    if (kind.ownerPath) {
      rows.push({
        label: "Belongs to",
        value: ownerQuery.isPending ? (
          <Skeleton variant="text" width={180} />
        ) : ownerQuery.isError ? (
          <Box component="span" sx={{ display: "inline-flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
            <span>Name unavailable</span>
            <Button size="small" onClick={() => void ownerQuery.refetch()}>
              Retry
            </Button>
          </Box>
        ) : (
          ownerQuery.data ??
          kind.missingOwnerNote ??
          `No ${lowerFirst(kind.label)} ${parsed.id} in Blizzard's data`
        ),
      });
    }
    rows.push({ label: "Kind", value: kind.label });
    parsed.parentIds.forEach((parentId, index) => {
      rows.push({
        label: kind.parentLabels?.[index] ?? "Parent",
        value: String(parentId),
      });
    });
    rows.push({ label: "Media id", value: String(parsed.id) });
    rows.push({
      label: "API path",
      value: (
        <Box component="span" sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 1 }}>
          <Box
            component="code"
            sx={(theme) => ({ fontFamily: theme.wc.fontMono, fontSize: "0.8125rem", wordBreak: "break-all" })}
          >
            {apiPath}
          </Box>
          <CopyButton
            value={apiPath}
            context="API path"
            label="Copy"
            status={copyStatus}
            onCopy={copy}
          />
        </Box>
      ),
    });
    if (record) {
      rows.push({ label: "Assets", value: describeAssets(record) });
    }
  }

  /* ---------------- Links ---------------- */

  const wowhead = parsed && kind.wowhead ? getExternalLink(kind.wowhead, parsed.id) : undefined;
  const explorer = kind.explorerSlug ? findNavItemBySlug(kind.explorerSlug) : undefined;
  // The explorer is only asked to open a record that exists: most profession
  // media ids are skill tiers, which it would fetch as professions, 404 on
  // and drop, leaving nothing selected.
  const explorerTo =
    explorer && parsed
      ? kind.explorerParam && typeof ownerQuery.data === "string"
        ? `${explorer.path}?${new URLSearchParams({ [kind.explorerParam]: String(parsed.id) }).toString()}`
        : explorer.path
      : undefined;

  const actions = parsed ? (
    // Wraps on phones: three buttons do not fit 320px on one line.
    <Stack direction="row" flexWrap="wrap" useFlexGap gap={1} justifyContent="flex-end" sx={{ flex: 1, minWidth: 0 }}>
      {explorer && explorerTo ? (
        <Button component={RouterLink} to={explorerTo} size="small">
          {`${explorer.label} explorer`}
        </Button>
      ) : null}
      {kind.workbench ? (
        <Button component={RouterLink} to={workbenchUrl(kind.workbench, parsed.id)} size="small">
          Open in API workbench
        </Button>
      ) : null}
      {wowhead ? (
        <Button
          href={wowhead.url}
          target="_blank"
          rel="noreferrer"
          size="small"
          endIcon={<OpenInNewRoundedIcon />}
        >
          {wowhead.label}
        </Button>
      ) : null}
    </Stack>
  ) : null;

  /* ---------------- Body ---------------- */

  const renderAssets = (): JSX.Element | null => {
    if (notFound) {
      return (
        <EmptyState
          compact
          title="No media record here"
          description={`Blizzard's media index has nothing at ${parsed?.path ?? "this path"}. The id may be mistyped, or the record was removed in a patch.`}
        />
      );
    }
    if (!record) {
      return null;
    }
    if (record.assets.length === 0) {
      return (
        <EmptyState
          compact
          title="No image for this record"
          description="Blizzard lists this record in its media index without any asset, as it does for most retired glyphs and some keystone affixes."
        />
      );
    }
    return (
      <Stack spacing={2.5}>
        {record.assets.map((asset, index) => (
          <Box component="section" key={`${asset.key}-${asset.url}`}>
            <Typography variant="overline" component="h3" sx={{ margin: 0, marginBottom: 0.75 }}>
              {assetHeading(asset, index, record.assets.length)}
            </Typography>
            <AssetVariantList asset={asset} copyStatus={copyStatus} onCopy={copy} />
          </Box>
        ))}
      </Stack>
    );
  };

  return (
    <DetailDialog
      open={open && parsed !== null}
      onClose={onClose}
      title={title}
      maxWidth="md"
      rows={rows}
      loading={recordPending}
      error={known === undefined && recordQuery.isError ? recordQuery.error : undefined}
      onRetry={() => void recordQuery.refetch()}
      errorContext="this media record"
      actions={actions}
    >
      {renderAssets()}
      <LiveStatus visuallyHidden>
        {copyStatus
          ? copyStatus.ok
            ? "Copied to the clipboard."
            : "Could not copy. Select the text and copy it by hand."
          : ""}
      </LiveStatus>
    </DetailDialog>
  );
};

export default MediaDetailDialog;
