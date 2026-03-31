import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded"
import FlightRoundedIcon from "@mui/icons-material/FlightRounded"
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded"
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded"
import { SearchCategory } from "@/features/search/types"
import {
  searchCreatures,
  searchItems,
  searchMounts,
  searchSpells,
} from "@/features/search/services/searchService"

export const SEARCH_CATEGORIES: SearchCategory[] = [
  {
    id: "items",
    label: "Items",
    description: "Weapons, armor, consumables, and trinkets from every era",
    icon: Inventory2RoundedIcon,
    fetcher: searchItems,
    minQueryLength: 2,
  },
  {
    id: "spells",
    label: "Spells",
    description: "Abilities, talents, and magical effects across all classes",
    icon: AutoAwesomeRoundedIcon,
    fetcher: searchSpells,
    minQueryLength: 2,
  },
  {
    id: "mounts",
    label: "Mounts",
    description: "Discover ground, flying, and special mounts with their sources",
    icon: FlightRoundedIcon,
    fetcher: searchMounts,
    minQueryLength: 2,
  },
  {
    id: "creatures",
    label: "Creatures",
    description: "NPCs, bosses, and denizens of Azeroth and beyond",
    icon: GroupsRoundedIcon,
    fetcher: searchCreatures,
    minQueryLength: 2,
  },
]
