import { useQuery } from "@tanstack/react-query";
import { fetchConnectedRealmSnapshots } from "@/features/connectedRealms/services/connectedRealmService";
import { env } from "@/lib/env";

export const useConnectedRealmSnapshots = (limit = 12) =>
  useQuery({
    queryKey: ["connected-realms", limit, env.region],
    queryFn: () => fetchConnectedRealmSnapshots(limit),
    staleTime: 1000 * 60 * 5,
  });
