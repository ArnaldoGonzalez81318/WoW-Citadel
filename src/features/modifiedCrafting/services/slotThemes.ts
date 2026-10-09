import type { Theme } from "@mui/material/styles";

import type { SlotTypeRef } from "@/features/modifiedCrafting/types";
import type { QualityKey } from "@/theme";

/*
 * Blizzard gives slot types no kind or group, only a name, and the names
 * repeat ("Add Embellishment" nineteen times, one per expansion's slot). The
 * themes below sort them by the words in their English names, checked
 * against all 389 on US: the order matters ("Grant PvP Item Level" is PvP,
 * not item level), and whatever no rule claims is a slot named after one
 * reagent (Mycobloom, Primal Molten Alloy (DNT), a Midnight flask). Those
 * "(DNT)" slots are real: a recipe record lists them (Primal Molten
 * Warglaive's alloy slot is one); only the five test slots are set apart.
 * The rules read the English index whatever the app's locale, so the
 * grouping is the same everywhere.
 */

export type SlotThemeId =
  | "embellishment"
  | "item-level"
  | "secondary-stats"
  | "profession-stats"
  | "finishing"
  | "sockets"
  | "pvp"
  | "dyes"
  | "reagents"
  | "test"
  | "unnamed";

type PaletteKey = "primary" | "secondary" | "success" | "warning" | "error" | "info";
export type ThemeAccent = PaletteKey | QualityKey;

export type SlotTheme = {
  id: SlotThemeId;
  label: string;
  /** What the slot types in it are called, for the tile and the section. */
  blurb: string;
  accent: ThemeAccent;
};

/** In the order the tiles show them: what changes the craft most first. */
export const SLOT_THEMES: readonly SlotTheme[] = [
  {
    id: "embellishment",
    label: "Embellishments",
    blurb: "Slots named “Add Embellishment”.",
    accent: "epic",
  },
  {
    id: "item-level",
    label: "Item level & upgrades",
    blurb: "Modify Item Level, Increase Rank, Spark, Infuse with Power, Empower, Augment Beyond and the like.",
    accent: "legendary",
  },
  {
    id: "secondary-stats",
    label: "Secondary stats",
    blurb: "Specify, Customize and Amplify Secondary Stat, and the four Cyphers.",
    accent: "rare",
  },
  {
    id: "profession-stats",
    label: "Profession stats",
    blurb: "Customize Crafting Stat and Customize Gathering Stat.",
    accent: "uncommon",
  },
  {
    id: "finishing",
    label: "Finishing & add-ins",
    blurb: "Illustrious Insight, Polishing Cloth, Secret Ingredient, Spare Parts, Artisan's Authenticity and the like.",
    accent: "secondary",
  },
  {
    id: "sockets",
    label: "Sockets",
    blurb: "Slots named “Socket”.",
    accent: "info",
  },
  {
    id: "pvp",
    label: "PvP",
    blurb: "Grant PvP Item Level and Competitor's Heraldry.",
    accent: "error",
  },
  {
    id: "dyes",
    label: "Dye herbs",
    blurb: "One slot per dye colour, each naming the herbs it takes.",
    accent: "warning",
  },
  {
    id: "reagents",
    label: "Named reagents",
    blurb: "Slots named after a single reagent: an ore, alloy, hide, bolt, ink, gem or potion.",
    accent: "success",
  },
  {
    id: "test",
    label: "Test slots",
    // Only some are named "Test…"; the rest are this page's inference from
    // names like "Just optional reagents w/o quality variation".
    blurb:
      "Slots that look like Blizzard's internal tests: named “Test…”, or after an optional-reagent test setup (this page's reading).",
    accent: "poor",
  },
  {
    id: "unnamed",
    label: "Unnamed",
    blurb: "Slot types Blizzard lists without a name.",
    accent: "primary",
  },
];

export const SLOT_THEME_BY_ID: ReadonlyMap<SlotThemeId, SlotTheme> = new Map(
  SLOT_THEMES.map((theme) => [theme.id, theme]),
);

export const DEFAULT_SLOT_THEME: SlotThemeId = "embellishment";

export const isSlotThemeId = (value: string): value is SlotThemeId =>
  SLOT_THEME_BY_ID.has(value as SlotThemeId);

/** Any of `parts` (regular-expression source), case-insensitively. */
const anyOf = (parts: readonly string[]): RegExp => new RegExp(parts.join("|"), "i");

/**
 * Slot names for an extra the crafter adds on top of the recipe: the
 * finishing reagents and the profession-specific add-ins, as Blizzard
 * names their slots.
 */
const FINISHING_NAMES = [
  "finishing",
  "secret ingredient",
  "polishing cloth",
  "chain oil",
  "curing agent",
  "embroidery thread",
  "quenching fluid",
  "blotting sand",
  "alchemical catalyst",
  "illustrious insight",
  "artisan's authenticity",
  "^resourcefulness$",
  "spare parts",
  "safety component",
  "forge accessories",
  "drafting supplies",
  "radiant reagents",
  "crafted reagents",
  "mysterious concoction",
  "enchants and equipment",
  "consumables and reagents",
  "darkmoon sigil",
  "^optional reagent$",
  "gemdust & polishing",
  "^(leather|mail) armor$",
];

/** First match wins; "reagents" takes whatever is left. */
const RULES: ReadonlyArray<readonly [SlotThemeId, RegExp]> = [
  ["test", anyOf(["^test\\b", "^just optional reagents", "^optional reagents with"])],
  ["embellishment", /embellish/i],
  ["pvp", /pvp|heraldry/i],
  [
    "item-level",
    anyOf([
      "item level",
      "increase rank",
      "infuse with power",
      "^empower",
      "^spark$",
      "augment beyond",
      "training matrix",
      "progenitor",
    ]),
  ],
  ["secondary-stats", /secondary stat|cypher$/i],
  ["profession-stats", /crafting stat|gathering stat/i],
  ["sockets", /^socket$/i],
  ["dyes", /dye herbs/i],
  ["finishing", anyOf(FINISHING_NAMES)],
];

export const slotThemeOf = (englishName: string | null): SlotThemeId => {
  if (!englishName) {
    return "unnamed";
  }
  const match = RULES.find(([, pattern]) => pattern.test(englishName));
  return match ? match[0] : "reagents";
};

/** Slot type id -> theme, from the English index. */
export const themeMapOf = (
  englishIndex: readonly SlotTypeRef[],
): ReadonlyMap<number, SlotThemeId> =>
  new Map(englishIndex.map((slot) => [slot.id, slotThemeOf(slot.name)]));

const PALETTE_KEYS: ReadonlySet<string> = new Set([
  "primary",
  "secondary",
  "success",
  "warning",
  "error",
  "info",
]);

export const accentColor = (theme: Theme, accent: ThemeAccent): string =>
  PALETTE_KEYS.has(accent)
    ? theme.palette[accent as PaletteKey].main
    : theme.palette.quality[accent as QualityKey];

export const themeAccentColor = (theme: Theme, id: SlotThemeId): string =>
  accentColor(theme, SLOT_THEME_BY_ID.get(id)?.accent ?? "primary");
