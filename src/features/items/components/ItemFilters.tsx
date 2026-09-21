import { Fade, FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import { useEffect, useState } from "react";

import { FilterChipGroup, SearchField } from "@/components/common/ExplorerFilterBar";
import { LoadingSkeleton } from "@/components/common/StateBlocks";
import type {
  ItemClassSummary,
  ItemSubclassSummary,
} from "@/features/items/types";

export type ItemFiltersProps = {
  itemClasses: ItemClassSummary[];
  activeClassId: number | null;
  subclasses: ItemSubclassSummary[];
  activeSubclassId: number | null;
  isSubclassesLoading: boolean;
  q: string;
  onClassChange: (id: number) => void;
  onSubclassChange: (id: number | null) => void;
  onQueryChange: (q: string) => void;
};

const CLASS_LABEL_ID = "item-class-label";
const CLASS_SELECT_ID = "item-class-select";

/**
 * Search field, class select and subclass chips for the item explorer.
 * Renders inside `ExplorerFilterBar`; the URL-backed `q` is the committed
 * value while `draft` is what the user is typing.
 */
const ItemFilters = ({
  itemClasses,
  activeClassId,
  subclasses,
  activeSubclassId,
  isSubclassesLoading,
  q,
  onClassChange,
  onSubclassChange,
  onQueryChange,
}: ItemFiltersProps): JSX.Element => {
  const [draft, setDraft] = useState(q);

  // Resync only on an external change (Back button, "Clear filters"), never
  // on the echo of the user's own debounced input.
  useEffect(() => {
    setDraft((current) => (current.trim() === q ? current : q));
  }, [q]);

  const handleClassChange = (event: SelectChangeEvent<string>): void => {
    const next = Number(event.target.value);
    if (Number.isInteger(next) && next !== activeClassId) {
      onClassChange(next);
    }
  };

  return (
    <>
      <SearchField
        id="items-search"
        label="Search items by name"
        placeholder="Search items by name…"
        value={draft}
        onChange={setDraft}
        onDebouncedChange={onQueryChange}
        onSubmit={onQueryChange}
        onClear={() => {
          setDraft("");
          onQueryChange("");
        }}
        debounceMs={350}
        minLength={2}
      />

      <FormControl size="small" sx={{ minWidth: 220, flexShrink: 0 }}>
        <InputLabel id={CLASS_LABEL_ID} htmlFor={CLASS_SELECT_ID}>
          Item class
        </InputLabel>
        <Select
          labelId={CLASS_LABEL_ID}
          inputProps={{ id: CLASS_SELECT_ID, name: "item-class" }}
          value={activeClassId === null ? "" : String(activeClassId)}
          label="Item class"
          onChange={handleClassChange}
          MenuProps={{ TransitionComponent: Fade }}
        >
          {itemClasses.map((itemClass) => (
            <MenuItem key={itemClass.id} value={String(itemClass.id)}>
              {itemClass.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {isSubclassesLoading ? (
        <LoadingSkeleton
          variant="block"
          height={28}
          label="Loading subclasses"
          sx={(theme) => ({
            width: 320,
            maxWidth: "100%",
            borderRadius: `${theme.wc.radius.pill}px`,
          })}
        />
      ) : subclasses.length > 0 ? (
        <FilterChipGroup
          label="Item subclass"
          options={subclasses.map((subclass) => ({
            value: String(subclass.id),
            label: subclass.name,
          }))}
          value={activeSubclassId === null ? null : String(activeSubclassId)}
          onChange={(value) =>
            onSubclassChange(value === null ? null : Number(value))
          }
          allLabel="All subclasses"
        />
      ) : null}
    </>
  );
};

export default ItemFilters;
