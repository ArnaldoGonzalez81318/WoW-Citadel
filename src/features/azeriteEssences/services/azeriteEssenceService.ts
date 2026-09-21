import { blizzardClient } from "@/lib/blizzardClient";
import {
  localized,
  namespace,
  optional404,
  sortByName,
} from "@/lib/blizzardHelpers";
import {
  AllowedSpecialization,
  AzeriteEssenceCardData,
  AzeriteEssenceDetail,
  AzeriteEssenceIndexResponse,
  AzeriteEssenceMedia,
  AzeriteEssencePower,
  AzeriteEssenceSummary,
  LocalizedString,
} from "@/features/azeriteEssences/types";

type RawReference = {
  id: number;
  name: LocalizedString;
  key: { href: string };
};

type RawPower = {
  id: number;
  rank: number;
  main_power_spell?: RawReference;
  passive_power_spell?: RawReference;
};

const normalizeSummary = (entry: RawReference): AzeriteEssenceSummary => ({
  id: entry.id,
  name: localized(entry.name),
  key: entry.key,
});

const normalizeSpecializations = (
  entries: RawReference[] = [],
): AllowedSpecialization[] =>
  sortByName(
    entries.map((entry) => ({
      id: entry.id,
      name: localized(entry.name),
      key: entry.key,
    })),
  );

const normalizePowers = (entries: RawPower[] = []): AzeriteEssencePower[] =>
  [...entries]
    .map((entry) => ({
      id: entry.id,
      rank: entry.rank,
      mainPowerSpell: entry.main_power_spell
        ? {
            id: entry.main_power_spell.id,
            name: localized(entry.main_power_spell.name),
            key: entry.main_power_spell.key,
          }
        : undefined,
      passivePowerSpell: entry.passive_power_spell
        ? {
            id: entry.passive_power_spell.id,
            name: localized(entry.passive_power_spell.name),
            key: entry.passive_power_spell.key,
          }
        : undefined,
    }))
    .sort((left, right) => left.rank - right.rank);

export const fetchAzeriteEssenceIndex = async (
  signal?: AbortSignal,
): Promise<AzeriteEssenceIndexResponse> => {
  const response = await blizzardClient.get<{
    azerite_essences: RawReference[];
  }>(
    "/data/wow/azerite-essence/index",
    { namespace: namespace("static") },
    { signal },
  );

  return {
    azerite_essences: sortByName(
      (response.azerite_essences ?? []).map(normalizeSummary),
    ),
  };
};

export const fetchAzeriteEssenceDetail = async (
  essenceId: number,
  signal?: AbortSignal,
): Promise<AzeriteEssenceDetail> => {
  const response = await blizzardClient.get<{
    id: number;
    name: LocalizedString;
    allowed_specializations?: RawReference[];
    powers?: RawPower[];
  }>(
    `/data/wow/azerite-essence/${essenceId}`,
    { namespace: namespace("static") },
    { signal },
  );

  return {
    id: response.id,
    name: localized(response.name),
    allowedSpecializations: normalizeSpecializations(
      response.allowed_specializations,
    ),
    powers: normalizePowers(response.powers),
  };
};

export const fetchAzeriteEssenceIcon = async (
  essenceId: number,
  signal?: AbortSignal,
): Promise<string | undefined> => {
  const response = await optional404(() =>
    blizzardClient.get<AzeriteEssenceMedia>(
      `/data/wow/media/azerite-essence/${essenceId}`,
      { namespace: namespace("static") },
      { signal },
    ),
  );

  return response?.assets?.find((asset) => asset.key === "icon")?.value;
};

/** Detail and icon together: one query per card, shared with the dialog. */
export const fetchAzeriteEssenceCard = async (
  essenceId: number,
  signal?: AbortSignal,
): Promise<AzeriteEssenceCardData> => {
  const [detail, iconUrl] = await Promise.all([
    fetchAzeriteEssenceDetail(essenceId, signal),
    fetchAzeriteEssenceIcon(essenceId, signal),
  ]);

  return { detail, iconUrl };
};
