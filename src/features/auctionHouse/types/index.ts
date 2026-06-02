export type LinkReference = {
  href: string;
};

export type LocalizedString = string | { [locale: string]: string | undefined };

export type AuctionItemReference = {
  id: number;
  context?: number;
  bonus_lists?: number[];
  pet_breed_id?: number;
  pet_level?: number;
  pet_quality_id?: number;
  pet_species_id?: number;
};

export type AuctionListing = {
  id: number;
  item: AuctionItemReference;
  quantity: number;
  time_left: string;
  buyout?: number;
  unit_price?: number;
};

export type AuctionHouseResponse = {
  connected_realm?: LinkReference;
  auctions: AuctionListing[];
};

export type AuctionItemSummary = {
  id: number;
  href: string;
  name: string;
  quality?: string;
  itemClass?: string;
  itemSubclass?: string;
  inventoryType?: string;
};
