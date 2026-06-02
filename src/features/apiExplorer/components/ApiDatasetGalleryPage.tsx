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
} from "@mui/material";
import { useQueries } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ResultCard from "@/components/common/ResultCard";
import VirtualizedCardGrid from "@/components/common/VirtualizedCardGrid";

import { getApiFamilyConfigBySlug } from "@/features/apiExplorer/config/apiCatalog";
import { ApiEndpointDefinition } from "@/features/apiExplorer/types";
import {
  buildPath,
  resolveLocalizedString,
  resolveNamespace,
  resolveParameterKey,
  summarizeEntry,
} from "@/features/apiExplorer/utils";
import { SearchResult } from "@/features/search/types";
import { blizzardClient } from "@/lib/blizzardClient";
import { env, getApiBaseUrl, shouldUseBlizzardProxy } from "@/lib/env";

type ApiDatasetGalleryPageProps = {
  slug: string;
};

type GalleryCard = SearchResult & {
  key: string;
  mediaRequestPath?: string;
  mediaRequestNamespace?: string;
  mediaRequestStrategy?: string;
};

type GallerySection = {
  id: string;
  label: string;
  cards: GalleryCard[];
  totalEntries: number;
};

type MediaQueryTarget = {
  token: string;
  path: string;
  namespace: string | undefined;
  strategy?: string;
  name: string;
};

type MediaQueryResult = {
  url?: string;
  summary?: string;
  details?: string;
  tag?: string;
};

type VisibleRange = {
  start: number;
  end: number;
};

type EndpointRequestDetails = {
  requestPath: string;
  queryParams: Record<string, string>;
  namespace: string | undefined;
};

type GallerySectionBlockProps = {
  section: GallerySection;
  accentColor: string;
  onCardClick: (card: GalleryCard) => void;
  onVisibleRangeChange: (sectionId: string, range: VisibleRange) => void;
};

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
};

const POWER_TYPE_ICON_NAMES: Record<number, string> = {
  0: "inv_elemental_mote_mana",
  1: "ability_warrior_rampage",
  2: "ability_hunter_focusfire",
  3: "ability_rogue_quickrecovery",
  4: "ability_rogue_eviscerate",
  5: "spell_deathknight_frozenruneweapon",
  6: "spell_deathknight_runetap",
  7: "inv_misc_gem_amethyst_02",
  8: "spell_nature_starfall",
  9: "spell_holy_divinepurpose",
  10: "spell_nature_lightning",
  11: "spell_shaman_maelstromweapon",
  12: "ability_monk_chiswirl",
  13: "spell_priest_voidtendrils",
  16: "spell_arcane_arcane01",
  17: "ability_demonhunter_eyebeam",
  18: "ability_demonhunter_fierybrand",
  19: "ability_evoker_essenceburst",
  23: "inv_misc_questionmark",
  24: "achievement_boss_lichking",
  25: "ability_mount_drake_blue",
};

const buildRenderIconUrl = (iconName: string): string =>
  `https://render.worldofwarcraft.com/${env.region}/icons/56/${iconName}.jpg`;

const MAX_MEDIA_TARGETS_PER_SECTION = 80;

const GALLERY_SECTION_CARD_LIMITS: Record<string, number> = {
  "talent:talent-index": 600,
};

const getGallerySectionCardLimit = (slug: string, endpointId: string): number =>
  GALLERY_SECTION_CARD_LIMITS[`${slug}:${endpointId}`] ?? Infinity;

const shouldDedupeGalleryCardsByName = (
  slug: string,
  endpointId: string,
): boolean => slug === "talent" && endpointId === "talent-index";

const formatRecordCount = (count: number): string =>
  new Intl.NumberFormat("en-US").format(count);

const buildSpellSearchQueries = (name: string): string[] => {
  const queries = new Set<string>();
  const trimmed = name.trim();

  if (trimmed) {
    queries.add(trimmed);
  }

  const ofPhraseMatch = trimmed.match(/\bof\s+(.+)$/iu);
  if (ofPhraseMatch?.[1]) {
    queries.add(`of ${ofPhraseMatch[1].trim()}`);
    queries.add(ofPhraseMatch[1].trim());
  }

  return Array.from(queries).filter((query) => query.length > 0);
};

