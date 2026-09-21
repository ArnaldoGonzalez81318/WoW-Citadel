import type { SearchResult } from "@/features/search/types";

export type { LocalizedString } from "@/lib/blizzardHelpers";

export type LinkReference = {
  href: string;
};

export type MountSummary = {
  id: number;
  name: string;
  href: string;
  description?: string;
  source?: string;
  displayId?: number;
};

export type MountIndexEntry = {
  id: number;
  name: string;
  key: LinkReference;
};

export type MountIndexResponse = {
  mounts: MountIndexEntry[];
};

export type MountDetail = {
  id: number;
  name: string;
  /** Cleaned prose; absent when Blizzard has none (never filler). */
  description?: string;
  source?: string;
  href: string;
  displayId?: number;
};

/**
 * Card-ready mount: a `SearchResult` plus the creature display id so the
 * detail dialog can load artwork without a preceding detail request.
 */
export type MountGalleryResult = SearchResult & {
  kind: "mount";
  displayId?: number;
};
