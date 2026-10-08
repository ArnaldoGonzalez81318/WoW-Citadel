import type {
  QuestBrowseMode,
  QuestGroupSummary,
} from "@/features/quests/types";

/*
 * Grouping for the zone and category pickers. Names are localized, so the
 * category sections are keyed on Blizzard's ids (stable in every locale);
 * a category added in a later patch lands in "Storylines & features" until
 * it is placed here. Zones have no grouping in the API at all: they go by
 * first letter.
 */

const CATEGORY_SECTIONS: ReadonlyArray<{ label: string; ids: ReadonlySet<number> }> = [
  {
    label: "Classes",
    ids: new Set([
      // Warlock … Evoker, then each class's Legion campaign and the Order Hall.
      61, 81, 82, 141, 161, 162, 261, 262, 263, 372, 395, 407, 614,
      413, 416, 417, 418, 419, 420, 421, 422, 423, 424, 425, 426, 427,
    ]),
  },
  {
    label: "Professions",
    ids: new Set([
      24, 101, 121, 181, 182, 201, 264, 304, 324, 371, 373, 377, 404, 408,
      410, 411, 571,
    ]),
  },
  {
    label: "Holidays & events",
    ids: new Set([
      21, 22, 41, 364, 366, 369, 370, 374, 375, 376, 378, 409, 430, 433, 564,
      638,
    ]),
  },
  {
    label: "Races & heritage",
    ids: new Set([
      437, 438, 439, 440, 444, 449, 450, 559, 560, 566, 582, 583, 640, 664,
    ]),
  },
  {
    label: "Dungeons, raids & delves",
    ids: new Set([392, 400, 432, 441, 442, 453, 565, 594, 652]),
  },
  {
    label: "PvP",
    ids: new Set([25, 555, 557, 575]),
  },
];

const OTHER_CATEGORY_SECTION = "Storylines & features";

/** Sections in display order; anything unplaced comes last. */
const CATEGORY_SECTION_ORDER: readonly string[] = [
  ...CATEGORY_SECTIONS.map((section) => section.label),
  OTHER_CATEGORY_SECTION,
];

const categorySection = (id: number): string =>
  CATEGORY_SECTIONS.find((section) => section.ids.has(id))?.label ??
  OTHER_CATEGORY_SECTION;

/** "Á…" and "a…" both file under "A"; digits and symbols under "#". */
const letterOf = (name: string): string => {
  const first = name.trim().normalize("NFD").charAt(0).toLocaleUpperCase();
  return /\p{L}/u.test(first) ? first : "#";
};

export type PickerOption = QuestGroupSummary & {
  /** The section header the picker files it under. */
  section: string;
  /** The name, plus its id when another entry shares the name. */
  label: string;
};

const compareNames = (left: string, right: string): number =>
  left.localeCompare(right, undefined, { sensitivity: "base" });

/**
 * Picker options sorted by section, then name (MUI's grouped Autocomplete
 * needs each section's options together). Blizzard reuses zone names across
 * expansions and phases (five "Tirisfal Glades", four "The Maw"); those get
 * their id so each option can be told apart.
 */
export const toPickerOptions = (
  mode: QuestBrowseMode,
  entries: readonly QuestGroupSummary[],
): PickerOption[] => {
  const counts = new Map<string, number>();
  entries.forEach((entry) => {
    const key = entry.name.toLocaleLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const options = entries.map((entry) => ({
    ...entry,
    section: mode === "category" ? categorySection(entry.id) : letterOf(entry.name),
    label:
      (counts.get(entry.name.toLocaleLowerCase()) ?? 0) > 1
        ? `${entry.name} (#${entry.id})`
        : entry.name,
  }));

  const sectionRank = (section: string): number => {
    if (mode !== "category") {
      // "#" after the letters, as in a book's index.
      return section === "#" ? 1 : 0;
    }
    return CATEGORY_SECTION_ORDER.indexOf(section);
  };

  return options.sort(
    (left, right) =>
      sectionRank(left.section) - sectionRank(right.section) ||
      (mode === "category" ? 0 : compareNames(left.section, right.section)) ||
      compareNames(left.name, right.name) ||
      left.id - right.id,
  );
};

/**
 * Where the page opens for each mode when the URL names no group: Elwynn
 * Forest (the classic first zone), the current expansion's category, and
 * Dungeon. A region whose index lacks one falls back to its first entry.
 */
export const DEFAULT_GROUP_IDS: Readonly<Record<QuestBrowseMode, number>> = {
  zone: 12,
  category: 649,
  type: 81,
};
