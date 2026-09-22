import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import SearchOffRoundedIcon from "@mui/icons-material/SearchOffRounded";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";

import { SearchField } from "@/components/common/ExplorerFilterBar";
import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";

export type NotFoundSuggestion = { label: string; to: string };

export type NotFoundPageProps = {
  /** "Did you mean" links (CategoryPage passes near-miss nav items). */
  suggestions?: NotFoundSuggestion[];
};

const MIN_QUERY_LENGTH = 2;

/**
 * 404 page. Rendered by the "*" route (prop-less) and in place by
 * CategoryPage for unknown category slugs, so the mistyped URL stays visible.
 */
const NotFoundPage = ({ suggestions = [] }: NotFoundPageProps): JSX.Element => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const submit = (value: string): void => {
    const trimmed = value.trim();
    if (trimmed.length >= MIN_QUERY_LENGTH) {
      navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  };

  const goBack = (): void => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <Stack sx={{ gap: (theme) => theme.wc.layout.sectionGap, maxWidth: 720 }}>
      <PageHeader
        eyebrow="404"
        icon={<SearchOffRoundedIcon />}
        title="Page not found"
        documentTitle="Page not found"
        description={
          <>
            There is nothing at{" "}
            <Typography
              component="code"
              sx={{
                fontFamily: (theme) => theme.wc.fontMono,
                fontSize: "0.875em",
                wordBreak: "break-all",
              }}
            >
              {pathname}
            </Typography>
            . Check the address or search the archive below.
          </>
        }
      />

      <SectionCard padding="default">
        <Stack spacing={3}>
          {/*
           * SearchField handles Enter itself (preventDefault + onSubmit), so
           * there is no form submission path; a plain Box avoids a second,
           * unlabelled role="search" landmark next to the header's.
           */}
          <Box>
            <SearchField
              id="not-found-search"
              label="Search items, spells, mounts and creatures"
              placeholder="Search the archive"
              value={query}
              onChange={setQuery}
              onSubmit={submit}
              onClear={() => setQuery("")}
            />
          </Box>

          {suggestions.length > 0 ? (
            <Stack
              component="nav"
              aria-labelledby="not-found-suggestions"
              spacing={1}
            >
              <Typography
                id="not-found-suggestions"
                variant="overline"
                component="p"
                sx={{ margin: 0 }}
              >
                Did you mean
              </Typography>
              <Stack direction="row" flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
                {suggestions.map((suggestion) => (
                  <Chip
                    key={suggestion.to}
                    component={RouterLink}
                    to={suggestion.to}
                    clickable
                    variant="outlined"
                    color="primary"
                    label={suggestion.label}
                  />
                ))}
              </Stack>
            </Stack>
          ) : null}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Button
              component={RouterLink}
              to="/"
              variant="contained"
              startIcon={<HomeRoundedIcon />}
            >
              Back to home
            </Button>
            <Button
              variant="outlined"
              startIcon={<ArrowBackRoundedIcon />}
              onClick={goBack}
            >
              Go back
            </Button>
          </Stack>
        </Stack>
      </SectionCard>
    </Stack>
  );
};

export default NotFoundPage;