const extractNumericPathSegment = (
  href: unknown,
  pattern: RegExp,
): number | undefined => {
  if (typeof href !== "string") {
    return undefined;
  }

  const match = href.match(pattern);
  if (!match?.[1]) {
    return undefined;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;

const asAssetList = (
  value: unknown,
): Array<{ key?: string; value?: string }> =>
  Array.isArray(value)
    ? (value as Array<{ key?: string; value?: string }>)
    : [];

const resolveEndpointRequest = (
  endpoint: ApiEndpointDefinition,
): EndpointRequestDetails => {
  const values = Object.fromEntries(
    (endpoint.parameters ?? []).map((parameter) => [
      parameter.key,
      parameter.defaultValue ?? "",
    ]),
  );

  const queryParams = Object.fromEntries(
    (endpoint.parameters ?? [])
      .filter((parameter) => parameter.location === "query")
      .map((parameter) => [
        resolveParameterKey(parameter.key),
        (values[parameter.key] ?? "").trim(),
      ])
      .filter((entry) => entry[1].length > 0),
  );

  return {
    requestPath: buildPath(endpoint.path, values),
    queryParams,
    namespace: resolveNamespace(endpoint.namespace),
  };
};

const supportsAutomaticGallery = (
  slug: string,
  endpoint: ApiEndpointDefinition,
): boolean => {
  const configuredIds = GALLERY_SOURCE_ENDPOINT_IDS[slug];

  if (configuredIds) {
    return configuredIds.includes(endpoint.id);
  }

  return (endpoint.parameters ?? []).every(
    (parameter) =>
      parameter.location !== "path" ||
      (parameter.defaultValue ?? "").trim().length > 0,
  );
};

const extractEntries = (data: unknown): unknown[] => {
  const record = asRecord(data);
  if (!record) {
    return [];
  }

  if (Array.isArray(record.results)) {
    return record.results;
  }

  const firstArray = Object.values(record).find((value) =>
    Array.isArray(value),
  );
  return Array.isArray(firstArray) ? firstArray : [];
};

const extractRecord = (entry: unknown): Record<string, unknown> | undefined => {
  const record = asRecord(entry);
  if (!record) {
    return undefined;
  }

  const dataRecord = asRecord(record.data);
  return dataRecord ?? record;
};

const extractDirectMediaUrl = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return /render\.worldofwarcraft\.com|\/(icons|media)\/|\.(png|jpe?g|webp)$/i.test(
      value,
    )
      ? value
      : undefined;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = extractDirectMediaUrl(entry);
      if (nested) {
        return nested;
      }
    }

    return undefined;
  }

  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const directAsset = asAssetList(record.assets)
    .map((asset) => asset.value)
    .find(
      (asset): asset is string => typeof asset === "string" && asset.length > 0,
    );

  if (directAsset) {
    return directAsset;
  }

  const directCandidates = [
    typeof record.icon === "string" ? record.icon : undefined,
    typeof record.image === "string" ? record.image : undefined,
    typeof record.href === "string" ? record.href : undefined,
  ].filter((candidate): candidate is string => Boolean(candidate));

  const directMatch = directCandidates.find((candidate) =>
    /render\.worldofwarcraft\.com|\.(png|jpe?g|webp)$/i.test(candidate),
  );
  if (directMatch) {
    return directMatch;
  }

  for (const nested of Object.values(record)) {
    const nestedUrl = extractDirectMediaUrl(nested);
    if (nestedUrl) {
      return nestedUrl;
    }
  }

  return undefined;
};

const resolveCardMediaUrl = (
  slug: string,
  record: Record<string, unknown>,
): string | undefined => {
  if (slug === "power-type" && typeof record.id === "number") {
    const iconName = POWER_TYPE_ICON_NAMES[record.id];
    if (iconName) {
      return buildRenderIconUrl(iconName);
    }
  }

  return extractDirectMediaUrl(record);
};

const humanizeToken = (value: string): string =>
  value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const cleanLabel = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Unknown entry";
  }

  return /^[A-Z0-9_-]+$/.test(trimmed) ? humanizeToken(trimmed) : trimmed;
};

