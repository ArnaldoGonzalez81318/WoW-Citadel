import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import {
  Box,
  Button,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

import DetailDialog from "@/components/common/DetailDialog";
import GoldAmount from "@/components/common/GoldAmount";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/common/StateBlocks";
import { levelSlotLine } from "@/features/items/components/ItemCard";
import ItemPieceList from "@/features/items/components/ItemPieceList";
import ItemTooltipPanel from "@/features/items/components/ItemTooltipPanel";
import {
  itemIconQuery,
  itemRecordQuery,
  itemSetQuery,
} from "@/features/items/hooks/itemQueries";
import useStickyError from "@/features/items/hooks/useStickyError";
import { itemTypeLine, pluralize } from "@/features/items/services/itemService";
import type { ItemRecord, ItemSummary, NamedRef } from "@/features/items/types";
import { WOWHEAD_LABEL, wowheadSearchUrl, wowheadUrl } from "@/lib/externalLinks";
import { formatNumber } from "@/lib/format";
import { qualityColor, visuallyHidden } from "@/theme";

export type DialogSubject = {
  kind: "item" | "set";
  id: number;
};

export type ItemExplorerDialogProps = {
  /** Whether the dialog is showing; `subject` stays set through the close transition. */
  open: boolean;
  subject: DialogSubject | null;
  /** The card that opened an item: its facts show while the record loads. */
  itemSeed?: ItemSummary;
  /** A set's name from the index, shown until its record loads. */
  setName?: string;
  /** Another item or set, from inside the dialog (a piece, the item's set). */
  onWalk: (subject: DialogSubject) => void;
  /** List the item's class and subclass on the page. */
  onBrowse: (classId: number, subclassId: number | null) => void;
  /** The page's class filter, so the dialog does not offer it again. */
  activeClassId: number | null;
  activeSubclassId: number | null;
  onClose: () => void;
};

/** The raw record in the API workbench (catalog slug, endpoint id and its path param). */
const workbenchUrl = (subject: DialogSubject): string =>
  `/api-explorer/items?${new URLSearchParams(
    subject.kind === "item"
      ? { endpoint: "item", itemId: String(subject.id) }
      : { endpoint: "item-set", itemSetId: String(subject.id) },
  ).toString()}`;

type Fact = { label: string; value: ReactNode };

/** The label/value list beside the tooltip. */
const FactList = ({ facts }: { facts: Fact[] }): JSX.Element => (
  <Box
    component="dl"
    sx={{
      display: "grid",
      gridTemplateColumns: "minmax(96px, max-content) minmax(0, 1fr)",
      columnGap: 2,
      rowGap: 1.25,
      m: 0,
      alignContent: "start",
    }}
  >
    {facts.map((fact) => (
      <Box key={fact.label} sx={{ display: "contents" }}>
        <Typography
          component="dt"
          variant="caption"
          sx={{ color: "text.secondary", fontWeight: 500, alignSelf: "center" }}
        >
          {fact.label}
        </Typography>
        <Typography
          component="dd"
          variant="body2"
          sx={{ m: 0, minWidth: 0, overflowWrap: "anywhere", alignSelf: "center" }}
        >
          {fact.value}
        </Typography>
      </Box>
    ))}
  </Box>
);

const mono = (value: number): JSX.Element => (
  <Box component="span" sx={(theme) => ({ fontFamily: theme.wc.fontMono })}>
    {value}
  </Box>
);

/** The record's base levels that the tooltip's preview (with bonuses) contradicts. */
type PreviewDiff = {
  level?: { preview: number; base: number };
  requiredLevel?: { preview: number; base: number };
};

/*
 * Only levels the fact list shows (above 1) count: a hidden fact
 * contradicts nothing.
 */
const previewDiff = (record: ItemRecord): PreviewDiff => {
  const diff: PreviewDiff = {};
  const { itemLevelValue, requiredLevelValue } = record.tooltip;
  if (
    record.level !== undefined &&
    record.level > 1 &&
    itemLevelValue !== undefined &&
    itemLevelValue !== record.level
  ) {
    diff.level = { preview: itemLevelValue, base: record.level };
  }
  if (
    record.requiredLevel !== undefined &&
    record.requiredLevel > 1 &&
    requiredLevelValue !== undefined &&
    requiredLevelValue !== record.requiredLevel
  ) {
    diff.requiredLevel = { preview: requiredLevelValue, base: record.requiredLevel };
  }
  return diff;
};

/** "…at item level 40 and required level 30; its base item level is 29 and…" */
const previewCaption = (diff: PreviewDiff): string | undefined => {
  const previewed: string[] = [];
  const base: string[] = [];
  if (diff.level) {
    previewed.push(`item level ${formatNumber(diff.level.preview)}`);
    base.push(`its base item level is ${formatNumber(diff.level.base)}`);
  }
  if (diff.requiredLevel) {
    previewed.push(`required level ${formatNumber(diff.requiredLevel.preview)}`);
    base.push(`its base required level is ${formatNumber(diff.requiredLevel.base)}`);
  }
  return previewed.length > 0
    ? `Blizzard previews this item with its default bonuses, at ${previewed.join(" and ")}; ${base.join(" and ")}.`
    : undefined;
};

const summaryFacts = (item: ItemSummary, diff: PreviewDiff = {}): Fact[] => {
  const facts: Fact[] = [];
  if (item.qualityName) {
    facts.push({
      label: "Quality",
      value: (
        <Box component="span" sx={(theme) => ({ color: qualityColor(theme, item.quality) })}>
          {item.qualityName}
        </Box>
      ),
    });
  }
  const type = itemTypeLine(item);
  if (type) {
    facts.push({ label: "Type", value: type });
  }
  const levelSlot = levelSlotLine({ slot: item.slot, level: undefined });
  if (levelSlot) {
    facts.push({ label: "Slot", value: levelSlot });
  }
  // Cosmetics and housing items sit at item level 1, which says nothing.
  if (item.level !== undefined && item.level > 1) {
    facts.push({
      label: diff.level ? "Base item level" : "Item level",
      value: formatNumber(item.level),
    });
  }
  if (item.requiredLevel !== undefined && item.requiredLevel > 1) {
    facts.push({
      label: diff.requiredLevel ? "Base required level" : "Requires level",
      value: formatNumber(item.requiredLevel),
    });
  }
  facts.push({ label: "Item ID", value: mono(item.id) });
  return facts;
};

/*
 * The tooltip draws the sell price Blizzard previews; the record's own is
 * listed only when the tooltip has none. (Blizzard's purchase price is left
 * out: it is set even for items no vendor sells, such as Thunderfury.)
 */
const recordFacts = (record: ItemRecord, diff: PreviewDiff): Fact[] => {
  const facts = summaryFacts(record, diff);
  if (record.tooltip.sellPrice === undefined && record.sellPrice !== undefined) {
    facts.splice(facts.length - 1, 0, {
      label: "Sell price",
      value: <GoldAmount copper={record.sellPrice} />,
    });
  }
  return facts;
};

/** Tooltip-shaped placeholder beside the card's facts while the record loads. */
const TooltipSkeleton = (): JSX.Element => (
  <Skeleton
    variant="rounded"
    role="status"
    aria-label="Loading tooltip"
    sx={{ width: "100%", maxWidth: 400, height: 300, justifySelf: "center" }}
  />
);

const twoColumnsSx = {
  display: "grid",
  gap: 2.5,
  gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 6fr) minmax(0, 5fr)" },
  alignItems: "start",
} as const;

