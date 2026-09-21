import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { fetchConnectedRealmCatalog } from "@/features/connectedRealms/services/connectedRealmService";
import type { ConnectedRealmCatalog } from "@/features/connectedRealms/types";
import { env } from "@/lib/env";

const CATALOG_STALE_TIME = 30 * 60_000;

export const connectedRealmCatalogQueryKey = (): readonly [
  "connected-realm-catalog",
  string,
  string,
] => ["connected-realm-catalog", env.region, env.locale] as const;

type UseConnectedRealmCatalogOptions = {
  enabled?: boolean;
};

/**
 * Every connected realm in the region, shared by the Realms directory, the
 * Connected Realms page and the Auction House realm picker.
 */
export const useConnectedRealmCatalog = ({
  enabled = true,
}: UseConnectedRealmCatalogOptions = {}): UseQueryResult<ConnectedRealmCatalog> =>
  useQuery({
    queryKey: connectedRealmCatalogQueryKey(),
    queryFn: ({ signal }) => fetchConnectedRealmCatalog(signal),
    enabled,
    staleTime: CATALOG_STALE_TIME,
    placeholderData: keepPreviousData,
  });

