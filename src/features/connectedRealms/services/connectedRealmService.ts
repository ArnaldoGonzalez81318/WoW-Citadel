import type { ChipProps } from "@mui/material";
import { blizzardClient, BlizzardRequestError } from "@/lib/blizzardClient";
import {
  localized,
  mapWithConcurrency,
  namespace,
  optional404,
} from "@/lib/blizzardHelpers";
import { humanizeEnum } from "@/lib/format";
import type {
  ConnectedRealm,
  ConnectedRealmCatalog,
  ConnectedRealmIndexResponse,
  ConnectedRealmMember,
  ConnectedRealmSearchEntry,
  ConnectedRealmSnapshot,
  RealmPopulationType,
  RealmReference,
  RealmStatusType,
} from "@/features/connectedRealms/types";

export type { ConnectedRealmSnapshot } from "@/features/connectedRealms/types";

type ConnectedRealmSearchResponse = {
  page?: number;
  pageSize?: number;
  pageCount?: number;
  results?: Array<{
    key: { href: string };
    data: ConnectedRealmSearchEntry;
  }>;
};

/**
 * Requested page size; Blizzard answers with its own `pageSize` (1000 is
 * accepted today, but the loop trusts the response's `pageCount`, so a
 * smaller cap only costs extra requests).
 */
const SEARCH_PAGE_SIZE = 1000;
/** Safety ceiling: hitting it before `pageCount` is an error, never a silent cut. */
const MAX_SEARCH_PAGES = 20;
const DETAIL_CONCURRENCY = 6;
const SHORT_LABEL_NAMES = 3;

const extractRealmId = (href: string): number | null => {
  const match = /connected-realm\/(\d+)/i.exec(href);
  return match ? Number.parseInt(match[1], 10) : null;
};

const uniqueStrings = (values: Array<string | undefined>): string[] =>
  Array.from(
    new Set(
      values.filter((value): value is string =>
        Boolean(value && value.length > 0),
      ),
    ),
  );

const normalizeRealm = (realm: RealmReference): ConnectedRealmMember => ({
  id: realm.id,
  slug: realm.slug,
  name: localized(realm.name) || realm.slug,
  timezone: realm.timezone,
  type: localized(realm.type?.name),
  typeCode: realm.type?.type,
  category: localized(realm.category),
  locale: realm.locale,
});

const compareNames = (left: string, right: string): number =>
  left.localeCompare(right, undefined, { sensitivity: "base" });

/** Flattens one connected-realm record into the shape the UI consumes. */
export const toSnapshot = (realm: ConnectedRealm): ConnectedRealmSnapshot => {
  const realmDetails = (realm.realms ?? [])
    .map(normalizeRealm)
    .sort((left, right) => compareNames(left.name, right.name));
  const realmNames = realmDetails.map((detail) => detail.name);
  const leadName = realmNames[0] ?? `Connected realm #${realm.id}`;
  const shortLabel =
    realmNames.length > SHORT_LABEL_NAMES
      ? `${realmNames.slice(0, SHORT_LABEL_NAMES).join(", ")} +${
          realmNames.length - SHORT_LABEL_NAMES
        }`
      : realmNames.join(", ") || leadName;
  const statusType = realm.status?.type;
  const populationType = realm.population?.type;

  return {
    ...realm,
    realmDetails,
    displayName: realmNames.join(", "),
    leadName,
    shortLabel,
    realmSlugs: realmDetails.map((detail) => detail.slug),
    realmTypes: uniqueStrings(
      realmDetails.map((detail) => detail.type || detail.category),
    ),
    timezones: uniqueStrings(realmDetails.map((detail) => detail.timezone)),
    populationLabel:
      humanizeEnum(populationType) ||
      localized(realm.population?.name) ||
      undefined,
    statusLabel:
      humanizeEnum(statusType) || localized(realm.status?.name) || undefined,
    statusType,
    populationType,
  };
};

export const fetchConnectedRealmIndex = (
  signal?: AbortSignal,
): Promise<ConnectedRealmIndexResponse> =>
  blizzardClient.get<ConnectedRealmIndexResponse>(
    "/data/wow/connected-realm/index",
    { namespace: namespace("dynamic") },
    { signal },
  );

