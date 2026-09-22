import ApiRoundedIcon from "@mui/icons-material/ApiRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useMemo, useState } from "react";
import { Navigate, Link as RouterLink, useLocation, useParams } from "react-router-dom";

import { ExplorerFilterBar, SearchField } from "@/components/common/ExplorerFilterBar";
import {
  GRID_PRESETS,
  gridTemplateColumnsSx,
} from "@/components/common/gridColumns";
import PageHeader from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/StateBlocks";
import ApiEndpointWorkbench from "@/features/apiExplorer/components/ApiEndpointWorkbench";
import {
  API_FAMILY_CONFIGS,
  getApiFamilyConfigBySlug,
  resolveApiFamilySlug,
} from "@/features/apiExplorer/config/apiCatalog";
import type { ApiFamilyConfig } from "@/features/apiExplorer/types";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import { lineClamp } from "@/theme";

// Not exported: a page module must export only components so Vite's React
// Fast Refresh can patch it in place instead of reloading the page.
const API_EXPLORER_PATH = "/api-explorer";

const BLIZZARD_DOCS_URL =
  "https://develop.battle.net/documentation/world-of-warcraft/game-data-apis";

const TOTAL_ENDPOINTS = API_FAMILY_CONFIGS.reduce(
  (total, family) => total + family.endpoints.length,
  0,
);

const familyPath = (family: ApiFamilyConfig): string =>
  `${API_EXPLORER_PATH}/${family.slug}`;

const pluralize = (count: number, singular: string, plural: string): string =>
  `${formatNumber(count)} ${count === 1 ? singular : plural}`;

const endpointCount = (family: ApiFamilyConfig): string =>
  pluralize(family.endpoints.length, "endpoint", "endpoints");

const regionLabel = (): string => `Region ${env.region.toUpperCase()}`;

const matchesFamily = (family: ApiFamilyConfig, filter: string): boolean => {
  const needle = filter.trim().toLowerCase();
  if (needle.length === 0) {
    return true;
  }
  return [family.label, family.slug, family.description].some((field) =>
    field.toLowerCase().includes(needle),
  );
};

/* ------------------------------------------------------------------ */
/* FamilyCard                                                          */
/* ------------------------------------------------------------------ */

const MOTION_HOVER = "@media (hover: hover)";
const MOTION_HOVER_LIFT =
  "@media (hover: hover) and (prefers-reduced-motion: no-preference)";

const FamilyCard = ({ family }: { family: ApiFamilyConfig }): JSX.Element => (
  <Card
    variant="outlined"
    sx={(theme) => ({
      display: "flex",
      minWidth: 0,
      borderRadius: `${theme.wc.radius.lg}px`,
      transition: theme.transitions.create(
        ["border-color", "box-shadow", "transform"],
        { duration: theme.wc.motion.base, easing: theme.wc.motion.easing },
      ),
      [MOTION_HOVER]: {
        "&:hover": {
          borderColor: theme.palette.border.strong,
          boxShadow: theme.palette.glow.card,
        },
      },
      [MOTION_HOVER_LIFT]: {
        "&:hover": { transform: "translateY(-2px)" },
      },
    })}
  >
    <CardActionArea
      component={RouterLink}
      to={familyPath(family)}
      aria-label={`Open ${family.label}`}
      sx={(theme) => ({
        flex: 1,
        minWidth: 0,
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 1,
        borderRadius: `${theme.wc.radius.lg}px`,
        "& .MuiCardActionArea-focusHighlight": { display: "none" },
      })}
    >
      <Typography variant="h6" component="h2" sx={{ margin: 0 }}>
        {family.label}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        component="p"
        sx={{ margin: 0, ...lineClamp(2) }}
      >
        {family.description}
      </Typography>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
        sx={{ marginTop: "auto", paddingTop: 0.5, minWidth: 0 }}
      >
        <Typography variant="caption" component="span" color="text.secondary">
          {endpointCount(family)}
        </Typography>
        <Typography
          variant="caption"
          component="code"
          color="text.secondary"
          sx={(theme) => ({ fontFamily: theme.wc.fontMono })}
        >
          {family.slug}
        </Typography>
      </Stack>
    </CardActionArea>
  </Card>
);

/* ------------------------------------------------------------------ */
/* FamilyIndex                                                         */
/* ------------------------------------------------------------------ */

