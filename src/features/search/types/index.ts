import type { SvgIconComponent } from "@mui/icons-material";

import type { QUALITY_KEYS } from "@/theme";

export type SearchCategoryId = "items" | "spells" | "mounts" | "creatures";

/**
 * What a result represents. Drives the external (Wowhead) link via
 * `getExternalLink(kind, id, name)` and lets cards/dialogs pick a
 * presentation. `generic` is for raw API records without a public page.
 */
export type EntityKind =
  | "item"
  | "spell"
  | "mount"
  | "npc"
  | "achievement"
  | "quest"
  | "azerite-essence"
  | "battlepet"
  | "title"
  | "realm"
  | "covenant"
  | "connected-realm"
  | "auction"
  | "generic";

/** WoW item quality tier; the keys of `theme.palette.quality`. */
export type ItemQuality = (typeof QUALITY_KEYS)[number];

/** One labelled fact shown on a card ("Item level", "415"). */
export interface SearchResultMeta {
  label: string;
  value: string;
}

export interface SearchResult {
  id: number;
  name: string;
  /** Blizzard API self link. Used as a dedupe key and by "Copy API URL"; never rendered as a public link. */
  href: string;
  summary?: string;
  details?: string;
  mediaUrl?: string;
  mediaRequestPath?: string;
  mediaRequestNamespace?: string;
  tag?: string;
  typeLabel?: string;
  /** Entity kind; enables the Wowhead link and kind-specific presentation. */
  kind?: EntityKind;
  /** Quality tier: colours the name and the card's accent border. */
  quality?: ItemQuality;
  /** Explicit public page; overrides the link derived from `kind`. */
  externalUrl?: string;
  /** Label for `externalUrl` (defaults to "View on Wowhead"). */
  externalLabel?: string;
  /** Secondary line under the name (class / subclass, realm, zone). */
  subtitle?: string;
  /** Labelled facts rendered as the card's meta line. */
  meta?: SearchResultMeta[];
}

export interface SearchFetcherOptions {
  /** react-query's signal: forwarded to `blizzardClient` so superseded searches abort. */
  signal?: AbortSignal;
}

export interface SearchCategory {
  id: SearchCategoryId;
  label: string;
  description: string;
  icon: SvgIconComponent;
  fetcher: (
    query: string,
    options?: SearchFetcherOptions,
  ) => Promise<SearchResult[]>;
  minQueryLength?: number;
}

export interface CategoryQueryState {
  category: SearchCategory;
  data?: SearchResult[];
  isLoading: boolean;
  isError: boolean;
  error?: Error;
}
