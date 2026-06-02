import { blizzardClient } from "@/lib/blizzardClient";
import { env } from "@/lib/env";

export type WowTokenPrice = {
  price: number;
  lastUpdated: Date;
};

type WowTokenResponse = {
  price: number;
  last_updated_timestamp: number;
};

const namespace = `dynamic-${env.region}`;

export const fetchWowTokenPrice = async (): Promise<WowTokenPrice> => {
  const response = await blizzardClient.get<WowTokenResponse>(
    "/data/wow/token/index",
    {
      namespace,
    },
  );

  return {
    price: response.price,
    lastUpdated: new Date(response.last_updated_timestamp),
  };
};
