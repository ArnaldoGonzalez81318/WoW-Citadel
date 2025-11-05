import { blizzardClient, BlizzardRequestError } from "@/lib/blizzardClient"
import { env } from "@/lib/env"
import type {
  ConnectedRealm,
  ConnectedRealmIndexResponse,
  LocalizedValue,
  RealmReference,
} from "@/features/connectedRealms/types"

const DYNAMIC_NAMESPACE = `dynamic-${env.region}`

const resolveLocalized = (value: LocalizedValue | undefined): string => {
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

const extractRealmId = (href: string): number | null => {
  const match = /connected-realm\/(\d+)/i.exec(href)
  return match ? Number.parseInt(match[1], 10) : null
}

const uniqueStrings = (values: Array<string | undefined>): string[] =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value && value.length > 0))))

const normalizeRealm = (realm: RealmReference) => ({
  id: realm.id,
  slug: realm.slug,
  name: resolveLocalized(realm.name),
  timezone: realm.timezone,
  type: resolveLocalized(realm.type?.name),
  category: resolveLocalized(realm.category?.name),
})

export const fetchConnectedRealmIndex = (): Promise<ConnectedRealmIndexResponse> =>
  blizzardClient.get<ConnectedRealmIndexResponse>("/data/wow/connected-realm/index", {
    namespace: DYNAMIC_NAMESPACE,
  })

export const fetchConnectedRealm = (connectedRealmId: number): Promise<ConnectedRealm> =>
  blizzardClient.get<ConnectedRealm>(`/data/wow/connected-realm/${connectedRealmId}`, {
    namespace: DYNAMIC_NAMESPACE,
  })

export type ConnectedRealmSnapshot = ConnectedRealm & {
  realmDetails: ReturnType<typeof normalizeRealm>[]
  displayName: string
  realmSlugs: string[]
  realmTypes: string[]
  timezones: string[]
  populationLabel?: string
  statusLabel?: string
}

export const fetchConnectedRealmSnapshots = async (limit = 12): Promise<ConnectedRealmSnapshot[]> => {
  const index = await fetchConnectedRealmIndex()
  const ids = index.connected_realms
    .map((entry) => extractRealmId(entry.href))
    .filter((id): id is number => typeof id === "number")
    .slice(0, limit)

  if (ids.length === 0) {
    return []
  }

  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        return await fetchConnectedRealm(id)
      } catch (error) {
        if (error instanceof BlizzardRequestError && (error.status === 404 || error.status === 204)) {
          return null
        }
        throw error
      }
    })
  )

  return results
    .filter((realm): realm is ConnectedRealm => Boolean(realm))
    .map((realm) => {
      const realmDetails = realm.realms?.map(normalizeRealm) ?? []
      const realmNames = realmDetails.map((detail) => detail.name)
      const realmTypes = uniqueStrings(realmDetails.map((detail) => detail.type || detail.category))
      const timezones = uniqueStrings(realmDetails.map((detail) => detail.timezone))

      return {
        ...realm,
        displayName: realmNames.join(", "),
        realmDetails,
        realmSlugs: realmDetails.map((detail) => detail.slug),
        realmTypes,
        timezones,
        populationLabel: resolveLocalized(realm.population?.name),
        statusLabel: resolveLocalized(realm.status?.name),
      }
    })
}
