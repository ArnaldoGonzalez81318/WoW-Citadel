export type LinkReference = {
  href: string
}

export type LocalizedString = string | { [locale: string]: string | undefined }

export type AzeriteEssenceSummary = {
  id: number
  name: string
  key: LinkReference
}

export type AzeriteEssenceIndexResponse = {
  azerite_essences: AzeriteEssenceSummary[]
}

export type AllowedSpecialization = {
  id: number
  name: string
  key: LinkReference
}

export type AzeriteSpellReference = {
  id: number
  name: string
  key: LinkReference
}

export type AzeriteEssencePower = {
  id: number
  rank: number
  mainPowerSpell?: AzeriteSpellReference
  passivePowerSpell?: AzeriteSpellReference
}

export type AzeriteEssenceDetail = {
  id: number
  name: string
  allowedSpecializations: AllowedSpecialization[]
  powers: AzeriteEssencePower[]
}

export type AzeriteEssenceMediaAsset = {
  key: string
  value: string
}

export type AzeriteEssenceMedia = {
  assets: AzeriteEssenceMediaAsset[]
}