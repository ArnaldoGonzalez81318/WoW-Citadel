import { blizzardClient } from "@/lib/blizzardClient";
import { namespace, optional404 } from "@/lib/blizzardHelpers";

/*
 * Shared by the Creatures and Journal pages: a creature display's render.
 * Blizzard serves one "zoom" portrait per display id
 * (render.worldofwarcraft.com/{region}/npcs/zoom/creature-display-{id}.jpg).
 */

type MediaResponse = {
  assets?: Array<{ key?: string; value?: string }>;
};

/** The display's zoom render, or null when Blizzard has none (404); other failures throw. */
export const fetchCreatureDisplayRender = async (
  displayId: number,
  signal?: AbortSignal,
): Promise<string | null> => {
  const media = await optional404(() =>
    blizzardClient.get<MediaResponse>(
      `/data/wow/media/creature-display/${displayId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );
  const assets = media?.assets ?? [];
  return (
    assets.find((asset) => asset.key === "zoom")?.value ??
    assets[0]?.value ??
    null
  );
};
