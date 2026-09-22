import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import KeyRoundedIcon from "@mui/icons-material/KeyRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import { memo, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { ExplorerFilterBar, SearchField } from "@/components/common/ExplorerFilterBar";
import {
  EmptyState,
  ErrorState,
  InlineProgress,
  LoadingSkeleton,
} from "@/components/common/StateBlocks";
import type {
  ApiEndpointDefinition,
  ApiFamilyConfig,
} from "@/features/apiExplorer/types";
import { resolveNamespace } from "@/features/apiExplorer/utils";
import EndpointForm from "@/features/apiExplorer/workbench/EndpointForm";
import {
  describeEndpointError,
  needsIdCopy,
} from "@/features/apiExplorer/workbench/errorMessages";
import JsonViewer, {
  CopyApiUrlButton,
} from "@/features/apiExplorer/workbench/JsonViewer";
import { JSON_VIEWER_MAX_HEIGHT } from "@/features/apiExplorer/workbench/jsonTokens";
import {
  resolveEndpointRequest,
  useEndpointRequest,
  useFamilyEndpointDiscovery,
} from "@/features/apiExplorer/workbench/useEndpointRequest";
import { formatNumber } from "@/lib/format";

export type ApiEndpointWorkbenchProps = {
  family: ApiFamilyConfig;
  /** Endpoint expanded when the URL has no `endpoint` param (first by default). */
  initialEndpointId?: string;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const ENDPOINT_PARAM = "endpoint";

/**
 * Height of the loading placeholder: the viewer's `<pre>` at max height plus
 * its padding and border, the viewer header, the summary caption and the
 * progress bar, so a loaded panel does not shift the accordions below it.
 */
const RESPONSE_PLACEHOLDER_HEIGHT = JSON_VIEWER_MAX_HEIGHT + 120;

/** Values the URL currently holds for an endpoint's parameters ("" when absent). */
const appliedValuesFor = (
  endpoint: ApiEndpointDefinition,
  searchParams: URLSearchParams,
): Record<string, string> =>
  Object.fromEntries(
    (endpoint.parameters ?? []).map((parameter) => [
      parameter.key,
      searchParams.get(parameter.key) ?? "",
    ]),
  );

/** Non-empty applied values layered over the resolved defaults. */
const mergeOverDefaults = (
  defaults: Record<string, string>,
  applied: Record<string, string>,
): Record<string, string> => {
  const merged = { ...defaults };
  Object.entries(applied).forEach(([key, value]) => {
    if (value.trim().length > 0) {
      merged[key] = value;
    }
  });
  return merged;
};

const describeData = (data: unknown): string => {
  if (Array.isArray(data)) {
    return `Array · ${formatNumber(data.length)} ${data.length === 1 ? "item" : "items"}`;
  }
  if (data && typeof data === "object") {
    const size = Object.keys(data as Record<string, unknown>).length;
    return `Object · ${formatNumber(size)} ${size === 1 ? "key" : "keys"}`;
  }
  if (data === undefined) {
    return "Empty response";
  }
  return typeof data;
};

const matchesFilter = (endpoint: ApiEndpointDefinition, filter: string): boolean => {
  const needle = filter.trim().toLowerCase();
  if (needle.length === 0) {
    return true;
  }
  return [endpoint.label, endpoint.path, endpoint.description].some((field) =>
    field.toLowerCase().includes(needle),
  );
};

/* ------------------------------------------------------------------ */
/* EndpointPanel                                                       */
/* ------------------------------------------------------------------ */

type EndpointPanelProps = {
  family: ApiFamilyConfig;
  endpoint: ApiEndpointDefinition;
  expanded: boolean;
  onToggle: (endpointId: string, open: boolean) => void;
  /** The current URL; parameter values are read from it. */
  searchParams: URLSearchParams;
  discovered: Record<string, string>;
  onSubmit: (endpoint: ApiEndpointDefinition, values: Record<string, string>) => void;
};

/**
 * Details of one panel. Mounted only while the accordion is open
 * (`unmountOnExit`), so collapsed panels render no form and no viewer.
 */
const EndpointPanelDetails = ({
  family,
  endpoint,
  expanded,
  onToggle,
  searchParams,
  discovered,
  onSubmit,
}: EndpointPanelProps): JSX.Element => {
  const parameters = endpoint.parameters ?? [];

  const appliedValues = useMemo(
    () => appliedValuesFor(endpoint, searchParams),
    [endpoint, searchParams],
  );
  const defaults = useMemo(
    () => resolveEndpointRequest(endpoint, {}, discovered).values,
    [endpoint, discovered],
  );
  const formValues = useMemo(
    () => mergeOverDefaults(defaults, appliedValues),
    [defaults, appliedValues],
  );

  const { request, query, apiUrl } = useEndpointRequest({
    family,
    endpoint,
    values: appliedValues,
    discovered,
    enabled: expanded,
  });

  const handleSubmit = useCallback(
    (values: Record<string, string>) => onSubmit(endpoint, values),
    [endpoint, onSubmit],
  );

  const queryString = new URLSearchParams(request.queryParams).toString();
  const requestLine = `${request.requestPath}${queryString ? `?${queryString}` : ""}`;
  const isBlocked = request.unresolvedPathParams.length > 0;

  const errorCopy = useMemo(
    () =>
      query.isError ? describeEndpointError(query.error, endpoint, family) : null,
    [query.isError, query.error, endpoint, family],
  );
  const suggested = errorCopy?.suggestedEndpoint;

  return (
    <Stack spacing={3}>
      {parameters.length > 0 ? (
        <EndpointForm
          endpoint={endpoint}
          values={formValues}
          defaults={defaults}
          onSubmit={handleSubmit}
          idPrefix={`${family.slug}-${endpoint.id}`}
        />
      ) : null}

      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
        <Typography
          component="code"
          variant="body2"
          sx={(theme) => ({
            fontFamily: theme.wc.fontMono,
            overflowWrap: "anywhere",
            minWidth: 0,
          })}
        >
          {requestLine}
        </Typography>
        <CopyApiUrlButton apiUrl={apiUrl} label={endpoint.label} />
      </Stack>

      {isBlocked ? (
        <EmptyState
          compact
          icon={<KeyRoundedIcon />}
          {...needsIdCopy(request.unresolvedPathParams)}
        />
      ) : query.isLoading ? (
        <LoadingSkeleton
          variant="block"
          height={RESPONSE_PLACEHOLDER_HEIGHT}
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
            suggested ? (
              <Button
                size="small"
                variant="text"
                color="inherit"
                onClick={() => onToggle(suggested.id, true)}
              >
                Open {suggested.label}
              </Button>
            ) : undefined
          }
        />
      ) : query.isSuccess ? (
        <Stack spacing={1.5}>
          <InlineProgress
            active={query.isFetching}
            label={`Refreshing ${endpoint.label}`}
          />
          <Typography variant="caption" color="text.secondary" component="p">
            {describeData(query.data)}
          </Typography>
          <JsonViewer
            data={query.data}
            label={endpoint.label}
            fileName={`${family.slug}-${endpoint.id}`}
            apiUrl={apiUrl}
          />
        </Stack>
      ) : null}
    </Stack>
  );
};

