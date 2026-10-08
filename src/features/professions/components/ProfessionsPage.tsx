import ConstructionRoundedIcon from "@mui/icons-material/ConstructionRounded";
import { Box, Button, Chip, Skeleton, Stack } from "@mui/material";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import ProfessionGallery, {
  CRAFTING_COLS,
  GALLERY_GAP,
} from "@/features/professions/components/ProfessionGallery";
import type { ProfessionGroups } from "@/features/professions/components/ProfessionGallery";
import ProfessionHero from "@/features/professions/components/ProfessionHero";
import { PROFESSION_TILE_HEIGHT } from "@/features/professions/components/ProfessionTile";
import RecipeBrowser from "@/features/professions/components/RecipeBrowser";
import RecipeDialog from "@/features/professions/components/RecipeDialog";
import {
  professionIndexQuery,
  professionQuery,
  skillTierQuery,
} from "@/features/professions/hooks/professionQueries";
import {
  pluralize,
  professionGroup,
} from "@/features/professions/services/professionService";
import type {
  Profession,
  ProfessionSummary,
  RecipeRef,
  SkillTierSummary,
} from "@/features/professions/types";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

const URL_DEFAULTS = {
  profession: "",
  tier: "",
  category: "",
  q: "",
  page: "",
  recipe: "",
};

/** About the loaded header: icon row, description, facts and two rows of expansions. */
const HERO_SKELETON_HEIGHT = 320;
/** The fourteen real professions: what the gallery shows before details land. */
const EXPECTED_TILE_COUNT = 14;
const EMPTY_INDEX: ProfessionSummary[] = [];
const EMPTY_TIERS: SkillTierSummary[] = [];

const parseId = (value: string): number | null => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

type GalleryDetails = {
  professions: Profession[];
  /** Some profession records are still on their first load. */
  pending: boolean;
  /** Records with no data that have failed, including any being fetched again. */
  failed: Array<UseQueryResult<Profession | null>>;
  /** Some failed record is being fetched again (a Retry, or a remount). */
  retrying: boolean;
  /** The first failed record's error; null while every one is being retried. */
  error: Error | null;
};

/*
 * A refetch of a record that has no data puts it back to pending and clears
 * its error (query-core's fetchState), so isPending alone cannot tell a
 * first load from a Retry. errorUpdateCount survives the refetch: a record
 * that has failed before is a failure being retried, not a first load, and
 * stays in `failed` so its banner (and the focused Retry button) stays put.
 *
 * Module scope, so react-query only re-runs it when a result changes.
 */
const combineProfessions = (
  results: UseQueryResult<Profession | null>[],
): GalleryDetails => {
  const failed = results.filter(
    (result) => result.data === undefined && result.errorUpdateCount > 0,
  );
  return {
    professions: results
      .map((result) => result.data)
      .filter((profession): profession is Profession => Boolean(profession)),
    pending: results.some(
      (result) => result.isPending && result.errorUpdateCount === 0,
    ),
    failed,
    retrying: failed.some((result) => result.fetchStatus !== "idle"),
    error: failed.find((result) => result.isError)?.error ?? null,
  };
};

/** Index order is by name, so every group is too. */
const groupProfessions = (professions: Profession[]): ProfessionGroups => {
  const groups: ProfessionGroups = {
    crafting: [],
    gathering: [],
    secondary: [],
    other: [],
  };
  professions.forEach((profession) => groups[professionGroup(profession)].push(profession));
  return groups;
};

/** Smooth unless the visitor asked for reduced motion. */
const scrollToTop = (node: Element | null): void => {
  let reduced = false;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    // No matchMedia: the default (smooth) is fine.
  }
  node?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
};

/**
 * Professions: every profession in Blizzard's game data as an icon gallery
 * grouped by type. Picking one shows its description and expansions, newest
 * first, and the chosen expansion's recipe book; a recipe opens with its
 * reagents and crafted item. Profession, expansion, category, filter, page
 * and open recipe all live in the URL, so any view can be shared.
 *
 * Grouping needs every profession's record (Blizzard's index has names
 * only): one small static request per profession (26 on US), cached for a
 * day and shared with the selected profession's header. Icons load per tile
 * as it nears the viewport; the internal crafting lines' only when expanded.
 */
