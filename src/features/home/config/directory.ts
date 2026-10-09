import { NAV_SECTIONS } from "@/components/layout/navigation/navConfig";
import type {
  NavFlyoutItem,
  NavFlyoutSection,
} from "@/components/layout/navigation/navConfig";

/** The directory section's id: the strip's "All explorers" link jumps to it. */
export const DIRECTORY_ID = "explorers";

/** One main-menu section as the home directory lists it. */
export type DirectoryGroup = {
  section: NavFlyoutSection;
  /** Routes with a dedicated explorer (`live`), in menu order. */
  explorers: readonly NavFlyoutItem[];
  /** Generic API dataset pages (`gallery`), in menu order. */
  datasets: readonly NavFlyoutItem[];
};

/**
 * The directory is derived from the main menu at module load, so a new
 * explorer appears on the home page the moment navConfig marks it `live`
 * and nothing here can drift from the menu. `planned` items have no page
 * yet and are left out, as is a section with nothing to open.
 */
export const DIRECTORY_GROUPS: readonly DirectoryGroup[] = NAV_SECTIONS.map(
  (section) => ({
    section,
    explorers: section.items.filter((item) => item.status === "live"),
    datasets: section.items.filter((item) => item.status === "gallery"),
  }),
).filter((group) => group.explorers.length + group.datasets.length > 0);

/** Every dedicated explorer; the hero's copy and the directory read it, never a literal. */
export const EXPLORER_COUNT = DIRECTORY_GROUPS.reduce(
  (total, group) => total + group.explorers.length,
  0,
);

export const DATASET_COUNT = DIRECTORY_GROUPS.reduce(
  (total, group) => total + group.datasets.length,
  0,
);

/**
 * The API Explorer has no menu entry (the header, the drawer and the footer
 * only list game data), so this directory is its one top-level way in. The
 * description is the workbench page's own lead.
 */
export const API_EXPLORER = {
  path: "/api-explorer",
  label: "API Explorer",
  description:
    "Browse every Blizzard World of Warcraft Game Data family, send requests with your own parameters and copy the raw JSON.",
} as const;
