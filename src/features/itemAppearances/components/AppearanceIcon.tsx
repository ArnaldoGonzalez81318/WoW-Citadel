import { useQuery } from "@tanstack/react-query";

import MediaTile from "@/components/common/MediaTile";
import type { MediaTileSize } from "@/components/common/MediaTile";
import { itemIconQuery } from "@/features/itemAppearances/hooks/appearanceQueries";
import type { FetchPriority } from "@/features/itemAppearances/services/priorityLimiter";
import type { Appearance } from "@/features/itemAppearances/types";

export type AppearanceIconProps = {
  /** The look to draw; undefined while its record loads, null when there is none. */
  appearance: Appearance | null | undefined;
  /** Its record (or the record before it) is still loading. */
  loading: boolean;
  /** For the letter shown when there is no icon. */
  fallbackLabel: string;
  size?: MediaTileSize;
  /** WoW item quality, when the caller knows it; tints the border. */
  quality?: string;
  /** "dialog" inside a dialog, so its icons never wait behind the grid's. */
  priority?: FetchPriority;
};

/**
 * A look's picture: Blizzard serves no render of an appearance, so it is
 * the inventory icon of the first item that wears it, from the Items
 * explorer's cache. A look with no items (or an icon Blizzard lacks) keeps
 * its letter. Always decorative: the name sits beside it.
 */
const AppearanceIcon = ({
  appearance,
  loading,
  fallbackLabel,
  size = 56,
  quality,
  priority = "card",
}: AppearanceIconProps): JSX.Element => {
  const itemId = appearance?.items[0]?.id;
  const iconQuery = useQuery({
    ...itemIconQuery(itemId ?? 0, priority),
    enabled: itemId !== undefined,
  });
  return (
    <MediaTile
      size={size}
      src={iconQuery.data ?? null}
      alt=""
      fallbackLabel={fallbackLabel}
      quality={quality}
      loading={loading || (itemId !== undefined && iconQuery.isPending)}
    />
  );
};

export default AppearanceIcon;
