import type { SvgIconComponent } from "@mui/icons-material";
import ApiRounded from "@mui/icons-material/ApiRounded";
import AssignmentRounded from "@mui/icons-material/AssignmentRounded";
import AutoStoriesRounded from "@mui/icons-material/AutoStoriesRounded";
import BoltRounded from "@mui/icons-material/BoltRounded";
import ChairRounded from "@mui/icons-material/ChairRounded";
import CheckroomRounded from "@mui/icons-material/CheckroomRounded";
import ConstructionRounded from "@mui/icons-material/ConstructionRounded";
import DataObjectRounded from "@mui/icons-material/DataObjectRounded";
import DiamondRounded from "@mui/icons-material/DiamondRounded";
import Diversity3Rounded from "@mui/icons-material/Diversity3Rounded";
import EmojiEventsRounded from "@mui/icons-material/EmojiEventsRounded";
import ExploreRounded from "@mui/icons-material/ExploreRounded";
import ExtensionRounded from "@mui/icons-material/ExtensionRounded";
import FamilyRestroomRounded from "@mui/icons-material/FamilyRestroomRounded";
import FlightRounded from "@mui/icons-material/FlightRounded";
import GavelRounded from "@mui/icons-material/GavelRounded";
import GroupsRounded from "@mui/icons-material/GroupsRounded";
import HolidayVillageRounded from "@mui/icons-material/HolidayVillageRounded";
import HubRounded from "@mui/icons-material/HubRounded";
import ImageSearchRounded from "@mui/icons-material/ImageSearchRounded";
import Inventory2Rounded from "@mui/icons-material/Inventory2Rounded";
import KeyRounded from "@mui/icons-material/KeyRounded";
import LayersRounded from "@mui/icons-material/LayersRounded";
import LeaderboardRounded from "@mui/icons-material/LeaderboardRounded";
import MilitaryTechRounded from "@mui/icons-material/MilitaryTechRounded";
import MonetizationOnRounded from "@mui/icons-material/MonetizationOnRounded";
import PeopleAltRounded from "@mui/icons-material/PeopleAltRounded";
import PetsRounded from "@mui/icons-material/PetsRounded";
import PsychologyRounded from "@mui/icons-material/PsychologyRounded";
import PublicRounded from "@mui/icons-material/PublicRounded";
import ShieldMoonRounded from "@mui/icons-material/ShieldMoonRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import ToysRounded from "@mui/icons-material/ToysRounded";
import TravelExploreRounded from "@mui/icons-material/TravelExploreRounded";
import WorkspacePremiumRounded from "@mui/icons-material/WorkspacePremiumRounded";

import type { NavFlyoutItem } from "@/components/layout/navigation/navConfig";

/*
 * Every glyph here was already in the bundle: another page imports it, or
 * (DataObjectRounded) the previous home directory did. vite's manualChunks
 * puts all of @mui/icons-material into one `mui-icons` chunk, and the built
 * index.html preloads that chunk on every route, so a glyph only the home
 * page needed would make every page download it. Check that again whenever
 * this map changes (grep src for the import path).
 */

/**
 * One glyph per explorer, keyed by nav item slug: each page's own header
 * icon, except where several pages share one (PublicRounded,
 * MilitaryTechRounded, EmojiEventsRounded, PetsRounded), which would make
 * neighbouring rows look alike; those take another glyph already in the
 * bundle.
 */
export const EXPLORER_ICONS: Readonly<Record<string, SvgIconComponent>> = {
  items: Inventory2Rounded,
  "item-appearance": CheckroomRounded,
  heirloom: FamilyRestroomRounded,
  mounts: FlightRounded,
  pet: PetsRounded,
  toy: ToysRounded,
  "azerite-essence": PsychologyRounded,
  "modified-crafting": ExtensionRounded,
  "housing-decor": ChairRounded,
  achievement: EmojiEventsRounded,
  spells: BoltRounded,
  realm: PublicRounded,
  "connected-realm": HubRounded,
  region: TravelExploreRounded,
  neighborhood: HolidayVillageRounded,
  covenant: ShieldMoonRounded,
  reputations: Diversity3Rounded,
  quest: AssignmentRounded,
  creatures: GroupsRounded,
  "guild-crest": ShieldRounded,
  journal: AutoStoriesRounded,
  "media-search": ImageSearchRounded,
  "auction-house": GavelRounded,
  "mythic-keystone-dungeon": KeyRounded,
  "mythic-keystone-leaderboard": LeaderboardRounded,
  "mythic-raid-leaderboard": WorkspacePremiumRounded,
  "pvp-season": MilitaryTechRounded,
  "pvp-tier": LayersRounded,
  profession: ConstructionRounded,
  "wow-token": MonetizationOnRounded,
};

/** Keyed by nav section id: the group headers, and the fallback for an explorer added later. */
export const SECTION_ICONS: Readonly<Record<string, SvgIconComponent>> = {
  collectibles: DiamondRounded,
  characters: PeopleAltRounded,
  world: PublicRounded,
  competitive: LeaderboardRounded,
};

/** Generic API dataset pages all share one glyph: they are the same page over different data. */
export const DATASET_ICON: SvgIconComponent = DataObjectRounded;

export const API_EXPLORER_ICON: SvgIconComponent = ApiRounded;

export const DIRECTORY_ICON: SvgIconComponent = ExploreRounded;

/**
 * An explorer's glyph, else its section's, else the directory's own: a nav
 * item added later still renders with a fitting icon, and the home page
 * never needs editing for it to appear.
 */
export const iconForItem = (
  item: NavFlyoutItem,
  sectionId: string,
): SvgIconComponent =>
  EXPLORER_ICONS[item.slug] ?? SECTION_ICONS[sectionId] ?? DIRECTORY_ICON;
