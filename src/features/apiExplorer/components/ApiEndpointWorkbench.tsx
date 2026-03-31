import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded"
import CodeRoundedIcon from "@mui/icons-material/CodeRounded"
import DataObjectRoundedIcon from "@mui/icons-material/DataObjectRounded"
import ImageSearchRoundedIcon from "@mui/icons-material/ImageSearchRounded"
import LinkRoundedIcon from "@mui/icons-material/LinkRounded"
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  Divider,
  Grid,
  Link,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material"
import { useQueries, useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { ApiEndpointDefinition, ApiEndpointParameter, ApiFamilyConfig } from "@/features/apiExplorer/types"
import {
  buildPath,
  collectUrlStrings,
  extractMediaAssets,
  extractPreviewItems,
  matchPathTemplate,
  resolveNamespace,
  resolveParameterKey,
} from "@/features/apiExplorer/utils"
import { blizzardClient, BlizzardRequestError } from "@/lib/blizzardClient"
import { env } from "@/lib/env"

interface ApiEndpointWorkbenchProps {
  family: ApiFamilyConfig
}

type EndpointPanelProps = {
  family: ApiFamilyConfig
  endpoint: ApiEndpointDefinition
  defaultExpanded?: boolean
  suggestedValues?: Record<string, string>
}

type EndpointRequestDetails = {
  values: Record<string, string>
  queryParams: Record<string, string>
  requestPath: string
  unresolvedPathParams: ApiEndpointParameter[]
}

const SAMPLE_PATH_VALUE_CANDIDATES: Record<string, string[]> = {
  connectedRealmId: ["4"],
  raid: ["vault-of-the-incarnates", "sepulcher-of-the-first-ones"],
  faction: ["alliance", "horde"],
}

const areEqualRecords = (left: Record<string, string>, right: Record<string, string>): boolean => {
  const leftEntries = Object.entries(left)
  const rightEntries = Object.entries(right)

  if (leftEntries.length !== rightEntries.length) {
    return false
  }

  return leftEntries.every(([key, value]) => right[key] === value)
}

const resolveErrorMessage = (error: unknown): string => {
  if (error instanceof BlizzardRequestError) {
    return error.details || error.message
  }

  return error instanceof Error ? error.message : "Unable to load endpoint response."
}

const resolveEndpointRequest = (
  endpoint: ApiEndpointDefinition,
  discoveredPathValues: Record<string, string>
): EndpointRequestDetails => {
  const values = Object.fromEntries(
    (endpoint.parameters ?? []).map((parameter) => {
      const discoveredValue = discoveredPathValues[parameter.key]
      const fallbackValue = SAMPLE_PATH_VALUE_CANDIDATES[parameter.key]?.[0]

      return [
        parameter.key,
        discoveredValue ?? parameter.defaultValue ?? (parameter.location === "path" ? fallbackValue ?? "" : ""),
      ]
    })
  )

  const unresolvedPathParams = (endpoint.parameters ?? []).filter(
    (parameter) => parameter.location === "path" && !(values[parameter.key] ?? "").trim()
  )

  const queryParams = Object.fromEntries(
    (endpoint.parameters ?? [])
      .filter((parameter) => parameter.location === "query")
      .map((parameter) => [resolveParameterKey(parameter.key), (values[parameter.key] ?? "").trim()])
      .filter((entry) => entry[1].length > 0)
  )

  return {
    values,
    queryParams,
    requestPath: buildPath(endpoint.path, values),
    unresolvedPathParams,
  }
}

const derivePathValuesFromResponses = (
  family: ApiFamilyConfig,
  discoveredPathValues: Record<string, string>,
  resolvedRequests: EndpointRequestDetails[],
  queryResults: Array<{ isSuccess: boolean; data?: unknown }>
): Record<string, string> => {
  const nextValues = { ...discoveredPathValues }

  queryResults.forEach((result, index) => {
    if (!result.isSuccess) {
      return
    }

    const endpoint = family.endpoints[index]
    const request = resolvedRequests[index]

    ;(endpoint.parameters ?? [])
      .filter((parameter) => parameter.location === "path")
      .forEach((parameter) => {
        const value = request.values[parameter.key]?.trim()

        if (value && !nextValues[parameter.key]) {
          nextValues[parameter.key] = value
        }
      })

    collectUrlStrings(result.data).forEach((href) => {
      family.endpoints.forEach((candidateEndpoint) => {
        const match = matchPathTemplate(candidateEndpoint.path, href)

        if (!match) {
          return
        }

        Object.entries(match).forEach(([key, value]) => {
          if (!nextValues[key]) {
            nextValues[key] = value
          }
        })
      })
    })
  })

  return nextValues
}

const EndpointPanel = ({ family, endpoint, defaultExpanded = false, suggestedValues = {} }: EndpointPanelProps): JSX.Element => {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries((endpoint.parameters ?? []).map((parameter) => [parameter.key, parameter.defaultValue ?? ""]))
  )

  useEffect(() => {
    setValues((current) => {
      const next = { ...current }
      let changed = false

      ;(endpoint.parameters ?? []).forEach((parameter) => {
        if ((next[parameter.key] ?? "").trim().length > 0) {
          return
        }

        const suggestedValue = suggestedValues[parameter.key]?.trim()
        if (suggestedValue) {
          next[parameter.key] = suggestedValue
          changed = true
        }
      })

      return changed ? next : current
    })
  }, [endpoint.parameters, suggestedValues])

  const unresolvedPathParams = useMemo(
    () =>
      (endpoint.parameters ?? []).filter(
        (parameter) => parameter.location === "path" && !(values[parameter.key] ?? "").trim()
      ),
    [endpoint.parameters, values]
  )

  const requestPath = useMemo(() => buildPath(endpoint.path, values), [endpoint.path, values])
  const queryParams = useMemo(
    () =>
      Object.fromEntries(
        (endpoint.parameters ?? [])
          .filter((parameter) => parameter.location === "query")
          .map((parameter) => [resolveParameterKey(parameter.key), (values[parameter.key] ?? "").trim()])
          .filter((entry) => entry[1].length > 0)
      ),
    [endpoint.parameters, values]
  )

  const query = useQuery({
    queryKey: ["api-family-endpoint", family.slug, endpoint.id, requestPath, queryParams, env.region, env.locale],
    queryFn: () =>
      blizzardClient.get<unknown>(requestPath, {
        ...queryParams,
        namespace: resolveNamespace(endpoint.namespace),
      }),
    enabled: expanded && unresolvedPathParams.length === 0,
    retry: false,
  })

  const previewItems = useMemo(() => extractPreviewItems(query.data), [query.data])
  const mediaAssets = useMemo(() => extractMediaAssets(query.data), [query.data])
  const responseTopLevelKeys = useMemo(() => {
    if (!query.data || typeof query.data !== "object") {
      return []
    }

    return Object.keys(query.data as Record<string, unknown>).slice(0, 10)
  }, [query.data])

  const handleChange = (key: string, nextValue: string) => {
    setValues((current) => ({ ...current, [key]: nextValue }))
  }

  const errorMessage = useMemo(() => (query.error ? resolveErrorMessage(query.error) : undefined), [query.error])

  return (
    <Accordion
      disableGutters
      expanded={expanded}
      onChange={(_event, nextExpanded) => setExpanded(nextExpanded)}
      sx={{
        borderRadius: 3,
        overflow: "hidden",
        backgroundColor: "rgba(10, 16, 32, 0.82)",
        border: `1px solid ${family.accentColor}26`,
        "&::before": {
          display: "none",
        },
      }}
    >
      <AccordionSummary expandIcon={<ChevronRightRoundedIcon />}>
        <Stack spacing={1.25} sx={{ width: "100%" }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            alignItems={{ xs: "flex-start", md: "center" }}
            justifyContent="space-between"
          >
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {endpoint.label}
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip label="GET" size="small" color="primary" sx={{ borderRadius: 2 }} />
              <Chip label={endpoint.namespace === "none" ? "No namespace" : `${endpoint.namespace}-${env.region}`} size="small" variant="outlined" sx={{ borderRadius: 2 }} />
            </Stack>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {endpoint.description}
          </Typography>
          <Chip
            icon={<LinkRoundedIcon />}
            label={endpoint.path}
            variant="outlined"
            sx={{ alignSelf: "flex-start", borderRadius: 2, maxWidth: "100%" }}
          />
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={3}>
          {(endpoint.parameters ?? []).length > 0 ? (
            <Grid container spacing={2}>
              {endpoint.parameters?.map((parameter) => (
                <Grid item xs={12} md={6} key={parameter.key}>
                  <TextField
                    fullWidth
                    size="small"
                    label={parameter.label}
                    value={values[parameter.key] ?? ""}
                    placeholder={parameter.placeholder}
                    helperText={parameter.description}
                    onChange={(event) => handleChange(parameter.key, event.target.value)}
                  />
                </Grid>
              ))}
            </Grid>
          ) : null}

          {unresolvedPathParams.length > 0 ? (
            <Alert severity="info" sx={{ borderRadius: 3 }}>
              Fill in {unresolvedPathParams.map((parameter) => parameter.label).join(", ")} to load this endpoint.
            </Alert>
          ) : null}

          {query.isError ? (
            <Alert severity="warning" sx={{ borderRadius: 3 }}>
              {errorMessage}
            </Alert>
          ) : null}

          {query.isSuccess ? (
            <Stack spacing={2.5}>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {responseTopLevelKeys.map((key) => (
                  <Chip key={key} label={key} size="small" variant="outlined" sx={{ borderRadius: 2 }} />
                ))}
              </Stack>

              {previewItems.length > 0 ? (
                <Stack spacing={1.25}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <DataObjectRoundedIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle2" color="text.secondary">
                      Response preview
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {previewItems.map((entry) => (
                      <Chip key={entry} label={entry} sx={{ borderRadius: 2 }} />
                    ))}
                  </Stack>
                </Stack>
              ) : null}

              {mediaAssets.length > 0 ? (
                <Stack spacing={1.25}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <ImageSearchRoundedIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle2" color="text.secondary">
                      Media assets
                    </Typography>
                  </Stack>
                  <Grid container spacing={2}>
                    {mediaAssets.slice(0, 6).map((asset) => (
                      <Grid item xs={12} sm={6} md={4} key={`${endpoint.id}-${asset.key}`}>
                        <Box
                          sx={{
                            p: 2,
                            borderRadius: 3,
                            border: `1px solid ${family.accentColor}24`,
                            backgroundColor: "rgba(6, 10, 20, 0.62)",
                          }}
                        >
                          <Stack spacing={1.25}>
                            <Typography variant="caption" color="text.secondary">
                              {asset.key}
                            </Typography>
                            <Box
                              component="img"
                              src={asset.value}
                              alt={asset.key}
                              sx={{ width: 56, height: 56, borderRadius: 2, objectFit: "cover" }}
                            />
                            <Link href={asset.value} target="_blank" rel="noreferrer" underline="hover">
                              Open asset
                            </Link>
                          </Stack>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Stack>
              ) : null}

              <Stack spacing={1.25}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <CodeRoundedIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2" color="text.secondary">
                    Raw JSON
                  </Typography>
                </Stack>
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    p: 2,
                    borderRadius: 3,
                    overflowX: "auto",
                    maxHeight: 420,
                    bgcolor: "rgba(4, 8, 16, 0.92)",
                    border: `1px solid ${family.accentColor}1f`,
                    color: "#d7e3ff",
                    fontSize: "0.78rem",
                    lineHeight: 1.6,
                  }}
                >
                  {JSON.stringify(query.data, null, 2)}
                </Box>
              </Stack>
            </Stack>
          ) : null}
        </Stack>
      </AccordionDetails>
    </Accordion>
  )
}

const EndpointCoverageCard = ({
  family,
  endpoint,
  request,
  query,
}: {
  family: ApiFamilyConfig
  endpoint: ApiEndpointDefinition
  request: EndpointRequestDetails
  query: {
    isError: boolean
    isFetching: boolean
    isPending: boolean
    isSuccess: boolean
    error: unknown
    data?: unknown
  }
}): JSX.Element => {
  const previewItems = useMemo(() => extractPreviewItems(query.data), [query.data])
  const mediaAssets = useMemo(() => extractMediaAssets(query.data), [query.data])
  const responseTopLevelKeys = useMemo(() => {
    if (!query.data || typeof query.data !== "object") {
      return []
    }

    return Object.keys(query.data as Record<string, unknown>).slice(0, 6)
  }, [query.data])

  const unresolvedLabels = request.unresolvedPathParams.map((parameter) => parameter.label)
  const statusLabel = request.unresolvedPathParams.length > 0
    ? "Blocked"
    : query.isSuccess
      ? "Live"
      : query.isError
        ? "Error"
        : query.isPending || query.isFetching
          ? "Loading"
          : "Queued"

  const statusColor = request.unresolvedPathParams.length > 0
    ? "default"
    : query.isSuccess
      ? "success"
      : query.isError
        ? "warning"
        : "primary"

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        height: "100%",
        borderRadius: 3,
        backgroundColor: "rgba(10, 16, 32, 0.72)",
        borderColor: `${family.accentColor}33`,
      }}
    >
      <Stack spacing={2} sx={{ height: "100%" }}>
        <Stack direction="row" spacing={1.25} justifyContent="space-between" alignItems="flex-start">
          <Stack spacing={0.75}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {endpoint.label}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {endpoint.description}
            </Typography>
          </Stack>
          <Chip label={statusLabel} color={statusColor} size="small" sx={{ borderRadius: 2 }} />
        </Stack>

        <Chip
          icon={<LinkRoundedIcon />}
          label={request.requestPath}
          size="small"
          variant="outlined"
          sx={{ alignSelf: "flex-start", borderRadius: 2, maxWidth: "100%" }}
        />

        {request.unresolvedPathParams.length > 0 ? (
          <Alert severity="info" sx={{ borderRadius: 3 }}>
            Waiting for sample values for {unresolvedLabels.join(", ")}.
          </Alert>
        ) : null}

        {query.isError ? (
          <Alert severity="warning" sx={{ borderRadius: 3 }}>
            {resolveErrorMessage(query.error)}
          </Alert>
        ) : null}

        {query.isPending || query.isFetching ? (
          <Stack spacing={1.25}>
            <Skeleton variant="rounded" height={24} sx={{ borderRadius: 2, bgcolor: "rgba(148, 163, 184, 0.16)" }} />
            <Skeleton variant="rounded" height={68} sx={{ borderRadius: 2, bgcolor: "rgba(148, 163, 184, 0.12)" }} />
          </Stack>
        ) : null}

        {query.isSuccess ? (
          <Stack spacing={1.5}>
            {responseTopLevelKeys.length > 0 ? (
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {responseTopLevelKeys.map((key) => (
                  <Chip key={key} label={key} size="small" variant="outlined" sx={{ borderRadius: 2 }} />
                ))}
              </Stack>
            ) : null}

            {previewItems.length > 0 ? (
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {previewItems.slice(0, 5).map((item) => (
                  <Chip key={item} label={item} sx={{ borderRadius: 2 }} />
                ))}
              </Stack>
            ) : null}

            {mediaAssets.length > 0 ? (
              <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap">
                {mediaAssets.slice(0, 3).map((asset) => (
                  <Box
                    key={`${endpoint.id}-${asset.key}`}
                    component="img"
                    src={asset.value}
                    alt={asset.key}
                    sx={{ width: 48, height: 48, borderRadius: 2, objectFit: "cover" }}
                  />
                ))}
              </Stack>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  )
}

const ApiEndpointWorkbench = ({ family }: ApiEndpointWorkbenchProps): JSX.Element => {
  const [discoveredPathValues, setDiscoveredPathValues] = useState<Record<string, string>>({})

  useEffect(() => {
    setDiscoveredPathValues({})
  }, [family.slug])

  const resolvedRequests = useMemo(
    () => family.endpoints.map((endpoint) => resolveEndpointRequest(endpoint, discoveredPathValues)),
    [discoveredPathValues, family.endpoints]
  )

  const endpointQueries = useQueries({
    queries: family.endpoints.map((endpoint, index) => {
      const request = resolvedRequests[index]

      return {
        queryKey: [
          "api-family-endpoint-auto",
          family.slug,
          endpoint.id,
          request.requestPath,
          request.queryParams,
          env.region,
          env.locale,
        ],
        queryFn: () =>
          blizzardClient.get<unknown>(request.requestPath, {
            ...request.queryParams,
            namespace: resolveNamespace(endpoint.namespace),
          }),
        enabled: request.unresolvedPathParams.length === 0,
        retry: false,
        staleTime: 300000,
      }
    }),
  })

  useEffect(() => {
    const nextValues = derivePathValuesFromResponses(
      family,
      discoveredPathValues,
      resolvedRequests,
      endpointQueries.map((query) => ({
        isSuccess: query.isSuccess,
        data: query.data,
      }))
    )

    if (!areEqualRecords(discoveredPathValues, nextValues)) {
      setDiscoveredPathValues(nextValues)
    }
  }, [discoveredPathValues, endpointQueries, family, resolvedRequests])

  const successCount = endpointQueries.filter((query) => query.isSuccess).length
  const errorCount = endpointQueries.filter((query) => query.isError).length
  const blockedCount = resolvedRequests.filter((request) => request.unresolvedPathParams.length > 0).length
  const loadingCount = endpointQueries.filter((query) => query.isPending || query.isFetching).length

  return (
    <Stack spacing={4}>
      <Stack spacing={1}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Live endpoint explorer
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Every endpoint in {family.label} is sampled automatically when this page loads. Use the overview for fast coverage, then drill into any panel for raw JSON and manual parameter changes.
        </Typography>
      </Stack>

      <Stack spacing={2}>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Chip label={`${successCount}/${family.endpoints.length} live`} color="success" variant="outlined" sx={{ borderRadius: 2 }} />
          <Chip label={`${loadingCount} loading`} color="primary" variant="outlined" sx={{ borderRadius: 2 }} />
          <Chip label={`${blockedCount} blocked`} variant="outlined" sx={{ borderRadius: 2 }} />
          <Chip label={`${errorCount} errors`} color="warning" variant="outlined" sx={{ borderRadius: 2 }} />
        </Stack>

        <Grid container spacing={2.5}>
          {family.endpoints.map((endpoint, index) => (
            <Grid item xs={12} md={6} xl={4} key={`${family.slug}-${endpoint.id}-coverage`}>
              <EndpointCoverageCard
                family={family}
                endpoint={endpoint}
                request={resolvedRequests[index]}
                query={{
                  isError: endpointQueries[index].isError,
                  isFetching: endpointQueries[index].isFetching,
                  isPending: endpointQueries[index].isPending,
                  isSuccess: endpointQueries[index].isSuccess,
                  error: endpointQueries[index].error,
                  data: endpointQueries[index].data,
                }}
              />
            </Grid>
          ))}
        </Grid>
      </Stack>

      <Divider flexItem sx={{ borderColor: `${family.accentColor}24` }} />

      <Stack spacing={2}>
        {family.endpoints.map((endpoint, index) => (
          <EndpointPanel
            key={`${family.slug}-${endpoint.id}`}
            family={family}
            endpoint={endpoint}
            defaultExpanded={index === 0}
            suggestedValues={resolvedRequests[index].values}
          />
        ))}
      </Stack>
    </Stack>
  )
}

export default ApiEndpointWorkbench