const normalizeApiHref = (
  href: string,
  namespace: string | undefined,
): string => {
  if (/^https?:\/\//i.test(href)) {
    return href;
  }

  const normalizedPath = href.startsWith("/") ? href : `/${href}`;

  if (shouldUseBlizzardProxy()) {
    const params = new URLSearchParams();
    if (namespace) {
      params.set("namespace", namespace);
    }
    params.set("locale", env.locale);
    return `${env.proxyPath}${normalizedPath}?${params.toString()}`;
  }

  const url = new URL(normalizedPath, getApiBaseUrl());
  if (namespace) {
    url.searchParams.set("namespace", namespace);
  }
  url.searchParams.set("locale", env.locale);
  return url.toString();
};

const extractHref = (
  entry: unknown,
  fallbackPath: string,
  namespace: string | undefined,
): string => {
  const outer = asRecord(entry);
  const record = extractRecord(entry);

  const hrefCandidates = [
    asRecord(outer?.key)?.href,
    asRecord(record?._links)?.self &&
      asRecord(asRecord(record?._links)?.self)?.href,
    asRecord(record?.key)?.href,
    record?.href,
  ];

  const href = hrefCandidates.find(
    (candidate) => typeof candidate === "string" && candidate.length > 0,
  );
  return normalizeApiHref(
    (href as string | undefined) ?? fallbackPath,
    namespace,
  );
};

const resolveName = (
  entry: unknown,
  record: Record<string, unknown>,
): string => {
  if (typeof entry === "string") {
    return cleanLabel(entry);
  }

  const displayString = resolveLocalizedString(record.display_string);
  if (displayString) {
    return displayString;
  }

  const directStringCandidates = [
    typeof record.slot_type === "string" ? cleanLabel(record.slot_type) : "",
    typeof record.type === "string" ? cleanLabel(record.type) : "",
    typeof record.category === "string" ? cleanLabel(record.category) : "",
  ];

  const directString = directStringCandidates.find(
    (candidate) => candidate.length > 0,
  );
  if (directString) {
    return directString;
  }

  return summarizeEntry(record);
};

const buildSummary = (record: Record<string, unknown>): string | undefined => {
  const candidates = [
    resolveLocalizedString(record.description),
    resolveLocalizedString(asRecord(record.source)?.name),
    resolveLocalizedString(asRecord(record.quality)?.name),
    typeof record.level === "number" ? `Level ${record.level}` : "",
    typeof record.rank === "number" ? `Rank ${record.rank}` : "",
  ].filter((value) => value.length > 0);

  return candidates[0];
};

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
    .filter((value) => value.length > 0);

  const countParts = Object.entries(record)
    .filter(([, value]) => Array.isArray(value) && value.length > 0)
    .slice(0, 2)
    .map(
      ([key, value]) =>
        `${(value as unknown[]).length} ${key.replace(/_/g, " ")}`,
    );

  const scalarParts = [
    typeof record.id === "number" || typeof record.id === "string"
      ? `ID ${record.id}`
      : "",
  ].filter((value) => value.length > 0);

  const detailParts = [...namedParts, ...countParts, ...scalarParts];
  return detailParts.length > 0 ? detailParts.join(" • ") : undefined;
};

