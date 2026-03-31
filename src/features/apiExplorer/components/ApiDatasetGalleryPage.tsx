import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material"
import { useQueries } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useState } from "react"
import CloseRoundedIcon from "@mui/icons-material/CloseRounded"
import ResultCard from "@/components/common/ResultCard"
import VirtualizedCardGrid from "@/components/common/VirtualizedCardGrid"
import useInfiniteScrollTrigger from "@/hooks/useInfiniteScrollTrigger"
import useIdlePrefetchWindow from "@/hooks/useIdlePrefetchWindow"
import { getApiFamilyConfigBySlug } from "@/features/apiExplorer/config/apiCatalog"
import { ApiEndpointDefinition } from "@/features/apiExplorer/types"
import {
  buildPath,
  resolveLocalizedString,
  resolveNamespace,
  resolveParameterKey,
  summarizeEntry,
} from "@/features/apiExplorer/utils"
import { SearchResult } from "@/features/search/types"
import { blizzardClient } from "@/lib/blizzardClient"
import { env, getApiBaseUrl, shouldUseBlizzardProxy } from "@/lib/env"

type ApiDatasetGalleryPageProps = {
  slug: string
}

type GalleryCard = SearchResult & {
  key: string
  mediaRequestPath?: string
  mediaRequestNamespace?: string
}

type GallerySection = {
  id: string
  label: string
  cards: GalleryCard[]
  totalEntries: number
}

type MediaQueryTarget = {
  token: string
  path: string
  namespace: string | undefined
}

type EndpointRequestDetails = {
  requestPath: string
  queryParams: Record<string, string>
  namespace: string | undefined
}

type GallerySectionBlockProps = {
  section: GallerySection
  accentColor: string
  onCardClick: (card: GalleryCard) => void
}

const SECTION_BATCH_SIZE = 30

const GALLERY_SOURCE_ENDPOINT_IDS: Record<string, string[]> = {
  achievement: ["achievement-index", "achievement-category-index"],
  "item-appearance": [
    "item-appearance-search",
    "item-appearance-set-index",
    "item-appearance-slot-index",
  ],
  heirloom: ["heirloom-index"],
  pet: ["pet-index"],
  spells: ["spell-search"],
  talent: ["talent-tree-index", "talent-index", "pvp-talent-index"],
  "tech-talent": ["tech-talent-tree-index", "tech-talent-index"],
  toy: ["toy-index"],
  "modified-crafting": [
    "modified-crafting-index",
    "modified-crafting-category-index",
    "modified-crafting-slot-type-index",
  ],
  "housing-decor": [
    "decor-index",
    "fixture-index",
    "fixture-hook-index",
    "room-index",
  ],
  "playable-class": ["playable-class-index"],
  "playable-race": ["playable-race-index"],
  "playable-specialization": ["playable-specialization-index"],
  "power-type": ["power-type-index"],
  title: ["title-index"],
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : undefined

const asAssetList = (value: unknown): Array<{ key?: string; value?: string }> =>
  Array.isArray(value) ? (value as Array<{ key?: string; value?: string }>) : []

const resolveEndpointRequest = (endpoint: ApiEndpointDefinition): EndpointRequestDetails => {
  const values = Object.fromEntries(
    (endpoint.parameters ?? []).map((parameter) => [parameter.key, parameter.defaultValue ?? ""])
  )

  const queryParams = Object.fromEntries(
    (endpoint.parameters ?? [])
      .filter((parameter) => parameter.location === "query")
      .map((parameter) => [resolveParameterKey(parameter.key), (values[parameter.key] ?? "").trim()])
      .filter((entry) => entry[1].length > 0)
  )

  return {
    requestPath: buildPath(endpoint.path, values),
    queryParams,
    namespace: resolveNamespace(endpoint.namespace),
  }
}

const supportsAutomaticGallery = (slug: string, endpoint: ApiEndpointDefinition): boolean => {
  const configuredIds = GALLERY_SOURCE_ENDPOINT_IDS[slug]

  if (configuredIds) {
    return configuredIds.includes(endpoint.id)
  }

  return (endpoint.parameters ?? []).every(
    (parameter) => parameter.location !== "path" || (parameter.defaultValue ?? "").trim().length > 0
  )
}

const extractEntries = (data: unknown): unknown[] => {
  const record = asRecord(data)
  if (!record) {
    return []
  }

  if (Array.isArray(record.results)) {
    return record.results
  }

  const firstArray = Object.values(record).find((value) => Array.isArray(value))
  return Array.isArray(firstArray) ? firstArray : []
}

const extractRecord = (entry: unknown): Record<string, unknown> | undefined => {
  const record = asRecord(entry)
  if (!record) {
    return undefined
  }

  const dataRecord = asRecord(record.data)
  return dataRecord ?? record
}

const extractDirectMediaUrl = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return /render\.worldofwarcraft\.com|\/(icons|media)\/|\.(png|jpe?g|webp)$/i.test(value)
      ? value
      : undefined
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = extractDirectMediaUrl(entry)
      if (nested) {
        return nested
      }
    }

    return undefined
  }

  const record = asRecord(value)
  if (!record) {
    return undefined
  }

  const directAsset = asAssetList(record.assets)
    .map((asset) => asset.value)
    .find((asset): asset is string => typeof asset === "string" && asset.length > 0)

  if (directAsset) {
    return directAsset
  }

  const directCandidates = [
    typeof record.icon === "string" ? record.icon : undefined,
    typeof record.image === "string" ? record.image : undefined,
    typeof record.href === "string" ? record.href : undefined,
  ].filter((candidate): candidate is string => Boolean(candidate))

  const directMatch = directCandidates.find((candidate) => /render\.worldofwarcraft\.com|\.(png|jpe?g|webp)$/i.test(candidate))
  if (directMatch) {
    return directMatch
  }

  for (const nested of Object.values(record)) {
    const nestedUrl = extractDirectMediaUrl(nested)
    if (nestedUrl) {
      return nestedUrl
    }
  }

  return undefined
}

