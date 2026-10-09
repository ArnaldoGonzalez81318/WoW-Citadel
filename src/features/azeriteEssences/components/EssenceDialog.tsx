import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PsychologyRoundedIcon from "@mui/icons-material/PsychologyRounded";
import { Box, Button, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import DetailDialog from "@/components/common/DetailDialog";
import type { DetailDialogRow } from "@/components/common/DetailDialog";
import { EmptyState, LoadingSkeleton } from "@/components/common/StateBlocks";
import RankLadder from "@/features/azeriteEssences/components/RankLadder";
import RoleTags from "@/features/azeriteEssences/components/RoleTags";
import SpecGroups from "@/features/azeriteEssences/components/SpecGroups";
import {
  essenceIconQuery,
  essenceQuery,
} from "@/features/azeriteEssences/hooks/essenceQueries";
import {
  ROLE_ORDER,
  classCountOf,
  describeRoles,
  pluralize,
  powerNamesOf,
  rolesOf,
} from "@/features/azeriteEssences/services/azeriteEssenceService";
import type {
  EssenceSummary,
  RoleType,
  Specialization,
} from "@/features/azeriteEssences/types";
import { getExternalLink } from "@/lib/externalLinks";
import { formatNumber } from "@/lib/format";
import { visuallyHidden } from "@/theme";

export type EssenceDialogProps = {
  /** Whether the dialog is showing; `essenceId` stays set through the close transition. */
  open: boolean;
  /** The essence to show (the last one opened). */
  essenceId: number | null;
  /** Its roster entry: the name and specs before the record loads. */
  summary: EssenceSummary | undefined;
  catalog: ReadonlyMap<number, Specialization>;
  /** Every spec record has answered, so the roles read from them are final. */
  rolesReady: boolean;
  /** The roster failed to load, so the spec records behind the roles never will. */
  rolesFailed: boolean;
  roleNames: Record<RoleType, string>;
  /** Specializations any essence allows (39 on US; the game has more), for "6 of the 39". */
  totalSpecs: number;
  onClose: () => void;
};

/** The raw essence record, in the API workbench (catalog slug and endpoint id). */
const workbenchUrl = (essenceId: number): string =>
  `/api-explorer/azerite-essence?${new URLSearchParams({
    endpoint: "azerite-essence-detail",
    azeriteEssenceId: String(essenceId),
  }).toString()}`;

/**
 * An essence in full: its roles and powers at a glance, the rank ladder
 * with each rank's major and minor spell (icons and tooltips, fetched for
 * this essence only), and every specialization that could slot it, grouped
 * by class.
 */
const EssenceDialog = ({
  open,
  essenceId,
  summary,
  catalog,
  rolesReady,
  rolesFailed,
  roleNames,
  totalSpecs,
  onClose,
}: EssenceDialogProps): JSX.Element => {
  const enabled = essenceId !== null;
  const record = useQuery({ ...essenceQuery(essenceId ?? 0), enabled });
  const icon = useQuery({ ...essenceIconQuery(essenceId ?? 0), enabled });
  const data = enabled ? record.data : undefined;

  // A Retry puts a record with no data back to pending (and clears its
  // error); keeping the error up meanwhile keeps the focused Retry in place.
  // The kept error belongs to one essence: opening another starts clean, so
  // a record that failed on its card shows the skeleton while the dialog
  // fetches it again, not a blank body or another essence's error.
  const [kept, setKept] = useState<{ id: number | null; error: unknown }>({
    id: essenceId,
    error: null,
  });
  if (kept.id !== essenceId) {
    setKept({ id: essenceId, error: null });
  } else if (record.error && record.error !== kept.error) {
    setKept({ id: essenceId, error: record.error });
  }
  const shownError = record.error ?? (kept.id === essenceId ? kept.error : null);
  const failed = enabled && record.data === undefined && shownError !== null;

  const specs = data?.specs ?? summary?.specs ?? [];
  const name = data?.name ?? summary?.name ?? (essenceId !== null ? `Essence #${essenceId}` : "");
  const shape: EssenceSummary = { id: essenceId ?? 0, name, specs };
  const roles = rolesOf(shape, catalog);
  const classCount = classCountOf(shape, catalog);
  const { major, minor } = powerNamesOf(data);

  // A shared link can open the dialog before the spec records are in: no
  // role is named until they all are, so "Tank" never turns into "Every role".
  let subtitle: string | undefined;
  if (!rolesReady) {
    subtitle = undefined;
  } else if (roles.length === ROLE_ORDER.length) {
    subtitle = "Azerite essence for every role";
  } else if (roles.length > 0) {
    subtitle = `${describeRoles(roles, roleNames)} Azerite essence`;
  }

  let rolesValue: JSX.Element | string = "Reading roles…";
  if (rolesReady) {
    rolesValue = <RoleTags roles={roles} names={roleNames} />;
  } else if (rolesFailed) {
    rolesValue = "Unavailable";
  }

  const rows: DetailDialogRow[] = [];
  if (data) {
    rows.push({ label: "Roles", value: rolesValue });
    if (major) {
      rows.push({ label: "Major power", value: major });
    }
    if (minor) {
      rows.push({ label: "Minor power", value: minor });
    }
    // The denominator is what essences allow, not the game's total (the
    // live index lists specializations no essence names).
    const specCount =
      totalSpecs > 0
        ? `${formatNumber(specs.length)} of the ${formatNumber(totalSpecs)} specializations essences allow`
        : pluralize(specs.length, "specialization", "specializations");
    rows.push({
      label: "Specializations",
      value:
        rolesReady && classCount > 0
          ? `${specCount} · ${pluralize(classCount, "class", "classes")}`
          : specCount,
    });
    rows.push({ label: "Ranks", value: formatNumber(data.powers.length) });
    rows.push({ label: "Essence ID", value: formatNumber(data.id, { useGrouping: false }) });
  }

  let specGroups: JSX.Element;
  if (rolesReady) {
    specGroups = <SpecGroups specs={specs} catalog={catalog} roleNames={roleNames} />;
  } else if (rolesFailed) {
    specGroups = (
      <Typography component="p" variant="body2" color="text.secondary" sx={{ margin: 0 }}>
        Roles and classes could not be read because the essence list failed to load. Close
        this dialog to retry it.
      </Typography>
    );
  } else {
    specGroups = <LoadingSkeleton variant="block" height={160} label="Loading specializations" />;
  }

  const notFound = enabled && record.data === null;
  const wowhead = getExternalLink("azerite-essence", essenceId, name);

  return (
    <DetailDialog
      open={open && enabled}
      onClose={onClose}
      title={name}
      subtitle={subtitle}
      media={{ src: icon.data, alt: "", kind: "icon", loading: enabled && icon.isPending }}
      rows={rows}
      loading={enabled && record.isPending && !failed}
      error={failed ? shownError : undefined}
      onRetry={() => {
        if (record.fetchStatus === "idle") {
          void record.refetch();
        }
      }}
      errorContext="this essence"
      maxWidth="md"
      actions={
        essenceId !== null ? (
          <>
            <Button component={RouterLink} to={workbenchUrl(essenceId)} size="small">
              Open in API workbench
            </Button>
            {wowhead && !notFound ? (
              <Button
                href={wowhead.url}
                target="_blank"
                rel="noreferrer"
                size="small"
                endIcon={<OpenInNewRoundedIcon />}
              >
                {wowhead.label}
                <Box component="span" sx={visuallyHidden}>
                  {`: ${name}, opens in a new tab`}
                </Box>
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      {/* Full width, not as `sections`: those are capped at 72ch, which
          leaves the ladder's two columns and the class grid a third short. */}
      {data ? (
        <Stack spacing={2.5}>
          <Box component="section">
            <Typography variant="overline" component="h3" sx={{ margin: 0, marginBottom: 0.75 }}>
              Rank ladder
            </Typography>
            <RankLadder essence={data} />
          </Box>
          <Box component="section">
            <Typography variant="overline" component="h3" sx={{ margin: 0, marginBottom: 0.75 }}>
              Specializations by class
            </Typography>
            {specGroups}
          </Box>
        </Stack>
      ) : notFound ? (
        <EmptyState
          compact
          icon={<PsychologyRoundedIcon />}
          title="Essence not found"
          description={`Blizzard has no Azerite essence #${essenceId ?? ""} in its game data.`}
        />
      ) : null}
    </DetailDialog>
  );
};

export default EssenceDialog;
