import { blizzardClient } from "@/lib/blizzardClient";
import { env } from "@/lib/env";
import {
  cleanMarkup,
  localized,
  mapWithConcurrency,
  namespace,
  optional404,
  sortByName,
} from "@/lib/blizzardHelpers";
import { getExternalLink } from "@/lib/externalLinks";
import type { SearchResult } from "@/features/search/types";
import type {
  Achievement,
  AchievementCategory,
  AchievementCategoryIndexResponse,
  AchievementCategorySummary,
  AchievementGalleryItem,
  AchievementGalleryPage,
  AchievementMedia,
  AchievementSummary,
  LocalizedString,
} from "@/features/achievements/types";

type RawCategorySummary = {
  id: number;
  name?: LocalizedString;
  key: { href: string };
};

const normalizeCategorySummary = (
  entry: RawCategorySummary,
): AchievementCategorySummary => ({
  id: entry.id,
  name: localized(entry.name).trim() || `Category #${entry.id}`,
  key: entry.key,
});

export const fetchAchievementCategoryIndex = async (
  signal?: AbortSignal,
): Promise<AchievementCategoryIndexResponse> => {
  const response = await blizzardClient.get<{
    categories?: RawCategorySummary[];
    achievement_categories?: RawCategorySummary[];
    root_categories?: RawCategorySummary[];
    guild_categories?: RawCategorySummary[];
  }>(
    "/data/wow/achievement-category/index",
    { namespace: namespace("static") },
    { signal },
  );

  const all = (response.categories ?? response.achievement_categories ?? []).map(
    normalizeCategorySummary,
  );
  const roots = (response.root_categories ?? []).map(normalizeCategorySummary);
  const guildIds = new Set(
    (response.guild_categories ?? []).map((category) => category.id),
  );
  // Player roots first, in Blizzard's order, then the guild root: it is the
  // in-game tab order and the guild root holds no achievements of its own,
  // so the default selection lands on a populated category.
  const orderedRoots = [
    ...roots.filter((category) => !guildIds.has(category.id)),
    ...roots.filter((category) => guildIds.has(category.id)),
  ];
  const sortedAll = sortByName(all);

  return {
    categories: sortedAll,
    rootCategories: orderedRoots.length > 0 ? orderedRoots : sortedAll,
  };
};

export const fetchAchievementCategory = (
  categoryId: number,
  signal?: AbortSignal,
): Promise<AchievementCategory> =>
  blizzardClient.get<AchievementCategory>(
    `/data/wow/achievement-category/${categoryId}`,
    { namespace: namespace("static") },
    { signal },
  );

