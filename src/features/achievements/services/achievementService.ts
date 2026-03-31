import { blizzardClient, BlizzardRequestError } from "@/lib/blizzardClient"
import { env } from "@/lib/env"
import { SearchResult } from "@/features/search/types"
import type {
  Achievement,
  AchievementCategory,
  AchievementCategoryIndexResponse,
  AchievementCategorySummary,
  AchievementSummary,
  AchievementMedia,
} from "@/features/achievements/types"

const STATIC_NAMESPACE = `static-${env.region}`

const sortByName = <T extends { name?: string }>(items: T[] = []): T[] =>
  [...items].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))

const extractAchievements = (category: AchievementCategory): AchievementSummary[] =>
  category.achievements ?? category.root_achievements ?? []

export const fetchAchievementCategoryIndex = async (): Promise<AchievementCategoryIndexResponse> => {
  const response = await blizzardClient.get<AchievementCategoryIndexResponse>(
    "/data/wow/achievement-category/index",
    {
      namespace: STATIC_NAMESPACE,
    }
  )

  return {
    achievement_categories: sortByName<AchievementCategorySummary>(response.achievement_categories),
  }
}

export const fetchAchievementCategory = (categoryId: number): Promise<AchievementCategory> =>
  blizzardClient.get<AchievementCategory>(`/data/wow/achievement-category/${categoryId}`, {
    namespace: STATIC_NAMESPACE,
  })

export const fetchAchievement = (achievementId: number): Promise<Achievement> =>
  blizzardClient.get<Achievement>(`/data/wow/achievement/${achievementId}`, {
    namespace: STATIC_NAMESPACE,
  })

export const fetchAchievementMedia = (achievementId: number): Promise<AchievementMedia> =>
  blizzardClient.get<AchievementMedia>(`/data/wow/media/achievement/${achievementId}`, {
    namespace: STATIC_NAMESPACE,
  })

const fetchItemMediaAsset = async (itemId: number): Promise<string | undefined> => {
  try {
    const response = await blizzardClient.get<{
      assets?: Array<{ key: string; value: string }>
    }>(`/data/wow/media/item/${itemId}`, {
      namespace: STATIC_NAMESPACE,
    })

    return response.assets?.find((asset) => asset.key === "icon")?.value ?? response.assets?.[0]?.value
  } catch (error) {
    if (error instanceof BlizzardRequestError && (error.status === 404 || error.status === 204)) {
      return undefined
    }

    throw error
  }
}

export type AchievementCategoryDetail = {
  category: AchievementCategory
  achievements: Achievement[]
}

export type AchievementGalleryPage = {
  category: AchievementCategory
  page: number
  pageCount: number
  achievements: SearchResult[]
}

export const fetchAchievementCategoryWithDetails = async (
  categoryId: number,
  limit = 12
): Promise<AchievementCategoryDetail> => {
  const category = await fetchAchievementCategory(categoryId)
  const achievementRefs = extractAchievements(category).slice(0, limit)

  if (achievementRefs.length === 0) {
    return { category, achievements: [] }
  }

  const detailResults = await Promise.all(
    achievementRefs.map(async ({ id }) => {
      try {
        return await fetchAchievement(id)
      } catch (error) {
        if (error instanceof BlizzardRequestError && (error.status === 404 || error.status === 204)) {
          return null
        }
        throw error
      }
    })
  )

  const achievements = detailResults.filter((item): item is Achievement => Boolean(item))

  return {
    category,
    achievements,
  }
}

export const fetchAchievementGalleryPage = async (
  categoryId: number,
  page: number,
  pageSize = 18
): Promise<AchievementGalleryPage> => {
  const category = await fetchAchievementCategory(categoryId)
  const achievementRefs = extractAchievements(category)
  const pageCount = Math.max(1, Math.ceil(achievementRefs.length / pageSize))
  const normalizedPage = Math.min(Math.max(page, 1), pageCount)
  const startIndex = (normalizedPage - 1) * pageSize
  const visibleRefs = achievementRefs.slice(startIndex, startIndex + pageSize)

  const achievements = await Promise.all(
    visibleRefs.map(async ({ id }) => {
      try {
        const detail = await fetchAchievement(id)
        const media = detail.media?.id ? await fetchAchievementMedia(detail.media.id) : await fetchAchievementMedia(id)
        let mediaUrl: string | undefined = media.assets?.find((asset) => asset.key === "icon")?.value ?? media.assets?.[0]?.value

        if (!mediaUrl && detail.reward_item?.id) {
          mediaUrl = await fetchItemMediaAsset(detail.reward_item.id)
        }

        const details = [
          detail.reward,
          detail.reward_item?.name,
          detail.is_account_wide ? "Account-wide" : undefined,
        ]
          .filter(Boolean)
          .join(" • ")

        return {
          id: detail.id,
          name: detail.name,
          href: detail.media?.key?.href ?? detail.reward_item?.key.href ?? `https://${env.region}.api.blizzard.com/data/wow/achievement/${detail.id}`,
          summary: typeof detail.points === "number" ? `${detail.points} points` : undefined,
          details: detail.description || details,
          tag: detail.is_account_wide ? "Account" : undefined,
          typeLabel: "Achievement",
          mediaUrl,
        } satisfies SearchResult
      } catch (error) {
        if (error instanceof BlizzardRequestError && (error.status === 404 || error.status === 204)) {
          return null
        }

        throw error
      }
    })
  )

  const galleryAchievements: SearchResult[] = achievements.flatMap((entry) => (entry ? [entry] : []))

  return {
    category,
    page: normalizedPage,
    pageCount,
    achievements: galleryAchievements,
  }
}
