import { BlizzardRequestError, blizzardClient } from "@/lib/blizzardClient"
import { env } from "@/lib/env"
import { SearchResult } from "@/features/search/types"

const DEFAULT_PAGE_SIZE = 12

const namespace = (type: "static" | "dynamic" | "profile"): string => `${type}-${env.region}`

type LocalizedString = Record<string, string | undefined> | undefined

type SearchResponse<T> = {
  results?: Array<{
    key: { href: string }
    data: T
  }>
}

const localized = (value: LocalizedString): string => {
  if (!value) {
    return ""
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

type ItemSearchResult = {
  id: number
  name: LocalizedString
  level?: number
  item_class?: { name?: LocalizedString }
  item_subclass?: { name?: LocalizedString }
  inventory_type?: { name?: LocalizedString }
  media?: { id: number }
}

type SpellSearchResult = {
  id: number
  name: LocalizedString
  description?: LocalizedString
  media?: { id: number }
}

type AchievementSearchResult = {
  id: number
  name: LocalizedString
  description?: LocalizedString
  points?: number
  media?: { id: number }
}

type MountSearchResult = {
  id: number
  name: LocalizedString
  description?: LocalizedString
  source?: { name?: LocalizedString }
  faction?: { name?: LocalizedString }
  is_flying_mount?: boolean
}

type CreatureSearchResult = {
  id: number
  name: LocalizedString
  description?: LocalizedString
  level?: number
  type?: { name?: LocalizedString }
  creature_type?: { name?: LocalizedString }
  creature_family?: { name?: LocalizedString }
}

const nameParamKey = (): string => `name.${env.locale}`

const mapResults = <T,>(
  response: SearchResponse<T>,
  mapper: (entry: NonNullable<SearchResponse<T>["results"]>[number]) => SearchResult
): SearchResult[] =>
  (response.results ?? []).map(mapper).filter((item) => Boolean(item.name))

const safeSearch = async <T>(
  search: () => Promise<SearchResult[]>
): Promise<SearchResult[]> => {
  try {
    return await search()
  } catch (error) {
    if (error instanceof BlizzardRequestError && (error.status === 404 || error.status === 204)) {
      return []
    }

    throw error
  }
}

export const searchItems = async (query: string): Promise<SearchResult[]> => {
  if (!query.trim()) {
    return []
  }

  return safeSearch(async () => {
    const response = await blizzardClient.get<SearchResponse<ItemSearchResult>>("/data/wow/search/item", {
      namespace: namespace("static"),
      orderby: "level:desc",
      _pageSize: DEFAULT_PAGE_SIZE,
      [nameParamKey()]: query,
    })

    return mapResults(response, ({ key, data }) => {
      const itemClass = localized(data.item_class?.name)
      const itemSubclass = localized(data.item_subclass?.name)
      const inventoryType = localized(data.inventory_type?.name)

      const summaryParts = [] as string[]
      if (data.level) {
        summaryParts.push(`Item level ${data.level}`)
      }

      if (itemClass) {
        summaryParts.push(itemClass)
      }

      if (itemSubclass && itemSubclass !== itemClass) {
        summaryParts.push(itemSubclass)
      }

      const details = [inventoryType].filter(Boolean).join(" • ")

      return {
        id: data.id,
        name: localized(data.name),
        href: key.href,
        summary: summaryParts.join(" • "),
        details,
        typeLabel: itemClass || "Item",
      }
    })
  })
}

export const searchSpells = async (query: string): Promise<SearchResult[]> => {
  if (!query.trim()) {
    return []
  }

  return safeSearch(async () => {
    const response = await blizzardClient.get<SearchResponse<SpellSearchResult>>("/data/wow/search/spell", {
      namespace: namespace("static"),
      orderby: "id:desc",
      _pageSize: DEFAULT_PAGE_SIZE,
      [nameParamKey()]: query,
    })

    return mapResults(response, ({ key, data }) => ({
      id: data.id,
      name: localized(data.name),
      href: key.href,
      summary: "Spell",
      details: cleanMarkup(localized(data.description)),
      typeLabel: "Spell",
    }))
  })
}

export const searchAchievements = async (query: string): Promise<SearchResult[]> => {
  if (!query.trim()) {
    return []
  }

  return safeSearch(async () => {
    const response = await blizzardClient.get<SearchResponse<AchievementSearchResult>>("/data/wow/search/achievement", {
      namespace: namespace("static"),
      orderby: "id:desc",
      _pageSize: DEFAULT_PAGE_SIZE,
      [nameParamKey()]: query,
    })

    return mapResults(response, ({ key, data }) => {
      const points = typeof data.points === "number" ? `${data.points} pts` : undefined

      return {
        id: data.id,
        name: localized(data.name),
        href: key.href,
        summary: points,
        details: cleanMarkup(localized(data.description)),
        typeLabel: "Achievement",
      }
    })
  })
}

export const searchMounts = async (query: string): Promise<SearchResult[]> => {
  if (!query.trim()) {
    return []
  }

  return safeSearch(async () => {
    const response = await blizzardClient.get<SearchResponse<MountSearchResult>>("/data/wow/search/mount", {
      namespace: namespace("static"),
      orderby: "id:desc",
      _pageSize: DEFAULT_PAGE_SIZE,
      [nameParamKey()]: query,
    })

    return mapResults(response, ({ key, data }) => {
      const affiliation = localized(data.faction?.name)
      const tag = data.is_flying_mount ? "Flying" : undefined

      return {
        id: data.id,
        name: localized(data.name),
        href: key.href,
        summary: localized(data.source?.name),
        details: cleanMarkup(localized(data.description)),
        typeLabel: "Mount",
        tag: tag || affiliation || undefined,
      }
    })
  })
}

export const searchCreatures = async (query: string): Promise<SearchResult[]> => {
  if (!query.trim()) {
    return []
  }

  return safeSearch(async () => {
    const response = await blizzardClient.get<SearchResponse<CreatureSearchResult>>(
      "/data/wow/search/creature",
      {
        namespace: namespace("static"),
        orderby: "level:desc",
        _pageSize: DEFAULT_PAGE_SIZE,
        [nameParamKey()]: query,
      }
    )

    return mapResults(response, ({ key, data }) => {
      const type = localized(data.type?.name ?? data.creature_type?.name)
      const family = localized(data.creature_family?.name)

      const summaryParts = [
        typeof data.level === "number" && data.level > 0 ? `Level ${data.level}` : undefined,
        type,
        family,
      ].filter(Boolean) as string[]

      return {
        id: data.id,
        name: localized(data.name),
        href: key.href,
        summary: summaryParts.join(" • ") || undefined,
        details: cleanMarkup(localized(data.description)),
        typeLabel: "Creature",
      }
    })
  })
}