const buildMediaRequest = (
  slug: string,
  record: Record<string, unknown>,
  endpointId: string,
):
  | { path: string; namespace: string | undefined; strategy?: string }
  | undefined => {
  if (slug === "achievement" && typeof record.id === "number") {
    return {
      path: `/data/wow/media/achievement/${record.id}`,
      namespace: resolveNamespace("static"),
    };
  }

  if (slug === "pet" && typeof record.id === "number") {
    return {
      path: `/data/wow/media/pet/${record.id}`,
      namespace: resolveNamespace("static"),
    };
  }

  if (slug === "spells" && typeof record.id === "number") {
    return {
      path: `/data/wow/media/spell/${record.id}`,
      namespace: resolveNamespace("static"),
    };
  }

  if (slug === "talent") {
    if (endpointId === "talent-index" && typeof record.id === "number") {
      return {
        path: `/data/wow/talent/${record.id}`,
        namespace: resolveNamespace("static"),
        strategy: "talent-via-spell",
      };
    }

    if (endpointId === "pvp-talent-index" && typeof record.id === "number") {
      return {
        path: `/data/wow/pvp-talent/${record.id}`,
        namespace: resolveNamespace("static"),
        strategy: "pvp-talent-via-spell",
      };
    }

    if (endpointId === "talent-tree-index") {
      const specId = extractNumericPathSegment(
        asRecord(record.key)?.href,
        /\/playable-specialization\/(\d+)/u,
      );
      if (typeof specId === "number") {
        return {
          path: `/data/wow/media/playable-specialization/${specId}`,
          namespace: resolveNamespace("static"),
        };
      }
    }
  }

  if (slug === "playable-race" && typeof record.id === "number") {
    return {
      path: `/data/wow/playable-race/${record.id}`,
      namespace: resolveNamespace("static"),
      strategy: "race-via-racial-spell",
    };
  }

  if (slug === "playable-class" && typeof record.id === "number") {
    return {
      path: `/data/wow/media/playable-class/${record.id}`,
      namespace: resolveNamespace("static"),
    };
  }

  if (slug === "playable-specialization" && typeof record.id === "number") {
    return {
      path: `/data/wow/media/playable-specialization/${record.id}`,
      namespace: resolveNamespace("static"),
    };
  }

  if (slug === "heirloom" && typeof record.id === "number") {
    return {
      path: `/data/wow/heirloom/${record.id}`,
      namespace: resolveNamespace("static"),
      strategy: "heirloom-via-item",
    };
  }

  if (slug === "housing-decor" && typeof record.id === "number") {
    if (endpointId === "decor-index") {
      return {
        path: `/data/wow/media/decor/${record.id}`,
        namespace: resolveNamespace("static"),
      };
    }
    if (endpointId === "fixture-index") {
      return {
        path: `/data/wow/media/fixture/${record.id}`,
        namespace: resolveNamespace("static"),
      };
    }
  }

  if (
    slug === "tech-talent" &&
    typeof record.id === "number" &&
    endpointId === "tech-talent-index"
  ) {
    return {
      path: `/data/wow/tech-talent/${record.id}`,
      namespace: resolveNamespace("static"),
      strategy: "tech-talent-via-detail",
    };
  }

  return undefined;
};

const dedupeCards = (cards: GalleryCard[]): GalleryCard[] => {
  const seen = new Set<string>();

  return cards.filter((card) => {
    const token = `${card.href}::${card.name}`.toLowerCase();
    if (seen.has(token)) {
      return false;
    }

    seen.add(token);
    return true;
  });
};

const dedupeCardsByName = (cards: GalleryCard[]): GalleryCard[] => {
  const seen = new Set<string>();

  return cards.filter((card) => {
    const token = card.name.toLowerCase();
    if (seen.has(token)) {
      return false;
    }

    seen.add(token);
    return true;
  });
};

const normalizeSectionCards = (
  slug: string,
  entries: unknown[],
  endpoint: ApiEndpointDefinition,
  request: EndpointRequestDetails,
): GalleryCard[] => {
  const limit = getGallerySectionCardLimit(slug, endpoint.id);
  const cards = dedupeCards(
    entries
      .map((entry, index) => {
        const record = extractRecord(entry) ?? {};
        const name = resolveName(entry, record);
        const mediaRequest = buildMediaRequest(slug, record, endpoint.id);

        return {
          key: `${endpoint.id}-${String(record.id ?? name ?? index)}-${index}`,
          id: typeof record.id === "number" ? record.id : index,
          name,
          href: extractHref(entry, request.requestPath, request.namespace),
          summary: buildSummary(record),
          details: buildDetails(record),
          mediaUrl: resolveCardMediaUrl(slug, record),
          mediaRequestPath: mediaRequest?.path,
          mediaRequestNamespace: mediaRequest?.namespace,
          mediaRequestStrategy: mediaRequest?.strategy,
          typeLabel: endpoint.label.replace(/\s+(Index|Search)$/u, ""),
          tag: resolveLocalizedString(asRecord(record.type)?.name) || undefined,
        };
      })
      .filter((card) => card.name !== "Unknown entry"),
  );
  const displayCards = shouldDedupeGalleryCardsByName(slug, endpoint.id)
    ? dedupeCardsByName(cards)
    : cards;

  return displayCards.slice(0, limit);
};

const sectionLabelForEndpoint = (endpoint: ApiEndpointDefinition): string =>
  endpoint.label.replace(/\s+(Index|Search)$/u, "");

