import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import ShuffleRoundedIcon from "@mui/icons-material/ShuffleRounded";
import { Box, Button, Chip, Skeleton, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import MediaTile from "@/components/common/MediaTile";
import SectionCard from "@/components/common/SectionCard";
import { ErrorState, LiveStatus } from "@/components/common/StateBlocks";
import { MountFactionTag, SourceIcon } from "@/features/mounts/components/MountMeta";
import { mountDetailQuery, mountRenderQuery } from "@/features/mounts/hooks/mountQueries";
import useHeldError from "@/features/mounts/hooks/useHeldError";
import { isPlaceholderName, pluralize } from "@/features/mounts/services/mountService";
import type { MountIndexEntry, MountSummary } from "@/features/mounts/types";
import { mixins, visuallyHidden } from "@/theme";

export type MountSpotlightProps = {
  /** Every mount (undefined while the index loads or after it failed). */
  index: MountIndexEntry[] | undefined;
  indexPending: boolean;
  /**
   * The index's failure when nothing else on the page reports it (a filtered
   * list does not need the index); held while its Retry runs.
   */
  indexError: Error | null;
  onRetryIndex: () => void;
  onOpen: (mount: MountSummary) => void;
};

/** A spotlight on an unfinished [PH]/[DND] record would be a grey tile (the list still has them). */
const isFinished = (entry: MountIndexEntry): boolean => !isPlaceholderName(entry.name);

/** Render on the left, the record beside it (stacked on phones). */
const layoutSx = {
  display: "grid",
  gap: { xs: 2, sm: 3 },
  gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 2fr) minmax(0, 3fr)" },
  alignItems: "center",
} as const;

const SpotlightSkeleton = (): JSX.Element => (
  <Box sx={layoutSx} role="status" aria-label="Loading a random mount">
    <Skeleton variant="rounded" sx={{ width: "100%", height: "auto", aspectRatio: "4 / 3" }} />
    <Stack spacing={1.25}>
      <Skeleton variant="text" sx={{ fontSize: "1.75rem", width: "60%" }} />
      <Stack direction="row" spacing={1}>
        <Skeleton variant="rounded" width={96} height={24} />
        <Skeleton variant="rounded" width={80} height={24} />
      </Stack>
      <Skeleton variant="text" width="95%" />
      <Skeleton variant="text" width="70%" />
      <Skeleton variant="rounded" width={128} height={36} />
    </Stack>
  </Box>
);

/**
 * One mount drawn at random from the whole index, with its render, source,
 * faction, requirements and description, and a button to draw another.
 * The draw lives in component state, not the URL: it is a curiosity, and a
 * shared link should land on a fresh one.
 */