const humanizeToken = (value: string): string =>
  value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const cleanLabel = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) {
    return "Unknown entry"
  }

  return /^[A-Z0-9_-]+$/.test(trimmed) ? humanizeToken(trimmed) : trimmed
}

const normalizeApiHref = (href: string, namespace: string | undefined): string => {
  if (/^https?:\/\//i.test(href)) {
    return href
  }

  const normalizedPath = href.startsWith("/") ? href : `/${href}`

  if (shouldUseBlizzardProxy()) {
    const params = new URLSearchParams()
    if (namespace) {
      params.set("namespace", namespace)
    }
    params.set("locale", env.locale)
    return `${env.proxyPath}${normalizedPath}?${params.toString()}`
  }

  const url = new URL(normalizedPath, getApiBaseUrl())
  if (namespace) {
    url.searchParams.set("namespace", namespace)
  }
  url.searchParams.set("locale", env.locale)
  return url.toString()
}

const extractHref = (
  entry: unknown,
  fallbackPath: string,
  namespace: string | undefined
): string => {
  const outer = asRecord(entry)
  const record = extractRecord(entry)

  const hrefCandidates = [
    asRecord(outer?.key)?.href,
    asRecord(record?._links)?.self && asRecord(asRecord(record?._links)?.self)?.href,
    asRecord(record?.key)?.href,
    record?.href,
  ]

  const href = hrefCandidates.find((candidate) => typeof candidate === "string" && candidate.length > 0)
  return normalizeApiHref((href as string | undefined) ?? fallbackPath, namespace)
}

