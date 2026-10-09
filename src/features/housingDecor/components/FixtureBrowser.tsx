import HouseSidingRoundedIcon from "@mui/icons-material/HouseSidingRounded";
import SearchOffRoundedIcon from "@mui/icons-material/SearchOffRounded";
import { Box, Button, Chip, Skeleton, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useId, useMemo } from "react";

import {
  ExplorerFilterBar,
  FilterChipGroup,
} from "@/components/common/ExplorerFilterBar";
import type { FilterOption } from "@/components/common/ExplorerFilterBar";
import SectionCard from "@/components/common/SectionCard";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import FixtureFamilyGrid, {
  FixtureKindsSkeleton,
} from "@/features/housingDecor/components/FixtureFamilyGrid";
import HousingSearchField from "@/features/housingDecor/components/HousingSearchField";
import type { SearchBinding } from "@/features/housingDecor/components/HousingSearchField";
import {
  fixturesQuery,
  hookCountsQuery,
} from "@/features/housingDecor/hooks/housingQueries";
import useHeldFailure from "@/features/housingDecor/hooks/useHeldFailure";
import {
  FIXTURE_KINDS,
  FIXTURE_KIND_LABEL,
  groupFixtures,
  pluralize,
  searchFamilies,
} from "@/features/housingDecor/services/housingCatalog";
import type {
  FixtureFamily,
  FixtureKind,
  HousingParams,
} from "@/features/housingDecor/types";
import type { SearchParamsRecordSetter } from "@/hooks/useSearchParamState";
import { formatNumber } from "@/lib/format";
import { MIN_FUZZY_QUERY_LENGTH } from "@/lib/fuzzyMatch";

const EMPTY_FAMILIES: FixtureFamily[] = [];
/** US's first three kinds (bases, roofs, dormers): what loading shows. */
const EXPECTED_SECTION_SIZES: readonly number[] = [14, 14, 9];
/** Roughly "Window · 642", "Roof Window · 435" and the rest. */
const HOOK_CHIP_WIDTHS: readonly number[] = [112, 148, 120, 104, 104];

export type FixtureBrowserProps = {
  /** The URL's search, trimmed. */
  search: string;
  kind: FixtureKind | null;
  setParams: SearchParamsRecordSetter<HousingParams>;
  searchBinding: SearchBinding;
  onOpen: (family: FixtureFamily) => void;
};

/**
 * Hook points by type across every fixture, from Blizzard's hook index:
 * the places on house bases and roofs that the other kinds fill.
 */
const HookPoints = (): JSX.Element => {
  const query = useQuery(hookCountsQuery());
  const failure = useHeldFailure(query);
  const counts = query.data;
  const total = counts?.reduce((sum, entry) => sum + entry.count, 0) ?? 0;

  const renderBody = (): JSX.Element => {
    if (failure.failed) {
      return (
        <ErrorState
          compact
          error={failure.error}
          context="the hook index"
          onRetry={failure.retry}
          retryLabel={failure.retrying ? "Retrying…" : "Retry"}
        />
      );
    }
    if (!counts) {
      // Chip-shaped (five types on US): the card sits above the filters, so
      // its loaded height must not shove them down.
      return (
        <Stack
          direction="row"
          flexWrap="wrap"
          useFlexGap
          gap={1}
          role="status"
          aria-label="Loading hook points"
          aria-busy="true"
        >
          {HOOK_CHIP_WIDTHS.map((width, index) => (
            <Skeleton
              key={index}
              variant="rounded"
              width={width}
              height={28}
              sx={(theme) => ({ borderRadius: `${theme.wc.radius.pill}px` })}
            />
          ))}
        </Stack>
      );
    }
    if (counts.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
          Blizzard&apos;s hook index is empty for this region.
        </Typography>
      );
    }
    return (
      <Stack
        component="ul"
        role="list"
        aria-label="Hook points by type"
        direction="row"
        flexWrap="wrap"
        useFlexGap
        gap={1}
        sx={{ listStyle: "none", m: 0, p: 0 }}
      >
        {counts.map((entry) => (
          <Box component="li" key={entry.type}>
            <Chip
              variant="outlined"
              label={`${entry.type} · ${formatNumber(entry.count)}`}
              sx={{ fontVariantNumeric: "tabular-nums" }}
            />
          </Box>
        ))}
      </Stack>
    );
  };

  return (
    <SectionCard
      title="Hook points"
      titleAs="h2"
      description={
        total > 0
          ? `${pluralize(total, "hook point", "hook points")} in Blizzard's hook index, by type. House bases and roofs carry them; open one to see its own.`
          : "Blizzard's hook index, by type. House bases and roofs carry them; open one to see its own."
      }
    >
      {renderBody()}
    </SectionCard>
  );
};

