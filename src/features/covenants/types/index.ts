export type LinkReference = {
  href: string
}

export type LocalizedString = string | { [locale: string]: string | undefined }

export type CovenantSummary = {
  id: number
  name: string
  key: LinkReference
}

export type CovenantIndexResponse = {
  covenants: CovenantSummary[]
}

export type SpellTooltip = {
  spell?: {
    id: number
    name: string
    key: LinkReference
  }
  description?: string
  cast_time?: string
  range?: string
  cooldown?: string
}

export type CovenantAbility = {
  id: number
  playableClass?: {
    id: number
    name: string
  }
  spellTooltip?: SpellTooltip
}

export type RenownReward = {
  level: number
  reward: {
    id: number
    name: string
    key: LinkReference
  }
}

export type CovenantDetail = {
  id: number
  name: string
  description: string
  signatureAbility?: CovenantAbility
  classAbilities: CovenantAbility[]
  renownRewards: RenownReward[]
}

export type CovenantMediaAsset = {
  key: string
  value: string
}

export type CovenantMedia = {
  assets: CovenantMediaAsset[]
}