/* ------------------------------------------------------------------ */
/* Item                                                                */
/* ------------------------------------------------------------------ */

const ItemBody = ({
  itemId,
  seed,
  onWalk,
}: {
  itemId: number;
  seed?: ItemSummary;
  onWalk: (subject: DialogSubject) => void;
}): JSX.Element => {
  const recordQuery = useQuery(itemRecordQuery(itemId));
  const recordError = useStickyError(`item-${itemId}`, recordQuery);
  const record = recordQuery.data ?? undefined;
  const set = record?.tooltip.set;
  const setQuery = useQuery({ ...itemSetQuery(set?.set.id ?? 0), enabled: set !== undefined });
  const setError = useStickyError(`set-${set?.set.id ?? 0}`, setQuery);
  const piecesHeadingId = useId();

  if (recordQuery.data === null) {
    return (
      <EmptyState
        compact
        title="Item not found"
        description={`Blizzard has no item #${itemId} in its game data.`}
      />
    );
  }

  const shown = record ?? seed;
  // The tooltip shows the levels with bonuses; the facts, the record's base ones.
  const diff = record ? previewDiff(record) : {};
  const facts = record ? recordFacts(record, diff) : seed ? summaryFacts(seed) : [];
  const caption = previewCaption(diff);

  let tooltip: ReactNode = null;
  if (record) {
    tooltip = (
      <Stack spacing={1} sx={{ minWidth: 0, alignItems: "center" }}>
        <ItemTooltipPanel
          record={record}
          setBonuses={
            set
              ? {
                  bonuses: setQuery.data?.bonuses,
                  loading: setQuery.isPending && setError.error === undefined,
                  failed: setError.error !== undefined,
                  retrying: setError.retrying,
                  onRetry: setError.retry,
                }
              : undefined
          }
        />
        {caption ? (
          <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 400 }}>
            {caption}
          </Typography>
        ) : null}
      </Stack>
    );
  } else if (recordError.error === undefined) {
    tooltip = <TooltipSkeleton />;
  }

  return (
    <Stack spacing={2.5}>
      {recordError.error !== undefined ? (
        <ErrorState
          compact
          error={recordError.error}
          context="this item's tooltip"
          onRetry={recordError.retry}
          retryLabel={recordError.retrying ? "Retrying…" : "Retry"}
        />
      ) : null}
      {shown ? (
        <Box sx={twoColumnsSx}>
          {tooltip}
          <FactList facts={facts} />
        </Box>
      ) : recordError.error === undefined ? (
        // A shared link: nothing to show until the record lands.
        <Box sx={twoColumnsSx}>
          <TooltipSkeleton />
          <LoadingSkeleton variant="text" count={6} label="Loading item facts" />
        </Box>
      ) : null}

      {set ? (
        <Box component="section" aria-labelledby={piecesHeadingId}>
          <Stack
            direction="row"
            flexWrap="wrap"
            useFlexGap
            gap={1}
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 1 }}
          >
            <Typography id={piecesHeadingId} variant="overline" component="h3" sx={{ m: 0 }}>
              {`${set.set.name} · ${pluralize(set.pieces.length, "piece", "pieces")}`}
            </Typography>
            <Button size="small" onClick={() => onWalk({ kind: "set", id: set.set.id })}>
              View set
            </Button>
          </Stack>
          <ItemPieceList
            pieces={set.pieces}
            currentItemId={itemId}
            labelledBy={piecesHeadingId}
            onOpen={(piece) => onWalk({ kind: "item", id: piece.id })}
          />
        </Box>
      ) : null}
    </Stack>
  );
};