export const fetchConnectedRealm = (
  connectedRealmId: number,
  signal?: AbortSignal,
): Promise<ConnectedRealm> =>
  blizzardClient.get<ConnectedRealm>(
    `/data/wow/connected-realm/${connectedRealmId}`,
    { namespace: namespace("dynamic") },
    { signal },
  );

const searchConnectedRealms = async (
  signal?: AbortSignal,
): Promise<ConnectedRealm[]> => {
  // Keyed by id: search paging is only stable with an explicit `orderby`.
  const recordsById = new Map<number, ConnectedRealm>();

  for (let page = 1; page <= MAX_SEARCH_PAGES; page += 1) {
    const response = await optional404(() =>
      blizzardClient.get<ConnectedRealmSearchResponse>(
        "/data/wow/search/connected-realm",
        {
          namespace: namespace("dynamic"),
          orderby: "id",
          _pageSize: SEARCH_PAGE_SIZE,
          _page: page,
        },
        { signal },
      ),
    );

    const results = response?.results ?? [];
    results.forEach(({ data }) => {
      if (data && typeof data.id === "number" && !recordsById.has(data.id)) {
        recordsById.set(data.id, data);
      }
    });

    const pageCount = response?.pageCount ?? 1;
    if (results.length === 0 || page >= pageCount) {
      return [...recordsById.values()];
    }
  }

  throw new Error(
    `Connected-realm search did not finish within ${MAX_SEARCH_PAGES} pages`,
  );
};

/**
 * Index + one detail request per cluster with settled results: a 404/204
 * skips the cluster silently, any other failure is skipped but counted so
 * one bad cluster never blanks the page.
 */
const fetchCatalogFromIndex = async (
  signal?: AbortSignal,
): Promise<ConnectedRealmCatalog> => {
  const index = await fetchConnectedRealmIndex(signal);
  const ids = (index.connected_realms ?? [])
    .map((entry) => extractRealmId(entry.href))
    .filter((id): id is number => typeof id === "number");

  const results = await mapWithConcurrency(
    ids,
    DETAIL_CONCURRENCY,
    (id) => fetchConnectedRealm(id, signal),
    signal,
  );

  const snapshots: ConnectedRealmSnapshot[] = [];
  let failedCount = 0;

  results.forEach((result) => {
    if (result.status === "fulfilled") {
      if (result.value) {
        snapshots.push(toSnapshot(result.value));
      }
      return;
    }

    const reason: unknown = result.reason;
    if (reason instanceof BlizzardRequestError && reason.isNotFound) {
      return;
    }
    failedCount += 1;
  });

  return { snapshots, failedCount };
};

const sortSnapshots = (
  snapshots: ConnectedRealmSnapshot[],
): ConnectedRealmSnapshot[] =>
  snapshots.sort((left, right) => compareNames(left.leadName, right.leadName));

/**
 * Every connected realm in the region from the paged search endpoint
 * (typically one request). Falls back to the index + per-cluster details when the search
 * endpoint is unavailable or empty.
 */
export const fetchConnectedRealmCatalog = async (
  signal?: AbortSignal,
): Promise<ConnectedRealmCatalog> => {
  const searched = await searchConnectedRealms(signal);

  if (searched.length > 0) {
    return {
      snapshots: sortSnapshots(searched.map(toSnapshot)),
      failedCount: 0,
    };
  }

  const fallback = await fetchCatalogFromIndex(signal);
  return {
    snapshots: sortSnapshots(fallback.snapshots),
    failedCount: fallback.failedCount,
  };
};

/* ------------------------------------------------------------------ */
/* Status / population presentation                                    */
/* ------------------------------------------------------------------ */

export type RealmChipColor = NonNullable<ChipProps["color"]>;

export const statusChipColor = (type?: RealmStatusType): RealmChipColor => {
  if (type === "UP") {
    return "success";
  }
  if (type === "DOWN") {
    return "error";
  }
  return "default";
};

const POPULATION_CHIP_COLORS: Record<string, RealmChipColor> = {
  LOW: "default",
  MEDIUM: "info",
  HIGH: "warning",
  FULL: "error",
  LOCKED: "error",
  RECOMMENDED: "success",
  NEW_PLAYERS: "success",
};

export const populationChipColor = (
  type?: RealmPopulationType,
): RealmChipColor => POPULATION_CHIP_COLORS[type ?? ""] ?? "default";

export const populationHint =
  "Blizzard's current login population tier for this realm group";
