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
import { EmptyState } from "@/components/common/StateBlocks";
import { creatureDisplayRenderQuery } from "@/features/creatures/hooks/creatureDisplayQueries";
import {
  creatureFamilyIconQuery,
  creatureFamilyQuery,
  creatureQuery,
  petSpecializationQuery,
} from "@/features/creatures/hooks/creatureQueries";
import { creatureKindLine } from "@/features/creatures/services/creatureService";
import type { Creature } from "@/features/creatures/types";
import { WOWHEAD_LABEL, wowheadUrl } from "@/lib/externalLinks";
import { formatNumber } from "@/lib/format";
import { focusRing, visuallyHidden } from "@/theme";

export type CreatureDialogSeed = {
  creature: Creature;
  /** When the search that listed it was fetched (the seed is that fresh). */
  updatedAt: number;
};

export type CreatureDialogProps = {
  /** Whether the dialog is showing; `creatureId` stays set through the close transition. */
  open: boolean;
  /** The creature to show (the last one opened). */
  creatureId: number | null;
  /**
   * The card that opened it: Blizzard's search hit is the whole creature
   * record, so the dialog shows it at once instead of fetching it again.
   */
  seed?: CreatureDialogSeed;
  /** The family the results are filtered to, so the dialog does not offer it again. */
  activeFamilyId: number | null;
  onShowFamily: (familyId: number) => void;
  onClose: () => void;
};

/** Thumbnails shown before "Show all": a creature rarely has more than six looks. */
const DISPLAY_PREVIEW_COUNT = 12;

/** The raw creature record, in the API workbench (catalog slug and endpoint id). */
const workbenchUrl = (creatureId: number): string =>
  `/api-explorer/creatures?${new URLSearchParams({
    endpoint: "creature",
    creatureId: String(creatureId),
  }).toString()}`;

type Fact = { label: string; value: ReactNode };

/** The DetailDialog's label/value list, beside the render instead of under it. */
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

/** An icon and a name on one line (family, pet spec). */
const IconLabel = ({ icon, name }: { icon: string | null | undefined; name: string }): JSX.Element => (
  <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
    <Avatar alt="" src={icon ?? undefined} variant="rounded" sx={{ width: 24, height: 24, fontSize: "0.75rem" }}>
      {name.charAt(0)}
    </Avatar>
    <span>{name}</span>
  </Stack>
);