const buildMediaQueryToken = (
  path: string,
  namespace: string | undefined,
): string => `${path}::${namespace ?? ""}`;

const GallerySectionBlock = ({
  section,
  accentColor,
  onCardClick,
  onVisibleRangeChange,
}: GallerySectionBlockProps): JSX.Element => {
  const handleVisibleRangeChange = useCallback(
    (range: VisibleRange) => onVisibleRangeChange(section.id, range),
    [onVisibleRangeChange, section.id],
  );

  return (
    <Stack spacing={1.5}>
      <Stack spacing={0.5}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {section.label}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {section.cards.length < section.totalEntries
            ? `Showing first ${formatRecordCount(section.cards.length)} of ${formatRecordCount(section.totalEntries)} records.`
            : `Showing ${formatRecordCount(section.cards.length)} records.`}
        </Typography>
      </Stack>

      <VirtualizedCardGrid
        items={section.cards}
        getItemKey={(item) => item.key}
        itemHeight={260}
        gap={12}
        columns={{ xs: 1, sm: 2, md: 4, lg: 6, xl: 10 }}
        renderItem={(item) => (
          <ResultCard
            result={item}
            accentColor={accentColor}
            compact
            onClick={() => onCardClick(item)}
          />
        )}
        onVisibleRangeChange={handleVisibleRangeChange}
      />
    </Stack>
  );
};

