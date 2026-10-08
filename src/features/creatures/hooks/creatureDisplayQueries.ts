import { fetchCreatureDisplayRender } from "@/features/creatures/services/creatureDisplayService";
import { env } from "@/lib/env";

/** Renders do not change; keep them for the session. */
const RENDER_STALE_MS = 24 * 60 * 60_000;

export const creatureDisplayKeys = {
  /** Not localized: a render URL is the same in every locale. */
  render: (displayId: number) =>
    ["creature-display-render", displayId, env.region] as const,
};

/** Shared by the Creatures and Journal pages so a display is fetched once. */
export const creatureDisplayRenderQuery = (displayId: number) => ({
  queryKey: creatureDisplayKeys.render(displayId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchCreatureDisplayRender(displayId, signal),
  staleTime: RENDER_STALE_MS,
});
