import LinkRoundedIcon from "@mui/icons-material/LinkRounded"
import {
  Alert,
  Box,
  Chip,
  Grid,
  Link,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material"
import { useQueries } from "@tanstack/react-query"
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

const ApiFamilyGallery = ({ family }: { family: ApiFamilyConfig }): JSX.Element => {
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
        queryKey: ["api-family-gallery", family.slug, endpoint.id, request.requestPath, request.queryParams, env.region, env.locale],
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

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {family.label} Gallery
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Live snapshots pulled from the endpoints behind this API family. This keeps the page visual and browseable instead of exposing raw request forms.
        </Typography>
      </Stack>

      <Grid container spacing={3}>
        {family.endpoints.map((endpoint, index) => {
          const query = endpointQueries[index]
          const request = resolvedRequests[index]
          const previewItems = extractPreviewItems(query.data)
          const mediaAssets = extractMediaAssets(query.data)

          return (
            <Grid item xs={12} md={6} xl={4} key={`${family.slug}-${endpoint.id}`}>
              <Paper
                variant="outlined"
                sx={{
                  height: "100%",
                  p: 2.5,
                  borderRadius: 3,
                  backgroundColor: "rgba(10, 16, 32, 0.72)",
                  borderColor: `${family.accentColor}33`,
                }}
              >
                <Stack spacing={2} sx={{ height: "100%" }}>
                  <Stack spacing={0.75}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {endpoint.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {endpoint.description}
                    </Typography>
                  </Stack>

                  <Chip
                    icon={<LinkRoundedIcon />}
                    label={request.requestPath}
                    variant="outlined"
                    size="small"
                    sx={{ alignSelf: "flex-start", borderRadius: 2, maxWidth: "100%" }}
                  />

                  {request.unresolvedPathParams.length > 0 ? (
                    <Alert severity="info" sx={{ borderRadius: 3 }}>
                      Waiting for {request.unresolvedPathParams.map((parameter) => parameter.label).join(", ")}.
                    </Alert>
                  ) : null}

                  {query.isPending || query.isFetching ? (
                    <Stack spacing={1.25}>
                      <Skeleton variant="rounded" height={140} sx={{ borderRadius: 3, bgcolor: "rgba(148, 163, 184, 0.12)" }} />
                    </Stack>
                  ) : null}

                  {query.isError ? (
                    <Alert severity="warning" sx={{ borderRadius: 3 }}>
                      {resolveErrorMessage(query.error)}
                    </Alert>
                  ) : null}

                  {query.isSuccess ? (
                    <Stack spacing={1.5} sx={{ mt: "auto" }}>
                      {mediaAssets.length > 0 ? (
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                          {mediaAssets.slice(0, 4).map((asset) => (
                            <Box
                              key={`${endpoint.id}-${asset.key}`}
                              component="img"
                              src={asset.value}
                              alt={asset.key}
                              sx={{ width: 64, height: 64, borderRadius: 2, objectFit: "cover" }}
                            />
                          ))}
                        </Stack>
                      ) : null}

                      {previewItems.length > 0 ? (
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                          {previewItems.slice(0, 8).map((item) => (
                            <Chip key={`${endpoint.id}-${item}`} label={item} sx={{ borderRadius: 2 }} />
                          ))}
                        </Stack>
                      ) : null}

                      <Link href={request.requestPath} color="primary" underline="hover" sx={{ alignSelf: "flex-start" }}>
                        Live endpoint path
                      </Link>
                    </Stack>
                  ) : null}
                </Stack>
              </Paper>
            </Grid>
          )
        })}
      </Grid>
    </Stack>
  )
}

export default ApiFamilyGallery