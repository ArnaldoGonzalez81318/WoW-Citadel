/**
 * Blizzard media responses are a bag of `{ key, value }` assets whose key
 * varies by endpoint: items use `icon`, journal instances use `tile`, zones
 * use `zone`/`image`, playable classes use `bust`, and some records only ever
 * carry one unnamed asset. Code that looks only for `key === "icon"` silently
 * misses the rest and leaves a letter fallback where artwork exists.
 */

/** One entry of a media response's `assets` array (untrusted API shape). */
export type MediaAsset = { key?: string; value?: string };

/**
 * Asset keys worth preferring, best first. `icon` leads because square icons
 * suit the 40/56 px tiles, and `zoom` follows it because it is the only key a
 * creature-display record carries (`media/creature-display/{id}` answers with
 * a single `zoom` portrait); the wider artwork keys come after, for records
 * that have no square art at all (journal instances, zones, classes).
 */
export const MEDIA_ASSET_PREFERENCE: readonly string[] = [
  "icon",
  "zoom",
  "tile",
  "image",
  "zone",
  "banner",
  "bust",
  "portrait",
  "avatar",
  "main",
  "original",
];

const assetUrl = (asset: MediaAsset | null | undefined): string | undefined => {
  if (!asset || typeof asset !== "object") {
    return undefined;
  }

  const { value } = asset;
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

/**
 * The best image URL in a media response's `assets`.
 *
 * Walks `preferred` in order and returns the first asset carrying that key
 * with a non-empty string value. When no preferred key hits, falls back to the
 * first asset with any non-empty string value, so single-asset responses with
 * an unexpected key still resolve. Returns `undefined` when there is nothing
 * usable — the caller then keeps MediaTile's letter fallback.
 *
 * Tolerates a missing array, non-object entries, missing keys and non-string
 * values: the argument comes straight off the wire.
 */
export const pickAssetUrl = (
  assets: readonly MediaAsset[] | undefined,
  preferred: readonly string[] = MEDIA_ASSET_PREFERENCE,
): string | undefined => {
  if (!Array.isArray(assets) || assets.length === 0) {
    return undefined;
  }

  for (const key of preferred) {
    for (const asset of assets) {
      if (asset && typeof asset === "object" && asset.key === key) {
        const url = assetUrl(asset);
        if (url !== undefined) {
          return url;
        }
      }
    }
  }

  for (const asset of assets) {
    const url = assetUrl(asset);
    if (url !== undefined) {
      return url;
    }
  }

  return undefined;
};
