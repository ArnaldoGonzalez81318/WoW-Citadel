import { env } from "@/lib/env";
import { blizzardClient, BlizzardRequestError } from "@/lib/blizzardClient";
import {
  LocalizedString,
  RealmDetail,
  RealmSummary,
} from "@/features/realms/types";

type SearchResponse<T> = {
  page?: number;
  pageSize?: number;
  pageCount?: number;
  results?: Array<{
    key: { href: string };
    data: T;
  }>;
};

type RealmIndexResponse = {
  realms?: Array<{
    id: number;
    name: string;
    slug: string;
    key: { href: string };
  }>;
};

type RealmSearchEntry = {
  id: number;
  name: LocalizedString;
  slug: string;
  timezone?: string;
  category?: LocalizedString;
  type?: { name?: LocalizedString };
  region?: { name?: LocalizedString };
};

const DYNAMIC_NAMESPACE = `dynamic-${env.region}`;

const localized = (value: LocalizedString | undefined): string => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return (
    value[env.locale] ??
    value.en_US ??
    Object.values(value).find(
      (entry) => typeof entry === "string" && entry.length > 0,
    ) ??
    ""
  );
};

const safeSearch = async <T>(fetcher: () => Promise<T>): Promise<T> => {
  try {
    return await fetcher();
  } catch (error) {
    if (
      error instanceof BlizzardRequestError &&
      (error.status === 404 || error.status === 204)
    ) {
      return [] as T;
    }

    throw error;
  }
};

export type RealmGalleryPage = {
  realms: RealmSummary[];
  page: number;
  pageCount: number;
};

export const fetchRealmIndex = async (): Promise<RealmSummary[]> => {
  const response = await blizzardClient.get<RealmIndexResponse>(
    "/data/wow/realm/index",
    {
      namespace: DYNAMIC_NAMESPACE,
    },
  );

  return (response.realms ?? []).map((realm) => ({
    id: realm.id,
    name: realm.name,
    slug: realm.slug,
    href: realm.key.href,
  }));
};

export const fetchRealmGalleryPage = async (
  page: number,
  pageSize = 24,
): Promise<RealmGalleryPage> => {
  const realms = await fetchRealmIndex();
  const pageCount = Math.max(1, Math.ceil(realms.length / pageSize));
  const normalizedPage = Math.min(Math.max(page, 1), pageCount);
  const startIndex = (normalizedPage - 1) * pageSize;

  return {
    page: normalizedPage,
    pageCount,
    realms: realms.slice(startIndex, startIndex + pageSize),
  };
};

export const searchRealmsDetailed = async (
  query: string,
  pageSize = 12,
): Promise<RealmSummary[]> => {
  if (!query.trim()) {
    return [];
  }

  return safeSearch(async () => {
    const response = await blizzardClient.get<SearchResponse<RealmSearchEntry>>(
      "/data/wow/search/realm",
      {
        namespace: DYNAMIC_NAMESPACE,
        _pageSize: pageSize,
        [`name.${env.locale}`]: query.trim(),
      },
    );

    return (response.results ?? []).map(({ key, data }) => ({
      id: data.id,
      name: localized(data.name),
      slug: data.slug,
      href: key.href,
      timezone: data.timezone,
      category: localized(data.category),
      typeName: localized(data.type?.name),
      regionName: localized(data.region?.name),
    }));
  });
};

export const fetchRealmDetail = async (
  realmSlug: string,
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
  }>(`/data/wow/realm/${realmSlug}`, {
    namespace: DYNAMIC_NAMESPACE,
  });

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
