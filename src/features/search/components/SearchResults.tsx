import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded"
import { Box, Paper, Stack, Typography } from "@mui/material"
import SearchResultSection from "@/features/search/components/SearchResultSection"
import { CategoryQueryState, SearchCategoryId } from "@/features/search/types"

interface SearchResultsProps {
  query: string
  categoryStates: CategoryQueryState[]
  hasAnyResults: boolean
}

const ACCENT_COLORS: Record<SearchCategoryId, string> = {
  items: "#1e9be9",
  spells: "#a78bfa",
  achievements: "#f5c045",
  mounts: "#6ee7b7",
}

const SearchResults = ({ query, categoryStates, hasAnyResults }: SearchResultsProps): JSX.Element => {
  if (!query) {
    return (
      <Paper
        variant="outlined"
        sx={{
          mt: 8,
          p: { xs: 4, md: 6 },
          borderRadius: 4,
          borderColor: "rgba(30, 155, 233, 0.18)",
          backgroundColor: "rgba(12, 18, 34, 0.65)",
        }}
      >
        <Stack spacing={3} alignItems="flex-start">
          <AutoFixHighRoundedIcon color="primary" fontSize="large" />
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Begin your search from the header
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Use the search field in the site header to look up legendary weapons like <strong>Shadowmourne</strong>, iconic spells such as <strong>Chaos Bolt</strong>, Feats of Strength like <strong>Champion of the Naaru</strong>, or mounts including <strong>Invincible</strong>.
          </Typography>
        </Stack>
      </Paper>
    )
  }

  if (!hasAnyResults) {
    return (
      <Paper
        variant="outlined"
        sx={{
          mt: 8,
          p: { xs: 4, md: 6 },
          textAlign: "center",
          borderRadius: 4,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
          No matches discovered
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Double check spelling, try a specific expansion keyword, or search another category of game data.
        </Typography>
      </Paper>
    )
  }

  return (
    <Stack spacing={8} mt={10}>
      {categoryStates.map((state) => (
        <Box key={state.category.id} id={`category-${state.category.id}`}>
          <SearchResultSection
            state={state}
            accentColor={ACCENT_COLORS[state.category.id] ?? "#1e9be9"}
          />
        </Box>
      ))}
    </Stack>
  )
}

export default SearchResults
