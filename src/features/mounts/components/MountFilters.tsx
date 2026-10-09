import { Box, Button, Skeleton, Stack } from "@mui/material";
import type { ReactNode, Ref } from "react";

import {
  ExplorerFilterBar,
  FilterChipGroup,
  SearchField,
  SegmentedControl,
} from "@/components/common/ExplorerFilterBar";
import type { FilterOption, SegmentedOption } from "@/components/common/ExplorerFilterBar";
import { ErrorState } from "@/components/common/StateBlocks";
import { SourceIcon } from "@/features/mounts/components/MountMeta";
import type { MountSort } from "@/features/mounts/types";
import { COARSE_POINTER } from "@/theme";

/** The faction control's value when no faction is picked (the URL leaves it out). */
export const ANY_FACTION = "any";

export type SourceOption = FilterOption & {
  /** Blizzard's source code, for its icon. */
  type: string;
};

export type MountFiltersProps = {
  /** The search field's draft (keystrokes stay local; the URL gets `onSearch`). */
  draft: string;
  onDraftChange: (value: string) => void;
  onSearch: (value: string) => void;
  /** Where focus goes when a Clear button removes itself. */
  searchInputRef?: Ref<HTMLInputElement>;
  minQueryLength: number;
  /** Undefined while the sources load. */
  sourceOptions: SourceOption[] | undefined;
  /** The sources failed (and nothing is cached to show instead). */
  sourcesError: unknown;
  onRetrySources: () => void;
  /** The chosen faction's per-source counts failed (the chips show none meanwhile). */
  countsError: unknown;
  onRetryCounts: () => void;
  source: string | null;
  onSourceChange: (source: string | null) => void;
  factionOptions: ReadonlyArray<SegmentedOption>;
  faction: string;
  onFactionChange: (faction: string) => void;
  sortOptions: ReadonlyArray<SegmentedOption<MountSort>>;
  sort: MountSort;
  onSortChange: (sort: MountSort) => void;
  /** A source or faction is set. */
  canClear: boolean;
  onClear: () => void;
  summary?: ReactNode;
  progress: boolean;
};

/** Full width on phones (each option an equal share), natural width beside the search on wider screens. */
const segmentedSx = {
  width: { xs: "100%", sm: "auto" },
  "& .MuiToggleButton-root": { flex: { xs: "1 1 0", sm: "0 0 auto" }, whiteSpace: "nowrap" },
} as const;

/**
 * "All sources" and the eleven source chips at about their real widths
 * (icon, name and count), so the rows they wrap onto match and the results
 * below stay put when the counts land.
 */
const SOURCE_SKELETON_WIDTHS = [92, 116, 104, 150, 156, 108, 150, 130, 144, 136, 88, 122];

/**
 * The mount filter strip: a name search, the faction and order, and a chip
 * per source with how many mounts it holds. The chips wrap onto their own
 * line; a summary of the results is announced politely at the end.
 */
const MountFilters = ({
  draft,
  onDraftChange,
  onSearch,
  searchInputRef,
  minQueryLength,
  sourceOptions,
  sourcesError,
  onRetrySources,
  countsError,
  onRetryCounts,
  source,
  onSourceChange,
  factionOptions,
  faction,
  onFactionChange,
  sortOptions,
  sort,
  onSortChange,
  canClear,
  onClear,
  summary,
  progress,
}: MountFiltersProps): JSX.Element => {
  const renderSources = (): JSX.Element => {
    if (sourceOptions) {
      const chips = (
        <FilterChipGroup
          label="Source"
          allLabel="All sources"
          size="small"
          options={sourceOptions.map((option) => ({
            ...option,
            // Sized and spaced by the chip (see SourceIcon).
            icon: <SourceIcon type={option.type} />,
          }))}
          value={source}
          onChange={onSourceChange}
        />
      );
      return countsError ? (
        <Stack spacing={1}>
          {chips}
          <ErrorState
            compact
            error={countsError}
            title="Per-source counts are unavailable"
            context="this faction's counts"
            onRetry={onRetryCounts}
          />
        </Stack>
      ) : (
        chips
      );
    }
    if (sourcesError) {
      return (
        <ErrorState
          compact
          error={sourcesError}
          context="mount sources"
          onRetry={onRetrySources}
        />
      );
    }
    return (
      <Stack
        role="status"
        aria-label="Loading mount sources"
        direction="row"
        flexWrap="wrap"
        useFlexGap
        gap={1}
        // FilterChipGroup's touch-screen row gap, so the rows match there too.
        sx={{ [COARSE_POINTER]: { rowGap: 1.5 } }}
      >
        {SOURCE_SKELETON_WIDTHS.map((width, index) => (
          <Skeleton key={index} variant="rounded" width={width} height={24} sx={{ borderRadius: 4 }} />
        ))}
      </Stack>
    );
  };

  return (
    <ExplorerFilterBar label="Mount filters" summary={summary} progress={progress}>
      <SearchField
        size="small"
        label="Search mounts by name"
        placeholder="Search mounts by name"
        value={draft}
        onChange={onDraftChange}
        onDebouncedChange={onSearch}
        minLength={minQueryLength}
        inputRef={searchInputRef}
        // Shrinks at phone width (its 240px floor would widen the page there).
        sx={{ flex: "2 1 240px", minWidth: { xs: 0, sm: 240 } }}
      />
      <SegmentedControl
        label="Faction"
        size="small"
        options={factionOptions}
        value={faction}
        onChange={onFactionChange}
        sx={segmentedSx}
      />
      <SegmentedControl<MountSort>
        label="Order"
        size="small"
        options={sortOptions}
        value={sort}
        onChange={onSortChange}
        sx={segmentedSx}
      />
      {canClear ? (
        <Button size="small" onClick={onClear} sx={{ flexShrink: 0 }}>
          Clear filters
        </Button>
      ) : null}
      {/* Its own line: eleven chips never fit beside the search. */}
      <Box sx={{ flex: "1 1 100%", minWidth: 0 }}>{renderSources()}</Box>
    </ExplorerFilterBar>
  );
};

export default MountFilters;