const resolveName = (entry: unknown, record: Record<string, unknown>): string => {
  if (typeof entry === "string") {
    return cleanLabel(entry)
  }

  const displayString = resolveLocalizedString(record.display_string)
  if (displayString) {
    return displayString
  }

  const directStringCandidates = [
    typeof record.slot_type === "string" ? cleanLabel(record.slot_type) : "",
    typeof record.type === "string" ? cleanLabel(record.type) : "",
    typeof record.category === "string" ? cleanLabel(record.category) : "",
  ]

  const directString = directStringCandidates.find((candidate) => candidate.length > 0)
  if (directString) {
    return directString
  }

  return summarizeEntry(record)
}

const buildSummary = (record: Record<string, unknown>): string | undefined => {
  const candidates = [
    resolveLocalizedString(record.description),
    resolveLocalizedString(asRecord(record.source)?.name),
    resolveLocalizedString(asRecord(record.quality)?.name),
    typeof record.level === "number" ? `Level ${record.level}` : "",
    typeof record.rank === "number" ? `Rank ${record.rank}` : "",
  ].filter((value) => value.length > 0)

  return candidates[0]
}

const buildDetails = (record: Record<string, unknown>): string | undefined => {
  const namedParts = [
    "type",
    "category",
    "slot",
    "slot_type",
    "inventory_type",
    "item_class",
    "item_subclass",
  ]
    .map((key) => resolveLocalizedString(asRecord(record[key])?.name))
    .filter((value) => value.length > 0)

  const countParts = Object.entries(record)
    .filter(([, value]) => Array.isArray(value) && value.length > 0)
    .slice(0, 2)
    .map(([key, value]) => `${(value as unknown[]).length} ${key.replace(/_/g, " ")}`)

  const scalarParts = [
    typeof record.id === "number" || typeof record.id === "string" ? `ID ${record.id}` : "",
  ].filter((value) => value.length > 0)

  const detailParts = [...namedParts, ...countParts, ...scalarParts]
  return detailParts.length > 0 ? detailParts.join(" • ") : undefined
}

const buildMediaRequest = (
  slug: string,
  record: Record<string, unknown>
): { path: string; namespace: string | undefined } | undefined => {
  if (slug === "achievement" && typeof record.id === "number") {
    return {
      path: `/data/wow/media/achievement/${record.id}`,
      namespace: resolveNamespace("static"),
    }
  }

  if (slug === "pet" && typeof record.id === "number") {
    return {
      path: `/data/wow/media/pet/${record.id}`,
      namespace: resolveNamespace("static"),
    }
  }

  if (slug === "spells" && typeof record.id === "number") {
    return {
      path: `/data/wow/media/spell/${record.id}`,
      namespace: resolveNamespace("static"),
    }
  }

  if (slug === "playable-class" && typeof record.id === "number") {
    return {
      path: `/data/wow/media/playable-class/${record.id}`,
      namespace: resolveNamespace("static"),
    }
  }

  if (slug === "playable-specialization" && typeof record.id === "number") {
    return {
      path: `/data/wow/media/playable-specialization/${record.id}`,
      namespace: resolveNamespace("static"),
    }
  }

  return undefined
}

const dedupeCards = (cards: GalleryCard[]): GalleryCard[] => {
  const seen = new Set<string>()

  return cards.filter((card) => {
    const token = `${card.href}::${card.name}`.toLowerCase()
    if (seen.has(token)) {
      return false
    }

    seen.add(token)
    return true
  })
}

const normalizeSectionCards = (
  slug: string,
  entries: unknown[],
  endpoint: ApiEndpointDefinition,
  request: EndpointRequestDetails
): GalleryCard[] =>
  dedupeCards(entries.map((entry, index) => {
    const record = extractRecord(entry) ?? {}
    const name = resolveName(entry, record)
    const mediaRequest = buildMediaRequest(slug, record)

    return {
      key: `${endpoint.id}-${String(record.id ?? name ?? index)}-${index}`,
      id: typeof record.id === "number" ? record.id : index,
      name,
      href: extractHref(entry, request.requestPath, request.namespace),
      summary: buildSummary(record),
      details: buildDetails(record),
      mediaUrl: extractDirectMediaUrl(record),
      mediaRequestPath: mediaRequest?.path,
      mediaRequestNamespace: mediaRequest?.namespace,
      typeLabel: endpoint.label.replace(/\s+(Index|Search)$/u, ""),
      tag: resolveLocalizedString(asRecord(record.type)?.name) || undefined,
    }
  })).filter((card) => card.name !== "Unknown entry")

