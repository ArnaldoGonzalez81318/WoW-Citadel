import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded"
import InfoRoundedIcon from "@mui/icons-material/InfoRounded"
import { Accordion, AccordionDetails, AccordionSummary, Alert, Chip, Grid, Skeleton, Stack, Typography } from "@mui/material"
import { memo, useMemo } from "react"
import AchievementCard from "@/features/achievements/components/AchievementCard"
import { useAchievementCategoryExplorer } from "@/features/achievements/hooks/useAchievementCategoryExplorer"
import type { AchievementCategorySummary } from "@/features/achievements/types"

interface AchievementCategoryPanelProps {
  category: AchievementCategorySummary
  expanded: boolean
  onToggle: (categoryId: number) => void
}

const AchievementCategoryPanel = ({ category, expanded, onToggle }: AchievementCategoryPanelProps): JSX.Element => (
  <Accordion
    expanded={expanded}
    onChange={() => onToggle(category.id)}
    disableGutters
    sx={{
      backgroundColor: "rgba(12, 18, 34, 0.65)",
      borderRadius: 3,
      border: "1px solid rgba(30, 155, 233, 0.18)",
      "&:before": { display: "none" },
      overflow: "hidden",
    }}
  >
    <AccordionSummary
      expandIcon={<ExpandMoreRoundedIcon color="primary" />}
      sx={{ px: { xs: 2, md: 3 } }}
    >
      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        {category.name}
      </Typography>
    </AccordionSummary>
    <AccordionDetails sx={{ px: { xs: 2, md: 3 }, pb: { xs: 3, md: 4 } }}>
      <AchievementCategoryContent categoryId={category.id} expanded={expanded} />
    </AccordionDetails>
  </Accordion>
)

interface AchievementCategoryContentProps {
  categoryId: number
  expanded: boolean
}

const AchievementCategoryContent = memo(({ categoryId, expanded }: AchievementCategoryContentProps) => {
  const { data, isLoading, isError, error } = useAchievementCategoryExplorer(expanded ? categoryId : null)

  const errorMessage = error instanceof Error ? error.message : undefined

  const achievements = data?.achievements ?? []
  const subcategories = useMemo(() => data?.category.subcategories ?? [], [data?.category.subcategories])

  if (isLoading) {
    return (
      <Grid container spacing={2} columns={{ xs: 1, sm: 2, md: 3 }}>
        {Array.from({ length: 6 }).map((_, index) => (
          <Grid item xs={1} key={index}>
            <Skeleton
              variant="rounded"
              sx={{
                height: 180,
                borderRadius: 3,
                backgroundColor: "rgba(12, 18, 34, 0.5)",
              }}
            />
          </Grid>
        ))}
      </Grid>
    )
  }

  if (isError) {
    return (
      <Alert severity="error" icon={<InfoRoundedIcon fontSize="small" />} sx={{ borderRadius: 2 }}>
        {errorMessage ?? "Unable to load achievements for this category at the moment."}
      </Alert>
    )
  }

  if (achievements.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        This category doesn&apos;t surface any achievements yet. Explore the subcategories or try another section.
      </Typography>
    )
  }

  return (
    <Stack spacing={3}>
      {subcategories.length > 0 ? (
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {subcategories.map((subcategory) => (
            <Chip
              key={subcategory.id}
              label={subcategory.name}
              variant="outlined"
              size="small"
              sx={{
                borderRadius: 2,
                borderColor: "rgba(30, 155, 233, 0.25)",
                color: "text.secondary",
              }}
            />
          ))}
        </Stack>
      ) : null}
      <Grid container spacing={2} columns={{ xs: 1, sm: 2, md: 3 }}>
        {achievements.map((achievement) => (
          <Grid item xs={1} key={achievement.id}>
            <AchievementCard achievement={achievement} />
          </Grid>
        ))}
      </Grid>
    </Stack>
  )
})

AchievementCategoryContent.displayName = "AchievementCategoryContent"

export default AchievementCategoryPanel
