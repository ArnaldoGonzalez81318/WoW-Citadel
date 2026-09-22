import type { SearchResult } from "@/features/search/types";

export type LinkReference = {
  href: string;
};

export type LocalizedString = string | { [locale: string]: string | undefined };

export type AchievementSummary = {
  id: number;
  key: LinkReference;
};

export type AchievementCategorySummary = {
  id: number;
  name: string;
  key: LinkReference;
};

export type AchievementCategoryIndexResponse = {
  /** Every category, sorted by name. */
  categories: AchievementCategorySummary[];
  /** Top-level categories in Blizzard's order (falls back to `categories`). */
  rootCategories: AchievementCategorySummary[];
};

export type AchievementCategory = {
  id: number;
  name: string;
  achievements?: AchievementSummary[];
  root_achievements?: AchievementSummary[];
  subcategories?: AchievementCategorySummary[];
  parent_category?: AchievementCategorySummary;
  display_order?: number;
  is_guild_category?: boolean;
};

export type Achievement = {
  id: number;
  name: string;
  description?: string;
  points?: number;
  is_account_wide?: boolean;
  reward?: string;
  reward_item?: {
    id: number;
    key: LinkReference;
    name?: string;
  };
  media?: {
    key: LinkReference;
    id: number;
  };
  category?: AchievementCategorySummary;
  display_order?: number;
  criteria?: {
    id: number;
    description?: string;
    amount?: number;
  };
  requirements?: {
    faction?: {
      type: string;
      name: string;
    };
  };
  prerequisite_achievement?: {
    id: number;
    name: string;
    key: LinkReference;
  };
};

export type AchievementMediaAsset = {
  key: string;
  value: string;
};

export type AchievementMedia = {
  assets: AchievementMediaAsset[];
};

/** One gallery card: the card-ready result plus the raw record for the dialog. */
export type AchievementGalleryItem = {
  result: SearchResult;
  achievement: Achievement;
};

export type AchievementGalleryPage = {
  page: number;
  pageCount: number;
  items: AchievementGalleryItem[];
  /** Achievements on this page that failed to load (404s are skipped, not counted). */
  failedCount: number;
  /** The refs behind `failedCount`, so a retry can target only them. */
  failedRefs: AchievementSummary[];
};
