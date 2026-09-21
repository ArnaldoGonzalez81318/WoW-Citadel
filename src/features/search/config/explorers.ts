import type { SvgIconComponent } from "@mui/icons-material";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import BoltRounded from "@mui/icons-material/BoltRounded";
import DataObjectRounded from "@mui/icons-material/DataObjectRounded";
import EmojiEventsRounded from "@mui/icons-material/EmojiEventsRounded";
import FlightRounded from "@mui/icons-material/FlightRounded";
import GroupsRounded from "@mui/icons-material/GroupsRounded";
import HubRounded from "@mui/icons-material/HubRounded";
import Inventory2Rounded from "@mui/icons-material/Inventory2Rounded";
import MonetizationOnRounded from "@mui/icons-material/MonetizationOnRounded";
import PublicRounded from "@mui/icons-material/PublicRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";

import { NAV_SECTIONS } from "@/components/layout/navigation/navConfig";

export interface ExplorerEntry {
  path: string;
  label: string;
  /** The nav section the explorer belongs to ("Collectibles & Gear"). */
  section: string;
  blurb: string;
  icon: SvgIconComponent;
}

type LiveExplorer = {
  icon: SvgIconComponent;
  blurb: string;
};

/**
 * Routes with a dedicated explorer, keyed by path. Labels and section names
 * come from navConfig so the directory stays in step with the nav.
 */
const LIVE_EXPLORERS: Record<string, LiveExplorer> = {
  "/category/items": {
    icon: Inventory2Rounded,
    blurb: "Browse item classes and subclasses, then open any item's details.",
  },
  "/category/spells": {
    icon: AutoAwesomeRounded,
    blurb: "Search spell records and inspect icons, descriptions and ranges.",
  },
  "/category/mounts": {
    icon: FlightRounded,
    blurb: "Every mount with its source, faction and flight capability.",
  },
  "/category/creatures": {
    icon: GroupsRounded,
    blurb: "Search NPCs and bosses by name with type, family and level.",
  },
  "/achievements": {
    icon: EmojiEventsRounded,
    blurb: "Achievement categories, individual criteria and point values.",
  },
  "/category/realm": {
    icon: PublicRounded,
    blurb: "Realm status, population, time zone and ruleset for your region.",
  },
  "/connected-realms": {
    icon: HubRounded,
    blurb: "Cross-realm groupings with live status and queue information.",
  },
  "/category/auction-house": {
    icon: StorefrontRounded,
    blurb: "Commodity prices and connected-realm auction listings.",
  },
  "/category/covenant": {
    icon: ShieldRounded,
    blurb: "Covenant signature and class abilities with renown rewards.",
  },
  "/category/azerite-essence": {
    icon: BoltRounded,
    blurb: "Heart of Azeroth essences with rank-by-rank powers.",
  },
  "/category/wow-token": {
    icon: MonetizationOnRounded,
    blurb: "Live WoW Token price with the session's price history.",
  },
};

const API_EXPLORER: ExplorerEntry = {
  path: "/api-explorer",
  label: "API Explorer",
  section: "Developer",
  blurb: "Call any Blizzard game-data endpoint and read the raw JSON.",
  icon: DataObjectRounded,
};

const fromNav = (): ExplorerEntry[] => {
  const entries: ExplorerEntry[] = [];
  const seen = new Set<string>();

  NAV_SECTIONS.forEach((section) => {
    section.items.forEach((item) => {
      const path = item.path;
      if (!path || seen.has(path)) {
        return;
      }
      const live = LIVE_EXPLORERS[path];
      if (!live) {
        return;
      }
      seen.add(path);
      entries.push({
        path,
        label: item.label,
        section: section.label,
        blurb: live.blurb,
        icon: live.icon,
      });
    });
  });

  return entries;
};

/** The 12 explorers listed on the home page, in nav order plus the API explorer. */
export const EXPLORERS: ExplorerEntry[] = [...fromNav(), API_EXPLORER];

/** 12 cards tile evenly at every breakpoint (4 / 3 / 2 / 1). */
export const EXPLORER_COLUMNS = { xs: 1, sm: 2, md: 3, lg: 4 } as const;
