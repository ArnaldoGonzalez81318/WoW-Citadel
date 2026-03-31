import { ApiNamespaceKind } from "@/features/apiExplorer/types"
import { env } from "@/lib/env"

export const resolveNamespace = (kind: ApiNamespaceKind): string | undefined => {
  if (kind === "static") {
    return `static-${env.region}`
  }

  if (kind === "dynamic") {
    return `dynamic-${env.region}`
  }

  return undefined
}

export const resolveParameterKey = (key: string): string => key.replace("{locale}", env.locale)

export const resolveLocalizedString = (value: unknown): string => {
  if (typeof value === "string") {
    return value
  }

  if (!value || typeof value !== "object") {
    return ""
  }

  const localized = value as Record<string, unknown>

  const directMatch = localized[env.locale]
  if (typeof directMatch === "string") {
    return directMatch
  }

  const englishMatch = localized.en_US
  if (typeof englishMatch === "string") {
    return englishMatch
  }

  const fallback = Object.values(localized).find((entry) => typeof entry === "string")
  return typeof fallback === "string" ? fallback : ""
}

export const summarizeEntry = (entry: unknown): string => {
  if (typeof entry === "string") {
    return entry
  }

  if (!entry || typeof entry !== "object") {
    return "Unknown entry"
  }

  const record = entry as Record<string, unknown>
  const labelCandidates = [
    resolveLocalizedString(record.name),
    resolveLocalizedString(record.label),
    resolveLocalizedString(record.title),
    typeof record.slug === "string" ? record.slug : "",
    typeof record.id === "number" || typeof record.id === "string" ? `ID ${record.id}` : "",
  ]

  return labelCandidates.find((candidate) => candidate.length > 0) ?? "Unknown entry"
}

export const extractPreviewItems = (data: unknown): string[] => {
  if (!data || typeof data !== "object") {
    return []
  }

  const record = data as Record<string, unknown>

  const results = Array.isArray(record.results)
    ? record.results.map((entry) => {
      if (entry && typeof entry === "object" && "data" in entry) {
        return summarizeEntry((entry as { data: unknown }).data)
      }

      return summarizeEntry(entry)
    })
    : []

  if (results.length > 0) {
    return results.slice(0, 8)
  }

  const arrayEntry = Object.values(record).find((value) => Array.isArray(value))
  if (Array.isArray(arrayEntry)) {
    return arrayEntry.map((entry) => summarizeEntry(entry)).slice(0, 8)
  }

  return []
}

export const extractMediaAssets = (data: unknown): Array<{ key: string; value: string }> => {
  if (!data || typeof data !== "object") {
    return []
  }

  const record = data as Record<string, unknown>
  if (!Array.isArray(record.assets)) {
    return []
  }

  return record.assets
    .map((asset) => {
      if (!asset || typeof asset !== "object") {
        return undefined
      }

      const candidate = asset as Record<string, unknown>
      return typeof candidate.key === "string" && typeof candidate.value === "string"
        ? { key: candidate.key, value: candidate.value }
        : undefined
    })
    .filter((entry): entry is { key: string; value: string } => Boolean(entry))
}

export const buildPath = (template: string, values: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (_match, key: string) => encodeURIComponent(values[key] ?? ""))

const trimPath = (value: string): string => value.replace(/\/+$/, "") || "/"

const parseCandidatePathname = (value: string): string | null => {
  try {
    return trimPath(new URL(value).pathname)
  } catch {
    if (!value.startsWith("/")) {
      return null
    }

    return trimPath(value.split("?")[0] ?? value)
  }
}

export const matchPathTemplate = (
  template: string,
  candidate: string
): Record<string, string> | null => {
  const pathname = parseCandidatePathname(candidate)

  if (!pathname) {
    return null
  }

  const templateSegments = trimPath(template).split("/").filter(Boolean)
  const pathSegments = pathname.split("/").filter(Boolean)

  if (templateSegments.length !== pathSegments.length) {
    return null
  }

  const values: Record<string, string> = {}

  for (let index = 0; index < templateSegments.length; index += 1) {
    const templateSegment = templateSegments[index]
    const pathSegment = pathSegments[index]
    const match = /^\{(\w+)\}$/.exec(templateSegment)

    if (match) {
      values[match[1]] = decodeURIComponent(pathSegment)
      continue
    }

    if (templateSegment !== pathSegment) {
      return null
    }
  }

  return values
}

export const collectUrlStrings = (value: unknown, bag = new Set<string>()): string[] => {
  if (typeof value === "string") {
    if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/data/wow/")) {
      bag.add(value)
    }

    return Array.from(bag)
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      collectUrlStrings(entry, bag)
    })

    return Array.from(bag)
  }

  if (!value || typeof value !== "object") {
    return Array.from(bag)
  }

  Object.values(value as Record<string, unknown>).forEach((entry) => {
    collectUrlStrings(entry, bag)
  })

  return Array.from(bag)
}