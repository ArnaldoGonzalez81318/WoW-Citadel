import {
  BRACKET_TYPE_ORDER,
  bracketTypeLabel,
} from "@/features/pvpSeasons/services/pvpBrackets";
import type { PvpFaction, PvpRewardCutoff } from "@/features/pvpSeasons/types";

export type FactionRating = { faction?: PvpFaction; rating: number };

export type TitleSummary = {
  achievementId: number;
  name: string;
  /** Set when every cutoff of the title belongs to one faction (Marshal, Warlord). */
  faction?: PvpFaction;
  /** Cutoffs that apply to every spec: one, or one per faction. */
  ratings: FactionRating[];
  /** Lowest and highest per-spec cutoff, when the title is set per spec. */
  specRange?: [number, number];
};

export type SpecCutoff = {
  specId: number;
  /** Blizzard's spec name from the reward ("Frost"), until the spec loads. */
  specName?: string;
  ratings: FactionRating[];
  /** Both factions' titles need the same rating, shown once. */
  bothFactions: boolean;
  best: number;
};

export type CutoffGroup = {
  bracketType: string;
  label: string;
  titles: TitleSummary[];
  specs: SpecCutoff[];
};

/** A title while its bracket's rows are being collected. */
type TitleDraft = {
  name: string;
  /** Every faction seen on the title's rows ("" for none). */
  factions: Set<string>;
  ratings: FactionRating[];
  specRatings: number[];
};

const FACTION_ORDER: Record<string, number> = { ALLIANCE: 0, HORDE: 1 };
const byFaction = (left: FactionRating, right: FactionRating): number =>
  (FACTION_ORDER[left.faction ?? ""] ?? -1) - (FACTION_ORDER[right.faction ?? ""] ?? -1);

const bracketRank = (type: string): number => {
  const index = BRACKET_TYPE_ORDER.indexOf(type);
  return index === -1 ? BRACKET_TYPE_ORDER.length : index;
};

/**
 * Blizzard's flat reward list (123 rows in Midnight Season 2) grouped the way
 * players read it: per bracket, its titles, then for Solo Shuffle and Blitz
 * every spec's cutoff, the hardest first.
 */
export const groupCutoffs = (cutoffs: readonly PvpRewardCutoff[]): CutoffGroup[] => {
  const byBracket = new Map<string, PvpRewardCutoff[]>();
  cutoffs.forEach((cutoff) => {
    const list = byBracket.get(cutoff.bracketType) ?? [];
    list.push(cutoff);
    byBracket.set(cutoff.bracketType, list);
  });

  return Array.from(byBracket.entries())
    .sort(([left], [right]) => bracketRank(left) - bracketRank(right))
    .map(([bracketType, list]) => {
      const titles = new Map<number, TitleDraft>();
      const specs = new Map<number, SpecCutoff>();
      list.forEach((cutoff) => {
        const title = titles.get(cutoff.achievementId) ?? {
          name: cutoff.achievementName,
          factions: new Set<string>(),
          ratings: [],
          specRatings: [],
        };
        title.factions.add(cutoff.faction ?? "");
        if (cutoff.specId === undefined) {
          title.ratings.push({ faction: cutoff.faction, rating: cutoff.rating });
        } else {
          title.specRatings.push(cutoff.rating);
          const spec = specs.get(cutoff.specId) ?? {
            specId: cutoff.specId,
            specName: cutoff.specName,
            ratings: [],
            bothFactions: false,
            best: 0,
          };
          spec.ratings.push({ faction: cutoff.faction, rating: cutoff.rating });
          spec.best = Math.max(spec.best, cutoff.rating);
          specs.set(cutoff.specId, spec);
        }
        titles.set(cutoff.achievementId, title);
      });

      return {
        bracketType,
        label: bracketTypeLabel(bracketType),
        titles: Array.from(titles.entries()).map(([achievementId, title]) => {
          const [onlyFaction] = Array.from(title.factions);
          return {
            achievementId,
            name: title.name,
            faction:
              title.factions.size === 1 && (onlyFaction === "ALLIANCE" || onlyFaction === "HORDE")
                ? onlyFaction
                : undefined,
            ratings: [...title.ratings].sort(byFaction),
            specRange:
              title.specRatings.length > 0
                ? [Math.min(...title.specRatings), Math.max(...title.specRatings)]
                : undefined,
          };
        }),
        specs: Array.from(specs.values())
          .map((spec): SpecCutoff => {
            // Blitz sets an Alliance and a Horde title per spec, almost always
            // at the same rating: one number then, not two identical ones.
            const factions = new Set(spec.ratings.map((rating) => rating.faction));
            const shared =
              spec.ratings.length > 1 &&
              factions.size === spec.ratings.length &&
              spec.ratings.every((rating) => rating.rating === spec.ratings[0].rating);
            return shared
              ? { ...spec, ratings: [{ rating: spec.best }], bothFactions: true }
              : { ...spec, ratings: [...spec.ratings].sort(byFaction) };
          })
          .sort((left, right) => right.best - left.best || left.specId - right.specId),
      };
    });
};
