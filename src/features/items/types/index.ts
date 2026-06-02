export type LinkReference = {
  href: string;
};

export type LocalizedString = string | { [locale: string]: string | undefined };

export type ItemClassSummary = {
  id: number;
  name: string;
  key: LinkReference;
};

export type ItemClassIndexResponse = {
  item_classes: ItemClassSummary[];
};

export type ItemSubclassSummary = {
  id: number;
  name: string;
  key: LinkReference;
};

export type ItemClassDetail = {
  class_id: number;
  name: string;
  item_subclasses?: ItemSubclassSummary[];
};

export type ItemDetail = {
  id: number;
  name: string;
  href: string;
  description?: string;
  quality?: string;
  level?: number;
  requiredLevel?: number;
  itemClass?: string;
  itemSubclass?: string;
  inventoryType?: string;
  binding?: string;
  isEquippable?: boolean;
  maxCount?: number;
  purchasePrice?: number;
  sellPrice?: number;
};
