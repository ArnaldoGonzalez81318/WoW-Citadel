import type { CategoryGroup, CategoryRef } from "@/features/modifiedCrafting/types";

/*
 * 588 category ids carry 522 names on US, and 9 have none: "Socket" alone
 * is seventeen ids, "Increase Item Level" twelve, and each PvP trophy and
 * crest four. A slot type names the exact ids it takes, so the ids stay
 * visible, but a reader looking for "Socket" wants one entry, not seventeen.
 */

const nameKey = (name: string): string => name.trim().toLocaleLowerCase();

/** Same-name categories collapsed, newest (highest id) group first. */
export const groupCategories = (categories: readonly CategoryRef[]): CategoryGroup[] => {
  const byKey = new Map<string, CategoryGroup>();
  categories.forEach((category) => {
    const key = category.name ? nameKey(category.name) : `#${category.id}`;
    const group = byKey.get(key);
    if (group) {
      group.ids.push(category.id);
    } else {
      byKey.set(key, { key, name: category.name, ids: [category.id], newestId: category.id });
    }
  });
  const groups = Array.from(byKey.values());
  groups.forEach((group) => {
    group.ids.sort((left, right) => right - left);
    group.newestId = group.ids[0];
  });
  // Blizzard numbers categories as it adds them, so the highest id is the
  // newest: this patch's reagents lead, not the first "Specify Haste".
  return groups.sort((left, right) => right.newestId - left.newestId);
};

/** Category id -> its group, for lookups from a slot type's list. */
export const groupByCategoryId = (
  groups: readonly CategoryGroup[],
): ReadonlyMap<number, CategoryGroup> => {
  const map = new Map<number, CategoryGroup>();
  groups.forEach((group) => group.ids.forEach((id) => map.set(id, group)));
  return map;
};