const EndpointPanel = memo((props: EndpointPanelProps): JSX.Element => {
  const { endpoint, expanded, onToggle } = props;
  const summaryId = `${endpoint.id}-summary`;
  const detailsId = `${endpoint.id}-details`;
  const labelId = `${summaryId}-label`;
  const descriptionId = `${summaryId}-description`;
  const namespaceLabel = resolveNamespace(endpoint.namespace) ?? "No namespace";

  return (
    <Accordion
      disableGutters
      expanded={expanded}
      onChange={(_event, open) => onToggle(endpoint.id, open)}
      slotProps={{
        // The panels sit directly under the page h1, so the summary heading
        // MUI wraps the button in is an h2 (its default h3 would skip a
        // level). Named by the label alone so heading navigation reads
        // "Item", not the chips, description and path as well.
        heading: { component: "h2", "aria-labelledby": labelId },
        // Collapsed panels mount no form or viewer; the URL holds the state.
        transition: { unmountOnExit: true },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreRoundedIcon />}
        aria-controls={detailsId}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        id={summaryId}
      >
        <Stack spacing={0.75} sx={{ width: "100%", minWidth: 0, paddingRight: 1 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
            useFlexGap
          >
            <Typography id={labelId} variant="h6" component="span" sx={{ minWidth: 0 }}>
              {endpoint.label}
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip label="GET" size="small" color="primary" />
              <Chip label={namespaceLabel} size="small" variant="outlined" />
            </Stack>
          </Stack>
          <Typography
            id={descriptionId}
            variant="caption"
            component="span"
            color="text.secondary"
          >
            {endpoint.description}
          </Typography>
          <Typography
            variant="caption"
            component="span"
            color="text.secondary"
            sx={(theme) => ({
              fontFamily: theme.wc.fontMono,
              overflowWrap: "anywhere",
            })}
          >
            {endpoint.path}
          </Typography>
        </Stack>
      </AccordionSummary>

      {/* MUI renders the role="region" wrapper with `detailsId` itself. */}
      <AccordionDetails>
        <EndpointPanelDetails {...props} />
      </AccordionDetails>
    </Accordion>
  );
});
EndpointPanel.displayName = "EndpointPanel";

/* ------------------------------------------------------------------ */
/* ApiEndpointWorkbench                                                */
/* ------------------------------------------------------------------ */

/**
 * One accordion panel per endpoint of a family: a parameter form, the
 * resolved request line and the raw JSON. The URL holds the expanded
 * endpoint (`?endpoint=`) and every submitted parameter value.
 */
const ApiEndpointWorkbench = ({
  family,
  initialEndpointId,
}: ApiEndpointWorkbenchProps): JSX.Element => {
  // Only the discovered ids are needed here; the panels fetch their own
  // responses (sharing the cache), so nothing is downloaded for a family
  // that has no blank path parameter.
  const { discoveredPathValues } = useFamilyEndpointDiscovery(family, {
    mode: "discovery",
  });
  const [searchParams, setSearchParams] = useSearchParams();

  const defaultEndpointId = initialEndpointId ?? family.endpoints[0]?.id ?? "";
  const urlEndpointId = searchParams.get(ENDPOINT_PARAM) ?? "";
  // Lets the user collapse the default panel without writing a sentinel to the URL.
  const [defaultDismissed, setDefaultDismissed] = useState(false);
  const activeEndpointId =
    urlEndpointId || (defaultDismissed ? "" : defaultEndpointId);

  const endpointsById = useMemo(
    () => new Map(family.endpoints.map((endpoint) => [endpoint.id, endpoint])),
    [family],
  );
  const allParameterKeys = useMemo(
    () =>
      new Set(
        family.endpoints.flatMap((endpoint) =>
          (endpoint.parameters ?? []).map((parameter) => parameter.key),
        ),
      ),
    [family],
  );

  const toggleEndpoint = useCallback(
    (endpointId: string, open: boolean) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (!open) {
            next.delete(ENDPOINT_PARAM);
            return next;
          }
          next.set(ENDPOINT_PARAM, endpointId);
          // Drop parameters the newly opened endpoint does not take, so a
          // shared URL never carries another panel's id.
          const keep = new Set(
            (endpointsById.get(endpointId)?.parameters ?? []).map(
              (parameter) => parameter.key,
            ),
          );
          allParameterKeys.forEach((key) => {
            if (!keep.has(key)) {
              next.delete(key);
            }
          });
          return next;
        },
        { replace: true, preventScrollReset: true },
      );
      setDefaultDismissed(!open);
    },
    [allParameterKeys, endpointsById, setSearchParams],
  );

  const applyValues = useCallback(
    (endpoint: ApiEndpointDefinition, values: Record<string, string>) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          (endpoint.parameters ?? []).forEach((parameter) => {
            const value = values[parameter.key]?.trim() ?? "";
            if (value.length > 0) {
              next.set(parameter.key, value);
            } else {
              next.delete(parameter.key);
            }
          });
          next.set(ENDPOINT_PARAM, endpoint.id);
          return next;
        },
        { replace: true, preventScrollReset: true },
      );
      setDefaultDismissed(false);
    },
    [setSearchParams],
  );

  const [filterInput, setFilterInput] = useState("");
  const [filter, setFilter] = useState("");

  const visible = useMemo(
    () => family.endpoints.filter((endpoint) => matchesFilter(endpoint, filter)),
    [family, filter],
  );

  const summary = `Showing ${formatNumber(visible.length)} of ${formatNumber(
    family.endpoints.length,
  )} endpoints`;

  return (
    <Stack spacing={2}>
      <ExplorerFilterBar label="Filter endpoints" summary={summary}>
        <SearchField
          label="Filter endpoints"
          placeholder="Filter by name or path"
          value={filterInput}
          onChange={setFilterInput}
          onDebouncedChange={setFilter}
          size="small"
        />
      </ExplorerFilterBar>

      {visible.length === 0 ? (
        <EmptyState
          compact
          title="No endpoints match"
          description={`Nothing in ${family.label} matches "${filter.trim()}".`}
        />
      ) : (
        <Stack spacing={1.5}>
          {visible.map((endpoint) => (
            <EndpointPanel
              key={endpoint.id}
              family={family}
              endpoint={endpoint}
              expanded={activeEndpointId === endpoint.id}
              onToggle={toggleEndpoint}
              searchParams={searchParams}
              discovered={discoveredPathValues}
              onSubmit={applyValues}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
};

export default ApiEndpointWorkbench;
