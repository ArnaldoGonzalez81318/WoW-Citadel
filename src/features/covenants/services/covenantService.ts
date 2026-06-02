import { env } from "@/lib/env";
import { blizzardClient, BlizzardRequestError } from "@/lib/blizzardClient";
import {
  CovenantAbility,
  CovenantDetail,
  CovenantIndexResponse,
  CovenantMedia,
  CovenantSummary,
  LocalizedString,
  RenownReward,
} from "@/features/covenants/types";

const STATIC_NAMESPACE = `static-${env.region}`;

const localized = (value: LocalizedString | undefined): string => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return (
    value[env.locale] ??
    value.en_US ??
    Object.values(value).find(
      (entry) => typeof entry === "string" && entry.length > 0,
    ) ??
    ""
  );
};

const sortByName = <T extends { name: string }>(items: T[]): T[] =>
  [...items].sort((left, right) => left.name.localeCompare(right.name));

const normalizeAbility = (entry: {
  id: number;
  playable_class?: { id: number; name: LocalizedString };
  spell_tooltip?: {
    spell?: { id: number; name: LocalizedString; key: { href: string } };
    description?: string;
    cast_time?: string;
    range?: string;
    cooldown?: string;
  };
}): CovenantAbility => ({
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
        description: entry.spell_tooltip.description,
        cast_time: entry.spell_tooltip.cast_time,
        range: entry.spell_tooltip.range,
        cooldown: entry.spell_tooltip.cooldown,
      }
    : undefined,
});

const normalizeRenownRewards = (
  entries: Array<{
    level: number;
    reward: { id: number; name: LocalizedString; key: { href: string } };
  }> = [],
): RenownReward[] =>
  [...entries]
    .map((entry) => ({
      level: entry.level,
      reward: {
        id: entry.reward.id,
        name: localized(entry.reward.name),
        key: entry.reward.key,
      },
    }))
    .sort((left, right) => left.level - right.level);

export const fetchCovenantIndex = async (): Promise<CovenantIndexResponse> => {
  const response = await blizzardClient.get<{
    covenants: Array<{
      id: number;
      name: LocalizedString;
      key: { href: string };
    }>;
  }>("/data/wow/covenant/index", {
    namespace: STATIC_NAMESPACE,
  });

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
): Promise<CovenantDetail> => {
  const response = await blizzardClient.get<{
    id: number;
    name: LocalizedString;
    description?: string;
    signature_ability?: {
      id: number;
      spell_tooltip?: {
        spell?: { id: number; name: LocalizedString; key: { href: string } };
        description?: string;
        cast_time?: string;
        range?: string;
        cooldown?: string;
      };
    };
    class_abilities?: Array<{
      id: number;
      playable_class?: { id: number; name: LocalizedString };
      spell_tooltip?: {
        spell?: { id: number; name: LocalizedString; key: { href: string } };
        description?: string;
        cast_time?: string;
        range?: string;
        cooldown?: string;
      };
    }>;
    renown_rewards?: Array<{
      level: number;
      reward: { id: number; name: LocalizedString; key: { href: string } };
    }>;
  }>(`/data/wow/covenant/${covenantId}`, {
    namespace: STATIC_NAMESPACE,
  });

  return {
    id: response.id,
    name: localized(response.name),
    description: response.description ?? "",
    signatureAbility: response.signature_ability
      ? normalizeAbility(response.signature_ability)
      : undefined,
    classAbilities: (response.class_abilities ?? []).map(normalizeAbility),
    renownRewards: normalizeRenownRewards(response.renown_rewards),
  };
};

export const fetchCovenantIcon = async (
  covenantId: number,
): Promise<string | null> => {
  try {
    const response = await blizzardClient.get<CovenantMedia>(
      `/data/wow/media/covenant/${covenantId}`,
      {
        namespace: STATIC_NAMESPACE,
      },
    );

    return (
      response.assets?.find((asset) => asset.key === "icon")?.value ?? null
    );
  } catch (error) {
    if (
      error instanceof BlizzardRequestError &&
      (error.status === 404 || error.status === 204)
    ) {
      return null;
    }

    throw error;
  }
};
