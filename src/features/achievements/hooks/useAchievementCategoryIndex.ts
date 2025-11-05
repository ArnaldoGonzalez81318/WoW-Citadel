import { useQuery } from "@tanstack/react-query"
import { fetchAchievementCategoryIndex } from "@/features/achievements/services/achievementService"
import { env } from "@/lib/env"

export const useAchievementCategoryIndex = () =>
  useQuery({
    queryKey: ["achievement-category-index", env.region],
    queryFn: fetchAchievementCategoryIndex,
    staleTime: 1000 * 60 * 60,
  })
