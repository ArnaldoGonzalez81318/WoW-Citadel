import { Stack } from "@mui/material"
import SearchHero from "@/features/search/components/SearchHero"
import SearchResults from "@/features/search/components/SearchResults"
import LegendaryShowcase from "@/features/search/components/LegendaryShowcase"
import TokenTicker from "@/features/search/components/TokenTicker"
import CategoryShowcase from "@/features/search/components/CategoryShowcase"
import { useBlizzardSearch } from "@/features/search/hooks/useBlizzardSearch"
import { useSearchState } from "@/features/search/context/SearchContext"

const SearchExperience = (): JSX.Element => {
  const { query, setQuery } = useSearchState()
  const { query: activeQuery, categoryStates, hasAnyResults } = useBlizzardSearch(query)

  return (
    <Stack spacing={{ xs: 8, md: 12 }}>
      <SearchHero onQuickSearch={setQuery} />
      <TokenTicker />
      <LegendaryShowcase onSelect={setQuery} />
      <CategoryShowcase />
      <SearchResults
        query={activeQuery}
        categoryStates={categoryStates}
        hasAnyResults={hasAnyResults}
      />
    </Stack>
  )
}

export default SearchExperience
