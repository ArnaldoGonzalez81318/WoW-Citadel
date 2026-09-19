/**
 * Primary navigation catalogue. Consumed by the header menubar, the mobile
 * drawer, the footer sitemap, CategoryPage and CategoryShowcase.
 *
 * `slug` matches the apiCatalog slug for the entry; `path` is the route the
 * entry opens; `status` says whether the route has a dedicated explorer
 * (`live`), a generic API dataset gallery (`gallery`) or nothing yet
 * (`planned`).
 */

export type NavItemStatus = "live" | "gallery" | "planned";

export type NavFlyoutItem = {
  id: string;
  label: string;
  description: string;
  /** apiCatalog slug (also the last path segment for `/category/*` routes). */
  slug: string;
  /** Route the entry opens; always set. */
  path: string;
  status: NavItemStatus;
};

export type NavFlyoutSection = {
  id: string;
  /** Full label (CategoryPage / CategoryShowcase / flyout heading). */
  label: string;
  /** Short label for the single-row header menubar. */
  shortLabel: string;
  description: string;
  items: NavFlyoutItem[];
};

type NavItemInput = Omit<NavFlyoutItem, "path" | "status"> & {
  path?: string;
  status?: NavItemStatus;
};

/**
 * Fills in the derived fields: `path` defaults to `/category/${slug}` and
 * `status` to `planned`.
 */
const defineItem = (item: NavItemInput): NavFlyoutItem => ({
  status: "planned",
  ...item,
  path: item.path ?? `/category/${item.slug}`,
});