const MountSpotlight = ({
  index,
  indexPending,
  indexError,
  onRetryIndex,
  onOpen,
}: MountSpotlightProps): JSX.Element | null => {
  const pool = useMemo(() => (index ?? []).filter(isFinished), [index]);
  // A fraction rather than an id, so the draw can be made before the index
  // arrives and lands on a mount once it does.
  const [draw, setDraw] = useState(() => Math.random());
  // Only a draw someone asked for is announced, not the one on arrival.
  const [announce, setAnnounce] = useState(false);
  const pick = pool.length > 0 ? pool[Math.floor(draw * pool.length)] : undefined;

  const query = useQuery({ ...mountDetailQuery(pick?.id ?? 0), enabled: pick !== undefined });
  const error = useHeldError(query.error, query.isFetching, String(pick?.id));
  const mount = pick !== undefined ? query.data : undefined;
  const displayId = mount?.displayIds[0];
  // Below the grid, so its render waits its turn behind the cards' renders.
  const renderQuery = useQuery({
    ...mountRenderQuery(displayId ?? 0),
    enabled: displayId !== undefined,
  });

  const header = {
    title: "Mount spotlight",
    icon: <AutoAwesomeRoundedIcon />,
    description: "A mount drawn at random from Blizzard's index.",
  };

  // Checked before the pending skeleton: a Retry puts the index back to
  // pending, and the focused Retry button must stay where it is.
  if (index === undefined && indexError) {
    return (
      <SectionCard {...header}>
        <ErrorState compact error={indexError} context="the mount index" onRetry={onRetryIndex} />
      </SectionCard>
    );
  }
  // Where the list needs the index, the results section explains a failed
  // or empty one.
  if (!indexPending && pool.length === 0) {
    return null;
  }

  const drawAnother = (): void => {
    if (pool.length < 2) {
      return;
    }
    const current = Math.floor(draw * pool.length);
    let next = Math.random();
    // Never the same mount twice in a row.
    while (Math.floor(next * pool.length) === current) {
      next = Math.random();
    }
    setDraw(next);
    setAnnounce(true);
  };

  const renderBody = (): JSX.Element => {
    if (error && !mount) {
      return (
        <ErrorState
          compact
          error={error}
          context="this mount"
          onRetry={() => void query.refetch()}
        />
      );
    }
    if (mount === null) {
      return (
        <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
          {`Blizzard has no record for ${pick?.name ?? "this mount"}; draw another.`}
        </Typography>
      );
    }
    if (!mount) {
      return <SpotlightSkeleton />;
    }
    const requirements = [
      ...mount.classes.map((playableClass) => playableClass.name),
      ...mount.races.map((race) => race.name),
    ];
    return (
      <Box sx={layoutSx}>
        <Box sx={{ width: "100%", aspectRatio: "4 / 3" }}>
          <MediaTile
            size="fill"
            aspect="4 / 3"
            src={renderQuery.data ?? null}
            alt=""
            fallbackLabel={mount.name}
            loading={displayId !== undefined && renderQuery.isPending}
            radius="md"
          />
        </Box>
        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <Typography variant="h4" component="h3" sx={{ m: 0, overflowWrap: "anywhere" }}>
            {mount.name}
          </Typography>
          <Stack direction="row" flexWrap="wrap" useFlexGap gap={1}>
            <Chip
              size="small"
              variant="outlined"
              icon={<SourceIcon type={mount.source?.type} />}
              label={mount.source?.name ?? "Source not listed"}
            />
            {mount.faction ? (
              <Chip
                size="small"
                variant="outlined"
                label={<MountFactionTag faction={mount.faction} />}
              />
            ) : null}
            {mount.displayIds.length > 1 ? (
              <Chip
                size="small"
                variant="outlined"
                icon={<PaletteRoundedIcon />}
                label={pluralize(mount.displayIds.length, "variant", "variants")}
              />
            ) : null}
          </Stack>
          {requirements.length > 0 ? (
            <Typography variant="body2" component="p" sx={{ m: 0 }}>
              <Box component="span" sx={{ color: "text.secondary" }}>
                Requires{" "}
              </Box>
              {requirements.join(" · ")}
            </Typography>
          ) : null}
          <Typography
            variant="body1"
            component="p"
            color="text.secondary"
            sx={{ m: 0, maxWidth: "60ch", ...mixins.lineClamp(4) }}
          >
            {mount.description ?? "Blizzard lists no description for this mount."}
          </Typography>
          <Box>
            <Button variant="contained" size="small" onClick={() => onOpen(mount)}>
              View details
              <Box component="span" sx={visuallyHidden}>
                {` of ${mount.name}`}
              </Box>
            </Button>
          </Box>
        </Stack>
      </Box>
    );
  };

  return (
    <SectionCard
      {...header}
      actions={
        pool.length > 1 ? (
          <Button size="small" startIcon={<ShuffleRoundedIcon />} onClick={drawAnother}>
            Another
            <Box component="span" sx={visuallyHidden}>
              {" random mount"}
            </Box>
          </Button>
        ) : undefined
      }
    >
      {renderBody()}
      {/* Says which mount a draw landed on; the panel itself changes silently. */}
      <LiveStatus visuallyHidden>{announce && mount ? `Spotlight: ${mount.name}` : ""}</LiveStatus>
    </SectionCard>
  );
};

export default MountSpotlight;
