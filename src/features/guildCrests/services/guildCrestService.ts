import type {
  CrestColor,
  CrestPart,
  CrestPartKind,
  CrestRing,
  GuildCrestCatalog,
} from "@/features/guildCrests/types";
import { createConcurrencyLimiter } from "@/features/pvpTiers/services/concurrencyLimiter";
import { blizzardClient } from "@/lib/blizzardClient";
import { namespace, optional404 } from "@/lib/blizzardHelpers";
import { env } from "@/lib/env";

/*
 * Blizzard's guild crest data is one static index (~33 KB):
 *
 *   guild-crest/index   196 emblems, 6 borders (ids + media links) and three
 *                       palettes: 17 emblem, 17 border, 51 background colours
 *   media/guild-crest/{emblem|border}/{id}
 *                       one asset: render.worldofwarcraft.com/{region}/guild/
 *                       tabards/emblem_NN.png (border_NN.png)
 *
 * The art file is named after the media id, zero-padded to two digits
 * (emblem_05, emblem_99, emblem_100, emblem_195; checked for us, eu, kr and
 * tw), so the designer derives every URL instead of making 202 media
 * requests. A derived URL that fails to load falls back to its media record
 * (see useCrestArt), so a renamed file costs one request, not a broken tile.
 *
 * The art is greyscale with alpha: the game tints it by multiplying with the
 * chosen colour (a texture's vertex colour), and so does GuildCrest.
 */

type MediaRef = { id?: number };

type CrestPartResponse = {
  id?: number;
  media?: MediaRef;
};

type CrestColorResponse = {
  id?: number;
  rgba?: { r?: number; g?: number; b?: number; a?: number };
};

type GuildCrestIndexResponse = {
  emblems?: CrestPartResponse[];
  borders?: CrestPartResponse[];
  colors?: {
    emblems?: CrestColorResponse[];
    borders?: CrestColorResponse[];
    backgrounds?: CrestColorResponse[];
  };
};

type CrestMediaResponse = {
  assets?: Array<{ key?: string; value?: string }>;
};

/* ------------------------------------------------------------------ */
/* Art                                                                 */
/* ------------------------------------------------------------------ */

const ART_ORIGIN = "https://render.worldofwarcraft.com";

/** The region's tabard art folder (the same folder the media records point at). */
const artFolder = (): string => `${ART_ORIGIN}/${env.region}/guild/tabards/`;

/** `emblem_05.png`, `emblem_100.png`: the media id, at least two digits. */
export const crestPartUrl = (kind: CrestPartKind, mediaId: number): string =>
  `${artFolder()}${kind}_${String(mediaId).padStart(2, "0")}.png`;

/**
 * The rest of the crest is the old Armory's tabard art, still served beside
 * the emblems but referenced by no API record: the cloth (tinted with the
 * background colour), its drop shadow, a gloss overlay, the hanging hooks
 * and the faction rings. A missing file only drops its layer; the cloth has
 * a drawn fallback.
 */
export const crestLayerUrls = () => {
  const folder = artFolder();
  return {
    cloth: `${folder}bg_00.png`,
    shadow: `${folder}shadow_00.png`,
    overlay: `${folder}overlay_00.png`,
    hooks: `${folder}hooks.png`,
    ring: {
      alliance: `${folder}ring-alliance.png`,
      horde: `${folder}ring-horde.png`,
    } satisfies Record<Exclude<CrestRing, "none">, string>,
  };
};

export type LayerBox = { x: number; y: number; width: number; height: number };

/**
 * Where each layer sits, in the Armory's 216×240 crest space (the files'
 * own pixel sizes, so nothing is resampled twice). The border and emblem
 * sit on the cloth's front panel, left of centre, because the cloth's
 * right-hand drop is its back.
 */
export const CREST_LAYOUT: Readonly<Record<
  "ring" | "cloth" | "border" | "emblem" | "hooks",
  LayerBox
>> = {
  ring: { x: 0, y: 0, width: 216, height: 216 },
  cloth: { x: 18, y: 27, width: 179, height: 210 },
  border: { x: 31, y: 40, width: 147, height: 159 },
  emblem: { x: 33, y: 57, width: 125, height: 125 },
  hooks: { x: 18, y: 27, width: 179, height: 32 },
};

