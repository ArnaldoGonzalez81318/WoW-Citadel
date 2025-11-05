import { blizzardClient, BlizzardRequestError } from "@/lib/blizzardClient"
import { env } from "@/lib/env"
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

export type AchievementCategoryDetail = {
  category: AchievementCategory
  achievements: Achievement[]
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
