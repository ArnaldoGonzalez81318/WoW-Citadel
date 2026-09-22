import UpcomingRoundedIcon from "@mui/icons-material/UpcomingRounded";
import { Button, Stack } from "@mui/material";
import { lazy } from "react";
import { Link as RouterLink } from "react-router-dom";

import PageHeader from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/StateBlocks";
import ApiFamilyGallery from "@/features/apiExplorer/components/ApiFamilyGallery";
import { getApiFamilyConfigBySlug } from "@/features/apiExplorer/config/apiCatalog";
import type { ApiFamilyConfig } from "@/features/apiExplorer/types";
import type { FamilyFallbackProps } from "@/pages/categoryRegistry";

/*
 * The only module in the CategoryPage graph that imports the API catalog and
 * ApiFamilyGallery, so dedicated explorers (items, spells, mounts, ...) never
 * pay for them. Loaded lazily by the registry.
 *
 * No Suspense boundary here on purpose: suspension bubbles up to
 * CategoryPage's single boundary so the user sees one page skeleton.
 */

const ApiDatasetGalleryPage = lazy(
  () => import("@/features/apiExplorer/components/ApiDatasetGalleryPage"),
);

const SearchExperience = lazy(
  () => import("@/features/search/components/SearchExperience"),
);

type Presentation = "dataset" | "family" | "search" | "none";

const resolvePresentation = (
  slug: string,
  family: ApiFamilyConfig | undefined,
): Presentation => {
  if (slug === "creatures") {
    return "search";
  }
  if (!family) {
    return "none";
  }
  if (family.presentation === "dataset" || family.presentation === "family") {
    return family.presentation;
  }
  // "page" means a dedicated explorer exists; reaching this module means the
  // registry had no entry, so the family gallery is the best available view.
  return "family";
};

const CategoryFamilyFallback = ({
  item,
  eyebrow,
  breadcrumbs,
}: FamilyFallbackProps): JSX.Element => {
  const family = getApiFamilyConfigBySlug(item.slug);
  const presentation = resolvePresentation(item.slug, family);

  if (presentation === "dataset") {
    // The nav entry is the category's player-facing identity ("Battle Pets",
    // not "Pet API"); the catalog copy stays for the API explorer.
    return (
      <ApiDatasetGalleryPage
        slug={item.slug}
        eyebrow={eyebrow}
        breadcrumbs={breadcrumbs}
        title={item.label}
        description={item.description}
      />
    );
  }

  const header = (
    <PageHeader
      eyebrow={eyebrow}
      breadcrumbs={breadcrumbs}
      title={item.label}
      description={item.description}
      documentTitle={item.label}
    />
  );

  return (
    <Stack sx={{ gap: (theme) => theme.wc.layout.sectionGap }}>
      {header}
      {presentation === "family" && family ? (
        <ApiFamilyGallery family={family} />
      ) : null}
      {presentation === "search" ? (
        <SearchExperience focusCategoryId="creatures" />
      ) : null}
      {presentation === "none" ? (
        <EmptyState
          icon={<UpcomingRoundedIcon />}
          title={`${item.label} explorer is in progress`}
          description="Use the search in the header for quick lookups in the meantime."
          action={
            <Button component={RouterLink} to="/" variant="outlined">
              Back to home
            </Button>
          }
        />
      ) : null}
    </Stack>
  );
};

export default CategoryFamilyFallback;
