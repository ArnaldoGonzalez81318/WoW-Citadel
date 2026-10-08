import {
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";

import {
  pvpRewardsQuery,
  pvpSeasonQuery,
} from "@/features/pvpSeasons/hooks/pvpSeasonQueries";
import {
  isUnpublishedSeasonError,
  seasonNameFromCutoffs,
} from "@/features/pvpSeasons/services/pvpSeasonService";
import {
  fallbackSeasonName,
  seasonMonths,
} from "@/features/pvpSeasons/services/seasonFormat";
import { toSxArray } from "@/lib/sx";

export type SeasonPickerProps = {
  /** Newest first. */
  seasonIds: readonly number[];
  currentId: number | null;
  value: number | null;
  onChange: (seasonId: number) => void;
  /** The selected season's display name (the page already loads its record). */
  selectedLabel: string;
  loading?: boolean;
  /** Epoch ms, to tell a season Blizzard still calls current but that has ended. */
  now: number;
  sx?: SxProps<Theme>;
};

/**
 * One option. Blizzard's index carries ids only, so each option loads its
 * season's record (a few hundred bytes) for a name and dates; options only
 * mount while the menu is open, so the ~20 lookups happen on demand, once.
 */
const SeasonOption = ({
  seasonId,
  current,
  now,
}: {
  seasonId: number;
  current: boolean;
  now: number;
}): JSX.Element => {
  // A label that failed (the unpublished seasons answer 403) is not asked
  // again every time the menu opens; picking that season retries it.
  const query = useQuery({ ...pvpSeasonQuery(seasonId), retryOnMount: false });
  // Cache only (never fetched here): a season the viewer already opened
  // names itself from its titles, as the season header does.
  const rewards = useQuery({ ...pvpRewardsQuery(seasonId), enabled: false });
  const name =
    query.data?.name ??
    seasonNameFromCutoffs(rewards.data ?? []) ??
    fallbackSeasonName(seasonId);
  // Between seasons the index still points at the one that just ended;
  // its end date has passed, so it is not called current here.
  const endTimestamp = query.data?.endTimestamp;
  const running = current && (endTimestamp === undefined || endTimestamp > now);
  const secondary = isUnpublishedSeasonError(query.error)
    ? "Not published by Blizzard"
    : [running ? "Current season" : undefined, seasonMonths(query.data)]
        .filter(Boolean)
        .join(" · ");
  return (
    <ListItemText
      primary={name}
      secondary={secondary || " "}
      slotProps={{ secondary: { variant: "caption" } }}
      sx={{ my: 0 }}
    />
  );
};

/** The season list, newest first, as a select labelled "Season". */
const SeasonPicker = ({
  seasonIds,
  currentId,
  value,
  onChange,
  selectedLabel,
  loading = false,
  now,
  sx,
}: SeasonPickerProps): JSX.Element => {
  const labelId = `pvp-season-${useId()}`;
  return (
    <FormControl
      size="small"
      disabled={loading || seasonIds.length === 0}
      sx={[{ minWidth: 0, width: { xs: "100%", sm: 280 } }, ...toSxArray(sx)]}
    >
      <InputLabel id={labelId}>Season</InputLabel>
      <Select
        labelId={labelId}
        label="Season"
        // An empty value until the index lists the selection, so MUI never
        // warns about an out-of-range value.
        value={value !== null && seasonIds.includes(value) ? value : ""}
        renderValue={() => selectedLabel}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isInteger(next) && next > 0) {
            onChange(next);
          }
        }}
        MenuProps={{ slotProps: { paper: { sx: { maxHeight: 420 } } } }}
      >
        {seasonIds.map((seasonId) => (
          <MenuItem key={seasonId} value={seasonId}>
            <SeasonOption seasonId={seasonId} current={seasonId === currentId} now={now} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default SeasonPicker;
