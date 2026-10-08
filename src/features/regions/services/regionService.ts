import type { WowTokenPrice } from "@/features/search/services/tokenService";
import type {
  LocalizedString,
  MakeupEntry,
  Region,
  RegionRealmCounts,
  RegionRealmMakeup,
  RegionRecord,
} from "@/features/regions/types";
import { blizzardClient } from "@/lib/blizzardClient";
import { localized, optional404 } from "@/lib/blizzardHelpers";
import { formatLocale, humanizeEnum, toBcp47 } from "@/lib/format";

/*
 * Blizzard's API has no global list of regions: each regional host only
 * knows itself, so `region/index` in `dynamic-eu` lists exactly one entry
 * (Europe, id 3). Every request here therefore names its region's
 * namespace explicitly (`dynamic-kr`, …) instead of `namespace("dynamic")`,
 * which always means the app's own region; the proxy routes each namespace
 * to its regional host.
 *
 *   region/index -> region/{id}      name, tag, patch_string
 *   token/index                      price in copper, last update
 *   connected-realm/index            one href per connected realm
 *   realm/index                      every realm record (internal ones too)
 *   search/connected-realm           every connected realm with its realms'
 *                                    zone, locale, ruleset and population
 *
 * The first four are a few KB each (the realm index ~47 KB on US). The search
 * is one request per region but ~350 KB on US and EU (every name in twelve
 * locales), so the page only asks for it once its tables near the viewport.
 */

/** `dynamic-eu` for `eu`: the namespace (and so the host) of one region. */
const dynamicNamespace = (region: Region): string => `dynamic-${region}`;

type Href = { href?: string };

type RegionIndexResponse = {
  regions?: Href[];
};

type RegionResponse = {
  id: number;
  name?: LocalizedString;
  tag?: string;
  patch_string?: string;
};

type TokenResponse = {
  price: number;
  last_updated_timestamp: number;
};

type ConnectedRealmIndexResponse = {
  connected_realms?: Href[];
};

type RealmIndexResponse = {
  realms?: Array<{ id?: number }>;
};

type SearchRealm = {
  id: number;
  timezone?: string;
  locale?: string;
  is_tournament?: boolean;
  category?: LocalizedString;
  type?: { type?: string; name?: LocalizedString };
};

type SearchConnectedRealm = {
  id: number;
  has_queue?: boolean;
  status?: { type?: string; name?: LocalizedString };
  population?: { type?: string; name?: LocalizedString };
  realms?: SearchRealm[];
};

type ConnectedRealmSearchResponse = {
  pageCount?: number;
  results?: Array<{ data?: SearchConnectedRealm }>;
};

const REGION_ID = /\/region\/(\d+)/u;

/**
 * The region's own record. Its index lists exactly one region today; a
 * region that lists none, or whose record is gone (404), resolves to `null`
 * and the page says so instead of retrying a missing record.
 */
export const fetchRegionRecord = async (
  region: Region,
  signal?: AbortSignal,
): Promise<RegionRecord | null> => {
  const params = { namespace: dynamicNamespace(region) };
  const index = await optional404(() =>
    blizzardClient.get<RegionIndexResponse>("/data/wow/region/index", params, {
      signal,
    }),
  );
  const regionId = (index?.regions ?? [])
    .map((entry) => Number(REGION_ID.exec(entry.href ?? "")?.[1]))
    .find((id) => Number.isInteger(id) && id > 0);
  if (regionId === undefined) {
    return null;
  }

  const record = await optional404(() =>
    blizzardClient.get<RegionResponse>(`/data/wow/region/${regionId}`, params, {
      signal,
    }),
  );
  if (!record) {
    return null;
  }

  const tag = record.tag?.trim() || region.toUpperCase();
  return {
    id: record.id,
    region,
    name: localized(record.name) || tag,
    tag,
    patch: record.patch_string?.trim() || undefined,
  };
};

/**
 * The region's WoW Token price. Same shape as the home ticker's
 * `fetchWowTokenPrice` (which can only ask the app's own region), because
 * both share one cache entry for that region; a 404 is an error here too,
 * since every region sells the token.
 */
export const fetchRegionTokenPrice = async (
  region: Region,
  signal?: AbortSignal,
): Promise<WowTokenPrice> => {
  const response = await blizzardClient.get<TokenResponse>(
    "/data/wow/token/index",
    { namespace: dynamicNamespace(region) },
    { signal },
  );

  return {
    price: response.price,
    lastUpdated: new Date(response.last_updated_timestamp),
  };
};

/** Connected realms and realm records, from the two indexes in parallel. */
export const fetchRegionRealmCounts = async (
  region: Region,
  signal?: AbortSignal,
): Promise<RegionRealmCounts> => {
  const params = { namespace: dynamicNamespace(region) };
  const [connected, realms] = await Promise.all([
    blizzardClient.get<ConnectedRealmIndexResponse>(
      "/data/wow/connected-realm/index",
      params,
      { signal },
    ),
    blizzardClient.get<RealmIndexResponse>("/data/wow/realm/index", params, {
      signal,
    }),
  ]);

  return {
    connectedRealms: (connected.connected_realms ?? []).length,
    realms: (realms.realms ?? []).length,
  };
};

/* ------------------------------------------------------------------ */
/* Realm makeup                                                        */
/* ------------------------------------------------------------------ */