/**
 * Every fixture, grouped into families by name and filed by kind (read from
 * the English names): bases and roofs first, then what attaches to them.
 * One request loads them all; a family's records (with their hook points)
 * only load when it is opened.
 */
const FixtureBrowser = ({
  search,
  kind,
  setParams,
  searchBinding,
  onOpen,
}: FixtureBrowserProps): JSX.Element => {
  const query = useQuery(fixturesQuery());
  const failure = useHeldFailure(query);
  const fixtures = query.data;
  const families = useMemo(
    () => (fixtures ? groupFixtures(fixtures) : EMPTY_FAMILIES),
    [fixtures],
  );
  const headingId = useId();

  const searching = search !== "";
  const numeric = /^#?\d+$/.test(search);
  const tooShort = searching && !numeric && search.length < MIN_FUZZY_QUERY_LENGTH;
  const matches = useMemo(() => {
    if (!searching) {
      return families;
    }
    return tooShort ? EMPTY_FAMILIES : searchFamilies(families, search);
  }, [families, search, searching, tooShort]);
  const shown = useMemo(
    () => (kind === null ? matches : matches.filter((family) => family.kind === kind)),
    [matches, kind],
  );

  // Chip counts follow the search, so a kind with no matches says so.
  const kindOptions = useMemo((): FilterOption<FixtureKind>[] => {
    const counts = new Map<FixtureKind, number>();
    matches.forEach((family) => counts.set(family.kind, (counts.get(family.kind) ?? 0) + 1));
    return FIXTURE_KINDS.filter((entry) => families.some((family) => family.kind === entry)).map(
      (entry) => ({
        value: entry,
        label: FIXTURE_KIND_LABEL[entry],
        count: counts.get(entry) ?? 0,
        disabled: (counts.get(entry) ?? 0) === 0 && entry !== kind,
      }),
    );
  }, [matches, families, kind]);

  const fixtureCount = fixtures?.length ?? 0;
  const shownFixtureCount = shown.reduce((sum, family) => sum + family.members.length, 0);
  const summary = ((): string => {
    if (!fixtures) {
      return failure.failed ? "Couldn't load fixtures" : "Loading fixtures…";
    }
    if (tooShort) {
      return "Type at least two letters";
    }
    const scope = kind === null ? "" : ` · ${FIXTURE_KIND_LABEL[kind]}`;
    if (searching) {
      return shown.length === 0
        ? "No matching fixtures"
        : `${pluralize(shown.length, "family matches", "families match")}${scope}`;
    }
    return `${pluralize(shown.length, "family", "families")} · ${pluralize(shownFixtureCount, "fixture", "fixtures")}${scope}`;
  })();

  let title = "Fixture families";
  if (searching) {
    title = `Fixtures matching “${search}”`;
  } else if (kind !== null) {
    title = FIXTURE_KIND_LABEL[kind];
  }

  // The button goes with the empty state; focus moves to the search field.
  const clearKind = (): void => {
    setParams({ kind: null });
    searchBinding.focus();
  };

  /* ---------------- Render ---------------- */

  const renderBody = (): JSX.Element => {
    if (failure.failed) {
      return (
        <ErrorState
          error={failure.error}
          context="fixtures"
          onRetry={failure.retry}
          retryLabel={failure.retrying ? "Retrying…" : "Retry"}
        />
      );
    }
    if (!fixtures) {
      return <FixtureKindsSkeleton sections={EXPECTED_SECTION_SIZES} />;
    }
    if (families.length === 0) {
      return (
        <EmptyState
          icon={<HouseSidingRoundedIcon />}
          title="No fixtures listed"
          description="Blizzard's fixture search returned nothing for this region."
        />
      );
    }
    if (tooShort || shown.length === 0) {
      return (
        <EmptyState
          compact
          icon={<SearchOffRoundedIcon />}
          title={
            tooShort
              ? "Type at least two letters"
              : searching
                ? `No fixtures match “${search}”${kind !== null ? ` among ${FIXTURE_KIND_LABEL[kind].toLowerCase()}` : ""}`
                : `No ${FIXTURE_KIND_LABEL[kind ?? "base"].toLowerCase()} listed`
          }
          description={
            tooShort
              ? "One letter matches nearly every fixture; add another to narrow it down."
              : "Try another word, or clear the search or the kind."
          }
          action={
            searching ? (
              <Button variant="outlined" size="small" onClick={searchBinding.onClear}>
                Clear search
              </Button>
            ) : (
              <Button variant="outlined" size="small" onClick={clearKind}>
                Show every kind
              </Button>
            )
          }
        />
      );
    }
    // A search or a kind is one list; otherwise every kind is a section of its own.
    if (searching || kind !== null) {
      return <FixtureFamilyGrid families={shown} label={title} onSelect={onOpen} />;
    }
    return (
      <Stack spacing={3}>
        {FIXTURE_KINDS.map((entry) => {
          const inKind = shown.filter((family) => family.kind === entry);
          if (inKind.length === 0) {
            return null;
          }
          const sectionHeadingId = `${headingId}-${entry}`;
          return (
            <Box component="section" key={entry} aria-labelledby={sectionHeadingId}>
              <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mb: 1.25 }}>
                <Typography id={sectionHeadingId} variant="subtitle1" component="h3" sx={{ m: 0 }}>
                  {FIXTURE_KIND_LABEL[entry]}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="span">
                  {pluralize(inKind.length, "family", "families")}
                </Typography>
              </Stack>
              <FixtureFamilyGrid
                families={inKind}
                label={FIXTURE_KIND_LABEL[entry]}
                onSelect={onOpen}
              />
            </Box>
          );
        })}
      </Stack>
    );
  };

  return (
    <Stack spacing={2.5}>
      {/*
        Above the filters rather than after 107 families (thousands of pixels
        down on a phone), and not between the filters and the list they
        filter, so typing changes what sits right under the field.
      */}
      <HookPoints />

      <ExplorerFilterBar label="Fixture filters" summary={summary}>
        <HousingSearchField
          binding={searchBinding}
          label="Search fixtures by name, colour or id"
          placeholder={
            fixtureCount > 0 ? `Search ${formatNumber(fixtureCount)} fixtures` : "Search fixtures"
          }
          disabled={failure.failed}
        />
        {kindOptions.length > 0 ? (
          <FilterChipGroup
            label="Fixture kind"
            size="small"
            options={kindOptions}
            value={kind}
            allLabel="Every kind"
            onChange={(next) => setParams({ kind: next })}
          />
        ) : null}
      </ExplorerFilterBar>

      <SectionCard
        title={title}
        description="Fixtures sharing a name are one family: “Woodland Dormer - Forest” is the Woodland Dormer in Forest. Kinds are read from the English names. Blizzard's API has no fixture art, so the tiles are this page's own."
      >
        {renderBody()}
      </SectionCard>
    </Stack>
  );
};

export default FixtureBrowser;
