import { useQuery } from "@tanstack/react-query";

import { fetchAchievementCategoryIndex } from "@/features/achievements/services/achievementService";
import { env } from "@/lib/env";

const ONE_HOUR = 3_600_000;

export const useAchievementCategoryIndex = () =>
  useQuery({
    queryKey: ["achievement-category-index", env.region],
    queryFn: ({ signal }) => fetchAchievementCategoryIndex(signal),
    staleTime: ONE_HOUR,
  });
