import { SvgIconComponent } from "@mui/icons-material"

export type SearchCategoryId = "items" | "spells" | "mounts" | "creatures"

export interface SearchResult {
  id: number
  name: string
  href: string
  summary?: string
  details?: string
  mediaUrl?: string
  tag?: string
  typeLabel?: string
}

export interface SearchCategory {
  id: SearchCategoryId
  label: string
  description: string
  icon: SvgIconComponent
  fetcher: (query: string) => Promise<SearchResult[]>
  minQueryLength?: number
}

export interface CategoryQueryState {
  category: SearchCategory
  data?: SearchResult[]
  isLoading: boolean
  isError: boolean
  error?: Error
}
