import { env } from "@/lib/env"
import { blizzardClient, BlizzardRequestError } from "@/lib/blizzardClient"
import {
  AllowedSpecialization,
  AzeriteEssenceDetail,
  AzeriteEssenceIndexResponse,
  AzeriteEssenceMedia,
  AzeriteEssencePower,
  AzeriteEssenceSummary,
  LocalizedString,
} from "@/features/azeriteEssences/types"

const STATIC_NAMESPACE = `static-${env.region}`

type SearchResponse<T> = {
  results?: Array<{
    key: { href: string }
    data: T
  }>
}

const localized = (value: LocalizedString | undefined): string => {
  if (!value) {
    return ""
  }

  if (typeof value === "string") {
    return value
  }

  return (
    value[env.locale] ??
    value.en_US ??
    Object.values(value).find((entry) => typeof entry === "string" && entry.length > 0) ??
    ""
  )
}

const sortByName = <T extends { name: string }>(items: T[]): T[] =>
  [...items].sort((left, right) => left.name.localeCompare(right.name))

const normalizeSummary = (entry: {
  id: number
  name: LocalizedString
  key: { href: string }
}): AzeriteEssenceSummary => ({
  id: entry.id,
  name: localized(entry.name),
  key: entry.key,
})

const normalizeSpecializations = (
  entries: Array<{ id: number; name: LocalizedString; key: { href: string } }> = []
): AllowedSpecialization[] =>
  sortByName(
    entries.map((entry) => ({
      id: entry.id,
      name: localized(entry.name),
      key: entry.key,
    }))
  )

const normalizePowers = (
  entries: Array<{
    id: number
    rank: number
    main_power_spell?: { id: number; name: LocalizedString; key: { href: string } }
    passive_power_spell?: { id: number; name: LocalizedString; key: { href: string } }
  }> = []
): AzeriteEssencePower[] =>
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
    .sort((left, right) => left.rank - right.rank)

export const fetchAzeriteEssenceIndex = async (): Promise<AzeriteEssenceIndexResponse> => {
  const response = await blizzardClient.get<{
    azerite_essences: Array<{ id: number; name: LocalizedString; key: { href: string } }>
  }>("/data/wow/azerite-essence/index", {
    namespace: STATIC_NAMESPACE,
  })

  return {
    azerite_essences: sortByName((response.azerite_essences ?? []).map(normalizeSummary)),
  }
}

export const searchAzeriteEssences = async (
  query: string,
  limit = 12
): Promise<AzeriteEssenceSummary[]> => {
  if (!query.trim()) {
    return []
  }

  const nameParamKey = `name.${env.locale}`

  try {
    const response = await blizzardClient.get<
      SearchResponse<{
        id: number
        name: LocalizedString
      }>
    >("/data/wow/search/azerite-essence", {
      namespace: STATIC_NAMESPACE,
      _pageSize: limit,
      [nameParamKey]: query.trim(),
    })

    return sortByName(
      (response.results ?? []).map(({ key, data }) => ({
        id: data.id,
        name: localized(data.name),
        key,
      }))
    )
  } catch (error) {
    if (error instanceof BlizzardRequestError && (error.status === 404 || error.status === 204)) {
      return []
    }

    throw error
  }
}

export const fetchAzeriteEssenceDetail = async (essenceId: number): Promise<AzeriteEssenceDetail> => {
  const response = await blizzardClient.get<{
    id: number
    name: LocalizedString
    allowed_specializations?: Array<{ id: number; name: LocalizedString; key: { href: string } }>
    powers?: Array<{
      id: number
      rank: number
      main_power_spell?: { id: number; name: LocalizedString; key: { href: string } }
      passive_power_spell?: { id: number; name: LocalizedString; key: { href: string } }
    }>
  }>(`/data/wow/azerite-essence/${essenceId}`, {
    namespace: STATIC_NAMESPACE,
  })

  return {
    id: response.id,
    name: localized(response.name),
    allowedSpecializations: normalizeSpecializations(response.allowed_specializations),
    powers: normalizePowers(response.powers),
  }
}

export const fetchAzeriteEssenceIcon = async (essenceId: number): Promise<string | undefined> => {
  try {
    const response = await blizzardClient.get<AzeriteEssenceMedia>(`/data/wow/media/azerite-essence/${essenceId}`, {
      namespace: STATIC_NAMESPACE,
    })

    return response.assets?.find((asset) => asset.key === "icon")?.value
  } catch (error) {
    if (error instanceof BlizzardRequestError && (error.status === 404 || error.status === 204)) {
      return undefined
    }

    throw error
  }
}