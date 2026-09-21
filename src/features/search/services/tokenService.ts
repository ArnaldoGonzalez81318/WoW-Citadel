import { blizzardClient } from "@/lib/blizzardClient";
import { namespace } from "@/lib/blizzardHelpers";

export type WowTokenPrice = {
  /** Price in copper (always a whole-gold multiple). */
  price: number;
  lastUpdated: Date;
};

type WowTokenResponse = {
  price: number;
  last_updated_timestamp: number;
};

export type FetchWowTokenPriceOptions = {
  signal?: AbortSignal;
};

export const fetchWowTokenPrice = async ({
  signal,
}: FetchWowTokenPriceOptions = {}): Promise<WowTokenPrice> => {
  const response = await blizzardClient.get<WowTokenResponse>(
    "/data/wow/token/index",
    { namespace: namespace("dynamic") },
    { signal },
  );

  return {
    price: response.price,
    lastUpdated: new Date(response.last_updated_timestamp),
  };
};