/* ------------------------------------------------------------------ */
/* Set                                                                 */
/* ------------------------------------------------------------------ */

const SetBody = ({
  setId,
  onWalk,
}: {
  setId: number;
  onWalk: (subject: DialogSubject) => void;
}): JSX.Element => {
  const setQuery = useQuery(itemSetQuery(setId));
  const setError = useStickyError(`set-${setId}`, setQuery);
  const bonusHeadingId = useId();
  const piecesHeadingId = useId();
  const set = setQuery.data ?? undefined;

  if (setQuery.data === null) {
    return (
      <EmptyState
        compact
        title="Item set not found"
        description={`Blizzard has no item set #${setId} in its game data.`}
      />
    );
  }
  if (setError.error !== undefined) {
    return (
      <ErrorState
        compact
        error={setError.error}
        context="this item set"
        onRetry={setError.retry}
        retryLabel={setError.retrying ? "Retrying…" : "Retry"}
      />
    );
  }
  if (!set) {
    return (
      <Stack spacing={2.5}>
        <LoadingSkeleton variant="text" count={2} label="Loading set bonuses" />
        <LoadingSkeleton
          variant="grid"
          columns={{ xs: 1, sm: 2 }}
          itemHeight={58}
          count={6}
          gap={8}
          label="Loading set pieces"
        />
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Box component="section" aria-labelledby={bonusHeadingId}>
        <Typography id={bonusHeadingId} variant="overline" component="h3" sx={{ m: 0, mb: 0.75 }}>
          Set bonuses
        </Typography>
        {set.bonuses.length > 0 ? (
          <Box component="ul" role="list" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1 }}>
            {set.bonuses.map((bonus) => (
              <Box
                component="li"
                key={`${bonus.requiredCount}-${bonus.text}`}
                sx={(theme) => ({
                  display: "flex",
                  gap: 1.25,
                  alignItems: "baseline",
                  p: 1.25,
                  borderRadius: `${theme.wc.radius.md}px`,
                  border: `1px solid ${theme.palette.border.subtle}`,
                  backgroundColor: theme.palette.surface.inset,
                })}
              >
                <Box
                  component="span"
                  sx={(theme) => ({
                    flexShrink: 0,
                    fontWeight: 700,
                    color: theme.palette.secondary.main,
                    fontVariantNumeric: "tabular-nums",
                  })}
                >
                  {`(${bonus.requiredCount})`}
                  <Box component="span" sx={visuallyHidden}>
                    {` ${bonus.requiredCount === 1 ? "piece" : "pieces"}:`}
                  </Box>
                </Box>
                <Typography variant="body2" component="span" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  {bonus.text}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Blizzard lists no bonuses for this set.
          </Typography>
        )}
      </Box>
      <Box component="section" aria-labelledby={piecesHeadingId}>
        <Typography id={piecesHeadingId} variant="overline" component="h3" sx={{ m: 0, mb: 0.75 }}>
          {pluralize(set.pieces.length, "piece", "pieces")}
        </Typography>
        {set.pieces.length > 0 ? (
          <ItemPieceList
            pieces={set.pieces}
            labelledBy={piecesHeadingId}
            onOpen={(piece: NamedRef) => onWalk({ kind: "item", id: piece.id })}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            Blizzard lists no pieces for this set.
          </Typography>
        )}
      </Box>
    </Stack>
  );
};

/* ------------------------------------------------------------------ */
/* Dialog                                                              */
/* ------------------------------------------------------------------ */

/**
 * An item or an item set, in one dialog so walking between them (a set's
 * piece, an item's set) swaps the content in place: focus moves to the new
 * title, and closing still returns focus to the card that opened it.
 *
 * An item shows its in-game tooltip beside its facts, then its set's pieces;
 * a set shows its bonuses and pieces. Records load on open; a set's pieces
 * load their own records (for quality, slot and item level) six at a time.
 */
const ItemExplorerDialog = ({
  open,
  subject,
  itemSeed,
  setName,
  onWalk,
  onBrowse,
  activeClassId,
  activeSubclassId,
  onClose,
}: ItemExplorerDialogProps): JSX.Element => {
  const isItem = subject?.kind === "item";
  const subjectId = subject?.id ?? 0;
  const seed = isItem && itemSeed?.id === subjectId ? itemSeed : undefined;

  // The bodies own their queries; these share the cache entries for the header.
  const recordQuery = useQuery({ ...itemRecordQuery(subjectId), enabled: open && isItem });
  const setQuery = useQuery({
    ...itemSetQuery(subjectId),
    enabled: open && subject?.kind === "set",
  });
  const record = isItem ? (recordQuery.data ?? undefined) : undefined;
  const set = !isItem && subject ? (setQuery.data ?? undefined) : undefined;
  const iconItemId = isItem ? subjectId : set?.pieces[0]?.id;
  const iconQuery = useQuery({
    ...itemIconQuery(iconItemId ?? 0),
    enabled: open && iconItemId !== undefined,
  });

  // Walking moves focus to the new title (the pressed row is gone).
  const rootRef = useRef<HTMLDivElement>(null);
  const walkedRef = useRef(false);
  const walk = (next: DialogSubject): void => {
    walkedRef.current = true;
    onWalk(next);
  };
  useEffect(() => {
    if (!walkedRef.current) {
      return;
    }
    walkedRef.current = false;
    // DetailDialog renders the h2 (and keeps no ref to it); the root is inside the dialog.
    const heading = rootRef.current?.closest('[role="dialog"]')?.querySelector<HTMLElement>("h2");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }, [subject?.kind, subject?.id]);

  let title = "";
  let subtitle: string | undefined;
  let quality: string | undefined;
  if (subject && isItem) {
    const shown = record ?? seed;
    title = shown?.name ?? `Item #${subject.id}`;
    quality = shown?.quality;
    subtitle = shown ? itemTypeLine(shown) || undefined : undefined;
  } else if (subject) {
    title = set?.name ?? setName ?? `Item set #${subject.id}`;
    subtitle = set ? `Item set · ${pluralize(set.pieces.length, "piece", "pieces")}` : "Item set";
  }

  const browseSource = record ?? seed;
  const canBrowse =
    browseSource?.itemClass !== undefined &&
    !(
      browseSource.itemClass.id === activeClassId &&
      (browseSource.itemSubclass?.id ?? null) === activeSubclassId
    );
  const browseLabel = browseSource ? itemTypeLine(browseSource) : "";

  const wowhead = subject
    ? isItem
      ? wowheadUrl("item", subject.id)
      : wowheadSearchUrl(set?.name ?? setName ?? "")
    : undefined;

  return (
    <DetailDialog
      open={open && subject !== null}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      quality={quality}
      media={{
        src: iconQuery.data ?? null,
        alt: "",
        kind: "icon",
        // A set borrows its first piece's icon, which waits for the set itself.
        loading:
          iconItemId !== undefined
            ? iconQuery.isPending
            : !isItem && subject !== null && setQuery.isPending && !setQuery.isError,
      }}
      maxWidth="md"
      actions={
        subject ? (
          // Wraps at phone width instead of pushing the dialog sideways.
          <Stack
            direction="row"
            flexWrap="wrap"
            useFlexGap
            gap={1}
            justifyContent="flex-end"
            sx={{ width: "100%" }}
          >
            {isItem && canBrowse && browseSource?.itemClass ? (
              <Button
                size="small"
                variant="outlined"
                onClick={() =>
                  onBrowse(
                    browseSource.itemClass?.id ?? 0,
                    browseSource.itemSubclass?.id ?? null,
                  )
                }
              >
                {`Browse ${browseLabel}`}
              </Button>
            ) : null}
            <Button component={RouterLink} to={workbenchUrl(subject)} size="small">
              Open in API workbench
            </Button>
            {wowhead ? (
              <Button
                href={wowhead}
                target="_blank"
                rel="noreferrer"
                size="small"
                endIcon={<OpenInNewRoundedIcon />}
              >
                {isItem ? WOWHEAD_LABEL : "Search on Wowhead"}
                <Box component="span" sx={visuallyHidden}>
                  {`: ${title}, opens in a new tab`}
                </Box>
              </Button>
            ) : null}
          </Stack>
        ) : null
      }
    >
      {/* Still rendered while closing (from the cache), so nothing blanks mid-transition. */}
      <Box ref={rootRef}>
        {subject ? (
          isItem ? (
            <ItemBody key={subject.id} itemId={subject.id} seed={seed} onWalk={walk} />
          ) : (
            <SetBody key={subject.id} setId={subject.id} onWalk={walk} />
          )
        ) : null}
      </Box>
    </DetailDialog>
  );
};

export default ItemExplorerDialog;
