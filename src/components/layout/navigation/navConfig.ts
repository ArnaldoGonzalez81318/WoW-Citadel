export type NavFlyoutItem = {
  id: string
  label: string
  description: string
  href: string
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
      { id: "item", label: "Items", description: "Weapons, armor, trinkets, consumables, and more", href: hrefFor("items") },
      { id: "item-appearance", label: "Item Appearance", description: "Transmogs, models, and visual variations", href: hrefFor("item-appearance") },
      { id: "heirloom", label: "Heirloom", description: "Scaling gear to help alts catch up", href: hrefFor("heirloom") },
      { id: "mount", label: "Mount", description: "Ground, flying, and special mounts from every expansion", href: hrefFor("mounts") },
      { id: "pet", label: "Battle Pet", description: "Collectable companions and their abilities", href: hrefFor("pet") },
      { id: "toy", label: "Toy", description: "Interactable toys for fun and utility", href: hrefFor("toy") },
      { id: "azerite-essence", label: "Azerite Essence", description: "Heart of Azeroth essence roster and ranks", href: hrefFor("azerite-essence") },
      { id: "modified-crafting", label: "Modified Crafting", description: "Dragonflight crafting reagent modifiers", href: hrefFor("modified-crafting") }
    ],
  },
  {
    id: "characters",
    label: "Character Progression",
    description: "Talents, specializations, and player power",
    items: [
      { id: "achievement", label: "Achievement", description: "Feats of strength, progress, and points", href: hrefFor("achievements") },
      { id: "spell", label: "Spell", description: "Class abilities, quests, and gameplay effects", href: hrefFor("spells") },
      { id: "talent", label: "Talent", description: "Class and spec talent tree nodes", href: hrefFor("talent") },
      { id: "tech-talent", label: "Tech Talent", description: "Covenant, mission table, and renown talents", href: hrefFor("tech-talent") },
      { id: "playable-class", label: "Playable Class", description: "Class roster and linked specializations", href: hrefFor("playable-class") },
      { id: "playable-race", label: "Playable Race", description: "Allied races, starting zones, and factions", href: hrefFor("playable-race") },
      { id: "playable-specialization", label: "Playable Specialization", description: "Spec identities, roles, and resource types", href: hrefFor("playable-specialization") },
      { id: "power-type", label: "Power Type", description: "Class resources such as mana, energy, and rage", href: hrefFor("power-type") },
      { id: "title", label: "Title", description: "Honorifics and earned titles for characters", href: hrefFor("title") }
    ],
  },
  {
    id: "world",
    label: "World & Factions",
    description: "Regions, realms, factions, and narrative systems",
    items: [
      { id: "realm", label: "Realm", description: "Realm status, rulesets, and connected clusters", href: hrefFor("realm") },
      { id: "connected-realm", label: "Connected Realm", description: "Cross-realm groupings and queue states", href: hrefFor("connected-realm") },
      { id: "region", label: "Region", description: "Global region metadata and locales", href: hrefFor("region") },
      { id: "covenant", label: "Covenant", description: "Shadowlands convenants and soulbinds", href: hrefFor("covenant") },
      { id: "reputation", label: "Reputations", description: "Factions, renown tracks, and rewards", href: hrefFor("reputations") },
      { id: "quest", label: "Quest", description: "Questlines, requirements, and story hooks", href: hrefFor("quest") },
      { id: "creature", label: "Creature", description: "NPCs, world bosses, and encounter data", href: hrefFor("creature") },
      { id: "guild-crest", label: "Guild Crest", description: "Guild heraldry icons and color palettes", href: hrefFor("guild-crest") }
    ],
  },
  {
    id: "competitive",
    label: "Competitive & Economy",
    description: "Auctions, keystones, raids, and PvP ladders",
    items: [
      { id: "auction-house", label: "Auction House", description: "Live commodity and auction listings", href: hrefFor("auction-house") },
      { id: "mythic-keystone-affix", label: "Mythic Keystone Affix", description: "Weekly seasonal affixes and details", href: hrefFor("mythic-keystone-affix") },
      { id: "mythic-keystone-dungeon", label: "Mythic Keystone Dungeon", description: "Current keystone dungeon pool and info", href: hrefFor("mythic-keystone-dungeon") },
      { id: "mythic-keystone-leaderboard", label: "Mythic Keystone Leaderboard", description: "Top runs per dungeon and connected realm", href: hrefFor("mythic-keystone-leaderboard") },
      { id: "mythic-raid-leaderboard", label: "Mythic Raid Leaderboard", description: "Progression standings for raid tiers", href: hrefFor("mythic-raid-leaderboard") },
      { id: "pvp-season", label: "PvP Season", description: "Season timelines and reward info", href: hrefFor("pvp-season") },
      { id: "pvp-tier", label: "PvP Tier", description: "Arena and battleground ranking tiers", href: hrefFor("pvp-tier") },
      { id: "profession", label: "Profession", description: "Crafting disciplines, recipes, and specs", href: hrefFor("profession") },
      { id: "wow-token", label: "WoW Token", description: "Token pricing history and conversions", href: hrefFor("wow-token") },
      { id: "media-search", label: "Media Search", description: "Icons, renders, and cinematic stills", href: hrefFor("media-search") },
      { id: "journal", label: "Journal", description: "Encounter journal for dungeons and raids", href: hrefFor("journal") }
    ],
  },
]
