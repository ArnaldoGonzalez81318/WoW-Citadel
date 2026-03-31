export type NavFlyoutItem = {
  id: string
  label: string
  description: string
  href: string
  path?: string
}

export type NavFlyoutSection = {
  id: string
  label: string
  description: string
  items: NavFlyoutItem[]
}

const hrefFor = (id: string): string => `#category-${id}`

export const NAV_SECTIONS: NavFlyoutSection[] = [
  {
    id: "collectibles",
    label: "Collectibles & Gear",
    description: "Loot tables, appearances, and account-bound rewards",
    items: [
      {
        id: "item",
        label: "Items",
        description: "Weapons, armor, trinkets, consumables, and more",
        href: hrefFor("items"),
        path: "/category/items",
      },
      {
        id: "item-appearance",
        label: "Item Appearance",
        description: "Transmogs, models, and visual variations",
        href: hrefFor("item-appearance"),
        path: "/category/item-appearance",
      },
      {
        id: "heirloom",
        label: "Heirloom",
        description: "Scaling gear to help alts catch up",
        href: hrefFor("heirloom"),
        path: "/category/heirloom",
      },
      {
        id: "mount",
        label: "Mount",
        description: "Ground, flying, and special mounts from every expansion",
        href: hrefFor("mounts"),
        path: "/category/mounts",
      },
      {
        id: "pet",
        label: "Battle Pet",
        description: "Collectable companions and their abilities",
        href: hrefFor("pet"),
        path: "/category/pet",
      },
      {
        id: "toy",
        label: "Toy",
        description: "Interactable toys for fun and utility",
        href: hrefFor("toy"),
        path: "/category/toy",
      },
      {
        id: "azerite-essence",
        label: "Azerite Essence",
        description: "Heart of Azeroth essence roster and ranks",
        href: hrefFor("azerite-essence"),
        path: "/category/azerite-essence",
      },
      {
        id: "modified-crafting",
        label: "Modified Crafting",
        description: "Dragonflight crafting reagent modifiers",
        href: hrefFor("modified-crafting"),
        path: "/category/modified-crafting",
      },
      {
        id: "housing-decor",
        label: "Housing Decor",
        description: "Decor, fixtures, hooks, and rooms for housing systems",
        href: hrefFor("housing-decor"),
        path: "/category/housing-decor",
      },
    ],
  },
  {
    id: "characters",
    label: "Character Progression",
    description: "Talents, specializations, and player power",
    items: [
      {
        id: "achievement",
        label: "Achievement",
        description: "Feats of strength, progress, and points",
        href: hrefFor("achievements"),
        path: "/achievements",
      },
      {
        id: "spell",
        label: "Spell",
        description: "Class abilities, quests, and gameplay effects",
        href: hrefFor("spells"),
        path: "/category/spells",
      },
      {
        id: "talent",
        label: "Talent",
        description: "Class and spec talent tree nodes",
        href: hrefFor("talent"),
        path: "/category/talent",
      },
      {
        id: "tech-talent",
        label: "Tech Talent",
        description: "Covenant, mission table, and renown talents",
        href: hrefFor("tech-talent"),
        path: "/category/tech-talent",
      },
      {
        id: "playable-class",
        label: "Playable Class",
        description: "Class roster and linked specializations",
        href: hrefFor("playable-class"),
        path: "/category/playable-class",
      },
      {
        id: "playable-race",
        label: "Playable Race",
        description: "Allied races, starting zones, and factions",
        href: hrefFor("playable-race"),
        path: "/category/playable-race",
      },
      {
        id: "playable-specialization",
        label: "Playable Specialization",
        description: "Spec identities, roles, and resource types",
        href: hrefFor("playable-specialization"),
        path: "/category/playable-specialization",
      },
      {
        id: "power-type",
        label: "Power Type",
        description: "Class resources such as mana, energy, and rage",
        href: hrefFor("power-type"),
        path: "/category/power-type",
      },
      {
        id: "title",
        label: "Title",
        description: "Honorifics and earned titles for characters",
        href: hrefFor("title"),
        path: "/category/title",
      },
    ],
  },
  {
    id: "world",
    label: "World & Factions",
    description: "Regions, realms, factions, and narrative systems",
    items: [
      {
        id: "realm",
        label: "Realm",
        description: "Realm status, rulesets, and connected clusters",
        href: hrefFor("realm"),
        path: "/category/realm",
      },
      {
        id: "connected-realm",
        label: "Connected Realm",
        description: "Cross-realm groupings and queue states",
        href: hrefFor("connected-realm"),
        path: "/connected-realms",
      },
      {
        id: "region",
        label: "Region",
        description: "Global region metadata and locales",
        href: hrefFor("region"),
        path: "/category/region",
      },
      {
        id: "neighborhood",
        label: "Neighborhood",
        description: "Neighborhood maps and nested district records",
        href: hrefFor("neighborhood"),
        path: "/category/neighborhood",
      },
      {
        id: "covenant",
        label: "Covenant",
        description: "Shadowlands convenants and soulbinds",
        href: hrefFor("covenant"),
        path: "/category/covenant",
      },
      {
        id: "reputation",
        label: "Reputations",
        description: "Factions, renown tracks, and rewards",
        href: hrefFor("reputations"),
        path: "/category/reputations",
      },
      {
        id: "quest",
        label: "Quest",
        description: "Questlines, requirements, and story hooks",
        href: hrefFor("quest"),
        path: "/category/quest",
      },
      {
        id: "creature",
        label: "Creature",
        description: "NPCs, world bosses, and encounter data",
        href: hrefFor("creatures"),
        path: "/category/creatures",
      },
      {
        id: "guild-crest",
        label: "Guild Crest",
        description: "Guild heraldry icons and color palettes",
        href: hrefFor("guild-crest"),
        path: "/category/guild-crest",
      },
    ],
  },
  {
    id: "competitive",
    label: "Competitive & Economy",
    description: "Auctions, keystones, raids, and PvP ladders",
    items: [
      {
        id: "auction-house",
        label: "Auction House",
        description: "Live commodity and auction listings",
        href: hrefFor("auction-house"),
        path: "/category/auction-house",
      },
      {
        id: "mythic-keystone-affix",
        label: "Mythic Keystone Affix",
        description: "Weekly seasonal affixes and details",
        href: hrefFor("mythic-keystone-affix"),
        path: "/category/mythic-keystone-affix",
      },
      {
        id: "mythic-keystone-dungeon",
        label: "Mythic Keystone Dungeon",
        description: "Current keystone dungeon pool and info",
        href: hrefFor("mythic-keystone-dungeon"),
        path: "/category/mythic-keystone-dungeon",
      },
      {
        id: "mythic-keystone-leaderboard",
        label: "Mythic Keystone Leaderboard",
        description: "Top runs per dungeon and connected realm",
        href: hrefFor("mythic-keystone-leaderboard"),
        path: "/category/mythic-keystone-leaderboard",
      },
      {
        id: "mythic-raid-leaderboard",
        label: "Mythic Raid Leaderboard",
        description: "Progression standings for raid tiers",
        href: hrefFor("mythic-raid-leaderboard"),
        path: "/category/mythic-raid-leaderboard",
      },
      {
        id: "pvp-season",
        label: "PvP Season",
        description: "Season timelines and reward info",
        href: hrefFor("pvp-season"),
        path: "/category/pvp-season",
      },
      {
        id: "pvp-tier",
        label: "PvP Tier",
        description: "Arena and battleground ranking tiers",
        href: hrefFor("pvp-tier"),
        path: "/category/pvp-tier",
      },
      {
        id: "profession",
        label: "Profession",
        description: "Crafting disciplines, recipes, and specs",
        href: hrefFor("profession"),
        path: "/category/profession",
      },
      {
        id: "wow-token",
        label: "WoW Token",
        description: "Token pricing history and conversions",
        href: hrefFor("wow-token"),
        path: "/category/wow-token",
      },
      {
        id: "media-search",
        label: "Media Search",
        description: "Icons, renders, and cinematic stills",
        href: hrefFor("media-search"),
        path: "/category/media-search",
      },
      {
        id: "journal",
        label: "Journal",
        description: "Encounter journal for dungeons and raids",
        href: hrefFor("journal"),
        path: "/category/journal",
      },
    ],
  },
]
