import HolidayVillageRoundedIcon from "@mui/icons-material/HolidayVillageRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Box, Button, Typography } from "@mui/material";
import { useMemo } from "react";

import DetailDialog from "@/components/common/DetailDialog";
import type {
  DetailDialogRow,
  DetailDialogSection,
} from "@/components/common/DetailDialog";
import { EmptyState } from "@/components/common/StateBlocks";
import { mapFaction } from "@/features/neighborhoods/config/neighborhoodMaps";
import { useNeighborhoodLookup } from "@/features/neighborhoods/hooks/useNeighborhoodRecords";
import { pageOf } from "@/features/neighborhoods/services/neighborhoodService";
import type { NeighborhoodMap } from "@/features/neighborhoods/types";
import FactionTag from "@/features/pvpSeasons/components/FactionTag";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import { wowheadSearchUrl } from "@/lib/externalLinks";

export type NeighborhoodDialogProps = {
  /** Whether the dialog is showing; `number` stays set through the close transition. */
  open: boolean;
  /** The neighborhood number to show (the last one opened). */
  number: number | null;
  maps: NeighborhoodMap[];
  /** The map index: the lookup cannot start until it is in. */
  mapsStatus: "pending" | "error" | "success";
  mapsError: unknown;
  onRetryMaps: () => void;
  /** What the register shows, to offer "Show on the register" only when it is elsewhere. */
  currentMapId: number | null;
  currentPage: number | null;
  onClose: () => void;
  onShowOnRegister: (mapId: number, number: number) => void;
};

const PUBLISHED_NOTE =
  "A neighborhood's record holds its number, its name and its map, nothing more. Plots, houses and residents are not in Blizzard's public API, so this page does not show or look them up.";

/**
 * One neighborhood, on whichever map has it: its number, name, map and the
 * map's faction, and where it sits in the register. Opened from a card the
 * record is already cached; from a typed number or a shared link, every
 * map is asked at once.
 */
const NeighborhoodDialog = ({
  open,
  number,
  maps,
  mapsStatus,
  mapsError,
  onRetryMaps,
  currentMapId,
  currentPage,
  onClose,
  onShowOnRegister,
}: NeighborhoodDialogProps): JSX.Element => {
  const mapIds = useMemo(() => maps.map((map) => map.id), [maps]);
  const lookup = useNeighborhoodLookup(number, mapIds, currentMapId);
  const record = number !== null ? lookup.record : undefined;
  const numberLabel = number !== null ? `No. ${formatNumber(number)}` : "";

  // The index has to be in before any map can be asked: its failure is the
  // dialog's failure, and an empty index means no map has the number.
  const loading = mapsStatus === "pending" || (mapsStatus === "success" && lookup.pending);
  const error =
    mapsStatus === "error" ? mapsError : !record && lookup.error ? lookup.error : undefined;
  const missing =
    !loading && error === undefined && !record && (maps.length === 0 || lookup.missing);

  const rows: DetailDialogRow[] = [];
  const sections: DetailDialogSection[] = [];
  if (record) {
    const faction = mapFaction(record.mapId);
    rows.push({ label: "Number", value: numberLabel });
    rows.push({
      label: "Map",
      value: faction ? (
        <>
          {`${record.mapName} · `}
          <FactionTag faction={faction} />
        </>
      ) : (
        record.mapName
      ),
    });
    rows.push({ label: "Register page", value: formatNumber(pageOf(record.id)) });
    rows.push({ label: "Region", value: env.region.toUpperCase() });
    if (record.nameIsCode) {
      sections.push({
        heading: "About this name",
        content: (
          <Typography variant="body2" color="text.secondary" component="p" sx={{ margin: 0 }}>
            {"Blizzard's API gives this neighborhood's name as a numeric code, "}
            <Box component="span" sx={(theme) => ({ fontFamily: theme.wc.fontMono, color: "text.primary" })}>
              {record.name}
            </Box>
            {", as it does for many neighborhoods, rather than in words."}
          </Typography>
        ),
      });
    }
    sections.push({
      heading: "What Blizzard publishes",
      content: (
        <Typography variant="body2" color="text.secondary" component="p" sx={{ margin: 0 }}>
          {PUBLISHED_NOTE}
        </Typography>
      ),
    });
  }

  const onRegister =
    record !== undefined &&
    record.mapId === currentMapId &&
    pageOf(record.id) === currentPage;
  const wowhead = record ? wowheadSearchUrl(record.mapName) : undefined;

  return (
    <DetailDialog
      open={open && number !== null}
      onClose={onClose}
      title={record?.name ?? `Neighborhood ${numberLabel}`}
      subtitle={
        record
          ? `${numberLabel} · ${record.mapName}`
          : missing
            ? "Not found"
            : undefined
      }
      rows={rows}
      sections={sections}
      loading={loading}
      error={error}
      onRetry={mapsStatus === "error" ? onRetryMaps : lookup.retry}
      errorContext={mapsStatus === "error" ? "neighborhood maps" : "this neighborhood"}
      actions={
        record ? (
          <>
            {onRegister ? null : (
              <Button size="small" onClick={() => onShowOnRegister(record.mapId, record.id)}>
                Show on the register
              </Button>
            )}
            {wowhead ? (
              <Button
                href={wowhead}
                target="_blank"
                rel="noreferrer"
                size="small"
                endIcon={<OpenInNewRoundedIcon />}
              >
                {`${record.mapName} on Wowhead`}
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      {missing ? (
        <EmptyState
          compact
          icon={<HolidayVillageRoundedIcon />}
          title={`No neighborhood ${numberLabel}`}
          description={`No map in this region (${env.region.toUpperCase()}) has a neighborhood with this number. It may not have been founded yet.`}
        />
      ) : null}
    </DetailDialog>
  );
};

export default NeighborhoodDialog;
