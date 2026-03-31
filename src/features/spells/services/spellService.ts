import { env } from "@/lib/env"
import { blizzardClient, BlizzardRequestError } from "@/lib/blizzardClient"
import { LocalizedString, SpellDetail, SpellMedia, SpellSummary } from "@/features/spells/types"

type SearchResponse<T> = {
  results?: Array<{
    key: { href: string }
    data: T
  }>
}

type SpellSearchEntry = {
  id: number
  name: LocalizedString
  description?: LocalizedString
}

const STATIC_NAMESPACE = `static-${env.region}`

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

const cleanMarkup = (value: string | undefined): string => {
  if (!value) {
    return ""
  }

  return value
    .replace(/\|c[0-9A-Fa-f]{8}/g, "")
    .replace(/\|r/g, "")
    .replace(/\|n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const safeSearch = async <T>(fetcher: () => Promise<T>): Promise<T> => {
  try {
    return await fetcher()
  } catch (error) {
    if (error instanceof BlizzardRequestError && (error.status === 404 || error.status === 204)) {
      return [] as T
    }

    throw error
  }
}

export const searchSpellsDetailed = async (query: string, pageSize = 12): Promise<SpellSummary[]> => {
  if (!query.trim()) {
    return []
  }

  return safeSearch(async () => {
    const response = await blizzardClient.get<SearchResponse<SpellSearchEntry>>("/data/wow/search/spell", {
      namespace: STATIC_NAMESPACE,
      orderby: "id:desc",
      _pageSize: pageSize,
      [`name.${env.locale}`]: query.trim(),
    })

    return (response.results ?? []).map(({ key, data }) => ({
      id: data.id,
      name: localized(data.name),
      description: cleanMarkup(localized(data.description)),
      href: key.href,
    }))
  })
}

export const fetchSpellDetail = async (spellId: number): Promise<SpellDetail> => {
  const response = await blizzardClient.get<{
    _links: { self: { href: string } }
    id: number
    name: string
    description?: string
    media?: { key?: { href?: string } }
  }>(`/data/wow/spell/${spellId}`, {
    namespace: STATIC_NAMESPACE,
  })

  return {
    id: response.id,
    name: response.name,
    description: cleanMarkup(response.description),
    mediaHref: response.media?.key?.href,
    href: response._links.self.href,
  }
}

export const fetchSpellIcon = async (spellId: number): Promise<string | undefined> => {
  try {
    const response = await blizzardClient.get<SpellMedia>(`/data/wow/media/spell/${spellId}`, {
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