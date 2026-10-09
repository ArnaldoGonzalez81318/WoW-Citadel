import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import {
  Avatar,
  Box,
  Button,
  ButtonBase,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

import DetailDialog from "@/components/common/DetailDialog";
import MediaTile from "@/components/common/MediaTile";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import { creatureDisplayRenderQuery } from "@/features/creatures/hooks/creatureDisplayQueries";
import { MountFactionTag, SourceIcon } from "@/features/mounts/components/MountMeta";
import {
  classIconQuery,
  mountDetailQuery,
  mountRenderQuery,
} from "@/features/mounts/hooks/mountQueries";
import useHeldError from "@/features/mounts/hooks/useHeldError";
import type { MountSummary, NamedRef, TypedRef } from "@/features/mounts/types";
import { getExternalLink } from "@/lib/externalLinks";
import { formatNumber } from "@/lib/format";
import { focusRing, visuallyHidden } from "@/theme";

export type MountDialogProps = {
  /** Whether the dialog is showing; `mountId` stays set through the close transition. */
  open: boolean;
  /** The mount to show (the last one opened). */
  mountId: number | null;
  /**
   * The card (or spotlight) that opened it: its search record already holds
   * the name, displays, source and faction, so those show at once while the
   * full record (description, requirements) loads.
   */
  seed?: MountSummary;
  /** The source the results are filtered to, so the dialog does not offer it again. */
  activeSource: string | null;
  onShowSource: (source: TypedRef) => void;
  onClose: () => void;
};

/** The raw mount record, in the API workbench (catalog slug and endpoint id). */
const workbenchUrl = (mountId: number): string =>
  `/api-explorer/mounts?${new URLSearchParams({
    endpoint: "mount",
    mountId: String(mountId),
  }).toString()}`;

type Fact = { label: string; value: ReactNode };

/** A label/value list beside the render instead of under it. */
const FactList = ({ facts }: { facts: Fact[] }): JSX.Element => (
  <Box
    component="dl"
    sx={{
      display: "grid",
      gridTemplateColumns: "minmax(96px, max-content) minmax(0, 1fr)",
      columnGap: 2,
      rowGap: 1.25,
      m: 0,
      alignContent: "start",
    }}
  >
    {facts.map((fact) => (
      <Box key={fact.label} sx={{ display: "contents" }}>
        <Typography
          component="dt"
          variant="caption"
          sx={{ color: "text.secondary", fontWeight: 500, alignSelf: "center" }}
        >
          {fact.label}
        </Typography>
        <Typography
          component="dd"
          variant="body2"
          sx={{ m: 0, minWidth: 0, overflowWrap: "anywhere", alignSelf: "center" }}
        >
          {fact.value}
        </Typography>
      </Box>
    ))}
  </Box>
);

/** A class with its icon (a letter until the icon lands, or when there is none). */
const ClassLabel = ({ playableClass }: { playableClass: NamedRef }): JSX.Element => {
  const iconQuery = useQuery(classIconQuery(playableClass.id));
  return (
    <Stack component="span" direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
      <Avatar
        alt=""
        src={iconQuery.data ?? undefined}
        variant="rounded"
        sx={{ width: 22, height: 22, fontSize: "0.6875rem" }}
      >
        {playableClass.name.charAt(0)}
      </Avatar>
      <span>{playableClass.name}</span>
    </Stack>
  );
};

/** One display's thumbnail: a toggle in the set, the pressed one fills the large render. */
const VariantThumb = ({
  displayId,
  position,
  total,
  selected,
  name,
  onSelect,
}: {
  displayId: number;
  position: number;
  total: number;
  selected: boolean;
  name: string;
  onSelect: (displayId: number) => void;
}): JSX.Element => {
  const renderQuery = useQuery(mountRenderQuery(displayId));
  return (
    <ButtonBase
      onClick={() => onSelect(displayId)}
      aria-pressed={selected}
      aria-label={`Variant ${position} of ${total}`}
      sx={(theme) => ({
        width: 72,
        height: 72,
        borderRadius: `${theme.wc.radius.sm}px`,
        overflow: "hidden",
        // The pressed ring sits over the tile (an inset shadow on the button
        // itself would be painted over by the image), leaving the outline
        // free for the focus ring.
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          pointerEvents: "none",
          boxShadow: selected ? `inset 0 0 0 2px ${theme.palette.primary.main}` : "none",
        },
        "&.Mui-focusVisible": focusRing(theme),
      })}
    >
      <MediaTile
        size="fill"
        aspect="1 / 1"
        src={renderQuery.data ?? null}
        alt=""
        fallbackLabel={name}
        loading={renderQuery.isPending}
        radius="sm"
      />
    </ButtonBase>
  );
};

