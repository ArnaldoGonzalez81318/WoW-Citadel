import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded"
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded"
import FlightRoundedIcon from "@mui/icons-material/FlightRounded"
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded"
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded"
import { SearchCategory } from "@/features/search/types"
import {
  searchAchievements,
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
    id: "achievements",
    label: "Achievements",
    description: "Track points, feats of strength, and collectible milestones",
    icon: EmojiEventsRoundedIcon,
    fetcher: searchAchievements,
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
