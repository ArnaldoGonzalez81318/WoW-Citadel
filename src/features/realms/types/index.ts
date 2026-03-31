export type LinkReference = {
  href: string
}

export type LocalizedString = string | { [locale: string]: string | undefined }

export type RealmSummary = {
  id: number
  name: string
  slug: string
  href: string
  timezone?: string
  category?: string
  typeName?: string
  regionName?: string
}

export type RealmDetail = {
  id: number
  name: string
  slug: string
  category: string
  timezone: string
  locale: string
  typeName: string
  regionName: string
  isTournament: boolean
  connectedRealmHref?: string
  href: string
}