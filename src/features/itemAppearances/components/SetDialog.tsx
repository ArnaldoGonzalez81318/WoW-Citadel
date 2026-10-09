import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Box, Button, Stack, Typography } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useId } from "react";
import { Link as RouterLink } from "react-router-dom";

import DetailDialog from "@/components/common/DetailDialog";
import type { DetailDialogRow } from "@/components/common/DetailDialog";
import { FilterChipGroup } from "@/components/common/ExplorerFilterBar";
import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import SetPieceCard from "@/features/itemAppearances/components/SetPieceCard";
import {
  appearanceKeys,
  appearanceQuery,
  itemIconQuery,
  setQuery,
} from "@/features/itemAppearances/hooks/appearanceQueries";
import useRetainedFailure from "@/features/itemAppearances/hooks/useRetainedFailure";
import { pluralize } from "@/features/itemAppearances/services/appearanceService";
import type { AppearanceSet, SetGroup } from "@/features/itemAppearances/types";
import { wowheadSearchUrl } from "@/lib/externalLinks";
import { formatNumber } from "@/lib/format";
import { visuallyHidden } from "@/theme";

export type SetDialogProps = {
  /** Whether the dialog is showing; `setId` stays set through the close transition. */
  open: boolean;
  setId: number | null;
  /** Every set under the same name, from the index (absent until it loads). */
  group?: SetGroup;
  /** The name from the index, shown until the set itself loads. */
  fallbackName?: string;
  onSelectVersion: (setId: number) => void;
  onOpenAppearance: (appearanceId: number) => void;
  onClose: () => void;
};

/** The raw set record, in the API workbench (catalog slug and endpoint id). */
const workbenchUrl = (setId: number): string =>
  `/api-explorer/item-appearance?${new URLSearchParams({
    endpoint: "item-appearance-set",
    appearanceSetId: String(setId),
  }).toString()}`;

const PIECE_COLS = { xs: 1, sm: 2 } as const;

/**
 * A set in full: each piece with its slot, the first item that wears it
 * and that item's icon (Blizzard serves no render of a set or a piece), and
 * when Blizzard lists several sets under the name, a switch between them.
 * A piece opens its appearance over the set.
 */
