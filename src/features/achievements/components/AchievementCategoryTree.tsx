import { Tab, Tabs } from "@mui/material";
import { useMemo } from "react";
import type { ReactNode, SyntheticEvent } from "react";

import {
  ExplorerFilterBar,
  FilterChipGroup,
} from "@/components/common/ExplorerFilterBar";
import type { FilterOption } from "@/components/common/ExplorerFilterBar";
import type { AchievementCategorySummary } from "@/features/achievements/types";

export type AchievementCategoryTreeProps = {
  /** Top-level categories, rendered as scrollable tabs. */
  rootCategories: AchievementCategorySummary[];
  /** Root of the current selection (the selection itself when it is a root). */
  rootId: number | null;
  /** Children of `rootId`, rendered as a chip group. */
  subcategories: AchievementCategorySummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** Result summary shown right-aligned ("1,204 achievements"). */
  summary?: ReactNode;
  /** Shows the 2px progress bar while the category refetches. */
  progress?: boolean;
  /** Stick under the app header on md+. */
  sticky?: boolean;
};

/**
 * Two-level category navigation: root categories as tabs (aria-selected),
 * subcategories of the active root as pressed chips (aria-pressed).
 */
const AchievementCategoryTree = ({
  rootCategories,
  rootId,
  subcategories,
  selectedId,
  onSelect,
  summary,
  progress = false,
  sticky = true,
}: AchievementCategoryTreeProps): JSX.Element => {
  const rootName = useMemo(
    () => rootCategories.find((category) => category.id === rootId)?.name,
    [rootCategories, rootId],
  );

  // MUI warns when `value` matches no Tab (e.g. a guild category deep link).
  const tabValue: number | false =
    rootId !== null && rootCategories.some((category) => category.id === rootId)
      ? rootId
      : false;

  const options = useMemo<FilterOption[]>(
    () =>
      subcategories.map((category) => ({
        value: String(category.id),
        label: category.name,
      })),
    [subcategories],
  );

  const chipValue =
    selectedId === null || selectedId === rootId ? null : String(selectedId);

  const handleTabChange = (_event: SyntheticEvent, value: number): void => {
    onSelect(value);
  };

  return (
    <ExplorerFilterBar
      label="Categories"
      sticky={sticky}
      summary={summary}
      progress={progress}
    >
      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Achievement categories"
        sx={{ flex: "1 1 100%", minWidth: 0 }}
      >
        {rootCategories.map((category) => (
          <Tab key={category.id} value={category.id} label={category.name} />
        ))}
      </Tabs>

      {subcategories.length > 0 ? (
        <FilterChipGroup
          label="Subcategory"
          allLabel={rootName ? `All ${rootName}` : "All"}
          options={options}
          value={chipValue}
          onChange={(value) => {
            if (value) {
              onSelect(Number(value));
            } else if (rootId !== null) {
              onSelect(rootId);
            }
          }}
        />
      ) : null}
    </ExplorerFilterBar>
  );
};

export default AchievementCategoryTree;
