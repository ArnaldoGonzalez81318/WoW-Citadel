export type { LocalizedString } from "@/lib/blizzardHelpers";

export type LinkReference = {
  href: string;
};

export type SpellSummary = {
  id: number;
  name: string;
  /** Cleaned of WoW inline markup; "" when Blizzard has none. */
  description: string;
  href: string;
  kind: "spell";
  /** Public (Wowhead) page for the spell. */
  externalUrl?: string;
  externalLabel?: string;
};

export type SpellDetail = {
  id: number;
  name: string;
  description: string;
  mediaHref?: string;
  href: string;
};

export type SpellMedia = {
  assets?: Array<{
    key: string;
    value: string;
  }>;
};
