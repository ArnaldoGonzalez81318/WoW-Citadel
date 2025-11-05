export type LinkReference = {
  href: string
}

export type LocalizedValue = string | { [locale: string]: string }

export type ConnectedRealmIndexItem = {
  href: string
}

export type ConnectedRealmIndexResponse = {
  connected_realms: ConnectedRealmIndexItem[]
}

export type RealmType = {
  name?: LocalizedValue
  type?: string
}

export type RealmPopulation = {
  name?: LocalizedValue
  type?: string
}

export type RealmStatus = {
  name?: LocalizedValue
  type?: string
}

export type RealmReference = {
  id: number
  slug: string
  name?: LocalizedValue
  timezone?: string
  type?: RealmType
  category?: RealmType
  realm?: LinkReference
}

export type ConnectedRealm = {
  id: number
  has_queue?: boolean
  status?: RealmStatus
  population?: RealmPopulation
  realms: RealmReference[]
  mythic_leaderboards?: LinkReference
  auctions?: LinkReference
}
