import {
  Fade,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  useMediaQuery,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Ref } from "react";

import { FilterChipGroup, SearchField } from "@/components/common/ExplorerFilterBar";
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
  /** The search input, so the page can hand focus back to it ("Clear filters"). */
  searchInputRef?: Ref<HTMLInputElement>;
};

const CLASS_LABEL_ID = "item-class-label";
const CLASS_SELECT_ID = "item-class-select";
const SUBCLASS_LABEL_ID = "item-subclass-label";
const SUBCLASS_SELECT_ID = "item-subclass-select";
/**
 * Select value for "All subclasses" (no `subclass` URL param). A non-empty
 * sentinel so the outlined label shrinks and the option text shows as the
 * selected value; subclass ids are numeric strings, so it cannot collide.
 */
const ALL_SUBCLASSES = "all";

/** Medium chip height (theme MuiChip root) and typical subclass label widths. */
const CHIP_HEIGHT = 28;
const SUBCLASS_PLACEHOLDER_WIDTHS = [112, 88, 96, 120, 80, 104];
/** Medium outlined input (theme MuiOutlinedInput) and the class Select's width. */
const SELECT_HEIGHT = 48;
const SELECT_MIN_WIDTH = 220;

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
  searchInputRef,
}: ItemFiltersProps): JSX.Element => {
  const theme = useTheme();
  // Below md the subclass chips (22 for Weapon) wrapped to eight rows and
  // pushed the grid below the first viewport; a Select keeps the bar to
  // three 48px controls there.
  const isCompact = useMediaQuery(theme.breakpoints.down("md"), { noSsr: true });
  const [draft, setDraft] = useState(q);
  const committedRef = useRef(q);

  const commit = useCallback(
    (text: string): void => {
      committedRef.current = text.trim();
      onQueryChange(text);
    },
    [onQueryChange],
  );

  // Resync only when the URL changed somewhere else (Back button, "Clear
  // filters"), never on the echo of this field's own commit, so a keystroke
  // typed while a debounced commit is in flight is kept.
  useEffect(() => {
    if (q !== committedRef.current) {
      committedRef.current = q;
      setDraft(q);
    }
  }, [q]);

  const handleClassChange = (event: SelectChangeEvent<string>): void => {
    const next = Number(event.target.value);
    if (Number.isInteger(next) && next !== activeClassId) {
      onClassChange(next);
    }
  };

  const handleSubclassChange = (event: SelectChangeEvent<string>): void => {
    const raw = event.target.value;
    if (raw === ALL_SUBCLASSES) {
      if (activeSubclassId !== null) {
        onSubclassChange(null);
      }
      return;
    }
    const next = Number(raw);
    if (Number.isInteger(next) && next !== activeSubclassId) {
      onSubclassChange(next);
    }
  };

  // Same rule as the class Select: only a value backed by a rendered option.
  const subclassSelectValue = subclasses.some(
    (entry) => entry.id === activeSubclassId,
  )
    ? String(activeSubclassId)
    : ALL_SUBCLASSES;

  // Only a value backed by a rendered option: before the class index lands
  // (deep link, reload) the Select has no options yet.
  const selectValue = itemClasses.some((entry) => entry.id === activeClassId)
    ? String(activeClassId)
    : "";

  return (
    <>
      <SearchField
        id="items-search"
        label="Search items by name"
        placeholder="Search items by name…"
        value={draft}
        onChange={setDraft}
        onDebouncedChange={commit}
        onSubmit={commit}
        onClear={() => {
          setDraft("");
          commit("");
        }}
        debounceMs={350}
        minLength={2}
        inputRef={searchInputRef}
      />

      <FormControl sx={{ minWidth: SELECT_MIN_WIDTH, flexShrink: 0 }}>
        <InputLabel id={CLASS_LABEL_ID}>Item class</InputLabel>
        <Select
          id={CLASS_SELECT_ID}
          labelId={CLASS_LABEL_ID}
          name="item-class"
          value={selectValue}
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
        isCompact ? (
          <Skeleton
            role="status"
            aria-label="Loading subclasses"
            aria-busy
            aria-live="polite"
            variant="rectangular"
            sx={{
              width: SELECT_MIN_WIDTH,
              maxWidth: "100%",
              height: SELECT_HEIGHT,
              borderRadius: `${theme.wc.radius.md}px`,
            }}
          />
        ) : (
          <Stack
            role="status"
            aria-label="Loading subclasses"
            aria-busy
            aria-live="polite"
            direction="row"
            flexWrap="wrap"
            useFlexGap
            gap={1}
            alignItems="center"
            sx={{ minWidth: 0, minHeight: CHIP_HEIGHT }}
          >
            {SUBCLASS_PLACEHOLDER_WIDTHS.map((width, index) => (
              <Skeleton
                key={index}
                variant="rectangular"
                sx={{
                  width,
                  maxWidth: "100%",
                  height: CHIP_HEIGHT,
                  borderRadius: `${theme.wc.radius.pill}px`,
                }}
              />
            ))}
          </Stack>
        )
      ) : subclasses.length > 0 && isCompact ? (
        <FormControl sx={{ minWidth: SELECT_MIN_WIDTH, flexShrink: 0 }}>
          <InputLabel id={SUBCLASS_LABEL_ID}>Item subclass</InputLabel>
          <Select
            id={SUBCLASS_SELECT_ID}
            labelId={SUBCLASS_LABEL_ID}
            name="item-subclass"
            value={subclassSelectValue}
            label="Item subclass"
            onChange={handleSubclassChange}
            MenuProps={{ TransitionComponent: Fade }}
          >
            <MenuItem value={ALL_SUBCLASSES}>All subclasses</MenuItem>
            {subclasses.map((subclass) => (
              <MenuItem key={subclass.id} value={String(subclass.id)}>
                {subclass.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
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
