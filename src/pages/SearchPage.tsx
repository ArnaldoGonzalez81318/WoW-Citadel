import SearchRounded from "@mui/icons-material/SearchRounded";
import { Stack } from "@mui/material";

import PageHeader from "@/components/common/PageHeader";
import SearchQueryResults from "@/features/search/components/SearchQueryResults";
import { useSearchParamState } from "@/hooks/useSearchParamState";
import { tokens } from "@/theme";

const SECTION_GAP = tokens.wc.layout.sectionGap;

/**
 * `/search?q=…`: the URL is the source of truth for the query, so the header
 * search, back/forward and shared links all land on the same results.
 */
const SearchPage = (): JSX.Element => {
  const [q] = useSearchParamState("q");
  const query = q.trim();
  const hasQuery = query.length > 0;

  return (
    <Stack spacing={SECTION_GAP}>
      <PageHeader
        eyebrow="Search"
        title="Search results"
        icon={<SearchRounded />}
        documentTitle={hasQuery ? `Search “${query}”` : "Search"}
        description={
          hasQuery ? (
            <>
              Matches for <strong>“{query}”</strong> across items, spells,
              mounts and creatures.
            </>
          ) : (
            "Use the search field in the header to look up items, spells, mounts and creatures."
          )
        }
      />
      <SearchQueryResults query={query} compact />
    </Stack>
  );
};

export default SearchPage;
