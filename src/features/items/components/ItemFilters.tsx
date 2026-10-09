import {
  Box,
  FormControl,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
} from "@mui/material";
import { useId } from "react";
import type { ReactNode, Ref } from "react";

import {
  ExplorerFilterBar,
  SearchField,
} from "@/components/common/ExplorerFilterBar";
import {
  QUALITY_LABEL,
  QUALITY_OPTIONS,
  SORT_OPTIONS,
} from "@/features/items/services/itemCatalog";
import type { SlotGroup } from "@/features/items/services/itemCatalog";
import LevelRangeFields from "@/features/items/components/LevelRangeFields";
import type { ItemLevelRange, ItemSort } from "@/features/items/types";
import { qualityColor } from "@/theme";
import type { QualityKey } from "@/theme";

/** The Selects' value for "any" (the URL leaves the key out). */
const ANY = "any";

export type ItemFiltersProps = {
  /** The search field's draft (keystrokes stay local; the URL gets `onSearch`). */
  draft: string;
  onDraftChange: (value: string) => void;
  onSearch: (value: string) => void;
  /** Where focus goes when a Clear button removes itself. */
  searchInputRef?: Ref<HTMLInputElement>;
  quality: QualityKey | null;
  onQualityChange: (quality: QualityKey | null) => void;
  /** Slots that fit the chosen class; the menu is left out when there are none. */
  slotGroups: readonly SlotGroup[];
  slot: string | null;
  onSlotChange: (slot: string | null) => void;
  level: ItemLevelRange;
  onLevelChange: (range: ItemLevelRange) => void;
  sort: ItemSort;
  onSortChange: (sort: ItemSort) => void;
  /** The subclass row (chips or a select), on a line of its own. */
  subclasses?: ReactNode;
  /** The active filter chips, on a line of their own. */
  activeFilters?: ReactNode;
  summary?: ReactNode;
  progress: boolean;
};

const QualityDot = ({ quality }: { quality: QualityKey }): JSX.Element => (
  <Box
    component="span"
    aria-hidden="true"
    sx={(theme) => ({
      display: "inline-block",
      flexShrink: 0,
      width: 10,
      height: 10,
      mr: 1,
      borderRadius: "50%",
      backgroundColor: qualityColor(theme, quality),
    })}
  />
);

/**
 * The item search strip: name, quality, slot (for gear), an item level
 * range and the sort, then the chosen class's subclasses and the filters in
 * force. Blizzard's item search applies every one of them server-side, so
 * any mix pages through the matches. A summary is announced politely.
 */
const ItemFilters = ({
  draft,
  onDraftChange,
  onSearch,
  searchInputRef,
  quality,
  onQualityChange,
  slotGroups,
  slot,
  onSlotChange,
  level,
  onLevelChange,
  sort,
  onSortChange,
  subclasses,
  activeFilters,
  summary,
  progress,
}: ItemFiltersProps): JSX.Element => {
  const qualityLabelId = useId();
  const slotLabelId = useId();
  const sortLabelId = useId();
  const armorSlots = slotGroups.filter((group) => group.section === "Armor");
  const weaponSlots = slotGroups.filter((group) => group.section === "Weapons");

  return (
    <ExplorerFilterBar label="Item filters" summary={summary} progress={progress}>
      <SearchField
        size="small"
        label="Search items by name"
        placeholder="Search items by name"
        value={draft}
        onChange={onDraftChange}
        onDebouncedChange={onSearch}
        inputRef={searchInputRef}
        // Shrinks at phone width (its 240px floor would widen the page there).
        sx={{ flex: "2 1 240px", minWidth: { xs: 0, sm: 240 } }}
      />
      <FormControl size="small" sx={{ flex: "1 1 150px", minWidth: 0, maxWidth: { sm: 190 } }}>
        <InputLabel id={qualityLabelId}>Quality</InputLabel>
        <Select
          labelId={qualityLabelId}
          label="Quality"
          value={quality ?? ANY}
          onChange={(event) => {
            const next = String(event.target.value);
            onQualityChange(next === ANY ? null : (next as QualityKey));
          }}
          renderValue={(value) =>
            value === ANY ? (
              "Any quality"
            ) : (
              <Box component="span" sx={{ display: "inline-flex", alignItems: "center" }}>
                <QualityDot quality={value as QualityKey} />
                {QUALITY_LABEL[value as QualityKey]}
              </Box>
            )
          }
        >
          <MenuItem value={ANY}>Any quality</MenuItem>
          {QUALITY_OPTIONS.map((option) => (
            <MenuItem
              key={option}
              value={option}
              sx={(theme) => ({ color: qualityColor(theme, option) })}
            >
              <QualityDot quality={option} />
              {QUALITY_LABEL[option]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {slotGroups.length > 0 ? (
        <FormControl size="small" sx={{ flex: "1 1 150px", minWidth: 0, maxWidth: { sm: 190 } }}>
          <InputLabel id={slotLabelId}>Slot</InputLabel>
          <Select
            labelId={slotLabelId}
            label="Slot"
            value={slot ?? ANY}
            onChange={(event) => {
              const next = String(event.target.value);
              onSlotChange(next === ANY ? null : next);
            }}
          >
            <MenuItem value={ANY}>Any slot</MenuItem>
            {armorSlots.length > 0 ? <ListSubheader>Armor</ListSubheader> : null}
            {armorSlots.map((group) => (
              <MenuItem key={group.key} value={group.key}>
                {group.label}
              </MenuItem>
            ))}
            {weaponSlots.length > 0 ? <ListSubheader>Weapons and off-hands</ListSubheader> : null}
            {weaponSlots.map((group) => (
              <MenuItem key={group.key} value={group.key}>
                {group.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ) : null}
      <LevelRangeFields value={level} onChange={onLevelChange} />
      <FormControl size="small" sx={{ flex: "1 1 140px", minWidth: 0, maxWidth: { sm: 170 } }}>
        <InputLabel id={sortLabelId}>Sort by</InputLabel>
        <Select
          labelId={sortLabelId}
          label="Sort by"
          value={sort}
          onChange={(event) => onSortChange(event.target.value as ItemSort)}
        >
          {SORT_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {subclasses}
      {activeFilters}
    </ExplorerFilterBar>
  );
};

export default ItemFilters;