const sectionLabelForEndpoint = (endpoint: ApiEndpointDefinition): string =>
  endpoint.label.replace(/\s+(Index|Search)$/u, "")

const buildMediaQueryToken = (path: string, namespace: string | undefined): string =>
  `${path}::${namespace ?? ""}`

const GallerySectionBlock = ({
  section,
  accentColor,
  onCardClick,
}: GallerySectionBlockProps): JSX.Element => {
  const [visibleCount, setVisibleCount] = useState(() => Math.min(SECTION_BATCH_SIZE, section.cards.length))

  useEffect(() => {
    setVisibleCount(Math.min(SECTION_BATCH_SIZE, section.cards.length))
  }, [section.cards.length, section.id])

  const visibleCards = useMemo(
    () => section.cards.slice(0, visibleCount),
    [section.cards, visibleCount]
  )

  const hasMore = visibleCount < section.cards.length

  const loadMore = useCallback(() => {
    if (!hasMore) {
      return
    }

    setVisibleCount((current) => Math.min(current + SECTION_BATCH_SIZE, section.cards.length))
  }, [hasMore, section.cards.length])

  const infiniteScrollRef = useInfiniteScrollTrigger({
    enabled: hasMore,
    hasMore,
    isLoading: false,
    onLoadMore: loadMore,
  })

  return (
    <Stack spacing={1.5}>
      <Stack spacing={0.5}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {section.label}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {visibleCards.length === section.cards.length
            ? `Showing ${section.cards.length} records.`
            : `Showing ${visibleCards.length} of ${section.cards.length} records.`}
        </Typography>
      </Stack>

      <VirtualizedCardGrid
        items={visibleCards}
        getItemKey={(item) => item.key}
        itemHeight={244}
        gap={12}
        columns={{ xs: 1, sm: 2, md: 4, lg: 6, xl: 10 }}
        renderItem={(item) => <ResultCard result={item} accentColor={accentColor} compact onClick={() => onCardClick(item)} />}
      />

      <Stack spacing={1.25} alignItems="center">
        {hasMore ? (
          <Typography variant="caption" color="text.secondary">
            Keep scrolling to load 30 more records.
          </Typography>
        ) : null}
        {hasMore ? <Box ref={infiniteScrollRef} sx={{ width: "100%", height: 1 }} /> : null}
      </Stack>
    </Stack>
  )
}