const ApiDatasetGalleryPage = ({
  slug,
}: ApiDatasetGalleryPageProps): JSX.Element | null => {
  const family = getApiFamilyConfigBySlug(slug);
  const [selectedCard, setSelectedCard] = useState<GalleryCard | null>(null);
  const [visibleRangesBySectionId, setVisibleRangesBySectionId] = useState<
    Record<string, VisibleRange>
  >({});

  useEffect(() => {
    setVisibleRangesBySectionId({});
  }, [slug]);

  const handleVisibleRangeChange = useCallback(
    (sectionId: string, range: VisibleRange) => {
      setVisibleRangesBySectionId((current) => {
        const existing = current[sectionId];
        if (existing?.start === range.start && existing.end === range.end) {
          return current;
        }

        return {
          ...current,
          [sectionId]: range,
        };
      });
    },
    [],
  );

  const eligibleEndpoints = useMemo(
    () =>
      family
        ? family.endpoints.filter((endpoint) =>
            supportsAutomaticGallery(slug, endpoint),
          )
        : [],
    [family, slug],
  );

  const resolvedRequests = useMemo(
    () => eligibleEndpoints.map((endpoint) => resolveEndpointRequest(endpoint)),
    [eligibleEndpoints],
  );

  const endpointQueries = useQueries({
    queries: eligibleEndpoints.map((endpoint, index) => {
      const request = resolvedRequests[index];

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
      };
    }),
  });

  const baseSections = useMemo<GallerySection[]>(
    () =>
      eligibleEndpoints.map((endpoint, index) => {
        const query = endpointQueries[index];
        const request = resolvedRequests[index];
        const entries = query.data ? extractEntries(query.data) : [];

        return {
          id: endpoint.id,
          label: sectionLabelForEndpoint(endpoint),
          cards: normalizeSectionCards(slug, entries, endpoint, request),
          totalEntries: entries.length,
        };
      }),
    [eligibleEndpoints, endpointQueries, resolvedRequests, slug],
  );

  const mediaTargets = useMemo<MediaQueryTarget[]>(() => {
    const seen = new Set<string>();
    const targets: MediaQueryTarget[] = [];

    for (const section of baseSections) {
      const range = visibleRangesBySectionId[section.id] ?? {
        start: 0,
        end: 0,
      };

      const start = Math.max(0, Math.min(section.cards.length, range.start));
      const end = Math.max(
        start,
        Math.min(
          section.cards.length,
          range.end,
          start + MAX_MEDIA_TARGETS_PER_SECTION,
        ),
      );

      for (const card of section.cards.slice(start, end)) {
        if (!card.mediaRequestPath || card.mediaUrl) {
          continue;
        }

        const token = buildMediaQueryToken(
          card.mediaRequestPath,
          card.mediaRequestNamespace,
        );
        if (seen.has(token)) {
          continue;
        }

        seen.add(token);
        targets.push({
          token,
          path: card.mediaRequestPath,
          namespace: card.mediaRequestNamespace,
          strategy: card.mediaRequestStrategy,
          name: card.name,
        });
      }
    }

    return targets;
  }, [baseSections, visibleRangesBySectionId]);

  const mediaQueries = useQueries({
    queries: mediaTargets.map((target) => ({
      queryKey: [
        "api-dataset-gallery-media",
        slug,
        target.path,
        target.namespace,
        target.strategy ?? "direct-media",
        target.name,
        env.region,
        env.locale,
      ],
      queryFn: async (): Promise<MediaQueryResult | undefined> => {
        try {
          if (target.strategy === "race-via-racial-spell") {
            const detail = await blizzardClient.get<{
              faction?: { type?: string; name?: string };
              is_allied_race?: boolean;
              racial_spells?: Array<{ id?: number; name?: string }>;
              playable_classes?: Array<{ id?: number; name?: string }>;
            }>(target.path, { namespace: target.namespace });

            let url: string | undefined;
            const spellId = detail?.racial_spells?.[0]?.id;
            if (typeof spellId === "number") {
              try {
                const media = await blizzardClient.get<{
                  assets?: Array<{ key?: string; value?: string }>;
                }>(`/data/wow/media/spell/${spellId}`, {
                  namespace: target.namespace,
                });
                url =
                  media.assets?.find((a) => a.key === "icon")?.value ??
                  media.assets?.[0]?.value;
              } catch {
                // no spell media
              }
            }

            const faction = detail?.faction?.name ?? undefined;
            const classes =
              detail?.playable_classes
                ?.map((c) => c.name)
                .filter(Boolean)
                .join(", ") || undefined;
            const allied = detail?.is_allied_race ? "Allied Race" : "";

            return {
              url,
              tag: faction,
              summary: classes,
              details: allied,
            };
          }

          if (target.strategy === "heirloom-via-item") {
            const detail = await blizzardClient.get<{ item?: { id?: number } }>(
              target.path,
              { namespace: target.namespace },
            );
            const itemId = detail?.item?.id;
            if (typeof itemId !== "number") return {};
            const media = await blizzardClient.get<{
              assets?: Array<{ key?: string; value?: string }>;
            }>(`/data/wow/media/item/${itemId}`, {
              namespace: target.namespace,
            });
            return {
              url:
                media.assets?.find((asset) => asset.key === "icon")?.value ??
                media.assets?.[0]?.value,
            };
          }

          if (
            target.strategy === "talent-via-spell" ||
            target.strategy === "pvp-talent-via-spell"
          ) {
            const detail = await blizzardClient.get<{
              description?: string;
              rank_descriptions?: Array<{
                rank?: number;
                description?: string;
              }>;
              spell?: { id?: number; name?: string };
              playable_class?: { name?: string; id?: number };
              playable_specialization?: { name?: string; id?: number };
              compatible_slots?: number[];
              unlock_player_level?: number;
            }>(target.path, { namespace: target.namespace });

            let url: string | undefined;
            let spellId = detail?.spell?.id;
            let spellName = detail?.spell?.name;
            let spellDescription: string | undefined;

            if (typeof spellId !== "number") {
              for (const query of buildSpellSearchQueries(target.name)) {
                const search = await blizzardClient.get<{
                  results?: Array<{
                    data?: {
                      id?: number;
                      name?: unknown;
                      media?: { id?: number };
                    };
                  }>;
                }>("/data/wow/search/spell", {
                  namespace: target.namespace,
                  "name.en_US": query,
                  orderby: "id",
                  _pageSize: 50,
                });
                const exactMatch = search.results?.find(
                  (result) =>
                    resolveLocalizedString(result.data?.name) === target.name,
                );
                const fallbackSpellId =
                  exactMatch?.data?.media?.id ?? exactMatch?.data?.id;

                if (typeof fallbackSpellId === "number") {
                  spellId = fallbackSpellId;
                  spellName =
                    resolveLocalizedString(exactMatch?.data?.name) ||
                    target.name;
                  break;
                }
              }
            }

            if (typeof spellId === "number") {
              try {
                const spellDetail = await blizzardClient.get<{
                  name?: string;
                  description?: string;
                  media?: { id?: number };
                }>(`/data/wow/spell/${spellId}`, {
                  namespace: target.namespace,
                });
                spellName = spellName ?? spellDetail.name;
                spellDescription = resolveLocalizedString(
                  spellDetail.description,
                );
                const mediaId = spellDetail.media?.id ?? spellId;
                const media = await blizzardClient.get<{
                  assets?: Array<{ key?: string; value?: string }>;
                }>(`/data/wow/media/spell/${mediaId}`, {
                  namespace: target.namespace,
                });
                url =
                  media.assets?.find((asset) => asset.key === "icon")?.value ??
                  media.assets?.[0]?.value;
              } catch {
                // spell media not found, continue without icon
              }
            }

            const rankedDescription = detail?.rank_descriptions
              ?.map((rank) => resolveLocalizedString(rank.description))
              .find((description) => description.length > 0);
            const summary =
              resolveLocalizedString(detail?.description) ||
              rankedDescription ||
              spellDescription;
            const tag =
              detail?.playable_specialization?.name ??
              detail?.playable_class?.name ??
              undefined;
            const details = [
              spellName,
              typeof detail?.unlock_player_level === "number" &&
              detail.unlock_player_level > 0
                ? `Level ${detail.unlock_player_level}`
                : "",
              Array.isArray(detail?.compatible_slots) &&
              detail.compatible_slots.length > 0
                ? `${detail.compatible_slots.length} PvP slots`
                : "",
            ]
              .filter(Boolean)
              .join(" • ");

            return {
              url,
              summary: summary || undefined,
              details: details || undefined,
              tag,
            };
          }

          if (target.strategy === "tech-talent-via-detail") {
            const detail = await blizzardClient.get<{
              id?: number;
              description?: string;
              tier?: number;
              compatible_playstyle?: { name?: string; type?: string };
              spell_tooltip?: { description?: string };
              media?: { id?: number };
            }>(target.path, { namespace: target.namespace });

            const mediaId = detail?.media?.id ?? detail?.id;
            let url: string | undefined;
            if (typeof mediaId === "number") {
              try {
                const media = await blizzardClient.get<{
                  assets?: Array<{ key?: string; value?: string }>;
                }>(`/data/wow/media/tech-talent/${mediaId}`, {
                  namespace: target.namespace,
                });
                url =
                  media.assets?.find((asset) => asset.key === "icon")?.value ??
                  media.assets?.[0]?.value;
              } catch {
                // media not found, continue without icon
              }
            }

            const description =
              resolveLocalizedString(detail?.spell_tooltip?.description) ||
              (typeof detail?.description === "string"
                ? detail.description
                : "");
            const tier =
              typeof detail?.tier === "number" ? `Tier ${detail.tier}` : "";
            const playstyle = detail?.compatible_playstyle?.name ?? "";

            return {
              url,
              summary: description || undefined,
              details:
                [tier, playstyle].filter(Boolean).join(" • ") || undefined,
              tag: playstyle || undefined,
            };
          }

          const response = await blizzardClient.get<{
            assets?: Array<{ key?: string; value?: string }>;
          }>(target.path, { namespace: target.namespace });

          return {
            url:
              response.assets?.find((asset) => asset.key === "icon")?.value ??
              response.assets?.[0]?.value,
          };
        } catch {
          return {};
        }
      },
      retry: false,
      staleTime: 300000,
    })),
  });

  const mediaResultByToken = useMemo(() => {
    const pairs = mediaTargets.map(
      (target, index) =>
        [
          target.token,
          mediaQueries[index]?.data as MediaQueryResult | undefined,
        ] as const,
    );
    return new Map(pairs);
  }, [mediaQueries, mediaTargets]);

  const sections = useMemo<GallerySection[]>(() => {
    return baseSections.map((section) => {
      const cards = section.cards.map((card) => {
        const token = card.mediaRequestPath
          ? buildMediaQueryToken(
              card.mediaRequestPath,
              card.mediaRequestNamespace,
            )
          : undefined;
        const enrichment = token ? mediaResultByToken.get(token) : undefined;

        return {
          ...card,
          mediaUrl: card.mediaUrl ?? enrichment?.url,
          summary: card.summary ?? enrichment?.summary,
          details: enrichment?.details ?? card.details,
          tag: card.tag ?? enrichment?.tag,
        };
      });

      return {
        ...section,
        cards,
      };
    });
  }, [baseSections, mediaResultByToken]);

  const visibleSections = useMemo(
    () => sections.filter((section) => section.cards.length > 0),
    [sections],
  );

  const selectedCardUsesIconAsset = Boolean(
    selectedCard?.mediaUrl && /\/icons\/56\//.test(selectedCard.mediaUrl),
  );

  const isLoading = endpointQueries.some(
    (query) => query.isPending || query.isFetching,
  );
  const hasErrors = endpointQueries.some((query) => query.isError);

  if (!family) {
    return null;
  }

  return (
    <Stack spacing={{ xs: 5, md: 6 }}>
      <Stack spacing={1}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {family.label} Gallery
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Live records pulled from Blizzard endpoints and normalized into
          browseable cards for this category.
        </Typography>
      </Stack>

      {isLoading && visibleSections.length === 0 ? (
        <Stack spacing={1.25}>
          <Skeleton
            variant="rounded"
            height={44}
            sx={{ borderRadius: 3, bgcolor: "rgba(148, 163, 184, 0.12)" }}
          />
          <Skeleton
            variant="rounded"
            height={244}
            sx={{ borderRadius: 3, bgcolor: "rgba(148, 163, 184, 0.12)" }}
          />
        </Stack>
      ) : null}

      {visibleSections.map((section) => (
        <GallerySectionBlock
          key={`${family.slug}-${section.id}`}
          section={section}
          accentColor={family.accentColor}
          onCardClick={setSelectedCard}
          onVisibleRangeChange={handleVisibleRangeChange}
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
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={3}
            alignItems={{ xs: "stretch", md: "flex-start" }}
          >
            <Box
              sx={{
                width: selectedCardUsesIconAsset
                  ? { xs: 56, md: 56 }
                  : { xs: "100%", md: 220 },
                flexShrink: 0,
              }}
            >
              <Box
                sx={{
                  width: selectedCardUsesIconAsset ? 56 : "100%",
                  height: selectedCardUsesIconAsset ? 56 : "auto",
                  minHeight: selectedCardUsesIconAsset
                    ? 56
                    : { xs: 180, md: 220 },
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: selectedCardUsesIconAsset ? 1 : 3,
                  border: selectedCardUsesIconAsset
                    ? "none"
                    : `1px solid ${family.accentColor}2e`,
                  backgroundColor: selectedCardUsesIconAsset
                    ? "transparent"
                    : "rgba(7, 12, 24, 0.72)",
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
                  <Typography
                    variant="h2"
                    sx={{ fontWeight: 700, color: "text.secondary" }}
                  >
                    {selectedCard.name.slice(0, 1)}
                  </Typography>
                ) : null}
              </Box>
            </Box>

            <Stack spacing={3} sx={{ minWidth: 0, flex: 1 }}>
              {selectedCard?.tag || selectedCard?.typeLabel ? (
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {selectedCard?.tag ? (
                    <Chip label={selectedCard.tag} size="small" />
                  ) : null}
                  {selectedCard?.typeLabel ? (
                    <Chip
                      label={selectedCard.typeLabel}
                      size="small"
                      variant="outlined"
                    />
                  ) : null}
                </Stack>
              ) : null}

              {selectedCard?.summary ? (
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 700, mb: 0.75 }}
                  >
                    Summary
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ whiteSpace: "pre-wrap" }}
                  >
                    {selectedCard.summary}
                  </Typography>
                </Box>
              ) : null}

              {selectedCard?.details ? (
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 700, mb: 0.75 }}
                  >
                    Details
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ whiteSpace: "pre-wrap" }}
                  >
                    {selectedCard.details}
                  </Typography>
                </Box>
              ) : null}

              {!selectedCard?.summary && !selectedCard?.details ? (
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <CircularProgress size={22} />
                  <Typography variant="body2" color="text.secondary">
                    This record has limited preview metadata available from
                    Blizzard.
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
        <Alert
          severity={hasErrors ? "warning" : "info"}
          sx={{ borderRadius: 3 }}
        >
          {hasErrors
            ? "We couldn’t load usable live records for this gallery right now."
            : "No live records were available for this gallery."}
        </Alert>
      ) : null}
    </Stack>
  );
};

export default ApiDatasetGalleryPage;
