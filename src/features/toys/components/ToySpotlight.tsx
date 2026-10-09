import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ShuffleRoundedIcon from "@mui/icons-material/ShuffleRounded";
import { Box, Button, Chip, Skeleton, Stack, Typography } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import MediaTile from "@/components/common/MediaTile";
import SectionCard from "@/components/common/SectionCard";
import { ErrorState, LiveStatus } from "@/components/common/StateBlocks";
import IconBackdrop from "@/features/professions/components/IconBackdrop";
import SourceIcon from "@/features/toys/components/SourceIcon";
import ToyUseText from "@/features/toys/components/ToyUseText";
import { toyIconQuery, toyItemQuery, toyQuery } from "@/features/toys/hooks/toyQueries";
import useHeldError from "@/features/toys/hooks/useHeldError";
import { sourceSummary } from "@/features/toys/services/toyService";
import type { ToyRef } from "@/features/toys/types";
import { qualityColor, visuallyHidden } from "@/theme";

export type ToySpotlightProps = {
  /** Every toy (undefined while the index loads or after it failed). */
  index: ToyRef[] | undefined;
  indexPending: boolean;
  onOpen: (toy: ToyRef) => void;
};

/** The art square: the 56px icon (Blizzard's largest) over a blurred wash of itself. */
const ART_SIZE = { xs: 96, sm: 128 } as const;

/** Art beside the text from sm up; stacked on phones. */
const layoutSx = {
  display: "grid",
  gap: { xs: 2, sm: 3 },
  gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "max-content minmax(0, 1fr)" },
  alignItems: "start",
} as const;

const artSx = (theme: Theme) => ({
  position: "relative" as const,
  width: ART_SIZE,
  height: ART_SIZE,
  flexShrink: 0,
  borderRadius: `${theme.wc.radius.md}px`,
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: theme.palette.surface.sunken,
  border: `1px solid ${theme.palette.border.default}`,
});

/**
 * Shaped like the loaded panel, ToyUseText's compact form included (the
 * effect, the cooldown chip most toys carry and the flavour line), so the
 * filters and grid below stay put when the toy lands.
 */
const SpotlightSkeleton = (): JSX.Element => (
  <Box sx={layoutSx} role="status" aria-label="Loading a random toy">
    <Skeleton variant="rounded" sx={{ width: ART_SIZE, height: ART_SIZE }} />
    <Stack spacing={1.25}>
      <Skeleton variant="text" sx={{ fontSize: "1.75rem", width: "55%" }} />
      <Stack direction="row" spacing={1}>
        <Skeleton variant="rounded" width={96} height={24} />
        <Skeleton variant="rounded" width={120} height={24} />
      </Stack>
      <Stack spacing={1}>
        <Box>
          <Skeleton variant="text" sx={{ fontSize: "1rem", width: "95%" }} />
          <Skeleton variant="text" sx={{ fontSize: "1rem", width: "70%" }} />
        </Box>
        <Skeleton variant="rounded" width={112} height={24} />
        <Skeleton variant="text" sx={{ fontSize: "0.875rem", width: "60%" }} />
      </Stack>
      <Skeleton variant="rounded" width={128} height={32} />
    </Stack>
  </Box>
);

/**
 * One toy pulled from the box at random: its icon, what it does in its
 * tooltip's words, where it comes from, and a button to pull another. The
 * draw lives in component state, not the URL: it is a curiosity, and a
 * shared link should land on a fresh one.
 */
