import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
  Button,
  Chip,
  Collapse,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useMemo, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import PageHeader from "@/components/common/PageHeader";
import type { PageHeaderBreadcrumb } from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import {
  EmptyState,
  ErrorState,
  LiveStatus,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import type {
  ApiEndpointDefinition,
  ApiEndpointParameter,
  ApiFamilyConfig,
} from "@/features/apiExplorer/types";
import { matchPathTemplate } from "@/features/apiExplorer/utils";
import EndpointForm from "@/features/apiExplorer/workbench/EndpointForm";
import { describeEndpointError } from "@/features/apiExplorer/workbench/errorMessages";
import {
  extractIndexRecords,
  extractLinkRecords,
  workbenchLink,
  workbenchLinkForHref,
  workbenchPath,
} from "@/features/apiExplorer/workbench/overviewRecords";
import type { IndexRecord } from "@/features/apiExplorer/workbench/overviewRecords";
import {
  isIdParameter,
  resolveEndpointRequest,
  useFamilyEndpointDiscovery,
} from "@/features/apiExplorer/workbench/useEndpointRequest";
import type { IndexEndpointQuery } from "@/features/apiExplorer/workbench/useEndpointRequest";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";

export type ApiFamilyOverviewPageHeader = {
  eyebrow: string;
  breadcrumbs?: PageHeaderBreadcrumb[];
};

export type ApiFamilyOverviewProps = {
  family: ApiFamilyConfig;
  /**
   * Renders the route's h1 for the family. Leave out when the host page
   * already owns the h1 (CategoryPage); the overview then starts at h2.
   */
  pageHeader?: ApiFamilyOverviewPageHeader;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const INITIAL_ROWS = 10;
const MAX_ROWS = 60;
/** Dense two-line row (body2 + caption) height, matched by the skeleton. */
const ROW_HEIGHT = 48;
const BUTTON_HEIGHT = 32;

/** The one path parameter of a by-id endpoint, when that is its whole path. */
const singleIdParameter = (
  endpoint: ApiEndpointDefinition,
): ApiEndpointParameter | undefined => {
  const pathParams = (endpoint.parameters ?? []).filter(
    (parameter) => parameter.location === "path",
  );
  return pathParams.length === 1 && isIdParameter(pathParams[0].key)
    ? pathParams[0]
    : undefined;
};

type DetailTarget = { endpoint: ApiEndpointDefinition; parameter: ApiEndpointParameter };

const detailTargets = (family: ApiFamilyConfig): DetailTarget[] =>
  family.endpoints.flatMap((endpoint) => {
    const parameter = singleIdParameter(endpoint);
    return parameter ? [{ endpoint, parameter }] : [];
  });

/**
 * The by-id endpoint a record opens: the one whose path template matches the
 * record's `key.href`, else the list's namesake (`quest-index` → `quest`,
 * `mount-search` → `mount`). A record that identifies neither stays a plain
 * row rather than opening an unrelated endpoint with its id.
 */
const resolveDetailLink = (
  family: ApiFamilyConfig,
  indexEndpoint: ApiEndpointDefinition,
  targets: DetailTarget[],
  record: IndexRecord,
): string | undefined => {
  if (record.href) {
    for (const target of targets) {
      const match = matchPathTemplate(target.endpoint.path, record.href);
      const value = match?.[target.parameter.key];
      if (value && /^\d+$/.test(value)) {
        return workbenchLink(family, target.endpoint, {
          [target.parameter.key]: value,
        });
      }
    }
  }

  if (record.id === undefined) {
    return undefined;
  }

  const namesakeId = indexEndpoint.id.replace(/-(index|search)$/, "");
  const target = targets.find((candidate) => candidate.endpoint.id === namesakeId);
  return target
    ? workbenchLink(family, target.endpoint, {
        [target.parameter.key]: String(record.id),
      })
    : undefined;
};

const rowTextSlotProps = {
  primary: { variant: "body2" },
  secondary: { component: "span" },
} as const;

type RowProps = {
  primary: string;
  secondary?: string;
  to?: string;
};

/** One record row; always an `<li>` so the list keeps its semantics. */
const RecordRow = ({ primary, secondary, to }: RowProps): JSX.Element => {
  const secondaryNode = secondary ? (
    <Typography
      component="span"
      variant="caption"
      color="text.secondary"
      sx={(theme) => ({ fontFamily: theme.wc.fontMono })}
    >
      {secondary}
    </Typography>
  ) : undefined;

  if (to) {
    return (
      <ListItem disablePadding>
        <ListItemButton
          component={RouterLink}
          to={to}
          sx={(theme) => ({ borderRadius: `${theme.wc.radius.sm}px` })}
        >
          <ListItemText
            primary={primary}
            secondary={secondaryNode}
            slotProps={rowTextSlotProps}
          />
        </ListItemButton>
      </ListItem>
    );
  }

  return (
    <ListItem>
      <ListItemText
        primary={primary}
        secondary={secondaryNode}
        slotProps={rowTextSlotProps}
      />
    </ListItem>
  );
};

/* ------------------------------------------------------------------ */
/* IndexSection                                                        */
/* ------------------------------------------------------------------ */

type IndexSectionProps = {
  family: ApiFamilyConfig;
  entry: IndexEndpointQuery;
  targets: DetailTarget[];
};

/** Same shape as the loaded first page: rows, the "Show more" button, the count. */
const SectionSkeleton = ({ label }: { label: string }): JSX.Element => (
  <Stack spacing={1}>
    <LoadingSkeleton
      variant="rows"
      count={INITIAL_ROWS}
      itemHeight={ROW_HEIGHT}
      gap={0}
      label={`Loading ${label}`}
    />
    <Skeleton
      variant="rectangular"
      width={120}
      height={BUTTON_HEIGHT}
      sx={(theme) => ({ borderRadius: `${theme.wc.radius.md}px` })}
    />
    <Skeleton variant="text" width={96} sx={{ fontSize: "0.75rem" }} />
  </Stack>
);

const IndexSection = ({ family, entry, targets }: IndexSectionProps): JSX.Element => {
  const { endpoint, query } = entry;
  const [showMore, setShowMore] = useState(false);

  const records = useMemo(
    () => (query.isSuccess ? extractIndexRecords(query.data) : []),
    [query.isSuccess, query.data],
  );
  // Link-only indexes (`/quest/index`) list the indexes they point to.
  const links = useMemo(
    () => (query.isSuccess && records.length === 0 ? extractLinkRecords(query.data) : []),
    [query.isSuccess, query.data, records.length],
  );
  const shown = records.slice(0, MAX_ROWS);
  const initial = shown.slice(0, INITIAL_ROWS);
  const rest = shown.slice(INITIAL_ROWS);

  const errorCopy = useMemo(
    () => (query.isError ? describeEndpointError(query.error, endpoint, family) : null),
    [query.isError, query.error, endpoint, family],
  );
  const suggested = errorCopy?.suggestedEndpoint;

  const renderRow = (record: IndexRecord): JSX.Element => (
    <RecordRow
      key={record.key}
      primary={record.label}
      // The label already reads "ID n" when the record has no name.
      secondary={
        record.id !== undefined && record.label !== `ID ${record.id}`
          ? `ID ${record.id}`
          : undefined
      }
      to={resolveDetailLink(family, endpoint, targets, record)}
    />
  );

  return (
    <SectionCard
      titleAs="h2"
      title={endpoint.label}
      description={endpoint.description}
      padding="compact"
      actions={
        <Button
          size="small"
          variant="text"
          component={RouterLink}
          to={workbenchLink(family, endpoint, {})}
          endIcon={<ArrowForwardRoundedIcon />}
        >
          Open in workbench
        </Button>
      }
    >
      {query.isLoading ? (
        <SectionSkeleton label={endpoint.label} />
      ) : query.isError && errorCopy ? (
        <ErrorState
          compact
          error={query.error}
          title={errorCopy.title}
          context={endpoint.label}
          onRetry={() => {
            void query.refetch();
          }}
          secondaryAction={
            suggested ? (
              <Button
                size="small"
                variant="text"
                color="inherit"
                component={RouterLink}
                to={workbenchLink(family, suggested, {})}
              >
                Open {suggested.label}
              </Button>
            ) : undefined
          }
        />
      ) : records.length === 0 && links.length > 0 ? (
        <Stack spacing={1}>
          <List dense disablePadding aria-label={`${endpoint.label} links`}>
            {links.map((link) => (
              <RecordRow
                key={link.key}
                primary={link.label}
                to={workbenchLinkForHref(family, link.href)}
              />
            ))}
          </List>
          <LiveStatus component="p" sx={{ fontSize: "0.75rem" }}>
            {formatNumber(links.length)} linked {links.length === 1 ? "index" : "indexes"}
          </LiveStatus>
        </Stack>
      ) : records.length === 0 ? (
        <EmptyState
          compact
          title="Nothing to list"
          description={`${endpoint.label} answered without a list of records. Open it in the workbench to read the raw response.`}
        />
      ) : (
        <Stack spacing={1}>
          <List dense disablePadding>
            {initial.map(renderRow)}
          </List>
          {rest.length > 0 ? (
            <>
              <Collapse in={showMore} unmountOnExit>
                <List dense disablePadding>
                  {rest.map(renderRow)}
                </List>
              </Collapse>
              <Button
                size="small"
                variant="text"
                aria-expanded={showMore}
                onClick={() => setShowMore((current) => !current)}
                sx={{ alignSelf: "flex-start" }}
              >
                {showMore ? "Show less" : `Show ${formatNumber(rest.length)} more`}
              </Button>
            </>
          ) : null}
          <LiveStatus component="p" sx={{ fontSize: "0.75rem" }}>
            {formatNumber(records.length)} {records.length === 1 ? "record" : "records"}
          </LiveStatus>
        </Stack>
      )}
    </SectionCard>
  );
};

/* ------------------------------------------------------------------ */
/* LookupSection                                                       */
/* ------------------------------------------------------------------ */

type LookupSectionProps = {
  family: ApiFamilyConfig;
  discovered: Record<string, string>;
};

const LookupSection = ({ family, discovered }: LookupSectionProps): JSX.Element | null => {
  const navigate = useNavigate();
  const lookupEndpoints = useMemo(
    () =>
      family.endpoints.filter((endpoint) =>
        (endpoint.parameters ?? []).some((parameter) => parameter.location === "path"),
      ),
    [family],
  );
  const [selectedId, setSelectedId] = useState<string>(
    () => lookupEndpoints[0]?.id ?? "",
  );
  const selected =
    lookupEndpoints.find((endpoint) => endpoint.id === selectedId) ?? lookupEndpoints[0];

  const defaults = useMemo(
    () => (selected ? resolveEndpointRequest(selected, {}, discovered).values : {}),
    [selected, discovered],
  );

  if (!selected) {
    return null;
  }

  const selectId = `${family.slug}-lookup-endpoint`;

  return (
    <SectionCard
      titleAs="h2"
      title="Look up by id"
      icon={<SearchRoundedIcon />}
      description="Pick a record type, enter an id and open it in the API workbench."
    >
      <Stack spacing={2}>
        <FormControl size="small" sx={{ maxWidth: 360 }}>
          <InputLabel id={`${selectId}-label`}>Record type</InputLabel>
          <Select
            labelId={`${selectId}-label`}
            id={selectId}
            label="Record type"
            value={selected.id}
            onChange={(event) => setSelectedId(String(event.target.value))}
          >
            {lookupEndpoints.map((endpoint) => (
              <MenuItem key={endpoint.id} value={endpoint.id}>
                {endpoint.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <EndpointForm
          key={selected.id}
          endpoint={selected}
          values={defaults}
          defaults={defaults}
          submitLabel="Open in workbench"
          idPrefix={`${family.slug}-lookup`}
          onSubmit={(values) => navigate(workbenchLink(family, selected, values))}
        />
      </Stack>
    </SectionCard>
  );
};

/* ------------------------------------------------------------------ */
/* ApiFamilyOverview                                                   */
/* ------------------------------------------------------------------ */

/**
 * Read-only overview of an API family: one h2 section per index endpoint
 * with its records as rows that open the workbench, then a "Look up by id"
 * form so blocked endpoints always have a path forward.
 */
const ApiFamilyOverview = ({ family, pageHeader }: ApiFamilyOverviewProps): JSX.Element => {
  const theme = useTheme();
  const { discoveredPathValues, indexQueries } = useFamilyEndpointDiscovery(family);
  const targets = useMemo(() => detailTargets(family), [family]);
  // Only list endpoints (no path parameters) become record sections; by-id
  // endpoints answer with a single record and are served by "Look up by id".
  const sections = indexQueries.filter(
    (entry): entry is IndexEndpointQuery =>
      entry !== undefined &&
      !(entry.endpoint.parameters ?? []).some(
        (parameter) => parameter.location === "path",
      ),
  );

  return (
    <Stack spacing={theme.wc.layout.sectionGap}>
      {pageHeader ? (
        <PageHeader
          eyebrow={pageHeader.eyebrow}
          breadcrumbs={pageHeader.breadcrumbs}
          title={family.label}
          description={family.description}
          meta={
            <>
              <Chip
                size="small"
                label={`${formatNumber(family.endpoints.length)} ${
                  family.endpoints.length === 1 ? "endpoint" : "endpoints"
                }`}
              />
              <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            </>
          }
          actions={
            <Button component={RouterLink} to={workbenchPath(family)} variant="outlined">
              Open in API workbench
            </Button>
          }
        />
      ) : null}

      {sections.length === 0 ? (
        <EmptyState
          title="No endpoint loads without an id"
          description={`Every ${family.label} endpoint needs a parameter. Use "Look up by id" below or open the workbench.`}
          action={
            <Button component={RouterLink} to={workbenchPath(family)} variant="outlined">
              Open in API workbench
            </Button>
          }
        />
      ) : (
        sections.map((entry) => (
          <IndexSection
            key={entry.endpoint.id}
            family={family}
            entry={entry}
            targets={targets}
          />
        ))
      )}

      <LookupSection family={family} discovered={discoveredPathValues} />
    </Stack>
  );
};

export default ApiFamilyOverview;
