import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import MediaTile from "@/components/common/MediaTile";
import { reagentIconQuery } from "@/features/modifiedCrafting/hooks/modifiedCraftingQueries";
import type { ReagentItem } from "@/features/modifiedCrafting/types";

export type ReagentIconProps = {
  /** The reagent to picture; undefined while its category's items load or when it has none. */
  item: ReagentItem | undefined;
  /** False until the owner nears the viewport. */
  enabled: boolean;
  /** Something upstream (the record, the item search) is still loading. */
  loading?: boolean;
  size?: 40 | 56;
  /** Drawn when there is no reagent to picture; a letter tile otherwise. */
  fallback?: ReactNode;
  /** The letter tile's source when there is no `fallback`. */
  fallbackLabel: string;
};

/**
 * A reagent's icon, its border tinted by the item's quality. Decorative:
 * every place that shows one names the reagent or its category beside it.
 */
const ReagentIcon = ({
  item,
  enabled,
  loading = false,
  size = 56,
  fallback,
  fallbackLabel,
}: ReagentIconProps): JSX.Element => {
  const icon = useQuery({
    ...reagentIconQuery(item?.id ?? 0),
    enabled: enabled && item !== undefined,
  });
  if (!item && !loading && fallback) {
    return <>{fallback}</>;
  }
  return (
    <MediaTile
      src={icon.data ?? null}
      alt=""
      size={size}
      fallbackLabel={item?.name ?? fallbackLabel}
      quality={item?.quality ?? null}
      loading={loading || (item !== undefined && enabled && icon.isPending)}
    />
  );
};

export default ReagentIcon;
