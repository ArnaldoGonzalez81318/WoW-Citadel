/** The two crest parts that are pictures (the background is only a colour). */
export type CrestPartKind = "emblem" | "border";

/** One emblem or border from Blizzard's crest index. */
export type CrestPart = {
  id: number;
  /** The media record (and art file) id; equal to `id` today, but keyed separately by Blizzard. */
  mediaId: number;
};

/** One entry of a crest palette, with the facts the swatches and labels need. */
export type CrestColor = {
  id: number;
  r: number;
  g: number;
  b: number;
  /** 0–1; every colour Blizzard lists today is opaque. */
  a: number;
  /** "#DFA55A" */
  hex: string;
  /** An approximate English name ("Tan", "Dark crimson"); Blizzard names none. */
  name: string;
};

export type CrestPaletteKey = "emblemColors" | "borderColors" | "backgroundColors";

/** Everything the guild crest index offers, ready for the designer. */
export type GuildCrestCatalog = {
  /** By id (Blizzard lists 196). */
  emblems: CrestPart[];
  /** By id (Blizzard lists 6). */
  borders: CrestPart[];
  /** In Blizzard's order (by id), which runs through the hues as in game. */
  emblemColors: CrestColor[];
  borderColors: CrestColor[];
  backgroundColors: CrestColor[];
};

/** The faction ring the Armory drew around a crest, or none. */
export type CrestRing = "none" | "alliance" | "horde";

/**
 * A crest as the designer draws it. A part is missing only when Blizzard's
 * index lists none of that kind; the crest then leaves that layer out.
 */
export type CrestDesign = {
  emblem?: CrestPart;
  border?: CrestPart;
  emblemColor?: CrestColor;
  borderColor?: CrestColor;
  backgroundColor?: CrestColor;
  ring: CrestRing;
};
