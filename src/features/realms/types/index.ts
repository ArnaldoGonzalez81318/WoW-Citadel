export type { LocalizedString } from "@/lib/blizzardHelpers";
import type {
  RealmPopulationType,
  RealmStatusType,
} from "@/features/connectedRealms/types";

export type LinkReference = {
  href: string;
};

/** Blizzard's realm ruleset code (`NORMAL`, `RP`, ...). */
export type RealmType = "NORMAL" | "RP" | string;

export type RealmSummary = {
  id: number;
  name: string;
  slug: string;
  href: string;
  timezone?: string;
  category?: string;
  typeName?: string;
  typeCode?: RealmType;
  regionName?: string;
  locale?: string;
  isTournament?: boolean;
  connectedRealmId?: number;
  connectedRealmHref?: string;
};

export type RealmDetail = {
  id: number;
  name: string;
  slug: string;
  category: string;
  timezone: string;
  locale: string;
  typeName: string;
  regionName: string;
  isTournament: boolean;
  connectedRealmHref?: string;
  href: string;
};

/** A realm joined with its connected-realm status for the directory. */
export type RealmDirectoryRow = RealmSummary & {
  statusType?: RealmStatusType;
  statusLabel?: string;
  populationType?: RealmPopulationType;
  populationLabel?: string;
  hasQueue?: boolean;
  isInternal: boolean;
};
