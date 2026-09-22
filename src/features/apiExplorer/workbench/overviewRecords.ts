import type {
  ApiEndpointDefinition,
  ApiFamilyConfig,
} from "@/features/apiExplorer/types";
import { matchPathTemplate, summarizeEntry } from "@/features/apiExplorer/utils";
import { humanizeEnum } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* Workbench links                                                     */
/* ------------------------------------------------------------------ */

export const workbenchPath = (family: ApiFamilyConfig): string =>
  `/api-explorer/${family.slug}`;

/** `/api-explorer/{slug}?endpoint={id}&{param}={value}` — the workbench pre-filled. */
export const workbenchLink = (
  family: ApiFamilyConfig,
  endpoint: ApiEndpointDefinition,
  values: Record<string, string>,
): string => {
  const params = new URLSearchParams({ endpoint: endpoint.id });
  Object.entries(values).forEach(([key, value]) => {
    if (value.trim().length > 0) {
      params.set(key, value.trim());
    }
  });
  return `${workbenchPath(family)}?${params.toString()}`;
};

/* ------------------------------------------------------------------ */
/* Records                                                             */
/* ------------------------------------------------------------------ */

export type IndexRecord = {
  /** Stable React key: the record id, its `key.href`, or its index. */
  key: string;
  id?: number;
  label: string;
  href?: string;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const recordHref = (record: Record<string, unknown> | undefined): string | undefined => {
  const key = asRecord(record?.key);
  return typeof key?.href === "string" ? key.href : undefined;
};

const plainHref = (value: unknown): string | undefined => {
  const record = asRecord(value);
  return typeof record?.href === "string" ? record.href : undefined;
};

/**
 * The list an index / search response carries: `results[].data` entries
 * first (keeping the wrapper's `key.href`, which names the detail record),
 * otherwise the first array value in the response.
 */
export const extractIndexRecords = (data: unknown): IndexRecord[] => {
  const root = asRecord(data);
  if (!root) {
    return [];
  }

  let entries: Array<{ record: unknown; href?: string }> = [];
  if (Array.isArray(root.results)) {
    entries = root.results.map((entry) => {
      const wrapper = asRecord(entry);
      const record = wrapper && "data" in wrapper ? wrapper.data : entry;
      return {
        record,
        href: recordHref(wrapper) ?? recordHref(asRecord(record)),
      };
    });
  } else {
    const firstArray = Object.values(root).find((value) => Array.isArray(value));
    entries = Array.isArray(firstArray)
      ? firstArray.map((record) => ({ record, href: recordHref(asRecord(record)) }))
      : [];
  }

  const seen = new Set<string>();

  return entries.map(({ record, href }, index) => {
    const fields = asRecord(record);
    const id = typeof fields?.id === "number" ? fields.id : undefined;
    const base = id !== undefined ? String(id) : (href ?? String(index));
    // Keys must be unique even when an index repeats an id or href.
    const key = seen.has(base) ? `${base}-${index}` : base;
    seen.add(key);
    return { key, id, label: summarizeEntry(record), href };
  });
};

export type LinkRecord = {
  key: string;
  label: string;
  href: string;
};

/**
 * Some indexes (e.g. `/quest/index`) carry no records, only links to sibling
 * indexes: `{ _links, categories: { href }, areas: { href } }`. Those links
 * are the response's content, so the overview lists them instead.
 */
export const extractLinkRecords = (data: unknown): LinkRecord[] => {
  const root = asRecord(data);
  if (!root) {
    return [];
  }

  return Object.entries(root).flatMap(([key, value]) => {
    if (key === "_links") {
      return [];
    }
    const href = plainHref(value);
    return href ? [{ key, label: humanizeEnum(key), href }] : [];
  });
};

/**
 * The workbench link for a raw Blizzard href, when a family endpoint's path
 * template matches it (path values are carried over as parameters).
 */
export const workbenchLinkForHref = (
  family: ApiFamilyConfig,
  href: string,
): string | undefined => {
  // Literal templates first, so "/quest/category/index" opens the category
  // index rather than "/quest/category/{questCategoryId}" with id "index".
  const candidates = [...family.endpoints].sort(
    (left, right) =>
      Number(left.path.includes("{")) - Number(right.path.includes("{")),
  );
  for (const endpoint of candidates) {
    const match = matchPathTemplate(endpoint.path, href);
    if (!match) {
      continue;
    }
    const usable = Object.entries(match).every(
      ([key, value]) =>
        value !== "index" && (!/Id$/.test(key) || /^\d+$/.test(value)),
    );
    if (usable) {
      return workbenchLink(family, endpoint, match);
    }
  }
  return undefined;
};
