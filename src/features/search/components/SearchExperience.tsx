import type { SearchCategoryId } from "@/features/search/types";
import SearchPage from "@/pages/SearchPage";

export interface SearchExperienceProps {
  /** The one category this page searches (e.g. "creatures"). */
  focusCategoryId: SearchCategoryId;
}

/**
 * Single-category search embedded in a category route. The host
 * (CategoryPage) renders the route's PageHeader, so the search page runs
 * headless: one query, one grid, its own SearchField, no scrolling.
 */
const SearchExperience = ({
  focusCategoryId,
}: SearchExperienceProps): JSX.Element => (
  <SearchPage categoryIds={[focusCategoryId]} hideHeader />
);

export default SearchExperience;