/** One display's thumbnail: a toggle in the set, the pressed one fills the large render. */
const DisplayThumb = ({
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
  const renderQuery = useQuery(creatureDisplayRenderQuery(displayId));
  return (
    <ButtonBase
      onClick={() => onSelect(displayId)}
      aria-pressed={selected}
      aria-label={`Display ${position} of ${total}`}
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
 * A creature in full: its model render large and square (Blizzard frames
 * the model in the middle of a 600×600 portrait, so a 16:9 banner would cut
 * tall models), type, family with its icon, the family's hunter pet spec,
 * whether hunters can tame it, and every display it has, each one a
 * thumbnail that swaps the large render.
 */
const CreatureDialog = ({
  open,
  creatureId,
  seed,
  activeFamilyId,
  onShowFamily,
  onClose,
}: CreatureDialogProps): JSX.Element => {
  const enabled = creatureId !== null;
  const usableSeed = seed && seed.creature.id === creatureId ? seed : undefined;
  const query = useQuery({
    ...creatureQuery(creatureId ?? 0),
    enabled,
    initialData: usableSeed?.creature,
    initialDataUpdatedAt: usableSeed?.updatedAt,
  });
  const creature = enabled ? query.data : undefined;
  const notFound = enabled && query.data === null;

  // The picked look belongs to one creature: another creature starts on its first.
  const [picked, setPicked] = useState<{ creatureId: number; displayId: number } | null>(null);
  const [showAllDisplays, setShowAllDisplays] = useState<number | null>(null);
  const displayIds = creature?.displayIds ?? [];
  const activeDisplay =
    picked && picked.creatureId === creatureId && displayIds.includes(picked.displayId)
      ? picked.displayId
      : displayIds[0];
  const renderQuery = useQuery({
    ...creatureDisplayRenderQuery(activeDisplay ?? 0),
    enabled: activeDisplay !== undefined,
  });

  const family = creature?.family;
  const familyQuery = useQuery({
    ...creatureFamilyQuery(family?.id ?? 0),
    enabled: family !== undefined,
  });
  const familyIconQuery = useQuery({
    ...creatureFamilyIconQuery(family?.id ?? 0),
    enabled: family !== undefined && familyQuery.data?.hasIcon !== false,
  });
  const spec = familyQuery.data?.specialization;
  // A Retry puts a record with no data back to pending; one that has failed
  // before keeps its "Unavailable" row (and the focused button) meanwhile.
  const familyFirstLoad = familyQuery.isPending && familyQuery.errorUpdateCount === 0;
  const familyRetrying = familyQuery.isFetching;
  const specQuery = useQuery({
    ...petSpecializationQuery(spec?.id ?? 0),
    enabled: spec !== undefined,
  });

  const displaysHeadingId = useId();
  const title =
    creature?.name ?? usableSeed?.creature.name ?? (creatureId !== null ? `Creature #${creatureId}` : "");
  const subtitle = creature ? creatureKindLine(creature) : "";

  const facts: Fact[] = [];
  if (creature) {
    if (creature.type) {
      facts.push({ label: "Type", value: creature.type.name });
    }
    if (family) {
      facts.push({
        label: "Family",
        value: <IconLabel icon={familyIconQuery.data} name={family.name} />,
      });
      if (familyFirstLoad) {
        facts.push({
          label: "Pet specialization",
          value: <Skeleton variant="text" width={120} />,
        });
      } else if (spec) {
        facts.push({
          label: "Pet specialization",
          value: <IconLabel icon={specQuery.data?.iconUrl} name={spec.name} />,
        });
      } else if (!familyQuery.data && familyQuery.errorUpdateCount > 0) {
        // Only the spec comes from the family record; the rest stands without it.
        facts.push({
          label: "Pet specialization",
          value: (
            <Stack direction="row" spacing={1} alignItems="center">
              <span>Unavailable</span>
              {/* Enabled while retrying (a disabled button drops focus); a
                  press meanwhile is ignored rather than restarting it. */}
              <Button
                size="small"
                onClick={() => {
                  if (!familyRetrying) {
                    void familyQuery.refetch();
                  }
                }}
              >
                {familyRetrying ? "Retrying…" : "Retry"}
              </Button>
            </Stack>
          ),
        });
      }
    }
    facts.push({
      label: "Hunters",
      value: creature.isTameable ? "Can tame it" : "Cannot tame it",
    });
    facts.push({ label: "Displays", value: formatNumber(creature.displayIds.length) });
    facts.push({
      label: "Creature ID",
      value: (
        <Box component="span" sx={(theme) => ({ fontFamily: theme.wc.fontMono })}>
          {creature.id}
        </Box>
      ),
    });
  }

  const allDisplays = showAllDisplays === creatureId;
  const shownDisplays = allDisplays ? displayIds : displayIds.slice(0, DISPLAY_PREVIEW_COUNT);
  const wowhead = creatureId !== null ? wowheadUrl("npc", creatureId) : undefined;

  const renderBody = (): JSX.Element | null => {
    if (notFound) {
      return (
        <EmptyState
          compact
          title="Creature not found"
          description={`Blizzard has no creature #${creatureId ?? ""} in its game data.`}
        />
      );
    }
    if (!creature) {
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
              fallbackLabel={creature.name}
              loading={activeDisplay !== undefined && renderQuery.isPending}
              radius="md"
            />
          </Box>
          <FactList facts={facts} />
        </Box>

        {displayIds.length > 1 ? (
          <Box component="section" aria-labelledby={displaysHeadingId}>
            <Typography
              id={displaysHeadingId}
              variant="overline"
              component="h3"
              sx={{ m: 0, mb: 0.75 }}
            >
              {`Displays (${formatNumber(displayIds.length)})`}
            </Typography>
            <Box
              component="ul"
              role="list"
              aria-labelledby={displaysHeadingId}
              sx={{
                listStyle: "none",
                m: 0,
                p: 0.5,
                display: "flex",
                flexWrap: "wrap",
                gap: 1.5,
              }}
            >
              {shownDisplays.map((displayId, index) => (
                <Box component="li" key={displayId}>
                  <DisplayThumb
                    displayId={displayId}
                    position={index + 1}
                    total={displayIds.length}
                    selected={displayId === activeDisplay}
                    name={creature.name}
                    onSelect={(next) =>
                      setPicked({ creatureId: creature.id, displayId: next })
                    }
                  />
                </Box>
              ))}
            </Box>
            {!allDisplays && displayIds.length > DISPLAY_PREVIEW_COUNT ? (
              <Button
                size="small"
                onClick={() => setShowAllDisplays(creature.id)}
                sx={{ mt: 1 }}
              >
                {`Show all ${formatNumber(displayIds.length)} displays`}
              </Button>
            ) : null}
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
      loading={enabled && query.isPending}
      error={query.isError && creature === undefined ? query.error : undefined}
      onRetry={() => void query.refetch()}
      errorContext="creature details"
      actions={
        creatureId !== null ? (
          // Wraps at phone width instead of pushing the dialog sideways.
          <Stack
            direction="row"
            flexWrap="wrap"
            useFlexGap
            gap={1}
            justifyContent="flex-end"
            sx={{ width: "100%" }}
          >
            {family && family.id !== activeFamilyId ? (
              <Button size="small" variant="outlined" onClick={() => onShowFamily(family.id)}>
                {`Show ${family.name} creatures`}
              </Button>
            ) : null}
            <Button component={RouterLink} to={workbenchUrl(creatureId)} size="small">
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
      {renderBody()}
    </DetailDialog>
  );
};

export default CreatureDialog;
