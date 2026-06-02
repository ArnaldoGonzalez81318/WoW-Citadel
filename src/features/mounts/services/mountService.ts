import { env } from "@/lib/env";
import { blizzardClient, BlizzardRequestError } from "@/lib/blizzardClient";
import {
  LocalizedString,
  MountDetail,
  MountIndexResponse,
  MountSummary,
} from "@/features/mounts/types";

type SearchResponse<T> = {
  results?: Array<{
    key: { href: string };
    data: T;
  }>;
};

export type MountGalleryPage = {
  mounts: MountSummary[];
  page: number;
  pageCount: number;
};

type MountSearchEntry = {
  id: number;
  name: LocalizedString;
  description?: LocalizedString;
  source?: { name?: LocalizedString };
  creature_displays?: Array<{ id: number }>;
};

const STATIC_NAMESPACE = `static-${env.region}`;

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

export const fetchMountIndex = async (): Promise<MountSummary[]> => {
  const response = await blizzardClient.get<MountIndexResponse>(
    "/data/wow/mount/index",
    {
      namespace: STATIC_NAMESPACE,
    },
  );

  return (response.mounts ?? []).map((mount) => ({
    id: mount.id,
    name: mount.name,
    href: mount.key.href,
  }));
};

export const fetchMountGalleryPage = async (
  page: number,
  pageSize = 24,
): Promise<MountGalleryPage> => {
  const response = await blizzardClient.get<MountIndexResponse>(
    "/data/wow/mount/index",
    {
      namespace: STATIC_NAMESPACE,
    },
  );

  const mounts = (response.mounts ?? []).map((mount) => ({
    id: mount.id,
    name: mount.name,
    href: mount.key.href,
  }));

  const pageCount = Math.max(1, Math.ceil(mounts.length / pageSize));
  const normalizedPage = Math.min(Math.max(page, 1), pageCount);
  const startIndex = (normalizedPage - 1) * pageSize;

  return {
    page: normalizedPage,
    pageCount,
    mounts: mounts.slice(startIndex, startIndex + pageSize),
  };
};

export const searchMountsDetailed = async (
  query: string,
  pageSize = 12,
): Promise<MountSummary[]> => {
  if (!query.trim()) {
    return [];
  }

  return safeSearch(async () => {
    const response = await blizzardClient.get<SearchResponse<MountSearchEntry>>(
      "/data/wow/search/mount",
      {
        namespace: STATIC_NAMESPACE,
        orderby: "id:desc",
        _pageSize: pageSize,
        [`name.${env.locale}`]: query.trim(),
      },
    );

    return (response.results ?? []).map(({ key, data }) => ({
      id: data.id,
      name: localized(data.name),
      description: localized(data.description),
      source: localized(data.source?.name),
      href: key.href,
      displayId: data.creature_displays?.[0]?.id,
    }));
  });
};

export const fetchMountDetail = async (
  mountId: number,
): Promise<MountDetail> => {
  const response = await blizzardClient.get<{
    _links: { self: { href: string } };
    id: number;
    name: string;
    description?: string;
    source?: { name?: string };
    creature_displays?: Array<{ id: number }>;
  }>(`/data/wow/mount/${mountId}`, {
    namespace: STATIC_NAMESPACE,
  });

  return {
    id: response.id,
    name: response.name,
    description: response.description ?? "",
    source: response.source?.name,
    href: response._links.self.href,
    displayId: response.creature_displays?.[0]?.id,
  };
};

export const fetchCreatureDisplayImage = async (
  displayId: number,
): Promise<string | undefined> => {
  try {
    const response = await blizzardClient.get<{
      assets?: Array<{ key: string; value: string }>;
    }>(`/data/wow/media/creature-display/${displayId}`, {
      namespace: STATIC_NAMESPACE,
    });

    return response.assets?.[0]?.value;
  } catch (error) {
    if (
      error instanceof BlizzardRequestError &&
      (error.status === 404 || error.status === 204)
    ) {
      return undefined;
    }

    throw error;
  }
};
