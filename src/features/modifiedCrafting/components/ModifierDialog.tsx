import { Box, Button, Link } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Link as RouterLink } from "react-router-dom";

import DetailDialog from "@/components/common/DetailDialog";
import type {
  DetailDialogRow,
  DetailDialogSection,
} from "@/components/common/DetailDialog";
import { EmptyState } from "@/components/common/StateBlocks";
import AcceptedBySlots from "@/features/modifiedCrafting/components/AcceptedBySlots";
import CategoryLinkRow from "@/features/modifiedCrafting/components/CategoryLinkRow";
import ReagentItemList from "@/features/modifiedCrafting/components/ReagentItemList";
import {
  CARD_ITEM_PAGE_SIZE,
  DIALOG_ITEM_PAGE_SIZE,
  categoryItemsQuery,
  promoteSlotType,
  reagentIconQuery,
  slotTypeQuery,
} from "@/features/modifiedCrafting/hooks/modifiedCraftingQueries";
import useRetainedError from "@/features/modifiedCrafting/hooks/useRetainedError";
import type { RetainedError } from "@/features/modifiedCrafting/hooks/useRetainedError";
import type { SlotLinks } from "@/features/modifiedCrafting/hooks/useSlotLinks";
import {
  categoryName,
  formatId,
  pluralize,
  slotTypeName,
} from "@/features/modifiedCrafting/services/modifiedCraftingService";
import { SLOT_THEME_BY_ID } from "@/features/modifiedCrafting/services/slotThemes";
import type { SlotThemeId } from "@/features/modifiedCrafting/services/slotThemes";
import type {
  CategoryGroup,
  CategoryRef,
  ModifierTarget,
  SlotTypeRef,
} from "@/features/modifiedCrafting/types";

export type ModifierDialogProps = {
  /** Whether the dialog is showing; `target` stays set through the close transition. */
  open: boolean;
  target: ModifierTarget | null;
  slotById: ReadonlyMap<number, SlotTypeRef>;
  /** Display-name -> every slot type id that carries it, newest first. */
  slotIdsByName: ReadonlyMap<string, readonly number[]>;
  themeOf: ReadonlyMap<number, SlotThemeId>;
  categoryById: ReadonlyMap<number, CategoryRef>;
  groupOfCategory: ReadonlyMap<number, CategoryGroup>;
  /** Both indexes have loaded, so an id missing from them is really missing. */
  indexesReady: boolean;
  links: SlotLinks;
  /** Starts the slot-link map: a category's "Accepted by" section came into view. */
  onNeedLinks: () => void;
  /** The slot type list's own failure, for the "Accepted by" section. */
  slotListError: RetainedError;
  /** Shows another slot type or category in this dialog. */
  onNavigate: (target: ModifierTarget) => void;
  onClose: () => void;
};

/** The raw records behind the dialog, in the API workbench (catalog slug and endpoint id). */
const workbenchUrl = (target: ModifierTarget): string =>
  `/api-explorer/modified-crafting?${new URLSearchParams(
    target.kind === "slot"
      ? { endpoint: "modified-crafting-slot-type", slotTypeId: String(target.id) }
      : { endpoint: "modified-crafting-category", categoryId: String(target.id) },
  ).toString()}`;

/**
 * "#340, #334, …", each a link that opens that id here. Every one is
 * listed (at most eighteen on US): this row is the only way to reach the
 * older ids of a repeated name.
 */
const IdLinks = ({
  ids,
  kind,
  onOpen,
}: {
  ids: readonly number[];
  kind: ModifierTarget["kind"];
  onOpen: (target: ModifierTarget) => void;
}): JSX.Element => (
  <Box
    component="ul"
    role="list"
    aria-label={kind === "slot" ? "Slot types with the same name" : "Categories with the same name"}
    sx={{
      listStyle: "none",
      m: 0,
      p: 0,
      display: "flex",
      flexWrap: "wrap",
      columnGap: 1.25,
      rowGap: 0.25,
    }}
  >
    {ids.map((id) => (
      <li key={id}>
        <Link
          component="button"
          type="button"
          variant="body2"
          onClick={() => onOpen({ kind, id })}
          sx={{ fontVariantNumeric: "tabular-nums" }}
        >
          {formatId(id)}
        </Link>
      </li>
    ))}
  </Box>
);

