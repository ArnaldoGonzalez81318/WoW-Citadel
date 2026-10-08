import { useId, useState } from "react";

import {
  CLOTH_FALLBACK_PATH,
  CREST_LAYOUT,
  crestLayerUrls,
  tintMatrix,
} from "@/features/guildCrests/services/guildCrestService";
import type { CrestColor, CrestRing } from "@/features/guildCrests/types";

/**
 * - `full`: the whole crest; with a ring, the Armory's 216×240 frame,
 *   without one a tighter frame centred on the cloth (same aspect ratio,
 *   so toggling the ring never resizes the preview box).
 * - `border`: cropped to the border, for the border picker's tiles.
 */
export type CrestFraming = "full" | "border";

const VIEW_BOX = {
  ring: "0 0 216 240",
  banner: "8 21 200 222",
  border: "25 34 159 171",
} as const;

/** The cloth's shade when no background colour is known (an empty palette). */
const NEUTRAL_CLOTH = "#5C6370";

export type GuildCrestProps = {
  emblemSrc?: string;
  borderSrc?: string;
  emblemColor?: CrestColor;
  borderColor?: CrestColor;
  backgroundColor?: CrestColor;
  ring?: CrestRing;
  framing?: CrestFraming;
  /**
   * Accessible name. Without one the crest is decorative (aria-hidden): a
   * picker tile names itself.
   */
  title?: string;
  onEmblemError?: () => void;
  onBorderError?: () => void;
  /**
   * The cloth image failed (the crest then draws a flat cloth). The crest
   * never retries on its own: remount it (a new `key`) to try again.
   */
  onClothError?: () => void;
};

/**
 * A guild crest drawn the way the Armory drew it: ring, cloth shadow, cloth
 * (tinted with the background colour), gloss, border, emblem and hooks,
 * each at its file's own size in one SVG. Tinting is an feColorMatrix
 * multiply in sRGB (the game's vertex colour), which needs no CORS: the
 * filter runs in the renderer, never reading the pixels into script.
 */
const GuildCrest = ({
  emblemSrc,
  borderSrc,
  emblemColor,
  borderColor,
  backgroundColor,
  ring = "none",
  framing = "full",
  title,
  onEmblemError,
  onBorderError,
  onClothError,
}: GuildCrestProps): JSX.Element => {
  // useId's ":r1:" is a valid id, but colons are awkward inside url(#…).
  const baseId = `crest-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const titleId = `${baseId}-title`;
  const layers = crestLayerUrls();
  const [clothFailed, setClothFailed] = useState(false);

  let viewBox: string = VIEW_BOX.border;
  if (framing === "full") {
    viewBox = ring === "none" ? VIEW_BOX.banner : VIEW_BOX.ring;
  }

  const tints: Array<[string, CrestColor | undefined]> = [
    ["cloth", backgroundColor],
    ["border", borderColor],
    ["emblem", emblemColor],
  ];
  const filterFor = (key: string, color: CrestColor | undefined): string | undefined =>
    color ? `url(#${baseId}-${key})` : undefined;

  return (
    <svg
      viewBox={viewBox}
      role={title ? "img" : undefined}
      aria-labelledby={title ? titleId : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      style={{ display: "block", width: "100%", height: "auto", overflow: "hidden" }}
    >
      {title ? <title id={titleId}>{title}</title> : null}
      <defs>
        {tints.map(([key, color]) =>
          color ? (
            <filter
              key={key}
              id={`${baseId}-${key}`}
              colorInterpolationFilters="sRGB"
            >
              <feColorMatrix type="matrix" values={tintMatrix(color)} />
            </filter>
          ) : null,
        )}
      </defs>

      {ring !== "none" ? <image href={layers.ring[ring]} {...CREST_LAYOUT.ring} /> : null}
      <image href={layers.shadow} {...CREST_LAYOUT.cloth} />
      {clothFailed ? (
        <path d={CLOTH_FALLBACK_PATH} fill={backgroundColor?.hex ?? NEUTRAL_CLOTH} />
      ) : (
        <image
          href={layers.cloth}
          {...CREST_LAYOUT.cloth}
          filter={filterFor("cloth", backgroundColor)}
          onError={() => {
            setClothFailed(true);
            onClothError?.();
          }}
        />
      )}
      {clothFailed ? null : <image href={layers.overlay} {...CREST_LAYOUT.cloth} />}
      {borderSrc ? (
        <image
          href={borderSrc}
          {...CREST_LAYOUT.border}
          filter={filterFor("border", borderColor)}
          onError={onBorderError}
        />
      ) : null}
      {emblemSrc ? (
        <image
          href={emblemSrc}
          {...CREST_LAYOUT.emblem}
          filter={filterFor("emblem", emblemColor)}
          onError={onEmblemError}
        />
      ) : null}
      <image href={layers.hooks} {...CREST_LAYOUT.hooks} />
    </svg>
  );
};

export default GuildCrest;
