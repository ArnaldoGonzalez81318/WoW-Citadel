export type ApiNamespaceKind = "static" | "dynamic" | "none"

export type ApiParameterLocation = "path" | "query"

export interface ApiEndpointParameter {
  key: string
  label: string
  location: ApiParameterLocation
  defaultValue?: string
  placeholder?: string
  description?: string
}

export interface ApiEndpointDefinition {
  id: string
  label: string
  description: string
  path: string
  namespace: ApiNamespaceKind
  parameters?: ApiEndpointParameter[]
}

export interface ApiFamilyConfig {
  slug: string
  label: string
  description: string
  accentColor: string
  endpoints: ApiEndpointDefinition[]
}