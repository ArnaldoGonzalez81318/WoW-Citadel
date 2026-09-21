import type { SvgIconComponent } from "@mui/icons-material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import FlightRoundedIcon from "@mui/icons-material/FlightRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";

import {
  searchCreatures,
  searchItems,
  searchMounts,
  searchSpells,
} from "@/features/search/services/searchService";
import type { SearchFetcher } from "@/features/search/services/searchService";
import type { SearchCategoryId } from "@/features/search/types";

/**
 * One searchable Blizzard entity type. Identity is carried by icon + label
 * only (no per-category accent colours).
 */
export interface SearchCategoryConfig {
  id: SearchCategoryId;
  label: string;
  singular: string;
  plural: string;
  description: string;
  icon: SvgIconComponent;
  fetcher: SearchFetcher;
  minQueryLength: number;
  /** Dedicated explorer route, when one exists, for "Open in … explorer". */
  explorerPath?: string;
  placeholder: string;
  examples: string[];
}

export const DEFAULT_SEARCH_CATEGORY: SearchCategoryId = "items";

export const SEARCH_CATEGORIES: SearchCategoryConfig[] = [
  {
    id: "items",
    label: "Items",
    singular: "item",
    plural: "items",
    description: "Weapons, armor, consumables and trinkets from every era.",
    icon: Inventory2RoundedIcon,
    fetcher: searchItems,
    minQueryLength: 2,
    explorerPath: "/category/items",
    placeholder: "Search items by name",
    examples: ["Shadowmourne", "Thunderfury"],
  },
  {
    id: "spells",
    label: "Spells",
    singular: "spell",
    plural: "spells",
    description: "Abilities, talents and magical effects across all classes.",
    icon: AutoAwesomeRoundedIcon,
    fetcher: searchSpells,
    minQueryLength: 2,
    explorerPath: "/category/spells",
    placeholder: "Search spells by name",
    examples: ["Chaos Bolt", "Pyroblast"],
  },
  {
    id: "mounts",
    label: "Mounts",
    singular: "mount",
    plural: "mounts",
    description: "Ground, flying and special mounts with their sources.",
    icon: FlightRoundedIcon,
    fetcher: searchMounts,
    minQueryLength: 2,
    explorerPath: "/category/mounts",
    placeholder: "Search mounts by name",
    examples: ["Invincible", "Ashes of Al'ar"],
  },
  {
    id: "creatures",
    label: "Creatures",
    singular: "creature",
    plural: "creatures",
    description: "NPCs, bosses and denizens of Azeroth and beyond.",
    icon: GroupsRoundedIcon,
    fetcher: searchCreatures,
    minQueryLength: 2,
    placeholder: "Search creatures by name",
    examples: ["Onyxia", "Hogger"],
  },
];

export const findSearchCategory = (
  id: string | null | undefined,
): SearchCategoryConfig | undefined =>
  id ? SEARCH_CATEGORIES.find((category) => category.id === id) : undefined;