/**
 * A mount in full: its model render large and square (Blizzard frames the
 * model in the middle of a 600×600 portrait, so a 16:9 banner would cut long
 * mounts), source, faction, the classes and races that may learn it, its
 * description, and every display variant, each a thumbnail that swaps the
 * large render.
 */
const MountDialog = ({
  open,
  mountId,
  seed,
  activeSource,
  onShowSource,
  onClose,
}: MountDialogProps): JSX.Element => {
  const enabled = mountId !== null;
  const query = useQuery({ ...mountDetailQuery(mountId ?? 0), enabled });
  const detail = enabled ? query.data : undefined;
  const usableSeed = seed && seed.id === mountId ? seed : undefined;
  const notFound = enabled && query.data === null;
  const mount: MountSummary | undefined = detail ?? usableSeed;
  const error = useHeldError(query.error, query.isFetching, String(mountId));

  // The picked variant belongs to one mount: another mount starts on its first.
  const [picked, setPicked] = useState<{ mountId: number; displayId: number } | null>(null);
  const displayIds = mount?.displayIds ?? [];
  const activeDisplay =
    picked && picked.mountId === mountId && displayIds.includes(picked.displayId)
      ? picked.displayId
      : displayIds[0];
  // The one render the dialog is opened for skips the cards' queue.
  const renderQuery = useQuery({
    ...creatureDisplayRenderQuery(activeDisplay ?? 0),
    enabled: activeDisplay !== undefined,
  });

  const variantsHeadingId = useId();
  const descriptionHeadingId = useId();
  const title = mount?.name ?? (mountId !== null ? `Mount #${mountId}` : "");
  const subtitle = [mount?.source?.name, mount?.faction?.name].filter(Boolean).join(" · ");

  const facts: Fact[] = [];
  if (mount) {
    facts.push({
      label: "Source",
      value: mount.source ? (
        <Stack component="span" direction="row" spacing={0.75} alignItems="center">
          <SourceIcon type={mount.source.type} sx={{ fontSize: 18, color: "text.secondary" }} />
          <span>{mount.source.name}</span>
        </Stack>
      ) : (
        "Not listed"
      ),
    });
    if (mount.faction) {
      facts.push({ label: "Faction", value: <MountFactionTag faction={mount.faction} /> });
    }
    if (detail && detail.classes.length > 0) {
      facts.push({
        label: detail.classes.length === 1 ? "Class" : "Classes",
        value: (
          <Stack component="span" direction="row" flexWrap="wrap" useFlexGap columnGap={1.5} rowGap={0.75}>
            {detail.classes.map((playableClass) => (
              <ClassLabel key={playableClass.id} playableClass={playableClass} />
            ))}
          </Stack>
        ),
      });
    }
    if (detail && detail.races.length > 0) {
      facts.push({
        label: detail.races.length === 1 ? "Race" : "Races",
        value: detail.races.map((race) => race.name).join(", "),
      });
    }
    if (detail?.hiddenUntilCollected) {
      // Blizzard's `should_exclude_if_uncollected` flag.
      facts.push({ label: "Mount Journal", value: "Hidden until collected" });
    }
    if (displayIds.length > 1) {
      facts.push({ label: "Variants", value: formatNumber(displayIds.length) });
    }
    facts.push({
      label: "Mount ID",
      value: (
        <Box component="span" sx={(theme) => ({ fontFamily: theme.wc.fontMono })}>
          {mount.id}
        </Box>
      ),
    });
  }

  const external = mount ? getExternalLink("mount", mount.id, mount.name) : undefined;

  const renderDescription = (): ReactNode => {
    if (detail) {
      return detail.description ? (
        <Typography variant="body2" component="p" sx={{ m: 0, maxWidth: "72ch" }}>
          {detail.description}
        </Typography>
      ) : (
        <Typography variant="body2" component="p" color="text.secondary" sx={{ m: 0 }}>
          Blizzard lists no description for this mount.
        </Typography>
      );
    }
    // Only reached with a seed: without one the whole body waits or fails.
    if (error) {
      return (
        <ErrorState
          compact
          error={error}
          context="this mount's description and requirements"
          onRetry={() => void query.refetch()}
        />
      );
    }
    return (
      <Box role="status" aria-label="Loading description">
        <Skeleton variant="text" width="92%" />
        <Skeleton variant="text" width="64%" />
      </Box>
    );
  };

  const renderBody = (): JSX.Element | null => {
    if (notFound) {
      return (
        <EmptyState
          compact
          title="Mount not found"
          description={`Blizzard has no mount #${mountId ?? ""} in its game data.`}
        />
      );
    }
    if (!mount) {
      return null;
    }
    return (
      <Stack spacing={2.5}>
        <Box
          sx={{
            display: "grid",
            gap: 2.5,
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              sm: "minmax(0, 5fr) minmax(0, 6fr)",
            },
            alignItems: "start",
          }}
        >
          {/* Square, like the render itself: nothing of the model is cropped. */}
          <Box
            sx={{
              width: "100%",
              maxWidth: { xs: 360, sm: "none" },
              justifySelf: "center",
              aspectRatio: "1 / 1",
            }}
          >
            <MediaTile
              size="fill"
              aspect="1 / 1"
              src={renderQuery.data ?? null}
              alt=""
              fallbackLabel={mount.name}
              loading={activeDisplay !== undefined && renderQuery.isPending}
              radius="md"
            />
          </Box>
          <Stack spacing={2.5} sx={{ minWidth: 0 }}>
            <FactList facts={facts} />
            <Box component="section" aria-labelledby={descriptionHeadingId}>
              <Typography
                id={descriptionHeadingId}
                variant="overline"
                component="h3"
                sx={{ m: 0, mb: 0.5 }}
              >
                Description
              </Typography>
              {renderDescription()}
            </Box>
          </Stack>
        </Box>

        {displayIds.length > 1 ? (
          <Box component="section" aria-labelledby={variantsHeadingId}>
            <Typography id={variantsHeadingId} variant="overline" component="h3" sx={{ m: 0, mb: 0.75 }}>
              {`Display variants (${formatNumber(displayIds.length)})`}
            </Typography>
            <Box
              component="ul"
              role="list"
              aria-labelledby={variantsHeadingId}
              sx={{ listStyle: "none", m: 0, p: 0.5, display: "flex", flexWrap: "wrap", gap: 1.5 }}
            >
              {displayIds.map((displayId, index) => (
                <Box component="li" key={displayId}>
                  <VariantThumb
                    displayId={displayId}
                    position={index + 1}
                    total={displayIds.length}
                    selected={displayId === activeDisplay}
                    name={mount.name}
                    onSelect={(next) => setPicked({ mountId: mount.id, displayId: next })}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        ) : null}
      </Stack>
    );
  };

  return (
    <DetailDialog
      open={open && enabled}
      onClose={onClose}
      title={title}
      subtitle={subtitle || undefined}
      maxWidth="md"
      loading={enabled && query.isPending && !usableSeed && error === null}
      error={error !== null && mount === undefined ? error : undefined}
      onRetry={() => void query.refetch()}
      errorContext="mount details"
      actions={
        mountId !== null ? (
          // Wraps at phone width instead of pushing the dialog sideways.
          <Stack
            direction="row"
            flexWrap="wrap"
            useFlexGap
            gap={1}
            justifyContent="flex-end"
            sx={{ width: "100%" }}
          >
            {mount?.source && mount.source.type !== activeSource ? (
              <Button
                size="small"
                variant="outlined"
                startIcon={<SourceIcon type={mount.source.type} />}
                onClick={() => {
                  if (mount.source) {
                    onShowSource(mount.source);
                  }
                }}
              >
                {`More ${mount.source.name} mounts`}
              </Button>
            ) : null}
            <Button component={RouterLink} to={workbenchUrl(mountId)} size="small">
              Open in API workbench
            </Button>
            {external ? (
              // Wowhead numbers mounts differently, so this is a name search.
              <Button
                href={external.url}
                target="_blank"
                rel="noreferrer"
                size="small"
                endIcon={<OpenInNewRoundedIcon />}
              >
                Search Wowhead
                <Box component="span" sx={visuallyHidden}>
                  {` for ${title}, opens in a new tab`}
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

export default MountDialog;
