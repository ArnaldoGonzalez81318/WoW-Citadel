import { Suspense } from "react";
import { useParams } from "react-router-dom";

import { LoadingSkeleton } from "@/components/common/StateBlocks";
import NotFoundPage from "@/pages/NotFoundPage";
import {
  buildCategoryHeaderProps,
  findRoutableCategoryItem,
  normalizeSlug,
  preloadCategory,
  resolveCategoryEntry,
  suggestCategories,
} from "@/pages/categoryRegistry";

/**
 * /category/:slug. Resolves the slug to a lazily loaded explorer and renders
 * nothing of its own: the explorer owns the single h1 via PageHeader (which
 * also sets document.title), receiving the nav section as `eyebrow` plus
 * `breadcrumbs`. Unknown slugs render the 404 in place so the URL survives.
 */
const CategoryPage = (): JSX.Element => {
  const { slug: rawSlug } = useParams<{ slug: string }>();
  const slug = normalizeSlug(rawSlug);
  const navItem = slug ? findRoutableCategoryItem(slug) : undefined;

  if (!navItem) {
    return <NotFoundPage suggestions={suggestCategories(slug)} />;
  }

  const entry = resolveCategoryEntry(slug);
  // Idempotent: starts the explorer chunk fetch in this tick, before React
  // reconciles the lazy element.
  preloadCategory(slug);
  const headerProps = buildCategoryHeaderProps(navItem);

  // `key={slug}` remounts when moving between explorers so per-page state resets.
  const content =
    entry.kind === "fallback" ? (
      <entry.Component key={slug} item={navItem} {...headerProps} />
    ) : (
      <entry.Component key={slug} {...headerProps} />
    );

  return (
    <Suspense
      fallback={
        <LoadingSkeleton variant="page" label={`Loading ${navItem.label}`} />
      }
    >
      {content}
    </Suspense>
  );
};

export default CategoryPage;
