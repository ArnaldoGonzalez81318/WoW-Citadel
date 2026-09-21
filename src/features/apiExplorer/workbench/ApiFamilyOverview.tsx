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
import { matchPathTemplate, summarizeEntry } from "@/features/apiExplorer/utils";
import EndpointForm from "@/features/apiExplorer/workbench/EndpointForm";
import { describeEndpointError } from "@/features/apiExplorer/workbench/errorMessages";
import { CopyApiUrlButton } from "@/features/apiExplorer/workbench/JsonViewer";
import {
  buildPublicApiUrl,
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

export const workbenchPath = (family: ApiFamilyConfig): string =>
  `/api-explorer/${family.slug}`;

/** `/api-explorer/{slug}?endpoint={id}&{param}={value}` — the workbench pre-filled. */
export const workbenchLink = (
  family: ApiFamilyConfig,
  endpoint: ApiEndpointDefinition,
  values: Record<string, string>,
): string => {
  const params = new URLSearchParams({ endpoint: endpoint.id });
  Object.entries(values).forEach(([key, value]) => {
    if (value.trim().length > 0) {
      params.set(key, value.trim());
    }
  });
  return `${workbenchPath(family)}?${params.toString()}`;
};

type IndexRecord = {
  /** Stable React key: the record id, its `key.href`, or its index. */
  key: string;
  id?: number;
  label: string;
  href?: string;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const recordHref = (record: Record<string, unknown>): string | undefined => {
  const key = asRecord(record.key);
  return typeof key?.href === "string" ? key.href : undefined;
};

/**
 * The list an index / search response carries: `results[].data` entries
 * first, otherwise the first array value in the response.
 */
export const extractIndexRecords = (data: unknown): IndexRecord[] => {
  const root = asRecord(data);
  if (!root) {
    return [];
  }

  let entries: unknown[] = [];
  if (Array.isArray(root.results)) {
    entries = root.results.map((entry) => {
      const wrapper = asRecord(entry);
      return wrapper && "data" in wrapper ? wrapper.data : entry;
    });
  } else {
    const firstArray = Object.values(root).find((value) => Array.isArray(value));
    entries = Array.isArray(firstArray) ? firstArray : [];
  }

  const seen = new Set<string>();

  return entries.map((entry, index) => {
    const record = asRecord(entry);
    const id = typeof record?.id === "number" ? record.id : undefined;
    const href = record ? recordHref(record) : undefined;
    const base = id !== undefined ? String(id) : (href ?? String(index));
    // Keys must be unique even when an index repeats an id or href.
    const key = seen.has(base) ? `${base}-${index}` : base;
    seen.add(key);
    return { key, id, label: summarizeEntry(entry), href };
  });
};

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
 * record's `key.href`, else the index's namesake (`quest-index` → `quest`).
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

  const namesakeId = indexEndpoint.id.replace(/-index$/, "");
  const target =
    targets.find((candidate) => candidate.endpoint.id === namesakeId) ??
    targets[0];
  return target
    ? workbenchLink(family, target.endpoint, {
        [target.parameter.key]: String(record.id),
      })
    : undefined;
};

/* ------------------------------------------------------------------ */
/* IndexSection                                                        */
/* ------------------------------------------------------------------ */

type IndexSectionProps = {
  family: ApiFamilyConfig;
  entry: IndexEndpointQuery;
  targets: DetailTarget[];
};

const IndexSection = ({ family, entry, targets }: IndexSectionProps): JSX.Element => {
  const { endpoint, request, query } = entry;
  const [showMore, setShowMore] = useState(false);

  const apiUrl = useMemo(() => buildPublicApiUrl(endpoint, request), [endpoint, request]);

  const records = useMemo(
    () => (query.isSuccess ? extractIndexRecords(query.data) : []),
    [query.isSuccess, query.data],
  );
  const shown = records.slice(0, MAX_ROWS);
  const initial = shown.slice(0, INITIAL_ROWS);
  const rest = shown.slice(INITIAL_ROWS);

  const errorCopy = useMemo(
    () => (query.isError ? describeEndpointError(query.error, endpoint, family) : null),
    [query.isError, query.error, endpoint, family],
  );

  const renderRow = (record: IndexRecord): JSX.Element => {
    const to = resolveDetailLink(family, endpoint, targets, record);
    const secondary =
      record.id !== undefined ? (
        <Typography
          component="span"
          variant="caption"
          color="text.secondary"
          sx={(theme) => ({ fontFamily: theme.wc.fontMono })}
        >
          ID {record.id}
        </Typography>
      ) : undefined;

    if (to) {
      return (
        <ListItemButton
          key={record.key}
          component={RouterLink}
          to={to}
          sx={(theme) => ({ borderRadius: `${theme.wc.radius.sm}px` })}
        >
          <ListItemText
            primary={record.label}
            secondary={secondary}
            slotProps={{
              primary: { variant: "body2" },
              secondary: { component: "span" },
            }}
          />
        </ListItemButton>
      );
    }

    return (
      <ListItem key={record.key}>
        <ListItemText
          primary={record.label}
          secondary={secondary}
          slotProps={{
            primary: { variant: "body2" },
            secondary: { component: "span" },
          }}
        />
      </ListItem>
    );
  };

  return (
    <SectionCard
      titleAs="h2"
      title={endpoint.label}
      description={endpoint.description}
      padding="compact"
      actions={
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
          <Typography
            component="code"
            variant="caption"
            color="text.secondary"
            sx={(theme) => ({
              fontFamily: theme.wc.fontMono,
              overflowWrap: "anywhere",
              display: { xs: "none", sm: "inline" },
            })}
          >
            {request.requestPath}
          </Typography>
          <CopyApiUrlButton apiUrl={apiUrl} label={endpoint.label} />
        </Stack>
      }
    >
      {query.isLoading ? (
        <LoadingSkeleton
          variant="rows"
          count={6}
          itemHeight={44}
          gap={4}
          label={`Loading ${endpoint.label}`}
        />
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
            errorCopy.hint ? (
              <Typography variant="body2" component="p" sx={{ margin: 0 }}>
                {errorCopy.hint}
              </Typography>
            ) : undefined
          }
        />
      ) : records.length === 0 ? (
        <EmptyState compact title="No records returned" />
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
              {!showMore ? (
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setShowMore(true)}
                  sx={{ alignSelf: "flex-start" }}
                >
                  Show {formatNumber(rest.length)} more
                </Button>
              ) : null}
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
      description="Pick an endpoint, enter its id and open the raw response in the workbench."
    >
      <Stack spacing={2}>
        <FormControl size="small" sx={{ maxWidth: 360 }}>
          <InputLabel id={`${selectId}-label`}>Endpoint</InputLabel>
          <Select
            labelId={`${selectId}-label`}
            id={selectId}
            label="Endpoint"
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
