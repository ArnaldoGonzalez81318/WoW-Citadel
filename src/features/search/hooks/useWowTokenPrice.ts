import { useQuery } from "@tanstack/react-query"
import { fetchWowTokenPrice, WowTokenPrice } from "@/features/search/services/tokenService"
import { env } from "@/lib/env"

export const useWowTokenPrice = () =>
  useQuery<WowTokenPrice, Error>({
    queryKey: ["wow-token-price", env.region],
    queryFn: fetchWowTokenPrice,
    staleTime: 1000 * 60 * 10,
    refetchInterval: 1000 * 60 * 5,
  })
