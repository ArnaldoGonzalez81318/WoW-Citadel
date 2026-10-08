import {
  fetchItemIcon,
  fetchProfession,
  fetchProfessionIcon,
  fetchProfessionIndex,
  fetchRecipe,
  fetchRecipeIcon,
  fetchSkillTier,
} from "@/features/professions/services/professionService";
import { env } from "@/lib/env";

/** Professions, tiers and recipes change with patches; a day is plenty. */
const STATIC_STALE_MS = 24 * 60 * 60_000;

/*
 * Names are localized, so those keys carry the locale; icons are not (the
 * render host is per region only).
 */
export const professionKeys = {
  index: () => ["profession-index", env.region, env.locale] as const,
  profession: (professionId: number) =>
    ["profession", professionId, env.region, env.locale] as const,
  icon: (professionId: number) =>
    ["profession-icon", professionId, env.region] as const,
  skillTier: (professionId: number, tierId: number) =>
    ["profession-skill-tier", professionId, tierId, env.region, env.locale] as const,
  recipe: (recipeId: number) =>
    ["profession-recipe", recipeId, env.region, env.locale] as const,
  recipeIcon: (recipeId: number) =>
    ["profession-recipe-icon", recipeId, env.region] as const,
  itemIcon: (itemId: number) => ["profession-item-icon", itemId, env.region] as const,
};

export const professionIndexQuery = () => ({
  queryKey: professionKeys.index(),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchProfessionIndex(signal),
  staleTime: STATIC_STALE_MS,
});

/** Shared by the gallery (to group) and the selected profession's header. */
export const professionQuery = (professionId: number) => ({
  queryKey: professionKeys.profession(professionId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchProfession(professionId, signal),
  staleTime: STATIC_STALE_MS,
});

export const professionIconQuery = (professionId: number) => ({
  queryKey: professionKeys.icon(professionId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchProfessionIcon(professionId, signal),
  staleTime: Infinity,
  gcTime: STATIC_STALE_MS,
});

export const skillTierQuery = (professionId: number, tierId: number) => ({
  queryKey: professionKeys.skillTier(professionId, tierId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchSkillTier(professionId, tierId, signal),
  staleTime: STATIC_STALE_MS,
});

/** Shared by a ranked recipe's tile (for its rank) and the recipe dialog. */
export const recipeQuery = (recipeId: number) => ({
  queryKey: professionKeys.recipe(recipeId),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchRecipe(recipeId, signal),
  staleTime: STATIC_STALE_MS,
});

/** Shared by the recipe tile and the dialog, so opening one costs no icon request. */
export const recipeIconQuery = (recipeId: number) => ({
  queryKey: professionKeys.recipeIcon(recipeId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchRecipeIcon(recipeId, signal),
  staleTime: Infinity,
  gcTime: STATIC_STALE_MS,
});

export const itemIconQuery = (itemId: number) => ({
  queryKey: professionKeys.itemIcon(itemId),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchItemIcon(itemId, signal),
  staleTime: Infinity,
  gcTime: STATIC_STALE_MS,
});
