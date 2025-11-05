import ReportProblemRoundedIcon from "@mui/icons-material/ReportProblemRounded"
import { useMemo } from "react"
import { Alert, Grid, Skeleton, Stack, Typography } from "@mui/material"
import ResultCard from "@/components/common/ResultCard"
import { CategoryQueryState } from "@/features/search/types"
import { BlizzardRequestError } from "@/lib/blizzardClient"

interface SearchResultSectionProps {
  state: CategoryQueryState
  accentColor: string
}

const SearchResultSection = ({ state, accentColor }: SearchResultSectionProps): JSX.Element => {
  const { category, isLoading, isError, data, error } = state
  const Icon = category.icon

  const friendlyError = useMemo(() => {
    if (!error) {
      return undefined
    }

    if (error instanceof BlizzardRequestError) {
      if (error.status === 401 || error.status === 403) {
        return "We couldn’t authenticate with Blizzard’s API. Update your Blizzard credentials in the .env file and refresh."
      }

      if (error.status === 429) {
        return "The Blizzard API rate limit has been reached. Please wait a few minutes and try again."
      }
    }

    return error.message
  }, [error])

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Icon sx={{ color: accentColor }} />
        <Stack spacing={0.5}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {category.label}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {category.description}
          </Typography>
        </Stack>
      </Stack>

      {isError && friendlyError ? (
        <Alert
          severity="error"
          icon={<ReportProblemRoundedIcon fontSize="small" />}
          sx={{ borderRadius: 2 }}
        >
          {friendlyError}
        </Alert>
      ) : null}

      {isLoading ? (
        <Grid container spacing={3}>
          {Array.from({ length: 3 }).map((_, index) => (
            <Grid item xs={12} md={4} key={index}>
              <Skeleton
                variant="rounded"
                height={200}
                sx={{
                  borderRadius: 3,
                  backgroundColor: "rgba(12, 18, 34, 0.65)",
                }}
              />
            </Grid>
          ))}
        </Grid>
      ) : null}

      {!isLoading && !isError && (!data || data.length === 0) ? (
        <Typography variant="body2" color="text.secondary">
          Nothing yet. Try a different keyword to uncover more from Azeroth.
        </Typography>
      ) : null}

      {!isLoading && !isError && data && data.length > 0 ? (
        <Grid container spacing={3}>
          {data.map((result) => (
            <Grid item xs={12} md={6} lg={4} key={result.id}>
              <ResultCard result={result} accentColor={accentColor} />
            </Grid>
          ))}
        </Grid>
      ) : null}
    </Stack>
  )
}

export default SearchResultSection
