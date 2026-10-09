import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useId } from "react";

import { FilterChipGroup } from "@/components/common/ExplorerFilterBar";
import type { ItemSubclassSummary } from "@/features/items/types";
import { COARSE_POINTER } from "@/theme";

/** Select value for "every subclass" (subclass ids are numeric strings). */
const ALL = "all";
/** Typical small subclass chip widths, cycled through the loading row. */
const PLACEHOLDER_WIDTHS = [72, 96, 64, 120, 84, 56, 108, 76];
/** Most classes list 11 to 15 subclasses. */
const DEFAULT_PLACEHOLDER_COUNT = 12;
/** The compact select's sizing, shared with its placeholder. */
const selectSx = { flex: "1 1 220px", minWidth: 0, maxWidth: { sm: 280 } } as const;

export type SubclassPickerProps = {
  className: string;
  subclasses: readonly ItemSubclassSummary[];
  loading: boolean;
  /** The class record failed: say so (with Retry) instead of an empty row. */
  error?: boolean;
  retrying?: boolean;
  onRetry?: () => void;
  value: number | null;
  onChange: (subclassId: number | null) => void;
  /** Chips to sketch while the class loads, so the results below don't jump. */
  placeholderCount?: number;
};

/**
 * The chosen class's subclasses: chips on wide screens, a select below md
 * (Weapon's 21 chips wrap to eight rows on a phone and push the results
 * below the first screen).
 */
const SubclassPicker = ({
  className,
  subclasses,
  loading,
  error = false,
  retrying = false,
  onRetry,
  value,
  onChange,
  placeholderCount = DEFAULT_PLACEHOLDER_COUNT,
}: SubclassPickerProps): JSX.Element | null => {
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down("md"), { noSsr: true });
  const labelId = useId();

  // Shaped like what replaces it (the select, or the wrapped chip rows
  // with "All types" first), so the filter bar keeps its height.
  if (loading) {
    if (compact) {
      return (
        <Box role="status" aria-label={`Loading ${className} subclasses`} aria-busy sx={selectSx}>
          <Skeleton variant="rounded" sx={{ width: "100%", height: 40 }} />
        </Box>
      );
    }
    return (
      <Stack
        role="status"
        aria-label={`Loading ${className} subclasses`}
        aria-busy
        direction="row"
        flexWrap="wrap"
        useFlexGap
        gap={1}
        sx={{ flex: "1 1 100%", minWidth: 0, [COARSE_POINTER]: { rowGap: 1.5 } }}
      >
        {Array.from({ length: placeholderCount + 1 }, (_, index) => (
          <Skeleton
            key={index}
            variant="rounded"
            sx={{
              width: PLACEHOLDER_WIDTHS[index % PLACEHOLDER_WIDTHS.length],
              maxWidth: "100%",
              height: 24,
              borderRadius: 999,
            }}
          />
        ))}
      </Stack>
    );
  }

  if (error) {
    return (
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ flex: "1 1 100%", minWidth: 0 }}
      >
        <Typography variant="body2" color="text.secondary">
          {`${className} subclasses couldn't be loaded.`}
        </Typography>
        {/* Enabled while retrying (a disabled button drops focus). */}
        <Button size="small" onClick={onRetry}>
          {retrying ? "Retrying…" : "Retry"}
        </Button>
      </Stack>
    );
  }

  if (subclasses.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <FormControl size="small" sx={selectSx}>
        <InputLabel id={labelId}>{`${className} type`}</InputLabel>
        <Select
          labelId={labelId}
          label={`${className} type`}
          value={value === null ? ALL : String(value)}
          onChange={(event) => {
            const next = String(event.target.value);
            onChange(next === ALL ? null : Number(next));
          }}
        >
          <MenuItem value={ALL}>All types</MenuItem>
          {subclasses.map((subclass) => (
            <MenuItem key={subclass.id} value={String(subclass.id)}>
              {subclass.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  return (
    <Box sx={{ flex: "1 1 100%", minWidth: 0 }}>
      <FilterChipGroup
        label={`${className} type`}
        size="small"
        options={subclasses.map((subclass) => ({
          value: String(subclass.id),
          label: subclass.name,
        }))}
        value={value === null ? null : String(value)}
        onChange={(next) => onChange(next === null ? null : Number(next))}
        allLabel="All types"
      />
    </Box>
  );
};

export default SubclassPicker;