const ProfessionsPage = ({
  eyebrow = "Competitive & Economy",
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const [params, setParams] = useSearchParamsRecord(URL_DEFAULTS);
  const navigate = useNavigate();

  /* ---------------- Gallery ---------------- */

  const indexQuery = useQuery(professionIndexQuery());
  const index = indexQuery.data ?? EMPTY_INDEX;
  const gallery = useQueries({
    queries: index.map((entry) => professionQuery(entry.id)),
    combine: combineProfessions,
  });
  const groups = useMemo(
    () => groupProfessions(gallery.professions),
    [gallery.professions],
  );
  // A record already being fetched again is left alone: refetch() would
  // cancel that attempt and start it over.
  const retryFailed = (): void => {
    gallery.failed
      .filter((result) => result.fetchStatus === "idle")
      .forEach((result) => void result.refetch());
  };
  // A retried record has no error until it fails again, so the banner keeps
  // showing the last one meanwhile instead of a generic message.
  const [lastGalleryError, setLastGalleryError] = useState<Error | null>(null);
  if (gallery.error !== null && gallery.error !== lastGalleryError) {
    setLastGalleryError(gallery.error);
  }
  const galleryError = gallery.error ?? lastGalleryError;

  /* ---------------- Selection (URL first, then sensible defaults) ---------------- */

  const requestedProfession = parseId(params.profession);
  // An id the index does not list (a typo, an old link) selects nothing.
  const professionId =
    requestedProfession !== null &&
    (!indexQuery.isSuccess || index.some((entry) => entry.id === requestedProfession))
      ? requestedProfession
      : null;

  useEffect(() => {
    if (
      params.profession !== "" &&
      professionId === null &&
      (requestedProfession === null || indexQuery.isSuccess)
    ) {
      setParams(
        { profession: null, tier: null, category: null, q: null, page: null },
        { replace: true },
      );
    }
  }, [params.profession, professionId, requestedProfession, indexQuery.isSuccess, setParams]);

  const detailQuery = useQuery({
    ...professionQuery(professionId ?? 0),
    enabled: professionId !== null,
  });
  const profession = professionId !== null ? (detailQuery.data ?? undefined) : undefined;

  const tiers = profession?.skillTiers ?? EMPTY_TIERS;
  const requestedTier = parseId(params.tier);
  const tier = tiers.find((entry) => entry.id === requestedTier) ?? tiers[0];
  const tierId = tier?.id ?? null;

  // Write the resolved expansion into the URL once the profession is known,
  // so the address always names the book on screen (and a stale or foreign
  // tier id falls back to the newest expansion).
  useEffect(() => {
    if (!profession) {
      return;
    }
    const resolved = tierId === null ? "" : String(tierId);
    if (params.tier !== resolved) {
      setParams({ tier: resolved || null }, { replace: true });
    }
  }, [profession, tierId, params.tier, setParams]);

  const tierQuery = useQuery({
    ...skillTierQuery(professionId ?? 0, tierId ?? 0),
    enabled: professionId !== null && tierId !== null,
  });

  // An internal line picked from a link opens its collapsed group, so the pressed tile shows.
  const [otherOpen, setOtherOpen] = useState(false);
  const selectedGroup = profession ? professionGroup(profession) : undefined;
  useEffect(() => {
    if (selectedGroup === "other") {
      setOtherOpen(true);
    }
  }, [selectedGroup]);

  /* ---------------- Recipe dialog ---------------- */

  const recipeId = parseId(params.recipe);
  // The id outlives the URL param so the dialog never blanks while closing.
  const [shownRecipeId, setShownRecipeId] = useState<number | null>(recipeId);
  if (recipeId !== null && recipeId !== shownRecipeId) {
    setShownRecipeId(recipeId);
  }
  // Opened by a click on this page (a history entry we pushed), not a shared link.
  const openedHereRef = useRef(false);
  useEffect(() => {
    if (recipeId === null) {
      openedHereRef.current = false;
    }
    if (params.recipe !== "" && recipeId === null) {
      setParams({ recipe: null }, { replace: true });
    }
  }, [recipeId, params.recipe, setParams]);

  const openRecipe = useCallback(
    (recipe: RecipeRef): void => {
      openedHereRef.current = true;
      setParams({ recipe: String(recipe.id) });
    },
    [setParams],
  );
  // Closing a dialog this page opened steps back over its history entry, so
  // Back after closing leaves the page instead of reopening the recipe.
  const closeRecipe = useCallback((): void => {
    if (openedHereRef.current) {
      openedHereRef.current = false;
      navigate(-1);
      return;
    }
    setParams({ recipe: null }, { replace: true });
  }, [navigate, setParams]);

  const recipeContext = useMemo(() => {
    const book = tierQuery.data;
    const category = book?.categories.find((group) =>
      group.recipes.some((recipe) => recipe.id === shownRecipeId),
    );
    const listed = category?.recipes.find((recipe) => recipe.id === shownRecipeId);
    return {
      fallbackName: listed?.name,
      context: {
        tierName: category ? book?.name : undefined,
        category: category?.name,
        professionName: category ? profession?.name : undefined,
      },
    };
  }, [tierQuery.data, shownRecipeId, profession?.name]);

  /* ---------------- Handlers ---------------- */

  const heroRef = useRef<HTMLDivElement>(null);
  const heroHeadingRef = useRef<HTMLHeadingElement>(null);
  const scrollPendingRef = useRef(false);

  const selectProfession = useCallback(
    (id: number): void => {
      if (id === professionId) {
        scrollToTop(heroRef.current);
        return;
      }
      scrollPendingRef.current = true;
      setParams({
        profession: String(id),
        tier: null,
        category: null,
        q: null,
        page: null,
        recipe: null,
      });
    },
    [professionId, setParams],
  );

  // After a pick in the gallery, bring the profession into view and move
  // focus to its heading, so the next Tab continues in what just appeared
  // instead of back up in the gallery. The gallery already loaded every
  // profession's record, so the header is there on the first render; the
  // focus waits for it if it is not.
  useEffect(() => {
    if (!scrollPendingRef.current || professionId === null) {
      return;
    }
    scrollToTop(heroRef.current);
    if (profession) {
      scrollPendingRef.current = false;
      heroHeadingRef.current?.focus({ preventScroll: true });
    }
  }, [professionId, profession]);

  const selectTier = useCallback(
    (id: number): void => {
      setParams({ tier: String(id), category: null, page: null, recipe: null });
    },
    [setParams],
  );

  const clearProfession = (): void => {
    setParams(
      { profession: null, tier: null, category: null, q: null, page: null },
      { replace: true },
    );
  };

  /* ---------------- Render ---------------- */

  const otherCount = groups.other.length;
  const mainCount = gallery.professions.length - otherCount;

  const renderGallery = (): JSX.Element => {
    // Only a first load holds the whole gallery back. Retrying a few records
    // (from the banner or the header) keeps the loaded tiles, the selection
    // and the focused Retry button on screen; with nothing loaded at all, a
    // retry looks like the first load.
    if (
      indexQuery.isPending ||
      (indexQuery.isSuccess &&
        (gallery.pending ||
          (gallery.retrying && gallery.professions.length === 0)))
    ) {
      return (
        <Stack spacing={1}>
          <Skeleton variant="text" width={220} sx={{ fontSize: "0.75rem" }} />
          <LoadingSkeleton
            variant="grid"
            columns={CRAFTING_COLS}
            itemHeight={PROFESSION_TILE_HEIGHT}
            count={EXPECTED_TILE_COUNT}
            gap={GALLERY_GAP * 8}
            label="Loading professions"
          />
        </Stack>
      );
    }
    if (indexQuery.isError) {
      return (
        <ErrorState
          compact
          error={indexQuery.error}
          context="professions"
          onRetry={() => void indexQuery.refetch()}
        />
      );
    }
    if (index.length === 0) {
      return (
        <EmptyState
          compact
          icon={<ConstructionRoundedIcon />}
          title="No professions listed"
          description="Blizzard returned an empty profession index for this region."
        />
      );
    }
    if (gallery.professions.length === 0 && gallery.failed.length > 0) {
      return (
        <ErrorState
          compact
          error={galleryError}
          context="professions"
          onRetry={retryFailed}
        />
      );
    }
    return (
      <Stack spacing={2}>
        {/* No error yet only when a remount is already retrying records
            this page never saw fail: their tiles or the banner follow. */}
        {gallery.failed.length > 0 && galleryError ? (
          <ErrorState
            compact
            error={galleryError}
            title={`${pluralize(gallery.failed.length, "profession", "professions")} could not be loaded`}
            context="these professions"
            onRetry={retryFailed}
            retryLabel={gallery.retrying ? "Retrying…" : "Retry"}
          />
        ) : null}
        <ProfessionGallery
          groups={groups}
          selectedId={professionId}
          otherOpen={otherOpen}
          onOtherOpenChange={setOtherOpen}
          onSelect={selectProfession}
        />
      </Stack>
    );
  };

  const renderProfession = (): JSX.Element | null => {
    if (professionId === null) {
      return (
        <EmptyState
          compact
          icon={<ConstructionRoundedIcon />}
          title="Pick a profession"
          description="Choose any profession above to see its expansions and browse each one's recipes, reagents and crafted items."
        />
      );
    }
    if (detailQuery.isPending) {
      return <LoadingSkeleton variant="block" height={HERO_SKELETON_HEIGHT} label="Loading profession" />;
    }
    if (detailQuery.isError && !profession) {
      return (
        <ErrorState
          error={detailQuery.error}
          context="this profession"
          onRetry={() => void detailQuery.refetch()}
        />
      );
    }
    if (!profession) {
      return (
        <EmptyState
          icon={<ConstructionRoundedIcon />}
          title="Profession not found"
          description={`Blizzard has no profession #${professionId} in its game data.`}
          action={
            <Button variant="outlined" size="small" onClick={clearProfession}>
              Clear selection
            </Button>
          }
        />
      );
    }
    return (
      <ProfessionHero
        profession={profession}
        tierId={tierId}
        onTierChange={selectTier}
        headingRef={heroHeadingRef}
      />
    );
  };

  const page = Math.max(1, parseId(params.page) ?? 1);

  return (
    <Stack
      sx={(theme) => ({
        gap: {
          xs: theme.spacing(theme.wc.layout.sectionGap.xs),
          md: theme.spacing(theme.wc.layout.sectionGap.md),
        },
      })}
    >
      <PageHeader
        eyebrow={eyebrow}
        breadcrumbs={breadcrumbs}
        title="Professions"
        documentTitle={profession ? `${profession.name} · Professions` : "Professions"}
        icon={<ConstructionRoundedIcon />}
        description="Every profession in Blizzard's game data, grouped by type. Pick one to browse its recipe books expansion by expansion, newest first, with each recipe's reagents and crafted item."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {mainCount > 0 ? (
              <Chip size="small" label={pluralize(mainCount, "profession", "professions")} />
            ) : null}
            {otherCount > 0 ? (
              <Chip
                size="small"
                variant="outlined"
                label={pluralize(otherCount, "internal crafting line", "internal crafting lines")}
              />
            ) : null}
          </>
        }
      />

      <SectionCard
        title="Choose a profession"
        description="Primary professions split into crafting and gathering, then the secondary ones. Blizzard's API only marks primary or secondary, so the gathering split is this page's."
      >
        {renderGallery()}
      </SectionCard>

      <Box
        ref={heroRef}
        sx={(theme) => ({
          scrollMarginTop: {
            xs: `${theme.wc.layout.headerHeight.xs + 16}px`,
            md: `${theme.wc.layout.headerHeight.md + 16}px`,
          },
        })}
      >
        {renderProfession()}
      </Box>

      {profession && tier ? (
        <RecipeBrowser
          tier={tier}
          query={tierQuery}
          category={params.category}
          search={params.q.trim()}
          page={page}
          setParams={setParams}
          onOpenRecipe={openRecipe}
        />
      ) : null}

      <RecipeDialog
        open={recipeId !== null}
        recipeId={shownRecipeId}
        fallbackName={recipeContext.fallbackName}
        context={recipeContext.context}
        onClose={closeRecipe}
      />
    </Stack>
  );
};

export default ProfessionsPage;