/**
 * The cloth's front panel (traced from the borders' outer edge), drawn in
 * the background colour if the cloth art fails, so the colour still shows.
 */
export const CLOTH_FALLBACK_PATH =
  "M34 64 L150 44 L169 68 L163 160 L94 201 L33 160 Z";

/* ------------------------------------------------------------------ */
/* Colours                                                             */
/* ------------------------------------------------------------------ */

const channel = (value: number | undefined): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(255, Math.max(0, Math.round(value)))
    : 0;

const toHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase();

type Hsl = { h: number; s: number; l: number };

const toHsl = (r: number, g: number, b: number): Hsl => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const l = (max + min) / 2;
  if (delta === 0) {
    return { h: 0, s: 0, l };
  }
  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === red) {
    h = 60 * (((green - blue) / delta + 6) % 6);
  } else if (max === green) {
    h = 60 * ((blue - red) / delta + 2);
  } else {
    h = 60 * ((red - green) / delta + 4);
  }
  return { h, s, l };
};

const greyName = (l: number): string => {
  if (l < 0.1) {
    return "black";
  }
  if (l < 0.3) {
    return "charcoal";
  }
  if (l < 0.6) {
    return "grey";
  }
  if (l < 0.8) {
    return "silver";
  }
  return l < 0.95 ? "off-white" : "white";
};

/** Hue family, with the dark and pale variants English has words for. */
const hueName = ({ h, s, l }: Hsl): string => {
  if (h >= 345 || h < 12) {
    return l > 0.55 ? "pink" : "red";
  }
  if (h >= 335) {
    return l > 0.55 ? "pink" : "crimson";
  }
  if (h < 40) {
    if (l < 0.35 || (l < 0.5 && s < 0.7)) {
      return "brown";
    }
    return l >= 0.55 && s < 0.7 ? "tan" : "orange";
  }
  if (h < 50) {
    return "gold";
  }
  if (h < 70) {
    return l < 0.3 ? "olive" : "yellow";
  }
  if (h < 95) {
    return "lime";
  }
  if (h < 150) {
    return "green";
  }
  if (h < 175) {
    return "teal";
  }
  if (h < 195) {
    return "cyan";
  }
  if (h < 265) {
    return l < 0.27 ? "navy" : "blue";
  }
  if (h < 295) {
    return "purple";
  }
  return l > 0.55 && h >= 315 ? "pink" : "magenta";
};

/** Names that already say "dark" take no "Dark" prefix. */
const INHERENTLY_DARK: ReadonlySet<string> = new Set(["navy", "olive"]);

const capitalize = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);

/**
 * An approximate name for a palette colour ("Dark crimson", "Tan"), for the
 * swatches' labels: Blizzard names none of them, and "#670021" alone tells a
 * screen reader user nothing. The hex value is always shown beside it.
 */
export const describeColor = (r: number, g: number, b: number): string => {
  const hsl = toHsl(r, g, b);
  const spread = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
  if (spread < 0.08 || hsl.s < 0.15) {
    return capitalize(greyName(hsl.l));
  }
  const name = hueName(hsl);
  if (hsl.l < 0.3 && !INHERENTLY_DARK.has(name)) {
    return `Dark ${name}`;
  }
  if (hsl.l > 0.72 && name !== "pink") {
    return `Light ${name}`;
  }
  return capitalize(name);
};

/** WCAG relative luminance, 0 (black) to 1 (white). */
export const relativeLuminance = ({ r, g, b }: Pick<CrestColor, "r" | "g" | "b">): number => {
  const linear = (value: number): number => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};

/** WCAG contrast ratio between two colours (1–21). */
export const contrastRatio = (
  left: Pick<CrestColor, "r" | "g" | "b">,
  right: Pick<CrestColor, "r" | "g" | "b">,
): number => {
  const [light, dark] = [relativeLuminance(left), relativeLuminance(right)].sort(
    (first, second) => second - first,
  );
  return (light + 0.05) / (dark + 0.05);
};

const WHITE_INK = { r: 255, g: 255, b: 255 };
/** The app's near-black text colour (#0b1220). */
const DARK_INK = { r: 11, g: 18, b: 32 };

