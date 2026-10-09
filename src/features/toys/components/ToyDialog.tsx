import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Box, Button, Skeleton, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

import DetailDialog from "@/components/common/DetailDialog";
import GoldAmount from "@/components/common/GoldAmount";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import SourceDetails from "@/features/toys/components/SourceDetails";
import SourceIcon from "@/features/toys/components/SourceIcon";
import ToyUseText from "@/features/toys/components/ToyUseText";
import { toyIconQuery, toyItemQuery, toyQuery } from "@/features/toys/hooks/toyQueries";
import useHeldError from "@/features/toys/hooks/useHeldError";
import type { ToyItem, ToyRecord } from "@/features/toys/types";
import { WOWHEAD_LABEL, wowheadUrl } from "@/lib/externalLinks";
import { visuallyHidden } from "@/theme";

export type ToyDialogProps = {
  /** Whether the dialog is showing; `toyId` stays set through the close transition. */
  open: boolean;
  /** The toy to show (the last one opened). */
  toyId: number | null;
  /** Its name from the index, shown until the record loads. */
  fallbackName?: string;
  /** The source the list is filtered to, so the dialog does not offer it again. */
  activeSource: string | null;
  onShowSource: (type: string) => void;
  onClose: () => void;
};

/** The raw toy record, in the API workbench (catalog slug and endpoint id). */
const workbenchUrl = (toyId: number): string =>
  `/api-explorer/toy?${new URLSearchParams({
    endpoint: "toy",
    toyId: String(toyId),
  }).toString()}`;

type Fact = { label: string; value: ReactNode };

/**
 * Blizzard's "Cost: 1 1 100" lost its currency icons upstream; the note
 * under the source text says so. The label is English, so other locales
 * simply go without the note.
 */
const hasCostLine = (record: ToyRecord): boolean =>
  record.sourceBlocks.some((block) => block.some((line) => /^cost$/i.test(line.label ?? "")));

const mono = (value: number): JSX.Element => (
  <Box component="span" sx={(theme) => ({ fontFamily: theme.wc.fontMono })}>
    {value}
  </Box>
);

