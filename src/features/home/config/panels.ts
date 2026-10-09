/**
 * The lazy panels' frames. The eager Suspense fallback draws the same
 * titles and ids, so the headings a screen-reader user lands on do not
 * change when the panel chunk arrives; its tile skeletons take the cached
 * season and tier's counts, so the page height holds too once those are
 * in (before, it can move by a row of tiles; see TILE_SKELETON_COUNT).
 */
export const HOME_PANELS = {
  mythicPlus: { id: "mythic-plus", title: "Mythic+ rotation" },
  raids: { id: "raids", title: "Raids this season" },
  pvp: { id: "pvp", title: "Rated PvP title cutoffs" },
} as const;
