import { useQuery } from "@tanstack/react-query";

import LinkRow from "@/features/modifiedCrafting/components/LinkRow";
import ReagentIcon from "@/features/modifiedCrafting/components/ReagentIcon";
import {
  CARD_ITEM_PAGE_SIZE,
  categoryItemsQuery,
} from "@/features/modifiedCrafting/hooks/modifiedCraftingQueries";
import {
  categoryName,
  formatId,
  pluralize,
} from "@/features/modifiedCrafting/services/modifiedCraftingService";
import type { CategoryRef } from "@/features/modifiedCrafting/types";
import useNearViewport from "@/hooks/useNearViewport";

export type CategoryLinkRowProps = {
  category: CategoryRef;
  /** Slot types that accept it, once the slot-link map is whole; undefined hides it. */
  acceptedCount?: number;
  onOpen: (category: CategoryRef) => void;
};

/**
 * A category in a slot type's dialog: its newest reagent's icon (loaded as
 * the row scrolls near), name and id, and how widely it is accepted when
 * the slot-link map is known. Opens the category in the same dialog.
 */
const CategoryLinkRow = ({ category, acceptedCount, onOpen }: CategoryLinkRowProps): JSX.Element => {
  const [nearRef, near] = useNearViewport<HTMLLIElement>("200px 0px");
  const items = useQuery({
    ...categoryItemsQuery(category.id, CARD_ITEM_PAGE_SIZE),
    enabled: near,
  });
  const name = categoryName(category);
  const lead = items.data?.items[0];
  return (
    <li ref={nearRef} style={{ minWidth: 0 }}>
      <LinkRow
        icon={
          <ReagentIcon
            item={lead}
            enabled={near}
            loading={items.isPending}
            size={40}
            fallbackLabel={name}
          />
        }
        primary={name}
        secondary={
          lead && lead.name !== name
            ? `Category ${formatId(category.id)} · ${lead.name}`
            : `Category ${formatId(category.id)}`
        }
        trailing={
          acceptedCount !== undefined
            ? `In ${pluralize(acceptedCount, "slot type", "slot types")}`
            : null
        }
        onClick={() => onOpen(category)}
      />
    </li>
  );
};

export default CategoryLinkRow;
