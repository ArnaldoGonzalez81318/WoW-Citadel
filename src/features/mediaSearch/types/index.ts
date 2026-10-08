/**
 * The tags Blizzard's media search answers to (probed on US: every other
 * guess, such as `mount`, `guild-crest` or `creature`, matches nothing).
 * Guild crest emblems and borders carry no tag at all, so they only show up
 * in the untagged "everything" search.
 */
export type MediaTagId =
  | "item"
  | "spell"
  | "achievement"
  | "creature-display"
  | "pet"
  | "recipe"
  | "pet-ability"
  | "glyph"
  | "tech-talent"
  | "journal-instance"
  | "profession"
  | "creature-family"
  | "keystone-affix"
  | "pvp-tier"
  | "playable-specialization"
  | "talent-tree"
  | "azerite-essence"
  | "playable-class"
  | "covenant";

/** A tag, or the untagged search across every kind. */
export type MediaScope = MediaTagId | "all";

/** Newest = highest ids first (ids grow as Blizzard adds records). */
export type MediaOrder = "newest" | "oldest";

/**
 * How a grid lays its tiles out: 56 px icons on a fixed stage, square
 * 600 × 600 creature renders, or 2:1 zone tiles.
 */
export type MediaLayout = "icon" | "render" | "tile";

/** One image of a media record (`assets[]`). */
export type MediaAsset = {
  /** Blizzard's asset key: icon, zoom, tile, image, atlas… */
  key: string;
  url: string;
  /** The game client's file id, when Blizzard reports one (icons and atlases). */
  fileDataId: number | null;
};

/** One media record from the search or a media endpoint. */
export type MediaRecord = {
  /**
   * The record's path under `/data/wow/media/`: "item/19019",
   * "guild-crest/emblem/0", "talent-tree/795/hero-talent/18". Unique across
   * kinds, unlike the id.
   */
  path: string;
  /** The last path segment: the owning record's id. */
  id: number;
  /** The non-numeric path segments: "item", "guild-crest/emblem", "talent-tree/hero-talent". */
  kind: string;
  /** Numeric segments before the id ("talent-tree/795/…" -> [795]). */
  parentIds: number[];
  /**
   * The search index's own `id` field, which `orderby` and `id` filters
   * read. Usually the path id, but an Azerite essence carries a spell's id
   * and a talent tree's specialization art the tree's, and journal
   * instances, covenants and tech talents carry none.
   */
  searchId: number | null;
  /** Duplicates removed (talent trees repeat one icon three times). */
  assets: MediaAsset[];
};

/** One page of a media search. */
export type MediaPage = {
  records: MediaRecord[];
  /** 1-based. */
  page: number;
  /** Pages in this search (Blizzard stops counting at 1,000 results). */
  pageCount: number;
  /** More than 1,000 matches: the pages end before the results do. */
  capped: boolean;
};

/** A tag's size (`_pageSize=1` makes Blizzard's page count the result count) and a sample. */
export type MediaTagSummary = {
  count: number;
  capped: boolean;
  sample: MediaRecord | null;
};

/** One size of an asset that the render CDN serves. */
export type AssetVariant = {
  /** "56 px", "Small", "Large". */
  label: string;
  url: string;
  /** Pixel size as published ("56 × 56"), when the URL scheme fixes it. */
  nominalSize?: string;
  /** The URL Blizzard returned (the others are derived from it). */
  original: boolean;
  /** Show the preview at its natural size (icons) instead of fitted to the dialog. */
  natural: boolean;
};
