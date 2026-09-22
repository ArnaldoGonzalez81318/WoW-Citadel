export type { LocalizedString } from "@/lib/blizzardHelpers";
import type { LocalizedString } from "@/lib/blizzardHelpers";

export type LinkReference = {
  href: string;
};

export type ConnectedRealmIndexItem = {
  href: string;
};

export type ConnectedRealmIndexResponse = {
  connected_realms: ConnectedRealmIndexItem[];
};

export type RealmStatusType = "UP" | "DOWN";

export type RealmPopulationType =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "FULL"
  | "LOCKED"
  | "RECOMMENDED"
  | "NEW_PLAYERS"
  | string;

export type RealmType = {
  name?: LocalizedString;
  type?: string;
};

export type RealmPopulation = {
  name?: LocalizedString;
  type?: RealmPopulationType;
};

export type RealmStatus = {
  name?: LocalizedString;
  type?: RealmStatusType;
};

export type RealmReference = {
  id: number;
  slug: string;
  name?: LocalizedString;
  timezone?: string;
  locale?: string;
  type?: RealmType;
  /** Localized category label ("United States", "Oceanic"); never an object. */
  category?: LocalizedString;
  realm?: LinkReference;
};

export type ConnectedRealm = {
  id: number;
  has_queue?: boolean;
  status?: RealmStatus;
  population?: RealmPopulation;
  realms: RealmReference[];
  mythic_leaderboards?: LinkReference;
  auctions?: LinkReference;
};

/** The search endpoint's `data` matches the detail shape. */
export type ConnectedRealmSearchEntry = ConnectedRealm;

export type ConnectedRealmMember = {
  id: number;
  slug: string;
  name: string;
  timezone?: string;
  type: string;
  typeCode?: string;
  category: string;
  locale?: string;
};

export type ConnectedRealmSnapshot = ConnectedRealm & {
  realmDetails: ConnectedRealmMember[];
  /** Every member name, comma separated (filters and labels). */
  displayName: string;
  /** The first member realm's name (sort key, card title fallback). */
  leadName: string;
  /** First three member names plus " +N" for the rest. */
  shortLabel: string;
  realmSlugs: string[];
  realmTypes: string[];
  timezones: string[];
  populationLabel?: string;
  statusLabel?: string;
  statusType?: RealmStatusType;
  populationType?: RealmPopulationType;
};

/** Fixed card height for the connected-realm grid and its skeleton. */
export const CONNECTED_REALM_CARD_HEIGHT = 236;

export type ConnectedRealmCatalog = {
  snapshots: ConnectedRealmSnapshot[];
  /** Clusters whose detail request failed in the index fallback. */
  failedCount: number;
};
