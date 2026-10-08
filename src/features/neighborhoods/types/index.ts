export type { LocalizedString } from "@/lib/blizzardHelpers";

/** One entry of Blizzard's neighborhood map index (Founder's Point, Razorwind Shores). */
export type NeighborhoodMap = {
  id: number;
  name: string;
};

/**
 * One neighborhood, as much as Blizzard's API knows about it: its number,
 * its name and the map it is on. Plots, houses and residents are not in
 * the public API.
 */
export type Neighborhood = {
  /** Region-wide number, shared by every map (see the service). */
  id: number;
  /** Exactly as Blizzard returns it: words, or a numeric code. */
  name: string;
  /**
   * Blizzard returns many names as a numeric code ("77-19-75") instead of
   * words; the page sets those in the monospace face and says so.
   */
  nameIsCode: boolean;
  mapId: number;
  mapName: string;
};

/** A neighborhood found by the newest-per-map lookup. */
export type NewestInMap = Neighborhood | null;
