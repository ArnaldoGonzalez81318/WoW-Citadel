import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { shouldRetrySearch } from "@/features/search/hooks/useBlizzardSearch";
import { fetchWowTokenPrice } from "@/features/search/services/tokenService";
import type { WowTokenPrice } from "@/features/search/services/tokenService";
import { env } from "@/lib/env";

/** Polling interval; every "auto-refreshes every N min" copy reads this. */
export const TOKEN_REFRESH_MINUTES = 5;

const REFETCH_INTERVAL_MS = TOKEN_REFRESH_MINUTES * 60_000;
/** Shorter than the interval so a window-focus refetch actually fires. */
const STALE_TIME_MS = 4 * 60_000;

export const WOW_TOKEN_QUERY_KEY = ["wow-token-price", env.region] as const;

export const useWowTokenPrice = (): UseQueryResult<WowTokenPrice> =>
  useQuery<WowTokenPrice>({
    queryKey: WOW_TOKEN_QUERY_KEY,
    queryFn: ({ signal }) => fetchWowTokenPrice({ signal }),
    staleTime: STALE_TIME_MS,
    refetchInterval: REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: true,
    retry: shouldRetrySearch,
  });

export default useWowTokenPrice;
