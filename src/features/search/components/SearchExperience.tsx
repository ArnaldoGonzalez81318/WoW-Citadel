import { Stack } from "@mui/material";
import { useEffect, useRef } from "react";
import SearchHero from "@/features/search/components/SearchHero";
import SearchResults from "@/features/search/components/SearchResults";
import LegendaryShowcase from "@/features/search/components/LegendaryShowcase";
import TokenTicker from "@/features/search/components/TokenTicker";
import CategoryShowcase from "@/features/search/components/CategoryShowcase";
import { useBlizzardSearch } from "@/features/search/hooks/useBlizzardSearch";
import { useSearchState } from "@/features/search/context/SearchContext";
import { SearchCategoryId } from "@/features/search/types";

type SearchExperienceProps = {
  focusCategoryId?: SearchCategoryId;
  variant?: "home" | "category";
};

const SearchExperience = ({
  focusCategoryId,
  variant = "home",
}: SearchExperienceProps = {}): JSX.Element => {
  const { query, setQuery } = useSearchState();
  const {
    query: activeQuery,
    categoryStates,
    hasAnyResults,
  } = useBlizzardSearch(query);
  const scrollTargetRef = useRef<string | null>(null);

  const isHomeVariant = variant === "home";
  const spacing = isHomeVariant ? { xs: 8, md: 12 } : { xs: 6, md: 8 };

  useEffect(() => {
    if (!focusCategoryId) {
      scrollTargetRef.current = null;
      return;
    }

    if (scrollTargetRef.current === focusCategoryId) {
      return;
    }

    const anchorId = `category-${focusCategoryId}`;
    const element = document.getElementById(anchorId);

    if (element) {
      window.requestAnimationFrame(() => {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      scrollTargetRef.current = focusCategoryId;
    }
  }, [focusCategoryId, activeQuery, hasAnyResults]);

  return (
    <Stack spacing={spacing}>
      {isHomeVariant ? <SearchHero onQuickSearch={setQuery} /> : null}
      {isHomeVariant ? <TokenTicker /> : null}
      {isHomeVariant ? <LegendaryShowcase onSelect={setQuery} /> : null}
      {isHomeVariant ? <CategoryShowcase /> : null}
      <SearchResults
        query={activeQuery}
        categoryStates={categoryStates}
        hasAnyResults={hasAnyResults}
      />
    </Stack>
  );
};

export default SearchExperience;