/**
 * White or near-black, whichever stands out more on the colour, for a mark
 * drawn on a swatch. Compared directly rather than by a luminance cut-off:
 * the two inks tie near 0.19, so a "light swatch" threshold like 0.4 puts
 * white on mid oranges and greens (#FF891B) at about 2.4:1.
 */
export const swatchInk = (color: Pick<CrestColor, "r" | "g" | "b">): string =>
  contrastRatio(color, WHITE_INK) >= contrastRatio(color, DARK_INK) ? "#ffffff" : "#0b1220";

/**
 * The 4×5 colour matrix that multiplies each channel by the colour (alpha
 * too), for feColorMatrix: the game's vertex-colour tint, without needing
 * the art's pixels (render.worldofwarcraft.com only sends CORS headers when
 * asked, so canvas or mask-image tinting could trip over a cached copy).
 */
export const tintMatrix = (color: Pick<CrestColor, "r" | "g" | "b" | "a">): string => {
  const scale = (value: number): string => (value / 255).toFixed(4);
  return [
    `${scale(color.r)} 0 0 0 0`,
    `0 ${scale(color.g)} 0 0 0`,
    `0 0 ${scale(color.b)} 0 0`,
    `0 0 0 ${color.a.toFixed(4)} 0`,
  ].join(" ");
};

/* ------------------------------------------------------------------ */
/* Requests                                                            */
/* ------------------------------------------------------------------ */

const isId = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

const toParts = (entries: CrestPartResponse[] | undefined): CrestPart[] =>
  (entries ?? [])
    .filter((entry): entry is CrestPartResponse & { id: number } => isId(entry.id))
    .map((entry) => ({
      id: entry.id,
      mediaId: isId(entry.media?.id) ? entry.media.id : entry.id,
    }))
    .sort((left, right) => left.id - right.id);

const toColors = (entries: CrestColorResponse[] | undefined): CrestColor[] =>
  (entries ?? [])
    .filter((entry): entry is CrestColorResponse & { id: number } => isId(entry.id))
    .map((entry) => {
      const r = channel(entry.rgba?.r);
      const g = channel(entry.rgba?.g);
      const b = channel(entry.rgba?.b);
      const alpha = entry.rgba?.a;
      return {
        id: entry.id,
        r,
        g,
        b,
        a:
          typeof alpha === "number" && Number.isFinite(alpha)
            ? Math.min(1, Math.max(0, alpha))
            : 1,
        hex: toHex(r, g, b),
        name: describeColor(r, g, b),
      };
    })
    .sort((left, right) => left.id - right.id);

/** Every emblem, border and palette colour, in one request. */
export const fetchGuildCrestCatalog = async (
  signal?: AbortSignal,
): Promise<GuildCrestCatalog> => {
  const response = await blizzardClient.get<GuildCrestIndexResponse>(
    "/data/wow/guild-crest/index",
    { namespace: namespace("static") },
    { signal },
  );

  return {
    emblems: toParts(response.emblems),
    borders: toParts(response.borders),
    emblemColors: toColors(response.colors?.emblems),
    borderColors: toColors(response.colors?.borders),
    backgroundColors: toColors(response.colors?.backgrounds),
  };
};

/**
 * Media fallbacks share four slots: if the art host is unreachable while the
 * API is not, a page of 48 emblem tiles fails at once, and each would
 * otherwise send its media request in the same instant.
 */
const mediaLimiter = createConcurrencyLimiter(4);

/**
 * One emblem's or border's art URL from its media record: the fallback for
 * a derived URL that failed to load. Null when Blizzard has no record (404)
 * or the record has no image; any other failure propagates.
 */
export const fetchCrestMediaUrl = async (
  kind: CrestPartKind,
  mediaId: number,
  signal?: AbortSignal,
): Promise<string | null> => {
  const media = await mediaLimiter(
    () =>
      optional404(() =>
        blizzardClient.get<CrestMediaResponse>(
          `/data/wow/media/guild-crest/${kind}/${mediaId}`,
          { namespace: namespace("static") },
          { signal },
        ),
      ),
    signal,
  );
  const assets = media?.assets ?? [];
  return (
    assets.find((asset) => asset.key === "image")?.value ?? assets[0]?.value ?? null
  );
};
