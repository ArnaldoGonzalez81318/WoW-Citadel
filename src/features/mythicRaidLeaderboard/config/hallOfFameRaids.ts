import type { HallOfFameRaid } from "@/features/mythicRaidLeaderboard/types";

/*
 * Blizzard publishes no index of Hall of Fame raids (hall-of-fame/index is a
 * 404), and the board only names its raid once fetched. These are every slug
 * that answers, checked live: Aberrus, Amirdrassil and every raid since
 * return 404, so the Hall of Fame API ends with Vault of the Incarnates;
 * it starts at Uldir (Antorus and older are 404 too).
 *
 * Keeping the journal ids here lets the tiles load their art without first
 * fetching nine boards just to learn them. Names and expansions are English
 * fallbacks; the Encounter Journal's localized ones replace them on load.
 */
export const HALL_OF_FAME_RAIDS: readonly HallOfFameRaid[] = [
  {
    slug: "vault-of-the-incarnates",
    journalInstanceId: 1200,
    name: "Vault of the Incarnates",
    expansion: "Dragonflight",
  },
  {
    slug: "sepulcher-of-the-first-ones",
    journalInstanceId: 1195,
    name: "Sepulcher of the First Ones",
    expansion: "Shadowlands",
  },
  {
    slug: "sanctum-of-domination",
    journalInstanceId: 1193,
    name: "Sanctum of Domination",
    expansion: "Shadowlands",
  },
  {
    slug: "castle-nathria",
    journalInstanceId: 1190,
    name: "Castle Nathria",
    expansion: "Shadowlands",
  },
  {
    slug: "nyalotha-the-waking-city",
    journalInstanceId: 1180,
    name: "Ny'alotha, the Waking City",
    expansion: "Battle for Azeroth",
  },
  {
    slug: "the-eternal-palace",
    journalInstanceId: 1179,
    name: "The Eternal Palace",
    expansion: "Battle for Azeroth",
  },
  {
    slug: "crucible-of-storms",
    journalInstanceId: 1177,
    name: "Crucible of Storms",
    expansion: "Battle for Azeroth",
  },
  {
    slug: "battle-of-dazaralor",
    journalInstanceId: 1176,
    name: "Battle of Dazar'alor",
    expansion: "Battle for Azeroth",
  },
  {
    slug: "uldir",
    journalInstanceId: 1031,
    name: "Uldir",
    expansion: "Battle for Azeroth",
  },
];

/** Newest first, so the first is the default board. */
export const LATEST_RAID: HallOfFameRaid = HALL_OF_FAME_RAIDS[0];

/**
 * Case- and space-insensitive, so a hand-typed "?raid=Uldir" finds Uldir;
 * the page then rewrites the URL to the canonical slug.
 */
export const findRaid = (slug: string): HallOfFameRaid | undefined => {
  const wanted = slug.trim().toLowerCase();
  return HALL_OF_FAME_RAIDS.find((raid) => raid.slug === wanted);
};

/** A Hall of Fame holds the first 100 guilds of each faction. */
export const HALL_OF_FAME_SIZE = 100;
