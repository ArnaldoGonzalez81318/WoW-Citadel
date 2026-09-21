import { blizzardClient } from "@/lib/blizzardClient";
import { localized, namespace, optional404 } from "@/lib/blizzardHelpers";
import type { LocalizedString } from "@/lib/blizzardHelpers";
import type { RealmDetail, RealmSummary } from "@/features/realms/types";

type RealmSearchResponse<T> = {
  page?: number;
  pageSize?: number;
  pageCount?: number;
  results?: Array<{
    key: { href: string };
    data: T;
  }>;
};

type RealmSearchEntry = {
  id: number;
  name: LocalizedString;
  slug: string;
  timezone?: string;
  category?: LocalizedString;
  locale?: string;
  is_tournament?: boolean;
  type?: { type?: string; name?: LocalizedString };
  region?: { name?: LocalizedString };
  connected_realm?: { href?: string; id?: number };
};

/** Never page past this: the whole region fits in one 1000-row page. */
const MAX_SEARCH_PAGES = 3;
const SEARCH_PAGE_SIZE = 1000;

const CONNECTED_REALM_ID_PATTERN = /connected-realm\/(\d+)/;

const connectedRealmIdFrom = (
  entry: RealmSearchEntry["connected_realm"],
): number | undefined => {
  if (typeof entry?.id === "number" && entry.id > 0) {
    return entry.id;
  }

  const parsed = Number(
    CONNECTED_REALM_ID_PATTERN.exec(entry?.href ?? "")?.[1],
  );
  return parsed > 0 ? parsed : undefined;
};

const toRealmSummary = (
  key: { href: string },
  data: RealmSearchEntry,
): RealmSummary => ({
  id: data.id,
  name: localized(data.name),
  slug: data.slug,
  href: key.href,
  timezone: data.timezone,
  category: localized(data.category) || undefined,
  typeName: localized(data.type?.name) || undefined,
  typeCode: data.type?.type,
  regionName: localized(data.region?.name) || undefined,
  locale: data.locale,
  isTournament: data.is_tournament,
  connectedRealmId: connectedRealmIdFrom(data.connected_realm),
  connectedRealmHref: data.connected_realm?.href,
});

/**
 * Every realm in the region with ruleset, category, time zone, locale and
 * connected-realm id, from the search endpoint (typically one request;
 * never more than three). Sorted by name client-side because Blizzard's
 * `orderby` on localized fields is unreliable.
 */
export const fetchAllRealms = async (
  signal?: AbortSignal,
): Promise<RealmSummary[]> => {
  // Keyed by id: Blizzard's search paging is only stable with an explicit
  // `orderby`; without it pages overlap and realms go missing, so the order
  // is pinned and duplicates are dropped defensively.
  const realmsById = new Map<number, RealmSummary>();

  for (let page = 1; page <= MAX_SEARCH_PAGES; page += 1) {
    const response = await optional404(() =>
      blizzardClient.get<RealmSearchResponse<RealmSearchEntry>>(
        "/data/wow/search/realm",
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
    results.forEach(({ key, data }) => {
      if (data && typeof data.id === "number" && data.slug && !realmsById.has(data.id)) {
        realmsById.set(data.id, toRealmSummary(key, data));
      }
    });

    const pageCount = response?.pageCount ?? 1;
    if (results.length === 0 || page >= pageCount) {
      break;
    }
  }

  return [...realmsById.values()].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
  );
};

/** Blizzard-internal entries (development category, account/test realms). */
export const isInternalRealm = (realm: RealmSummary): boolean =>
  realm.category?.toLowerCase() === "development" ||
  /account-realm|^rdb-|^test/i.test(realm.slug);

export const fetchRealmDetail = async (
  realmSlug: string,
  signal?: AbortSignal,
): Promise<RealmDetail> => {
  const response = await blizzardClient.get<{
    _links: { self: { href: string } };
    id: number;
    name: string;
    slug: string;
    category: string;
    timezone: string;
    locale: string;
    type: { name: string };
    region: { name: string };
    is_tournament: boolean;
    connected_realm?: { href?: string };
  }>(
    `/data/wow/realm/${realmSlug}`,
    { namespace: namespace("dynamic") },
    { signal },
  );

  return {
    id: response.id,
    name: response.name,
    slug: response.slug,
    category: response.category,
    timezone: response.timezone,
    locale: response.locale,
    typeName: response.type.name,
    regionName: response.region.name,
    isTournament: response.is_tournament,
    connectedRealmHref: response.connected_realm?.href,
    href: response._links.self.href,
  };
};