const ApiDatasetGalleryPage = ({ slug }: ApiDatasetGalleryPageProps): JSX.Element | null => {
  const family = getApiFamilyConfigBySlug(slug)
  const [selectedCard, setSelectedCard] = useState<GalleryCard | null>(null)

  const eligibleEndpoints = useMemo(
    () => (family ? family.endpoints.filter((endpoint) => supportsAutomaticGallery(slug, endpoint)) : []),
    [family, slug]
  )

  const resolvedRequests = useMemo(
    () => eligibleEndpoints.map((endpoint) => resolveEndpointRequest(endpoint)),
    [eligibleEndpoints]
  )

  const endpointQueries = useQueries({
    queries: eligibleEndpoints.map((endpoint, index) => {
      const request = resolvedRequests[index]

      return {
        queryKey: [
          "api-dataset-gallery",
          slug,
          endpoint.id,
          request.requestPath,
          request.queryParams,
          env.region,
          env.locale,
        ],
        queryFn: () =>
          blizzardClient.get<unknown>(request.requestPath, {
            ...request.queryParams,
            namespace: request.namespace,
          }),
        retry: false,
        staleTime: 300000,
      }
    }),
  })

  const baseSections = useMemo<GallerySection[]>(
    () =>
      eligibleEndpoints.map((endpoint, index) => {
        const query = endpointQueries[index]
        const request = resolvedRequests[index]
        const entries = query.data ? extractEntries(query.data) : []

        return {
          id: endpoint.id,
          label: sectionLabelForEndpoint(endpoint),
          cards: normalizeSectionCards(slug, entries, endpoint, request),
          totalEntries: entries.length,
        }
      }),
    [eligibleEndpoints, endpointQueries, resolvedRequests, slug]
  )

  const flatCards = useMemo(
    () => baseSections.flatMap((section) => section.cards),
    [baseSections]
  )

  const activeMediaCount = useIdlePrefetchWindow({
    totalCount: flatCards.length,
    initialCount: 12,
    batchSize: 8,
    resetKey: `${slug}-${flatCards.length}`,
  })

  const mediaTargets = useMemo<MediaQueryTarget[]>(() => {
    const seen = new Set<string>()
    const targets: MediaQueryTarget[] = []

    for (const card of flatCards.slice(0, activeMediaCount)) {
      if (!card.mediaRequestPath || card.mediaUrl) {
        continue
      }

      const token = buildMediaQueryToken(card.mediaRequestPath, card.mediaRequestNamespace)
      if (seen.has(token)) {
        continue
      }

      seen.add(token)
      targets.push({
        token,
        path: card.mediaRequestPath,
        namespace: card.mediaRequestNamespace,
      })
    }

    return targets
  }, [activeMediaCount, flatCards])

  const mediaQueries = useQueries({
    queries: mediaTargets.map((target) => ({
      queryKey: [
        "api-dataset-gallery-media",
        slug,
        target.path,
        target.namespace,
        env.region,
        env.locale,
      ],
      queryFn: async () => {
        try {
          const response = await blizzardClient.get<{ assets?: Array<{ key?: string; value?: string }> }>(
            target.path,
            { namespace: target.namespace }
          )

          return response.assets?.find((asset) => asset.key === "icon")?.value ?? response.assets?.[0]?.value
        } catch {
          return undefined
        }
      },
      retry: false,
      staleTime: 300000,
    })),
  })

  const mediaUrlByToken = useMemo(() => {
    const pairs = mediaTargets.map((target, index) => [target.token, mediaQueries[index]?.data] as const)
    return new Map(pairs)
  }, [mediaQueries, mediaTargets])

  const sections = useMemo<GallerySection[]>(() => {
    return baseSections.map((section) => {
      const cards = section.cards.map((card) => ({
        ...card,
        mediaUrl:
          card.mediaUrl ??
          (card.mediaRequestPath
            ? mediaUrlByToken.get(buildMediaQueryToken(card.mediaRequestPath, card.mediaRequestNamespace))
            : undefined),
      }))

      return {
        ...section,
        cards,
      }
    })
  }, [baseSections, mediaUrlByToken])

  const visibleSections = useMemo(
    () => sections.filter((section) => section.cards.length > 0),
    [sections]
  )

  const selectedCardUsesIconAsset = Boolean(selectedCard?.mediaUrl && /\/icons\/56\//.test(selectedCard.mediaUrl))

  const isLoading = endpointQueries.some((query) => query.isPending || query.isFetching)
  const hasErrors = endpointQueries.some((query) => query.isError)

  if (!family) {
    return null
  }

  return (
    <Stack spacing={{ xs: 5, md: 6 }}>
      <Stack spacing={1}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {family.label} Gallery
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Live records pulled from Blizzard endpoints and normalized into browseable cards for this category.
        </Typography>
      </Stack>

      {isLoading && visibleSections.length === 0 ? (
        <Stack spacing={1.25}>
          <Skeleton variant="rounded" height={44} sx={{ borderRadius: 3, bgcolor: "rgba(148, 163, 184, 0.12)" }} />
          <Skeleton variant="rounded" height={244} sx={{ borderRadius: 3, bgcolor: "rgba(148, 163, 184, 0.12)" }} />
        </Stack>
      ) : null}

      {visibleSections.map((section) => (
        <GallerySectionBlock
          key={`${family.slug}-${section.id}`}
          section={section}
          accentColor={family.accentColor}
          onCardClick={setSelectedCard}
        />
      ))}

      <Dialog
        open={selectedCard !== null}
        onClose={() => setSelectedCard(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pr: 7 }}>
          {selectedCard?.name ?? "Record details"}
          <IconButton
            aria-label="Close record details"
            onClick={() => setSelectedCard(null)}
            sx={{ position: "absolute", right: 12, top: 12 }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems={{ xs: "stretch", md: "flex-start" }}>
            <Box
              sx={{
                width: selectedCardUsesIconAsset ? { xs: 56, md: 56 } : { xs: "100%", md: 220 },
                flexShrink: 0,
              }}
            >
              <Box
                sx={{
                  width: selectedCardUsesIconAsset ? 56 : "100%",
                  height: selectedCardUsesIconAsset ? 56 : "auto",
                  minHeight: selectedCardUsesIconAsset ? 56 : { xs: 180, md: 220 },
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: selectedCardUsesIconAsset ? 1 : 3,
                  border: selectedCardUsesIconAsset ? "none" : `1px solid ${family.accentColor}2e`,
                  backgroundColor: selectedCardUsesIconAsset ? "transparent" : "rgba(7, 12, 24, 0.72)",
                  p: selectedCardUsesIconAsset ? 0 : 3,
                }}
              >
                {selectedCard?.mediaUrl ? (
                  <Box
                    component="img"
                    src={selectedCard.mediaUrl}
                    alt={selectedCard.name}
                    sx={{
                      width: selectedCardUsesIconAsset ? 56 : "auto",
                      height: selectedCardUsesIconAsset ? 56 : "auto",
                      maxWidth: selectedCardUsesIconAsset ? 56 : 160,
                      maxHeight: selectedCardUsesIconAsset ? 56 : 160,
                      objectFit: "contain",
                    }}
                  />
                ) : selectedCard ? (
                  <Typography variant="h2" sx={{ fontWeight: 700, color: "text.secondary" }}>
                    {selectedCard.name.slice(0, 1)}
                  </Typography>
                ) : null}
              </Box>
            </Box>

            <Stack spacing={3} sx={{ minWidth: 0, flex: 1 }}>
              {selectedCard?.tag || selectedCard?.typeLabel ? (
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {selectedCard?.tag ? <Chip label={selectedCard.tag} size="small" /> : null}
                  {selectedCard?.typeLabel ? <Chip label={selectedCard.typeLabel} size="small" variant="outlined" /> : null}
                </Stack>
              ) : null}

              {selectedCard?.summary ? (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                    Summary
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
                    {selectedCard.summary}
                  </Typography>
                </Box>
              ) : null}

              {selectedCard?.details ? (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                    Details
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
                    {selectedCard.details}
                  </Typography>
                </Box>
              ) : null}

              {!selectedCard?.summary && !selectedCard?.details ? (
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <CircularProgress size={22} />
                  <Typography variant="body2" color="text.secondary">
                    This record has limited preview metadata available from Blizzard.
                  </Typography>
                </Stack>
              ) : null}

              <Link
                href={selectedCard?.href}
                target="_blank"
                rel="noreferrer"
                color="primary"
                underline="hover"
                sx={{ alignSelf: "flex-start" }}
              >
                View full record on Blizzard
              </Link>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>

      {!isLoading && visibleSections.length === 0 ? (
        <Alert severity={hasErrors ? "warning" : "info"} sx={{ borderRadius: 3 }}>
          {hasErrors
            ? "We couldn’t load usable live records for this gallery right now."
            : "No live records were available for this gallery."}
        </Alert>
      ) : null}
    </Stack>
  )
}

export default ApiDatasetGalleryPage