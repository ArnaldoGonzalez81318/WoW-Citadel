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

/** Accent tone of a family: gold (`secondary`) for value families, arcane blue otherwise. */
export type ApiFamilyTone = "primary" | "secondary";

export interface ApiFamilyConfig {
  slug: string;
  label: string;
  description: string;
  /**
   * A palette *tone*, never a colour: category identity is icon + label.
   * Read it through `getApiFamilyTone`; never interpolate it into CSS.
   */
  accentColor: ApiFamilyTone;
  endpoints: ApiEndpointDefinition[];
  presentation?: ApiFamilyPresentation;
  /** Endpoint ids whose index responses feed the dataset gallery. */
  datasetSources?: string[];
}
