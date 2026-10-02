import SearchRounded from "@mui/icons-material/SearchRounded";
import {
  Box,
  Button,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useCallback, useRef, useState } from "react";
import type { FocusEvent, FormEvent } from "react";
import type { To } from "react-router-dom";

import PageHeader from "@/components/common/PageHeader";
import { LiveStatus } from "@/components/common/StateBlocks";
import SearchCombobox, {
  SEARCH_KEY_SHORTCUTS,
} from "@/components/search/SearchCombobox";
import type { SearchComboboxHandle } from "@/components/search/SearchCombobox";
import { usePrimarySearch } from "@/components/search/primarySearch";
import {
  DEFAULT_SEARCH_CATEGORY,
  SEARCH_CATEGORIES,
} from "@/features/search/categories";
import RecentSearchChips from "@/features/search/components/RecentSearchChips";
import { searchUrl } from "@/features/search/config/searchRoutes";
import { useSearchState } from "@/features/search/context/SearchContext";
import type { SearchCategoryId } from "@/features/search/types";

const SEARCH_ID = "home-search";
const STATUS_ID = `${SEARCH_ID}-status`;
const TIP_ID = `${SEARCH_ID}-tip`;
const EXAMPLE_COUNT = 6;

type Example = { term: string; categoryId: SearchCategoryId };

/**
 * Round-robin across categories so every category (creatures included) is
 * represented, and each chip opens its own tab: "Chaos Bolt" lands on
 * Spells instead of an empty Items tab.
 */
const EXAMPLES: Example[] = (() => {
  const rounds = Math.max(
    ...SEARCH_CATEGORIES.map((category) => category.examples.length),
  );
  const examples: Example[] = [];
  for (let round = 0; round < rounds; round += 1) {
    for (const category of SEARCH_CATEGORIES) {
      const term = category.examples[round];
      if (term) {
        examples.push({ term, categoryId: category.id });
      }
    }
  }
  return examples.slice(0, EXAMPLE_COUNT);
})();

const EXAMPLE_TERMS = EXAMPLES.map((example) => example.term);
const EXAMPLE_CATEGORY = new Map(
  EXAMPLES.map((example) => [example.term, example.categoryId] as const),
);

/** The default tab (items) is left out so URLs stay canonical (SearchPage strips cat=items). */
const exampleTo = (term: string): To => {
  const categoryId = EXAMPLE_CATEGORY.get(term);
  return searchUrl(
    term,
    categoryId && categoryId !== DEFAULT_SEARCH_CATEGORY ? categoryId : undefined,
  );
};

type ChipRowProps = {
  /** Visible eyebrow ("Try"). */
  label: string;
  /** Accessible name of the chip list ("Example searches"). */
  listLabel: string;
  terms: string[];
  buildTo?: (term: string) => To;
  onRemove?: (term: string) => void;
};

const ChipRow = ({
  label,
  listLabel,
  terms,
  buildTo = searchUrl,
  onRemove,
}: ChipRowProps): JSX.Element => (
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
      buildTo={buildTo}
      onRemove={onRemove}
      label={listLabel}
    />
  </Stack>
);

/**
 * Home hero: the page's h1, its primary search and a quick-search row
 * (examples plus recent searches). The field is a SearchCombobox with the
 * same live suggestions as the header; this host owns the Search button,
 * the hint lines and the registration that makes the header yield to it.
 * Every chip is a real link to `/search`; removing a recent term is a
 * sibling button, never nested in the link.
 */
const HomeHero = (): JSX.Element => {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"));
  const { recentSearches, removeRecentSearch } = useSearchState();
  const comboRef = useRef<SearchComboboxHandle>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [hint, setHint] = useState("");

  const focusField = useCallback(
    () => comboRef.current?.focus({ select: true }),
    [],
  );
  usePrimarySearch(formRef, focusField, theme.wc.layout.headerHeight.md);

  const handleTooShort = useCallback((minLength: number) => {
    setHint(`Type at least ${minLength} characters to search`);
    comboRef.current?.focus();
  }, []);

  /**
   * Enter never reaches the form (SearchField handles the keydown), so this
   * is the Search button. It goes through the combobox so the minimum length,
   * the draft and closing the list stay in one place.
   */
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    comboRef.current?.submit();
  };

  /**
   * Phones: lift the form under the sticky header so the suggestion panel
   * has room above the on-screen keyboard. Instant, like the skip link.
   */
  const handleFocus = (event: FocusEvent<HTMLFormElement>): void => {
    const form = formRef.current;
    if (!isPhone || !form || !(event.target instanceof HTMLInputElement)) {
      return;
    }
    const resting = theme.wc.layout.headerHeight.xs + 8;
    if (Math.abs(form.getBoundingClientRect().top - resting) > 8) {
      form.scrollIntoView({ block: "start" });
    }
  };

  return (
    <Paper
      variant="outlined"
      sx={(t) => ({
        borderRadius: `${t.wc.radius.xl}px`,
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

        <Box>
          <Box
            component="form"
            ref={formRef}
            role="search"
            aria-label="Search Azeroth"
            onSubmit={handleSubmit}
            onInput={() => setHint("")}
            onFocus={handleFocus}
            sx={(t) => ({
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              gap: 1.5,
              alignItems: "stretch",
              maxWidth: 720,
              scrollMarginTop: `${t.wc.layout.headerHeight.xs + 8}px`,
            })}
          >
            <Tooltip
              title="Press / to search"
              describeChild
              disableFocusListener
              disableTouchListener
              enterDelay={600}
              placement="top"
            >
              {/* The flex item; the combobox inside anchors the panel, so it matches the field and never covers the button. */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <SearchCombobox
                  id={SEARCH_ID}
                  handleRef={comboRef}
                  size="medium"
                  label="Search Azeroth"
                  placeholder="Search Azeroth by name"
                  describedBy={`${STATUS_ID} ${TIP_ID}`}
                  keyShortcuts={SEARCH_KEY_SHORTCUTS}
                  onSubmitTooShort={handleTooShort}
                />
              </Box>
            </Tooltip>
            <Button
              type="submit"
              variant="contained"
              size="large"
              startIcon={<SearchRounded />}
              sx={(t) => ({
                minHeight: t.wc.layout.touchTarget,
                flexShrink: 0,
              })}
            >
              Search
            </Button>
          </Box>
          <Box sx={{ maxWidth: 720, mt: 1 }}>
            {/* Always mounted: a live region inserted together with its first text is not reliably announced. */}
            <LiveStatus
              id={STATUS_ID}
              sx={{ color: "warning.light", mb: hint ? 0.5 : 0 }}
            >
              {hint}
            </LiveStatus>
            <Typography
              id={TIP_ID}
              component="p"
              variant="caption"
              color="text.secondary"
            >
              Tip: search whole words, like “Thunderfury” (not “thund”).
            </Typography>
          </Box>
        </Box>

        <Stack spacing={1.5}>
          <ChipRow
            label="Try"
            listLabel="Example searches"
            terms={EXAMPLE_TERMS}
            buildTo={exampleTo}
          />
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