const buildFacts = (record: ToyRecord, item: ToyItem | null | undefined): Fact[] => {
  const facts: Fact[] = [];
  facts.push({
    label: "Source",
    value: record.source ? (
      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
        <SourceIcon type={record.source.type} />
        <span>{record.source.name}</span>
      </Box>
    ) : (
      "Not listed"
    ),
  });
  if (item?.quality) {
    facts.push({ label: "Quality", value: item.quality.name });
  }
  if (item?.binding) {
    facts.push({ label: "Binding", value: item.binding });
  }
  if (item?.unique) {
    facts.push({ label: "Carry limit", value: item.unique });
  }
  if (item && item.requirements.length > 0) {
    facts.push({
      label: "Requires",
      value: (
        <Box component="ul" role="list" sx={{ listStyle: "none", m: 0, p: 0 }}>
          {item.requirements.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </Box>
      ),
    });
  }
  if (item?.sellPrice !== undefined) {
    facts.push({ label: "Sells for", value: <GoldAmount copper={item.sellPrice} size="small" /> });
  }
  if (record.excludeIfUncollected) {
    facts.push({
      label: "Collections",
      value: "Blizzard leaves it out of collection lists for characters who don't have it",
    });
  }
  facts.push({ label: "Toy ID", value: mono(record.id) });
  facts.push({ label: "Item ID", value: mono(record.itemId) });
  return facts;
};

/** The dialog's label/value list, labels in a column of their own from sm up. */
const FactList = ({ facts }: { facts: Fact[] }): JSX.Element => (
  <Box
    component="dl"
    sx={{
      display: "grid",
      gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(112px, max-content) minmax(0, 1fr)" },
      columnGap: 2,
      rowGap: { xs: 0.25, sm: 1 },
      m: 0,
    }}
  >
    {facts.map((fact) => (
      <Box key={fact.label} sx={{ display: "contents" }}>
        <Typography
          component="dt"
          variant="caption"
          sx={{ color: "text.secondary", fontWeight: 500, alignSelf: "baseline", mt: { xs: 1, sm: 0 } }}
        >
          {fact.label}
        </Typography>
        <Typography
          component="dd"
          variant="body2"
          sx={{ m: 0, minWidth: 0, overflowWrap: "anywhere", alignSelf: "baseline" }}
        >
          {fact.value}
        </Typography>
      </Box>
    ))}
  </Box>
);

/** An h3 section of the dialog body. */
const Section = ({ title, children }: { title: string; children: ReactNode }): JSX.Element => {
  const headingId = useId();
  return (
    <Box component="section" aria-labelledby={headingId}>
      <Typography id={headingId} variant="overline" component="h3" sx={{ m: 0, mb: 0.75, display: "block" }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
};

const UseSkeleton = (): JSX.Element => (
  <Stack spacing={1} role="status" aria-label="Loading what the toy does">
    <Skeleton variant="text" width="40%" sx={{ fontSize: "0.75rem" }} />
    <Skeleton variant="text" width="95%" />
    <Skeleton variant="text" width="70%" />
    <Skeleton variant="rounded" width={120} height={24} />
  </Stack>
);

/**
 * A toy in full: what it does (its item's "Use:" text, cooldown and flavour
 * line, in the tooltip's colours), where it comes from in Blizzard's words,
 * its binding and requirements, and links to filter the box by its source,
 * to the raw record and to Wowhead. The toy record is the cards' cache entry
 * (opening a card costs no request); the item record loads here.
 */
const ToyDialog = ({
  open,
  toyId,
  fallbackName,
  activeSource,
  onShowSource,
  onClose,
}: ToyDialogProps): JSX.Element => {
  const enabled = toyId !== null;
  const toyRecordQuery = useQuery({ ...toyQuery(toyId ?? 0), enabled });
  const record = enabled ? toyRecordQuery.data : undefined;
  const notFound = enabled && record === null;
  const toyError = useHeldError(
    record === undefined ? toyRecordQuery.error : null,
    toyRecordQuery.isFetching,
    String(toyId),
  );

  const itemId = record?.itemId;
  const itemQuery = useQuery({ ...toyItemQuery(itemId ?? 0), enabled: itemId !== undefined });
  const iconQuery = useQuery({ ...toyIconQuery(itemId ?? 0), enabled: itemId !== undefined });
  const item = itemId !== undefined ? itemQuery.data : undefined;
  const itemError = useHeldError(
    item === undefined ? itemQuery.error : null,
    itemQuery.isFetching,
    String(itemId),
  );

  const title =
    item?.name ?? record?.name ?? fallbackName ?? (toyId !== null ? `Toy #${toyId}` : "");
  const source = record?.source;
  const wowhead = itemId !== undefined ? wowheadUrl("item", itemId) : undefined;

  const renderUse = (): JSX.Element => {
    if (item) {
      return <ToyUseText item={item} />;
    }
    if (itemError) {
      return (
        <ErrorState
          compact
          error={itemError}
          context="what this toy does"
          onRetry={() => {
            // A press while the retry is in flight is ignored rather than restarting it.
            if (!itemQuery.isFetching) {
              void itemQuery.refetch();
            }
          }}
          retryLabel={itemQuery.isFetching ? "Retrying…" : "Retry"}
        />
      );
    }
    if (item === null) {
      return (
        <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
          {`Blizzard has no item record for this toy (item ${itemId ?? ""}), so its tooltip text is missing.`}
        </Typography>
      );
    }
    return <UseSkeleton />;
  };

  const renderBody = (): JSX.Element | null => {
    if (notFound) {
      return (
        <EmptyState
          compact
          title="Toy not found"
          description={`Blizzard has no toy #${toyId ?? ""} in its game data. The link may be out of date.`}
        />
      );
    }
    if (!record) {
      return null;
    }
    return (
      <Stack spacing={2.5}>
        <Box
          sx={(theme) => ({
            p: 2,
            borderRadius: `${theme.wc.radius.md}px`,
            border: `1px solid ${theme.palette.border.default}`,
            backgroundColor: theme.palette.surface.sunken,
          })}
        >
          <Section title="Use">{renderUse()}</Section>
        </Box>
        <FactList facts={buildFacts(record, item)} />
        {record.sourceBlocks.length > 0 ? (
          <Section title="Where it comes from">
            <Stack spacing={1}>
              <SourceDetails blocks={record.sourceBlocks} />
              {hasCostLine(record) ? (
                <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
                  Costs are Blizzard&rsquo;s figures; its text leaves out which currency.
                </Typography>
              ) : null}
            </Stack>
          </Section>
        ) : null}
      </Stack>
    );
  };

  return (
    <DetailDialog
      open={open && enabled}
      onClose={onClose}
      title={title}
      subtitle={source ? `Toy · ${source.name}` : "Toy"}
      quality={item?.quality?.type}
      media={
        notFound
          ? undefined
          : {
              kind: "icon",
              src: iconQuery.data ?? null,
              alt: "",
              loading: record === undefined ? !toyError : iconQuery.isPending,
            }
      }
      maxWidth="sm"
      loading={enabled && record === undefined && !toyError}
      error={record === undefined && toyError ? toyError : undefined}
      onRetry={() => {
        if (!toyRecordQuery.isFetching) {
          void toyRecordQuery.refetch();
        }
      }}
      errorContext="this toy"
      actions={
        toyId !== null ? (
          // Wraps at phone width instead of pushing the dialog sideways.
          <Stack
            direction="row"
            flexWrap="wrap"
            useFlexGap
            gap={1}
            justifyContent="flex-end"
            sx={{ width: "100%" }}
          >
            {source && source.type !== activeSource ? (
              <Button
                size="small"
                variant="outlined"
                startIcon={<SourceIcon type={source.type} />}
                onClick={() => onShowSource(source.type)}
              >
                {`Show ${source.name} toys`}
              </Button>
            ) : null}
            <Button component={RouterLink} to={workbenchUrl(toyId)} size="small">
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
                {WOWHEAD_LABEL}
                <Box component="span" sx={visuallyHidden}>
                  {`: ${title}, opens in a new tab`}
                </Box>
              </Button>
            ) : null}
          </Stack>
        ) : null
      }
    >
      {renderBody()}
    </DetailDialog>
  );
};

export default ToyDialog;
