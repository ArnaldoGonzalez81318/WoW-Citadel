export type LinkReference = {
  href: string
}

export type LocalizedString = string | { [locale: string]: string | undefined }

export type SpellSummary = {
  id: number
  name: string
  description: string
  href: string
}

export type SpellDetail = {
  id: number
  name: string
  description: string
  mediaHref?: string
  href: string
}

export type SpellMedia = {
  assets?: Array<{
    key: string
    value: string
  }>
}