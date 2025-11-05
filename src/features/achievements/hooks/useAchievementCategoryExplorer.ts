import { useQuery } from "@tanstack/react-query"
import { fetchAchievementCategoryWithDetails } from "@/features/achievements/services/achievementService"
import { env } from "@/lib/env"

export const useAchievementCategoryExplorer = (categoryId: number | null, limit = 12) =>
  useQuery({
    queryKey: ["achievement-category-explorer", categoryId, limit, env.region],
    queryFn: () => fetchAchievementCategoryWithDetails(categoryId as number, limit),
    enabled: typeof categoryId === "number",
    staleTime: 1000 * 60 * 10,
  })