export const NAV_SECTIONS: NavFlyoutSection[] = [
  {
    id: "collectibles",
    label: "Collectibles & Gear",
    shortLabel: "Collectibles",
    description: "Loot tables, appearances, and account-bound rewards",
    items: [
      defineItem({
        id: "item",
        slug: "items",
        label: "Items",
        description: "Weapons, armor, trinkets, consumables, and more",
        status: "live",
      }),
      defineItem({
        id: "item-appearance",
        slug: "item-appearance",
        label: "Item Appearances",
        description: "Transmogs, models, and visual variations",
        status: "gallery",
      }),
      defineItem({
        id: "heirloom",
        slug: "heirloom",
        label: "Heirlooms",
        description: "Scaling gear to help alts catch up",
        status: "gallery",
      }),
      defineItem({
        id: "mount",
        slug: "mounts",
        label: "Mounts",
        description: "Ground, flying, and special mounts from every expansion",
        status: "live",
      }),
      defineItem({
        id: "pet",
        slug: "pet",
        label: "Battle Pets",
        description: "Collectable companions and their abilities",
        status: "gallery",
      }),
      defineItem({
        id: "toy",
        slug: "toy",
        label: "Toys",
        description: "Interactable toys for fun and utility",
        status: "gallery",
      }),
      defineItem({
        id: "azerite-essence",
        slug: "azerite-essence",
        label: "Azerite Essences",
        description: "Heart of Azeroth essence roster and ranks",
        status: "live",
      }),
      defineItem({
        id: "modified-crafting",
        slug: "modified-crafting",
        label: "Modified Crafting",
        description: "Dragonflight crafting reagent modifiers",
        status: "gallery",
      }),
      defineItem({
        id: "housing-decor",
        slug: "housing-decor",
        label: "Housing Decor",
        description: "Decor, fixtures, hooks, and rooms for housing systems",
        status: "gallery",
      }),
    ],
  },
  {
    id: "characters",
    label: "Character Progression",
    shortLabel: "Progression",
    description: "Talents, specializations, and player power",
    items: [
      defineItem({
        id: "achievement",
        slug: "achievement",
        label: "Achievements",
        description: "Feats of strength, progress, and points",
        path: "/achievements",
        status: "live",
      }),
      defineItem({
        id: "spell",
        slug: "spells",
        label: "Spells",
        description: "Class abilities, quests, and gameplay effects",
        status: "live",
      }),
      defineItem({
        id: "talent",
        slug: "talent",
        label: "Talents",
        description: "Class and spec talent tree nodes",
        status: "gallery",
      }),
      defineItem({
        id: "tech-talent",
        slug: "tech-talent",
        label: "Tech Talents",
        description: "Covenant, mission table, and renown talents",
        status: "gallery",
      }),
      defineItem({
        id: "playable-class",
        slug: "playable-class",
        label: "Playable Classes",
        description: "Class roster and linked specializations",
        status: "gallery",
      }),
      defineItem({
        id: "playable-race",
        slug: "playable-race",
        label: "Playable Races",
        description: "Allied races, starting zones, and factions",
        status: "gallery",
      }),
      defineItem({
        id: "playable-specialization",
        slug: "playable-specialization",
        label: "Playable Specializations",
        description: "Spec identities, roles, and resource types",
        status: "gallery",
      }),
      defineItem({
        id: "power-type",
        slug: "power-type",
        label: "Power Types",
        description: "Class resources such as mana, energy, and rage",
        status: "gallery",
      }),
      defineItem({
        id: "title",
        slug: "title",
        label: "Titles",
        description: "Honorifics and earned titles for characters",
        status: "gallery",
      }),
    ],
  },
  {
    id: "world",
    label: "World & Factions",
    shortLabel: "World",
    description: "Realms, factions, encounters, and reference media",
    items: [
      defineItem({
        id: "realm",
        slug: "realm",
        label: "Realms",
        description: "Realm status, rulesets, and connected clusters",
        status: "live",
      }),
      defineItem({
        id: "connected-realm",
        slug: "connected-realm",
        label: "Connected Realms",
        description: "Cross-realm groupings and queue states",
        path: "/connected-realms",
        status: "live",
      }),
      defineItem({
        id: "region",
        slug: "region",
        label: "Regions",
        description: "Global region metadata and locales",
      }),
      defineItem({
        id: "neighborhood",
        slug: "neighborhood",
        label: "Neighborhoods",
        description: "Neighborhood maps and nested district records",
      }),
      defineItem({
        id: "covenant",
        slug: "covenant",
        label: "Covenants",
        description: "Covenant abilities and renown rewards",
        status: "live",
      }),
      defineItem({
        id: "reputation",
        slug: "reputations",
        label: "Reputations",
        description: "Factions, renown tracks, and rewards",
      }),
      defineItem({
        id: "quest",
        slug: "quest",
        label: "Quests",
        description: "Questlines, requirements, and story hooks",
      }),
      defineItem({
        id: "creature",
        slug: "creatures",
        label: "Creatures",
        description: "NPCs, world bosses, and encounter data",
        status: "live",
      }),
      defineItem({
        id: "guild-crest",
        slug: "guild-crest",
        label: "Guild Crests",
        description: "Guild heraldry icons and color palettes",
      }),
      defineItem({
        id: "journal",
        slug: "journal",
        label: "Journal",
        description: "Encounter journal for dungeons and raids",
      }),
      defineItem({
        id: "media-search",
        slug: "media-search",
        label: "Media Search",
        description: "Icons, renders, and cinematic stills",
      }),
    ],
  },
  {
    id: "competitive",
    label: "Competitive & Economy",
    shortLabel: "Economy & PvP",
    description: "Auctions, tokens, keystones, raids, and PvP ladders",
    items: [
      defineItem({
        id: "auction-house",
        slug: "auction-house",
        label: "Auction House",
        description: "Live commodity and auction listings",
        status: "live",
      }),
      defineItem({
        id: "mythic-keystone-affix",
        slug: "mythic-keystone-affix",
        label: "Mythic Keystone Affixes",
        description: "Weekly seasonal affixes and details",
      }),
      defineItem({
        id: "mythic-keystone-dungeon",
        slug: "mythic-keystone-dungeon",
        label: "Mythic Keystone Dungeons",
        description: "Current keystone dungeon pool and info",
      }),
      defineItem({
        id: "mythic-keystone-leaderboard",
        slug: "mythic-keystone-leaderboard",
        label: "Mythic Keystone Leaderboards",
        description: "Top runs per dungeon and connected realm",
      }),
      defineItem({
        id: "mythic-raid-leaderboard",
        slug: "mythic-raid-leaderboard",
        label: "Mythic Raid Leaderboards",
        description: "Progression standings for raid tiers",
      }),
      defineItem({
        id: "pvp-season",
        slug: "pvp-season",
        label: "PvP Seasons",
        description: "Season timelines and reward info",
      }),
      defineItem({
        id: "pvp-tier",
        slug: "pvp-tier",
        label: "PvP Tiers",
        description: "Arena and battleground ranking tiers",
      }),
      defineItem({
        id: "profession",
        slug: "profession",
        label: "Professions",
        description: "Crafting disciplines, recipes, and specs",
      }),
      defineItem({
        id: "wow-token",
        slug: "wow-token",
        label: "WoW Token",
        description: "Live price and session history",
        status: "live",
      }),
    ],
  },
];

export type IndexedNavItem = NavFlyoutItem & { section: NavFlyoutSection };

/** Every item with its owning section, in navigation order. */
export const NAV_ITEMS: IndexedNavItem[] = NAV_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({ ...item, section })),
);

export const findNavItemBySlug = (slug: string): IndexedNavItem | undefined =>
  NAV_ITEMS.find((item) => item.slug === slug);

/** Exact route match; every nav path is a leaf route. */
export const findNavItemByPath = (
  pathname: string,
): IndexedNavItem | undefined =>
  NAV_ITEMS.find((item) => item.path === pathname);

export const findSectionForPath = (
  pathname: string,
): NavFlyoutSection | undefined => findNavItemByPath(pathname)?.section;
