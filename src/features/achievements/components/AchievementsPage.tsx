import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded"
import { Alert, Skeleton, Stack, Typography } from "@mui/material"
import { useEffect, useMemo, useState } from "react"
import AchievementCategoryPanel from "@/features/achievements/components/AchievementCategoryPanel"
import { useAchievementCategoryIndex } from "@/features/achievements/hooks/useAchievementCategoryIndex"

const AchievementsPage = (): JSX.Element => {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const { data, isLoading, isError, error } = useAchievementCategoryIndex()

  const categories = useMemo(() => data?.achievement_categories ?? [], [data])
  const errorMessage = error instanceof Error ? error.message : undefined

  useEffect(() => {
    if (categories.length > 0 && expandedId === null) {
      setExpandedId(categories[0].id)
    }
  }, [categories, expandedId])

  const handleToggle = (categoryId: number) => {
    setExpandedId((current) => (current === categoryId ? null : categoryId))
  }

  return (
    <Stack spacing={{ xs: 4, md: 6 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <EmojiEventsRoundedIcon color="primary" fontSize="large" />
          <Typography variant="h3" sx={{ fontWeight: 700 }}>
            Achievement Atlas
          </Typography>
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Browse Blizzard&apos;s official achievement catalogue by category. Expand a section to inspect key feats, their point values, and rewards without leaving the Citadel.
        </Typography>
      </Stack>

      {isError ? (
        <Alert severity="error" sx={{ borderRadius: 3 }}>
          {errorMessage ?? "Unable to load the achievement index. Double-check your Blizzard API credentials and try again."}
        </Alert>
      ) : null}

      {isLoading ? (
        <Stack spacing={2}>
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton
              key={index}
              variant="rounded"
              height={72}
              sx={{ borderRadius: 3, backgroundColor: "rgba(12, 18, 34, 0.45)" }}
            />
          ))}
        </Stack>
      ) : (
        <Stack spacing={2}>
          {categories.map((category) => (
            <AchievementCategoryPanel
              key={category.id}
              category={category}
              expanded={expandedId === category.id}
              onToggle={handleToggle}
            />
          ))}
        </Stack>
      )}
    </Stack>
  )
}

export default AchievementsPage
