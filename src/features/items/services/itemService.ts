import { SearchResult } from "@/features/search/types"
import { env } from "@/lib/env"
import { BlizzardRequestError, blizzardClient } from "@/lib/blizzardClient"
import {
  ItemClassDetail,
  ItemClassIndexResponse,
  ItemDetail,
  ItemSubclassSummary,
  LocalizedString,
} from "@/features/items/types"

type SearchResponse<T> = {
  page?: number
  pageSize?: number
  pageCount?: number
  results?: Array<{
    key: { href: string }
    data: T
  }>
}

type ItemSearchResult = {
  id: number
  name: LocalizedString
  level?: number
  required_level?: number
  media?: { id?: number }
  quality?: { name?: LocalizedString; type?: string }
  item_class?: { id: number; name?: LocalizedString }
  item_subclass?: { id: number; name?: LocalizedString }
  inventory_type?: { name?: LocalizedString }
}

export type ItemGalleryPage = {
  items: SearchResult[]
  page: number
  pageCount: number
}

const namespace = (): string => `static-${env.region}`

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

export const fetchItemClassIndex = async (): Promise<ItemClassIndexResponse> => {
  const response = await blizzardClient.get<ItemClassIndexResponse>("/data/wow/item-class/index", {
    namespace: namespace(),
  })

  return {
    ...response,
    item_classes: sortByName(response.item_classes ?? []),
  }
}

export const fetchItemClassDetail = async (itemClassId: number): Promise<ItemClassDetail> => {
  const response = await blizzardClient.get<{
    class_id: number
    name: LocalizedString
    item_subclasses?: Array<{
      id: number
      name: LocalizedString
      key: { href: string }
    }>
  }>(`/data/wow/item-class/${itemClassId}`, {
    namespace: namespace(),
  })

  const subclasses: ItemSubclassSummary[] = sortByName(
    (response.item_subclasses ?? []).map((entry) => ({
      id: entry.id,
      name: localized(entry.name),
      key: entry.key,
    }))
  )

  return {
    class_id: response.class_id,
    name: localized(response.name),
    item_subclasses: subclasses,
  }
}

export const fetchItemsByClass = async (
  itemClassId: number,
  itemSubclassId?: number,
  pageSize = 9
): Promise<SearchResult[]> =>
  safeSearch(async () => {
    const response = await blizzardClient.get<SearchResponse<ItemSearchResult>>("/data/wow/search/item", {
      namespace: namespace(),
      orderby: "level:desc,id:desc",
      _pageSize: pageSize,
      "item_class.id": itemClassId,
      ...(itemSubclassId !== undefined ? { "item_subclass.id": itemSubclassId } : {}),
    })

    return (response.results ?? [])
      .map(({ key, data }): SearchResult => {
        const itemClass = localized(data.item_class?.name)
        const itemSubclass = localized(data.item_subclass?.name)
        const inventoryType = localized(data.inventory_type?.name)
        const quality = localized(data.quality?.name)

        const summaryParts = [
          typeof data.level === "number" ? `Item level ${data.level}` : undefined,
          quality,
          itemClass,
        ].filter(Boolean) as string[]

        const detailParts = [
          itemSubclass && itemSubclass !== itemClass ? itemSubclass : undefined,
          inventoryType,
          typeof data.required_level === "number" ? `Req. level ${data.required_level}` : undefined,
        ].filter(Boolean) as string[]

        return {
          id: data.id,
          name: localized(data.name),
          href: key.href,
          summary: summaryParts.join(" • "),
          details: detailParts.join(" • "),
          typeLabel: quality || "Item",
          tag: inventoryType || undefined,
        }
      })
      .filter((item) => item.name.length > 0)
  })

export const fetchItemGalleryPage = async (
  itemClassId: number,
  page: number,
  itemSubclassId?: number,
  pageSize = 24
): Promise<ItemGalleryPage> =>
  safeSearch(async () => {
    const response = await blizzardClient.get<SearchResponse<ItemSearchResult>>("/data/wow/search/item", {
      namespace: namespace(),
      orderby: "id:desc",
      _pageSize: pageSize,
      _page: page,
      "item_class.id": itemClassId,
      ...(itemSubclassId !== undefined ? { "item_subclass.id": itemSubclassId } : {}),
    })

    return {
      page: response.page ?? page,
      pageCount: response.pageCount ?? 1,
      items: (response.results ?? [])
        .map(({ key, data }): SearchResult => {
          const itemClass = localized(data.item_class?.name)
          const itemSubclass = localized(data.item_subclass?.name)
          const inventoryType = localized(data.inventory_type?.name)
          const quality = localized(data.quality?.name)

          return {
            id: data.id,
            name: localized(data.name),
            href: key.href,
            summary: [quality, typeof data.level === "number" ? `Item level ${data.level}` : undefined]
              .filter(Boolean)
              .join(" • "),
            details: [
              itemClass,
              itemSubclass && itemSubclass !== itemClass ? itemSubclass : undefined,
              inventoryType,
              typeof data.required_level === "number" ? `Req. level ${data.required_level}` : undefined,
            ]
              .filter(Boolean)
              .join(" • "),
            tag: inventoryType || undefined,
            typeLabel: quality || "Item",
          }
        })
        .filter((item) => item.name.length > 0),
    }
  })

export const fetchItemMediaUrl = async (itemId: number): Promise<string | undefined> => {
  try {
    const response = await blizzardClient.get<{
      assets?: Array<{ key: string; value: string }>
    }>(`/data/wow/media/item/${itemId}`, {
      namespace: namespace(),
    })

    return response.assets?.[0]?.value
  } catch (error) {
    if (error instanceof BlizzardRequestError && (error.status === 404 || error.status === 204)) {
      return undefined
    }

    throw error
  }
}

export const fetchItemDetail = async (itemId: number): Promise<ItemDetail> => {
  const response = await blizzardClient.get<{
    _links: { self: { href: string } }
    id: number
    name: LocalizedString
    description?: LocalizedString
    level?: number
    required_level?: number
    is_equippable?: boolean
    max_count?: number
    purchase_price?: number
    sell_price?: number
    quality?: { name?: LocalizedString }
    preview_item?: {
      item_class?: { name?: LocalizedString }
      item_subclass?: { name?: LocalizedString }
      inventory_type?: { name?: LocalizedString }
      binding?: { name?: LocalizedString }
    }
  }>(`/data/wow/item/${itemId}`, {
    namespace: namespace(),
  })

  return {
    id: response.id,
    name: localized(response.name),
    href: response._links.self.href,
    description: localized(response.description),
    quality: localized(response.quality?.name),
    level: response.level,
    requiredLevel: response.required_level,
    itemClass: localized(response.preview_item?.item_class?.name),
    itemSubclass: localized(response.preview_item?.item_subclass?.name),
    inventoryType: localized(response.preview_item?.inventory_type?.name),
    binding: localized(response.preview_item?.binding?.name),
    isEquippable: response.is_equippable,
    maxCount: response.max_count,
    purchasePrice: response.purchase_price,
    sellPrice: response.sell_price,
  }
}