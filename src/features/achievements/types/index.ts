export type LinkReference = {
  href: string
}

export type LocalizedString = string | { [locale: string]: string }

export type AchievementSummary = {
  id: number
  key: LinkReference
}

export type AchievementCategorySummary = {
  id: number
  name: string
  key: LinkReference
}

export type AchievementCategoryIndexResponse = {
  categories: AchievementCategorySummary[]
}

export type AchievementCategory = {
  id: number
  name: string
  achievements?: AchievementSummary[]
  root_achievements?: AchievementSummary[]
  subcategories?: AchievementCategorySummary[]
}

export type Achievement = {
  id: number
  name: string
  description?: string
  points?: number
  is_account_wide?: boolean
  reward?: string
  reward_item?: {
    id: number
    key: LinkReference
    name?: string
  }
  media?: {
    key: LinkReference
    id: number
  }
}

export type AchievementMediaAsset = {
  key: string
  value: string
}

export type AchievementMedia = {
  assets: AchievementMediaAsset[]
}