/** `undefined` when the achievement no longer exists (404). */
export const fetchAchievement = (
  achievementId: number,
  signal?: AbortSignal,
): Promise<Achievement | undefined> =>
  optional404(() =>
    blizzardClient.get<Achievement>(
      `/data/wow/achievement/${achievementId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );

/** Achievement media ids always equal the achievement id, so no detail hop is needed. */
export const fetchAchievementMedia = (
  achievementId: number,
  signal?: AbortSignal,
): Promise<AchievementMedia | undefined> =>
  optional404(() =>
    blizzardClient.get<AchievementMedia>(
      `/data/wow/media/achievement/${achievementId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );

const fetchItemMediaAsset = async (
  itemId: number,
  signal?: AbortSignal,
): Promise<string | undefined> => {
  const response = await optional404(() =>
    blizzardClient.get<{ assets?: Array<{ key: string; value: string }> }>(
      `/data/wow/media/item/${itemId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );

  return (
    response?.assets?.find((asset) => asset.key === "icon")?.value ??
    response?.assets?.[0]?.value
  );
};

const iconOf = (media: AchievementMedia | undefined): string | undefined =>
  media?.assets?.find((asset) => asset.key === "icon")?.value ??
  media?.assets?.[0]?.value;

export type AchievementGalleryOptions = {
  /** Show each card's subcategory (when browsing a root category). */
  showCategory?: boolean;
};

type LoadedAchievement = {
  detail: Achievement;
  mediaUrl?: string;
};

const toGalleryItem = (
  { detail, mediaUrl }: LoadedAchievement,
  options: AchievementGalleryOptions,
): AchievementGalleryItem => {
  const name = detail.name?.trim() || `Achievement #${detail.id}`;
  const points = typeof detail.points === "number" ? detail.points : undefined;
  const rewardText = detail.reward ?? detail.reward_item?.name;
  const summary =
    [
      points !== undefined ? `${points} pts` : undefined,
      rewardText ? `Reward: ${rewardText}` : undefined,
    ]
      .filter(Boolean)
      .join(" · ") || undefined;
  const external = getExternalLink("achievement", detail.id, name);

  const meta = [
    { label: "Points", value: points !== undefined ? String(points) : undefined },
    { label: "Reward", value: rewardText },
  ].filter(
    (entry): entry is { label: string; value: string } =>
      typeof entry.value === "string" && entry.value.length > 0,
  );

  const result: SearchResult = {
    id: detail.id,
    name,
    href:
      detail.media?.key?.href ??
      detail.reward_item?.key.href ??
      `https://${env.region}.api.blizzard.com/data/wow/achievement/${detail.id}`,
    kind: "achievement",
    summary,
    details: cleanMarkup(detail.description) || undefined,
    subtitle: options.showCategory ? detail.category?.name : undefined,
    tag: detail.is_account_wide ? "Account-wide" : undefined,
    typeLabel: "Achievement",
    mediaUrl,
    meta,
    externalUrl: external?.url,
    externalLabel: external?.label,
  };

  return { result, achievement: detail };
};

const displayOrderOf = (detail: Achievement): number =>
  typeof detail.display_order === "number"
    ? detail.display_order
    : Number.POSITIVE_INFINITY;

/**
 * One page of a category's achievements. The caller passes the category's
 * ref list (fetched once); each ref costs detail + media in parallel, with at
 * most six achievements in flight. Failures are counted, never fatal, unless
 * every ref on the page failed.
 */
export const fetchAchievementGalleryPage = async (
  refs: AchievementSummary[],
  page: number,
  pageSize: number,
  signal?: AbortSignal,
  options: AchievementGalleryOptions = {},
): Promise<AchievementGalleryPage> => {
  const pageCount = Math.max(1, Math.ceil(refs.length / pageSize));
  const normalizedPage = Math.min(Math.max(page, 1), pageCount);
  const startIndex = (normalizedPage - 1) * pageSize;
  const pageRefs = refs.slice(startIndex, startIndex + pageSize);

  const settled = await mapWithConcurrency(
    pageRefs,
    6,
    async ({ id }): Promise<LoadedAchievement | null> => {
      const [detail, media] = await Promise.all([
        fetchAchievement(id, signal),
        fetchAchievementMedia(id, signal),
      ]);

      if (!detail) {
        return null;
      }

      let mediaUrl = iconOf(media);
      if (!mediaUrl && detail.reward_item?.id) {
        mediaUrl = await fetchItemMediaAsset(detail.reward_item.id, signal);
      }

      return { detail, mediaUrl };
    },
    signal,
  );

  const fulfilled: LoadedAchievement[] = [];
  const rejected: unknown[] = [];

  settled.forEach((entry) => {
    if (entry.status === "fulfilled") {
      if (entry.value) {
        fulfilled.push(entry.value);
      }
    } else {
      rejected.push(entry.reason);
    }
  });

  if (pageRefs.length > 0 && fulfilled.length === 0 && rejected.length > 0) {
    throw rejected[0];
  }

  const items = fulfilled
    .sort((left, right) => displayOrderOf(left.detail) - displayOrderOf(right.detail))
    .map((entry) => toGalleryItem(entry, options));

  return {
    page: normalizedPage,
    pageCount,
    items,
    failedCount: rejected.length,
  };
};
