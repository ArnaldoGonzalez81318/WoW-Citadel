import SearchRounded from "@mui/icons-material/SearchRounded";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { useState } from "react";
import type { FormEvent } from "react";

import { SearchField } from "@/components/common/ExplorerFilterBar";
import PageHeader from "@/components/common/PageHeader";
import { SEARCH_CATEGORIES } from "@/features/search/categories";
import RecentSearchChips from "@/features/search/components/RecentSearchChips";
import { searchUrl } from "@/features/search/config/searchRoutes";
import { useSearchState } from "@/features/search/context/SearchContext";

const EXAMPLE_TERMS = SEARCH_CATEGORIES.flatMap((category) => category.examples).slice(
  0,
  6,
);

type ChipRowProps = {
  /** Visible eyebrow ("Try"). */
  label: string;
  /** Accessible name of the chip list ("Example searches"). */
  listLabel: string;
  terms: string[];
  onRemove?: (term: string) => void;
};

const ChipRow = ({ label, listLabel, terms, onRemove }: ChipRowProps): JSX.Element => (
  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
    <Typography
      variant="overline"
      component="span"
      color="text.secondary"
      sx={{ mr: 0.5 }}
    >
      {label}
    </Typography>
    <RecentSearchChips
      terms={terms}
      buildTo={searchUrl}
      onRemove={onRemove}
      label={listLabel}
    />
  </Stack>
);

/**
 * Home hero: the page's h1, one search form and a single quick-search row
 * (examples plus recent searches). Every chip is a real link to `/search`;
 * removing a recent term is a sibling button, never nested in the link.
 */
const HomeHero = (): JSX.Element => {
  const { submitQuery, recentSearches, removeRecentSearch } = useSearchState();
  const [local, setLocal] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    submitQuery(local);
  };

  return (
    <Paper
      variant="outlined"
      sx={(theme) => ({
        borderRadius: `${theme.wc.radius.xl}px`,
        p: 3,
      })}
    >
      <Stack spacing={3}>
        <PageHeader
          eyebrow="WoW Citadel"
          title="Find anything in Azeroth"
          description="Search items, spells, mounts and creatures, then dig deeper in the dedicated explorers."
          documentTitle=""
        />

        <Box
          component="form"
          role="search"
          onSubmit={handleSubmit}
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            gap: 1.5,
            alignItems: "stretch",
            maxWidth: 720,
          }}
        >
          <SearchField
            label="Search Azeroth"
            placeholder="Search Azeroth by name"
            value={local}
            onChange={setLocal}
            onSubmit={submitQuery}
            onClear={() => setLocal("")}
            autoFocus={false}
            size="medium"
            sx={{ flex: 1, minWidth: 0 }}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            startIcon={<SearchRounded />}
            sx={(theme) => ({
              minHeight: theme.wc.layout.touchTarget,
              flexShrink: 0,
            })}
          >
            Search
          </Button>
        </Box>

        <Stack spacing={1.5}>
          <ChipRow label="Try" listLabel="Example searches" terms={EXAMPLE_TERMS} />
          {recentSearches.length > 0 ? (
            <ChipRow
              label="Recent"
              listLabel="Recent searches"
              terms={recentSearches}
              onRemove={removeRecentSearch}
            />
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  );
};

export default HomeHero;