const ToySpotlight = ({ index, indexPending, onOpen }: ToySpotlightProps): JSX.Element | null => {
  const pool = index ?? [];
  // A fraction rather than an id, so the draw can be made before the index
  // arrives and lands on a toy once it does.
  const [draw, setDraw] = useState(() => Math.random());
  // Only a draw someone asked for is announced, not the one on arrival.
  const [announce, setAnnounce] = useState(false);
  const pick = pool.length > 0 ? pool[Math.floor(draw * pool.length)] : undefined;

  const recordQuery = useQuery({ ...toyQuery(pick?.id ?? 0), enabled: pick !== undefined });
  const record = pick !== undefined ? recordQuery.data : undefined;
  const itemId = record?.itemId;
  const itemQuery = useQuery({ ...toyItemQuery(itemId ?? 0), enabled: itemId !== undefined });
  const iconQuery = useQuery({ ...toyIconQuery(itemId ?? 0), enabled: itemId !== undefined });
  const item = itemId !== undefined ? itemQuery.data : undefined;
  const icon = iconQuery.data ?? null;

  // Either lookup failing stops the panel; Retry refetches whichever failed.
  const failedQuery = record === undefined ? recordQuery : item === undefined ? itemQuery : null;
  const error = useHeldError(
    failedQuery?.error ?? null,
    failedQuery?.isFetching ?? false,
    `${pick?.id ?? ""}:${itemId ?? ""}`,
  );

  // The results section explains a failed or empty index.
  if (!indexPending && pool.length === 0) {
    return null;
  }

  const drawAnother = (): void => {
    if (pool.length < 2) {
      return;
    }
    const current = Math.floor(draw * pool.length);
    let next = Math.random();
    // Never the same toy twice in a row.
    while (Math.floor(next * pool.length) === current) {
      next = Math.random();
    }
    setDraw(next);
    setAnnounce(true);
  };

  const renderBody = (): JSX.Element => {
    if (error && (record === undefined || item === undefined)) {
      return (
        <ErrorState
          compact
          error={error}
          context="this toy"
          onRetry={() => {
            if (failedQuery && !failedQuery.isFetching) {
              void failedQuery.refetch();
            }
          }}
          retryLabel={failedQuery?.isFetching ? "Retrying…" : "Retry"}
        />
      );
    }
    if (record === null || item === null) {
      return (
        <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
          {`Blizzard has no full record for ${pick?.name ?? "this toy"}; pull another.`}
        </Typography>
      );
    }
    if (!pick || !record || !item) {
      return <SpotlightSkeleton />;
    }
    const where = sourceSummary(record);
    return (
      <Box sx={layoutSx}>
        <Box sx={artSx}>
          <IconBackdrop src={icon} opacity={0.7} sx={{ maskImage: "none", WebkitMaskImage: "none" }} />
          <MediaTile
            size={56}
            src={icon}
            alt=""
            fallbackLabel={item.name}
            quality={item.quality?.type}
            loading={iconQuery.isPending}
            sx={(theme) => ({ boxShadow: theme.palette.glow.card })}
          />
        </Box>
        <Stack spacing={1.25} sx={{ minWidth: 0 }}>
          <Typography
            variant="h4"
            component="h3"
            sx={(theme) => ({
              m: 0,
              overflowWrap: "anywhere",
              color: item.quality ? qualityColor(theme, item.quality.type) : undefined,
            })}
          >
            {item.name}
          </Typography>
          {record.source || where ? (
            <Stack direction="row" flexWrap="wrap" useFlexGap gap={1} alignItems="center">
              {record.source ? (
                <Chip
                  size="small"
                  variant="outlined"
                  icon={<SourceIcon type={record.source.type} />}
                  label={record.source.name}
                />
              ) : null}
              {where ? (
                <Typography variant="body2" color="text.secondary" component="span" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  {where}
                </Typography>
              ) : null}
            </Stack>
          ) : null}
          <ToyUseText item={item} compact />
          <Box>
            <Button variant="contained" size="small" onClick={() => onOpen(pick)}>
              View details
              <Box component="span" sx={visuallyHidden}>
                {` of ${item.name}`}
              </Box>
            </Button>
          </Box>
        </Stack>
      </Box>
    );
  };

  return (
    <SectionCard
      title="From the toy box"
      icon={<AutoAwesomeRoundedIcon />}
      description="A toy pulled at random from Blizzard's index."
      actions={
        pool.length > 1 ? (
          <Button size="small" startIcon={<ShuffleRoundedIcon />} onClick={drawAnother}>
            Another
            <Box component="span" sx={visuallyHidden}>
              {" random toy"}
            </Box>
          </Button>
        ) : undefined
      }
    >
      {renderBody()}
      {/* Says which toy a draw landed on; the panel itself changes silently. */}
      <LiveStatus visuallyHidden>{announce && item ? `Spotlight: ${item.name}` : ""}</LiveStatus>
    </SectionCard>
  );
};

export default ToySpotlight;