const FamilyIndex = (): JSX.Element => {
  const theme = useTheme();
  const [filterInput, setFilterInput] = useState("");
  const [filter, setFilter] = useState("");

  const visible = useMemo(
    () => API_FAMILY_CONFIGS.filter((family) => matchesFamily(family, filter)),
    [filter],
  );

  const summary = `Showing ${formatNumber(visible.length)} of ${formatNumber(
    API_FAMILY_CONFIGS.length,
  )} families`;

  return (
    <Stack spacing={theme.wc.layout.sectionGap}>
      <PageHeader
        eyebrow="Developer tools"
        title="API explorer"
        description="Browse every Blizzard World of Warcraft Game Data family, send requests with your own parameters and copy the raw JSON."
        documentTitle="API explorer"
        icon={<ApiRoundedIcon />}
        meta={
          <>
            <Chip
              size="small"
              label={pluralize(API_FAMILY_CONFIGS.length, "family", "families")}
            />
            <Chip
              size="small"
              label={pluralize(TOTAL_ENDPOINTS, "endpoint", "endpoints")}
            />
            <Chip size="small" label={regionLabel()} />
          </>
        }
      />

      <Stack spacing={2}>
        <ExplorerFilterBar label="Filter families" summary={summary}>
          <SearchField
            label="Filter families"
            placeholder="Filter by name or slug"
            value={filterInput}
            onChange={setFilterInput}
            onDebouncedChange={setFilter}
            size="small"
          />
        </ExplorerFilterBar>

        {visible.length === 0 ? (
          <EmptyState
            title="No families match"
            description={`Nothing matches "${filter.trim()}". Try a shorter word.`}
            action={
              <Button
                variant="outlined"
                onClick={() => {
                  setFilterInput("");
                  setFilter("");
                }}
              >
                Clear filter
              </Button>
            }
          />
        ) : (
          <Box
            component="ul"
            aria-label="API families"
            sx={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: 2,
              ...gridTemplateColumnsSx(GRID_PRESETS.rows),
            }}
          >
            {visible.map((family) => (
              <Box component="li" key={family.slug} sx={{ minWidth: 0, display: "flex" }}>
                <FamilyCard family={family} />
              </Box>
            ))}
          </Box>
        )}
      </Stack>
    </Stack>
  );
};

/* ------------------------------------------------------------------ */
/* ApiWorkbenchPage                                                    */
/* ------------------------------------------------------------------ */

/**
 * `/api-explorer/:family?` — the family index without a slug, the endpoint
 * workbench for a known family, or a not-found state for an unknown slug.
 */
const ApiWorkbenchPage = (): JSX.Element => {
  const theme = useTheme();
  const { family: familyParam } = useParams<{ family?: string }>();
  const { search } = useLocation();
  const slug = familyParam?.trim().toLowerCase() ?? "";
  const canonicalSlug = resolveApiFamilySlug(slug);
  const family = canonicalSlug ? getApiFamilyConfigBySlug(canonicalSlug) : undefined;

  if (slug.length === 0) {
    return <FamilyIndex />;
  }

  // `/api-explorer/item` -> `/api-explorer/items`: one canonical URL per family.
  if (canonicalSlug && canonicalSlug !== familyParam) {
    return <Navigate to={`${API_EXPLORER_PATH}/${canonicalSlug}${search}`} replace />;
  }

  if (!family) {
    return (
      <Stack spacing={theme.wc.layout.sectionGap}>
        <PageHeader
          eyebrow="API explorer"
          title="API family not found"
          documentTitle="API family not found · API explorer"
          breadcrumbs={[
            { label: "API explorer", to: API_EXPLORER_PATH },
            { label: "Not found" },
          ]}
        />
        <EmptyState
          title="No API family matches this address"
          description={slug}
          action={
            <Button component={RouterLink} to={API_EXPLORER_PATH} variant="outlined">
              All families
            </Button>
          }
        />
      </Stack>
    );
  }

  return (
    <Stack spacing={theme.wc.layout.sectionGap}>
      <PageHeader
        eyebrow="API explorer"
        title={family.label}
        description={family.description}
        documentTitle={`${family.label} · API explorer`}
        icon={<ApiRoundedIcon />}
        breadcrumbs={[
          { label: "API explorer", to: API_EXPLORER_PATH },
          { label: family.label },
        ]}
        meta={
          <>
            <Chip size="small" label={endpointCount(family)} />
            <Chip size="small" label={regionLabel()} />
          </>
        }
        actions={
          <Button
            href={BLIZZARD_DOCS_URL}
            target="_blank"
            rel="noreferrer"
            variant="outlined"
            endIcon={<LaunchRoundedIcon />}
          >
            Blizzard docs
          </Button>
        }
      />
      <ApiEndpointWorkbench family={family} />
    </Stack>
  );
};

export default ApiWorkbenchPage;