/**
 * A slot type or a category in full. A slot type shows its theme, the ids
 * that share its name and every category it accepts (each with a reagent
 * icon); a category shows the ids that share its name, its reagent items
 * from the item search with their effect, and, from the slot-link map, the
 * slot types that accept it. Every link opens the other in this same
 * dialog (the URL follows), so the relation can be walked both ways.
 */
const ModifierDialog = ({
  open,
  target,
  slotById,
  slotIdsByName,
  themeOf,
  categoryById,
  groupOfCategory,
  indexesReady,
  links: liveLinks,
  onNeedLinks,
  slotListError,
  onNavigate,
  onClose,
}: ModifierDialogProps): JSX.Element => {
  const slotId = target?.kind === "slot" ? target.id : null;
  const categoryId = target?.kind === "category" ? target.id : null;

  // Closing stops the map the dialog asked for, which empties it; the
  // content fading out keeps the map it last showed rather than jumping to
  // "Waiting for the slot type list…". (Written during render on purpose: a
  // pure function of the props, like the target that outlives its param.)
  const linksRef = useRef(liveLinks);
  if (open) {
    linksRef.current = liveLinks;
  }
  const links = open ? liveLinks : linksRef.current;

  const slotQuery = useQuery({ ...slotTypeQuery(slotId ?? 0), enabled: slotId !== null });
  const slotRetained = useRetainedError(`slot-${slotId ?? ""}`, slotQuery);
  // A record the slot-link map queued at low priority would hold the
  // dialog on "Loading details" until its turn: move it up.
  const slotFetchStatus = slotQuery.fetchStatus;
  useEffect(() => {
    if (open && slotId !== null && slotFetchStatus === "fetching") {
      promoteSlotType(slotId);
    }
  }, [open, slotId, slotFetchStatus]);
  const record = slotId !== null ? slotQuery.data : undefined;

  // The title tile: a slot type's first category's newest reagent (the
  // cards' query), or the category's own newest one (the list's query).
  const leadCategoryId = slotId !== null ? record?.categories[0]?.id : (categoryId ?? undefined);
  const leadItems = useQuery({
    ...categoryItemsQuery(
      leadCategoryId ?? 0,
      slotId !== null ? CARD_ITEM_PAGE_SIZE : DIALOG_ITEM_PAGE_SIZE,
    ),
    enabled: open && leadCategoryId !== undefined,
  });
  const leadItem = leadCategoryId !== undefined ? leadItems.data?.items[0] : undefined;
  const leadIcon = useQuery({
    ...reagentIconQuery(leadItem?.id ?? 0),
    enabled: open && leadItem !== undefined,
  });

  // Walking to another slot type or category replaces what the pressed
  // button belonged to, so focus would fall back to the dialog itself: move
  // it to the new title instead, which also announces what just opened.
  const anchorRef = useRef<HTMLSpanElement>(null);
  const focusTitleRef = useRef(false);
  const navigate = (next: ModifierTarget): void => {
    focusTitleRef.current = true;
    onNavigate(next);
  };
  useEffect(() => {
    if (!focusTitleRef.current || target === null) {
      return;
    }
    focusTitleRef.current = false;
    const title = anchorRef.current
      ?.closest<HTMLElement>("[role='dialog']")
      ?.querySelector<HTMLElement>("h2");
    if (title) {
      title.tabIndex = -1;
      title.focus();
    }
  }, [target]);

  const openCategory = (category: CategoryRef): void =>
    navigate({ kind: "category", id: category.id });
  const openSlot = (slot: SlotTypeRef): void => navigate({ kind: "slot", id: slot.id });

  const rows: DetailDialogRow[] = [];
  const sections: DetailDialogSection[] = [];
  let title = "";
  let subtitle: string | undefined;
  let notFound: JSX.Element | null = null;

  if (slotId !== null) {
    const ref = slotById.get(slotId);
    const known = record ?? ref;
    // "Unnamed" only once a record or the index says so, not while both load.
    title = known ? slotTypeName(known) : `Slot type ${formatId(slotId)}`;
    const themeId = themeOf.get(slotId);
    const theme = themeId ? SLOT_THEME_BY_ID.get(themeId) : undefined;
    subtitle = `Reagent slot type ${formatId(slotId)}${theme ? ` · ${theme.label}` : ""}`;
    if (record) {
      if (theme) {
        rows.push({ label: "Theme", value: `${theme.label}: ${theme.blurb}` });
      }
      rows.push({
        label: "Accepts",
        value:
          record.categories.length > 0
            ? pluralize(record.categories.length, "category", "categories")
            : "No category",
      });
      const siblings = (ref?.name ? (slotIdsByName.get(ref.name) ?? []) : []).filter(
        (id) => id !== slotId,
      );
      if (siblings.length > 0) {
        rows.push({
          label: "Same name",
          value: <IdLinks ids={siblings} kind="slot" onOpen={navigate} />,
        });
      }
      rows.push({ label: "Slot type ID", value: formatId(slotId) });
      if (record.categories.length > 0) {
        sections.push({
          heading: `Accepted categories · ${record.categories.length}`,
          content: (
            <Box
              component="ul"
              role="list"
              aria-label={`Categories ${title} accepts`}
              sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 0.75 }}
            >
              {record.categories.map((category) => (
                <CategoryLinkRow
                  key={category.id}
                  category={category}
                  acceptedCount={
                    links.complete ? (links.acceptedBy.get(category.id)?.length ?? 0) : undefined
                  }
                  onOpen={openCategory}
                />
              ))}
            </Box>
          ),
        });
      }
    } else if (record === null) {
      notFound = (
        <EmptyState
          compact
          title="Slot type not found"
          description={`Blizzard has no reagent slot type ${formatId(slotId)} in its game data.`}
        />
      );
    }
  }

  if (categoryId !== null) {
    const ref = categoryById.get(categoryId);
    title = ref ? categoryName(ref) : `Category ${formatId(categoryId)}`;
    subtitle = `Reagent category ${formatId(categoryId)}`;
    if (ref || !indexesReady) {
      const group = groupOfCategory.get(categoryId);
      const siblings = (group?.ids ?? []).filter((id) => id !== categoryId);
      if (ref && ref.name === null && leadItem) {
        rows.push({
          label: "Name",
          value: `None in the API; its newest reagent is ${leadItem.name}`,
        });
      }
      if (siblings.length > 0) {
        rows.push({
          label: "Same name",
          value: <IdLinks ids={siblings} kind="category" onOpen={navigate} />,
        });
      }
      if (links.complete) {
        const count = links.acceptedBy.get(categoryId)?.length ?? 0;
        rows.push({
          label: "Accepted by",
          value: count > 0 ? pluralize(count, "slot type", "slot types") : "No slot type",
        });
      }
      rows.push({ label: "Category ID", value: formatId(categoryId) });
      sections.push({
        heading: "Reagent items",
        content: <ReagentItemList categoryId={categoryId} />,
      });
      sections.push({
        heading: "Accepted by",
        content: (
          <AcceptedBySlots
            categoryIds={[categoryId]}
            links={links}
            onNeeded={open ? onNeedLinks : undefined}
            listError={slotListError}
            slotById={slotById}
            themeOf={themeOf}
            onOpenSlot={openSlot}
          />
        ),
      });
    } else {
      notFound = (
        <EmptyState
          compact
          title="Category not found"
          description={`Blizzard lists no reagent category ${formatId(categoryId)}.`}
        />
      );
    }
  }

  const slotLoading = slotId !== null && slotQuery.isPending && slotRetained.error === undefined;
  // Locates the dialog for the focus move above; renders nothing. It goes in
  // the footer, which shows in every state, not the body, which a loading or
  // failed record replaces (only a not-found state has no footer).
  const anchor = <Box component="span" ref={anchorRef} sx={{ display: "none" }} />;

  return (
    <DetailDialog
      open={open && target !== null}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      media={{
        kind: "icon",
        src: leadIcon.data ?? null,
        alt: "",
        loading:
          open &&
          ((slotId !== null && slotQuery.isPending) ||
            (leadCategoryId !== undefined && leadItems.isPending) ||
            (leadItem !== undefined && leadIcon.isPending)),
      }}
      rows={rows}
      sections={sections}
      loading={slotLoading}
      error={slotId !== null ? slotRetained.error : undefined}
      onRetry={slotRetained.retry}
      errorContext="this slot type"
      maxWidth="md"
      actions={
        target !== null && notFound === null ? (
          <>
            {anchor}
            <Button component={RouterLink} to={workbenchUrl(target)} size="small">
              Open in API workbench
            </Button>
          </>
        ) : null
      }
    >
      {notFound}
      {notFound !== null ? anchor : null}
    </DetailDialog>
  );
};

export default ModifierDialog;