/**
 * Requested page size; Blizzard answers every region in one page today (92
 * connected realms on EU), and the loop trusts the response's `pageCount`,
 * so a smaller server cap only costs extra requests.
 */
const SEARCH_PAGE_SIZE = 1000;
/** Safety ceiling: hitting it before `pageCount` is an error, never a silent cut. */
const MAX_SEARCH_PAGES = 20;

/** Densest first; "New Players" is Blizzard's newer name for Recommended. */
const POPULATION_ORDER = [
  "LOCKED",
  "FULL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "RECOMMENDED",
  "NEW_PLAYERS",
];

const populationRank = (key: string): number => {
  const index = POPULATION_ORDER.indexOf(key);
  return index === -1 ? POPULATION_ORDER.length : index;
};

/** Tallies by key, remembering the first label seen for each. */
class Tally {
  private readonly entries = new Map<string, MakeupEntry>();

  add(key: string | undefined, label: string): void {
    if (!key) {
      return;
    }
    const entry = this.entries.get(key);
    if (entry) {
      entry.count += 1;
    } else {
      this.entries.set(key, { key, label: label || key, count: 1 });
    }
  }

  /** Most first, then by label, so equal counts keep a stable order. */
  byCount(): MakeupEntry[] {
    return [...this.entries.values()].sort(
      (left, right) =>
        right.count - left.count ||
        left.label.localeCompare(right.label, undefined, { sensitivity: "base" }),
    );
  }

  byRank(rank: (key: string) => number): MakeupEntry[] {
    return [...this.entries.values()].sort(
      (left, right) => rank(left.key) - rank(right.key) || right.count - left.count,
    );
  }
}

const summarizeMakeup = (
  connectedRealms: SearchConnectedRealm[],
): RegionRealmMakeup => {
  const population = new Tally();
  const timezones = new Tally();
  const languages = new Tally();
  const categories = new Tally();
  const rulesets = new Tally();
  // A realm belongs to one connected realm, but count ids, not rows, in
  // case the search ever repeats one.
  const realmIds = new Set<number>();
  const tournamentIds = new Set<number>();
  let down = 0;
  let queued = 0;

  connectedRealms.forEach((connected) => {
    const populationType = connected.population?.type;
    population.add(
      populationType,
      localized(connected.population?.name) || humanizeEnum(populationType),
    );
    if (connected.status?.type === "DOWN") {
      down += 1;
    }
    if (connected.has_queue === true) {
      queued += 1;
    }

    (connected.realms ?? []).forEach((realm) => {
      if (realmIds.has(realm.id)) {
        return;
      }
      realmIds.add(realm.id);
      if (realm.is_tournament === true) {
        tournamentIds.add(realm.id);
      }
      // Labels for zones are formatted by the page (their UTC offset moves
      // with daylight saving), so the zone itself is the label here.
      timezones.add(realm.timezone, realm.timezone ?? "");
      languages.add(realm.locale, formatLocale(realm.locale));
      const category = localized(realm.category);
      categories.add(category, category);
      const rulesetType = realm.type?.type;
      rulesets.add(
        rulesetType,
        localized(realm.type?.name) || humanizeEnum(rulesetType),
      );
    });
  });

  return {
    connectedRealms: connectedRealms.length,
    realms: realmIds.size,
    population: population.byRank(populationRank),
    timezones: timezones.byCount(),
    languages: languages.byCount(),
    categories: categories.byCount(),
    rulesets: rulesets.byCount(),
    down,
    queued,
    tournamentRealms: tournamentIds.size,
  };
};

/**
 * Every connected realm in the region from the paged search endpoint
 * (one request today), reduced to tallies. A 404 reads as "none listed";
 * every other failure propagates so the app-wide retry policy handles it.
 */
export const fetchRegionRealmMakeup = async (
  region: Region,
  signal?: AbortSignal,
): Promise<RegionRealmMakeup> => {
  // Keyed by id: search paging is only stable with an explicit `orderby`.
  const byId = new Map<number, SearchConnectedRealm>();

  for (let page = 1; page <= MAX_SEARCH_PAGES; page += 1) {
    const response = await optional404(() =>
      blizzardClient.get<ConnectedRealmSearchResponse>(
        "/data/wow/search/connected-realm",
        {
          namespace: dynamicNamespace(region),
          orderby: "id",
          _pageSize: SEARCH_PAGE_SIZE,
          _page: page,
        },
        { signal },
      ),
    );

    const results = response?.results ?? [];
    results.forEach(({ data }) => {
      if (data && typeof data.id === "number" && !byId.has(data.id)) {
        byId.set(data.id, data);
      }
    });

    if (results.length === 0 || page >= (response?.pageCount ?? 1)) {
      return summarizeMakeup([...byId.values()]);
    }
  }

  throw new Error(
    `The ${region.toUpperCase()} connected-realm search did not finish within ${MAX_SEARCH_PAGES} pages`,
  );
};

/* ------------------------------------------------------------------ */
/* Links                                                               */
/* ------------------------------------------------------------------ */

/** Blizzard's own realm status page for a region, in the app locale. */
export const realmStatusUrl = (region: Region, locale: string): string =>
  `https://worldofwarcraft.blizzard.com/${toBcp47(
    locale,
  ).toLowerCase()}/game/status/${region}`;