const SetDialog = ({
  open,
  setId,
  group,
  fallbackName,
  onSelectVersion,
  onOpenAppearance,
  onClose,
}: SetDialogProps): JSX.Element => {
  const enabled = setId !== null;
  const query = useQuery({
    ...setQuery(setId ?? 0, "dialog"),
    enabled,
    // Switching versions keeps the last one up (dimmed) so the version chips,
    // and the focus on the one just pressed, stay put while the next loads.
    placeholderData: keepPreviousData,
  });
  const versions = group && setId !== null && group.ids.includes(setId) ? group.ids : [];
  // With versions to switch between, a failed one shows its error under the
  // chips instead of in place of the whole body, so the chip just pressed
  // keeps its focus and another version stays one press away.
  const hasVersions = versions.length > 1;
  const placeholder = query.isPlaceholderData;
  // Only a sibling version may stand in: another set opened from the grid
  // must not show the last one's pieces under its name.
  const siblingPlaceholder =
    placeholder &&
    query.data !== undefined &&
    query.data !== null &&
    versions.includes(query.data.id);
  const failure = useRetainedFailure(appearanceKeys.set(setId ?? 0), {
    data: placeholder ? undefined : query.data,
    error: query.error,
    errorUpdateCount: query.errorUpdateCount,
    isFetching: query.isFetching,
    refetch: query.refetch,
  });
  // A Retry of a failed version puts the last one back up as a placeholder;
  // the error stays up instead, so nothing above it jumps while it runs.
  const set =
    enabled && !failure.failed && (!placeholder || siblingPlaceholder)
      ? (query.data ?? undefined)
      : undefined;
  const switching = set !== undefined && siblingPlaceholder;
  const loading =
    enabled && !failure.failed && (query.isPending || (placeholder && !siblingPlaceholder));
  const notFound = enabled && !placeholder && query.data === null;

  // The first piece names the item type and lends the header its icon.
  const firstPieceId = set?.appearanceIds[0];
  const firstPiece = useQuery({
    ...appearanceQuery(firstPieceId ?? 0, "dialog"),
    enabled: firstPieceId !== undefined,
  });
  const firstItemId = firstPieceId !== undefined ? firstPiece.data?.items[0]?.id : undefined;
  const icon = useQuery({
    ...itemIconQuery(firstItemId ?? 0, "dialog"),
    enabled: firstItemId !== undefined,
  });

  const versionsHeadingId = useId();
  const piecesHeadingId = useId();

  const name = set?.name ?? fallbackName ?? (setId !== null ? `Set ${setId}` : "");
  const pieceType = firstPiece.data?.itemSubclass?.name;
  const subtitle = set
    ? [pieceType, pluralize(set.appearanceIds.length, "piece", "pieces")]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  // While another version loads, the last one's facts stay (dimmed, like its
  // pieces) rather than leaving, which would move the chips under the focus;
  // the id is already the one pressed.
  const staleSx = (theme: Theme) => ({
    opacity: switching ? 0.6 : 1,
    transition: theme.transitions.create("opacity", { duration: theme.wc.motion.base }),
  });
  const rows: DetailDialogRow[] = [];
  if (set) {
    rows.push({
      label: "Pieces",
      value: (
        <Box component="span" sx={staleSx}>
          {formatNumber(set.appearanceIds.length)}
        </Box>
      ),
    });
    if (pieceType) {
      rows.push({
        label: "First piece",
        value: (
          <Box component="span" sx={staleSx}>
            {[firstPiece.data?.slot?.name, pieceType].filter(Boolean).join(" · ")}
          </Box>
        ),
      });
    }
    rows.push({
      label: "Set ID",
      value: (
        <Box component="span" sx={(theme) => ({ fontFamily: theme.wc.fontMono })}>
          {setId ?? set.id}
        </Box>
      ),
    });
  }

  const wowhead = name ? wowheadSearchUrl(name) : undefined;

  const renderVersions = (): JSX.Element => (
    <Box component="section" aria-labelledby={versionsHeadingId}>
      <Typography
        id={versionsHeadingId}
        variant="overline"
        component="h3"
        sx={{ m: 0, mb: 0.75 }}
      >
        {`Versions (${formatNumber(versions.length)})`}
      </Typography>
      <FilterChipGroup
        label="Sets with this name"
        options={versions.map((id, index) => ({
          value: String(id),
          label: `Version ${index + 1}`,
        }))}
        value={setId !== null ? String(setId) : null}
        // The pressed chip is the set on screen; pressing it again changes nothing.
        onChange={(next) => {
          if (next !== null) {
            onSelectVersion(Number(next));
          }
        }}
        hideAll
        size="small"
      />
      <Typography
        variant="caption"
        color="text.secondary"
        component="p"
        sx={{ m: 0, mt: 1, maxWidth: "72ch" }}
      >
        Blizzard lists these sets under one name. Each lists its own appearances, though a
        piece can recur across them, and their items may be the same or different; in game
        these are usually difficulty or season recolours, but the API does not say which is
        which.
      </Typography>
    </Box>
  );

  const renderPieces = (current: AppearanceSet): JSX.Element => (
    <Box
      component="section"
      aria-labelledby={piecesHeadingId}
      aria-busy={switching || undefined}
      sx={staleSx}
    >
      <Typography
        id={piecesHeadingId}
        variant="overline"
        component="h3"
        sx={{ m: 0, mb: 0.75 }}
      >
        {`Pieces (${formatNumber(current.appearanceIds.length)})`}
      </Typography>
      {current.appearanceIds.length === 0 ? (
        <EmptyState compact title="No pieces listed" description="Blizzard's record for this set lists no appearances." />
      ) : (
        <Box
          component="ul"
          role="list"
          aria-labelledby={piecesHeadingId}
          sx={{
            display: "grid",
            gap: 1.5,
            listStyle: "none",
            m: 0,
            p: 0,
            ...gridTemplateColumnsSx(PIECE_COLS),
          }}
        >
          {current.appearanceIds.map((appearanceId, index) => (
            <Box component="li" key={`${appearanceId}-${index}`} sx={{ minWidth: 0 }}>
              <SetPieceCard
                appearanceId={appearanceId}
                position={index + 1}
                onOpen={onOpenAppearance}
              />
            </Box>
          ))}
        </Box>
      )}
      <Typography
        variant="caption"
        color="text.secondary"
        component="p"
        sx={{ m: 0, mt: 1.5, maxWidth: "72ch" }}
      >
        Blizzard&apos;s API has no render of a set or its pieces; each piece shows the icon of
        the first item that wears it.
      </Typography>
    </Box>
  );

  const renderBody = (): JSX.Element | null => {
    let content: JSX.Element | null = null;
    if (notFound) {
      content = (
        <EmptyState
          compact
          title="Set not found"
          description={`Blizzard has no appearance set #${setId ?? ""} in its game data.`}
        />
      );
    } else if (hasVersions && failure.failed && failure.error) {
      content = (
        <ErrorState
          compact
          error={failure.error}
          context="this appearance set"
          onRetry={failure.retry}
          retryLabel={failure.retrying ? "Retrying…" : "Retry"}
        />
      );
    } else if (set) {
      content = renderPieces(set);
    }
    if (!hasVersions) {
      return content;
    }
    return (
      <Stack spacing={2.5}>
        {renderVersions()}
        {content}
      </Stack>
    );
  };

  return (
    <DetailDialog
      open={open && enabled}
      onClose={onClose}
      title={name}
      subtitle={subtitle}
      media={{
        kind: "icon",
        src: icon.data ?? null,
        alt: "",
        loading:
          loading ||
          (firstPieceId !== undefined && firstPiece.isPending) ||
          (firstItemId !== undefined && icon.isPending),
      }}
      rows={rows}
      maxWidth="md"
      loading={loading}
      // Shown under the version chips instead, when there are any (see renderBody).
      error={hasVersions ? undefined : (failure.error ?? undefined)}
      onRetry={failure.retry}
      errorContext="this appearance set"
      actions={
        setId !== null ? (
          // Wraps at phone width instead of pushing the dialog sideways.
          <Stack
            direction="row"
            flexWrap="wrap"
            useFlexGap
            gap={1}
            justifyContent="flex-end"
            sx={{ width: "100%" }}
          >
            <Button component={RouterLink} to={workbenchUrl(setId)} size="small">
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
                Search Wowhead
                <Box component="span" sx={visuallyHidden}>
                  {` for ${name} (opens in a new tab)`}
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

export default SetDialog;
