import { blizzardClient } from "@/lib/blizzardClient";
import {
  cleanMarkup,
  localized,
  namespace,
  optional404,
  sortByName,
} from "@/lib/blizzardHelpers";
import {
  CovenantAbility,
  CovenantCardData,
  CovenantDetail,
  CovenantIndexResponse,
  CovenantMedia,
  CovenantSummary,
  LocalizedString,
  RenownReward,
} from "@/features/covenants/types";

type RawSpellTooltip = {
  spell?: { id: number; name: LocalizedString; key: { href: string } };
  description?: string;
  cast_time?: string;
  range?: string;
  cooldown?: string;
};

type RawAbility = {
  id: number;
  playable_class?: { id: number; name: LocalizedString };
  spell_tooltip?: RawSpellTooltip;
};

type RawRenownReward = {
  level: number;
  reward: { id: number; name: LocalizedString; key: { href: string } };
};

const normalizeAbility = (entry: RawAbility): CovenantAbility => ({
  id: entry.id,
  playableClass: entry.playable_class
    ? {
        id: entry.playable_class.id,
        name: localized(entry.playable_class.name),
      }
    : undefined,
  spellTooltip: entry.spell_tooltip
    ? {
        spell: entry.spell_tooltip.spell
          ? {
              id: entry.spell_tooltip.spell.id,
              name: localized(entry.spell_tooltip.spell.name),
              key: entry.spell_tooltip.spell.key,
            }
          : undefined,
        description: cleanMarkup(entry.spell_tooltip.description),
        castTime: entry.spell_tooltip.cast_time,
        range: entry.spell_tooltip.range,
        cooldown: entry.spell_tooltip.cooldown,
      }
    : undefined,
});

const normalizeRenownRewards = (
  entries: RawRenownReward[] = [],
): RenownReward[] =>
  [...entries]
    .map((entry) => ({
      level: entry.level,
      reward: {
        id: entry.reward.id,
        name: localized(entry.reward.name) || `Reward #${entry.reward.id}`,
        key: entry.reward.key,
      },
    }))
    .sort((left, right) => left.level - right.level);

export const fetchCovenantIndex = async (
  signal?: AbortSignal,
): Promise<CovenantIndexResponse> => {
  const response = await blizzardClient.get<{
    covenants: Array<{
      id: number;
      name: LocalizedString;
      key: { href: string };
    }>;
  }>(
    "/data/wow/covenant/index",
    { namespace: namespace("static") },
    { signal },
  );

  const covenants: CovenantSummary[] = sortByName(
    (response.covenants ?? []).map((entry) => ({
      id: entry.id,
      name: localized(entry.name),
      key: entry.key,
    })),
  );

  return { covenants };
};

export const fetchCovenantDetail = async (
  covenantId: number,
  signal?: AbortSignal,
): Promise<CovenantDetail> => {
  const response = await blizzardClient.get<{
    id: number;
    name: LocalizedString;
    description?: string;
    signature_ability?: RawAbility;
    class_abilities?: RawAbility[];
    renown_rewards?: RawRenownReward[];
  }>(
    `/data/wow/covenant/${covenantId}`,
    { namespace: namespace("static") },
    { signal },
  );

  return {
    id: response.id,
    name: localized(response.name),
    description: cleanMarkup(response.description),
    signatureAbility: response.signature_ability
      ? normalizeAbility(response.signature_ability)
      : undefined,
    classAbilities: (response.class_abilities ?? []).map(normalizeAbility),
    renownRewards: normalizeRenownRewards(response.renown_rewards),
  };
};

export const fetchCovenantIcon = async (
  covenantId: number,
  signal?: AbortSignal,
): Promise<string | null> => {
  const response = await optional404(() =>
    blizzardClient.get<CovenantMedia>(
      `/data/wow/media/covenant/${covenantId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );

  return response?.assets?.find((asset) => asset.key === "icon")?.value ?? null;
};

/** Detail and icon together: one query per card, shared with the dialog. */
export const fetchCovenantCard = async (
  covenantId: number,
  signal?: AbortSignal,
): Promise<CovenantCardData> => {
  const [detail, iconUrl] = await Promise.all([
    fetchCovenantDetail(covenantId, signal),
    fetchCovenantIcon(covenantId, signal),
  ]);

  return { detail, iconUrl };
};
