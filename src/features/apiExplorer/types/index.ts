export type ApiNamespaceKind = "static" | "dynamic" | "none";

export type ApiParameterLocation = "path" | "query";

/**
 * How a family is surfaced in the app:
 * - `dataset`: a browsable gallery built from `datasetSources` (index endpoints)
 * - `family`: the endpoint workbench only
 * - `page`: a dedicated explorer page owns it (items, mounts, realms…)
 */
export type ApiFamilyPresentation = "dataset" | "family" | "page";

export interface ApiEndpointParameter {
  key: string;
  label: string;
  location: ApiParameterLocation;
  defaultValue?: string;
  placeholder?: string;
  description?: string;
}

export interface ApiEndpointDefinition {
  id: string;
  label: string;
  description: string;
  path: string;
  namespace: ApiNamespaceKind;
  parameters?: ApiEndpointParameter[];
}

export interface ApiFamilyConfig {
  slug: string;
  label: string;
  description: string;
  /** @deprecated Category identity is icon + label; the catalog drops this field. */
  accentColor: string;
  endpoints: ApiEndpointDefinition[];
  presentation?: ApiFamilyPresentation;
  /** Endpoint ids whose index responses feed the dataset gallery. */
  datasetSources?: string[];
}
