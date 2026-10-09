/** The WoW Token price, as every token view reads it (see `fetchRegionTokenPrice`). */
export type WowTokenPrice = {
  /** Price in copper (always a whole-gold multiple). */
  price: number;
  lastUpdated: Date;
};
