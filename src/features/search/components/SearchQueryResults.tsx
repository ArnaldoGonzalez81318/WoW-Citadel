import { Stack } from "@mui/material";
import { useEffect, useRef } from "react";
import SearchResults from "@/features/search/components/SearchResults";
import { useBlizzardSearch } from "@/features/search/hooks/useBlizzardSearch";

interface SearchQueryResultsProps {
  query: string;
  compact?: boolean;
  autoScroll?: boolean;
}

const SearchQueryResults = ({
  query,
  compact = false,
  autoScroll = false,
}: SearchQueryResultsProps): JSX.Element => {
  const {
    query: activeQuery,
    categoryStates,
    hasAnyResults,
  } = useBlizzardSearch(query);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!autoScroll || !activeQuery || !resultsRef.current) {
      return;
    }

    window.requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [activeQuery, autoScroll]);

  return (
    <Stack ref={resultsRef} spacing={0}>
      <SearchResults
        query={activeQuery}
        categoryStates={categoryStates}
        hasAnyResults={hasAnyResults}
        compact={compact}
      />
    </Stack>
  );
};

export default SearchQueryResults;
