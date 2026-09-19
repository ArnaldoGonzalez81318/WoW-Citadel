import ApiRounded from "@mui/icons-material/ApiRounded";
import { Box, Chip, Link, Stack, Typography } from "@mui/material";
import { Link as RouterLink, useParams } from "react-router-dom";

import {
  GRID_PRESETS,
  gridTemplateColumnsSx,
} from "@/components/common/gridColumns";
import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import { EmptyState } from "@/components/common/StateBlocks";
import ApiEndpointWorkbench from "@/features/apiExplorer/components/ApiEndpointWorkbench";
import {
  API_FAMILY_CONFIGS,
  getApiFamilyConfigBySlug,
} from "@/features/apiExplorer/config/apiCatalog";
import type { ApiFamilyConfig } from "@/features/apiExplorer/types";
import { formatNumber } from "@/lib/format";
import { lineClamp, tokens } from "@/theme";

export const API_EXPLORER_PATH = "/api-explorer";

const SECTION_GAP = tokens.wc.layout.sectionGap;

const familyPath = (family: ApiFamilyConfig): string =>
  `${API_EXPLORER_PATH}/${family.slug}`;

const endpointCount = (family: ApiFamilyConfig): string =>
  `${formatNumber(family.endpoints.length)} ${
    family.endpoints.length === 1 ? "endpoint" : "endpoints"
  }`;

/** Every family as a link card, so an unknown or missing slug still leads somewhere. */
const FamilyIndex = (): JSX.Element => (
  <SectionCard
    title="API families"
    description="Pick a family to sample its endpoints live and inspect the raw JSON."
    padding="compact"
  >
    <Box
      component="ul"
      sx={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "grid",
        gap: "16px",
        ...gridTemplateColumnsSx(GRID_PRESETS.tiles),
      }}
    >
      {API_FAMILY_CONFIGS.map((family) => (
        <Box component="li" key={family.slug} sx={{ minWidth: 0, display: "flex" }}>
          <Link
            component={RouterLink}
            to={familyPath(family)}
            underline="none"
            sx={(theme) => ({
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
              flex: 1,
              minWidth: 0,
              padding: "12px 16px",
              borderRadius: `${theme.wc.radius.md}px`,
              border: `1px solid ${theme.palette.border.default}`,
              backgroundColor: theme.palette.surface.sunken,
              transition: theme.transitions.create(
                ["border-color", "background-color"],
                { duration: theme.wc.motion.base },
              ),
              "&:hover": {
                borderColor: theme.palette.border.strong,
                backgroundColor: theme.palette.action.hover,
              },
            })}
          >
            <Typography variant="subtitle2" component="span">
              {family.label}
            </Typography>
            <Typography
              variant="caption"
              component="span"
              color="text.secondary"
              sx={lineClamp(2)}
            >
              {family.description}
            </Typography>
            <Typography
              variant="caption"
              component="span"
              color="text.secondary"
              sx={{ marginTop: "auto", paddingTop: 0.5 }}
            >
              {endpointCount(family)}
            </Typography>
          </Link>
        </Box>
      ))}
    </Box>
  </SectionCard>
);

/**
 * `/api-explorer/:family?` — the endpoint workbench for one API family, or
 * the family index when the slug is missing or unknown.
 */
const ApiWorkbenchPage = (): JSX.Element => {
  const { family: familyParam } = useParams<{ family?: string }>();
  const slug = familyParam?.trim().toLowerCase() ?? "";
  const family = slug.length > 0 ? getApiFamilyConfigBySlug(slug) : undefined;

  if (family) {
    return (
      <Stack spacing={SECTION_GAP}>
        <PageHeader
          eyebrow="API explorer"
          title={family.label}
          description={family.description}
          icon={<ApiRounded />}
          breadcrumbs={[
            { label: "API explorer", to: API_EXPLORER_PATH },
            { label: family.label },
          ]}
          meta={<Chip size="small" label={endpointCount(family)} />}
        />
        <ApiEndpointWorkbench family={family} />
      </Stack>
    );
  }

  return (
    <Stack spacing={SECTION_GAP}>
      <PageHeader
        eyebrow="Game data"
        title="API explorer"
        description="Blizzard's World of Warcraft Game Data endpoints, grouped by family. Each family page samples its endpoints live and shows the raw responses."
        icon={<ApiRounded />}
        meta={
          <Chip
            size="small"
            label={`${formatNumber(API_FAMILY_CONFIGS.length)} families`}
          />
        }
      />
      {slug.length > 0 ? (
        <EmptyState
          compact
          title="Unknown API family"
          description={
            <>
              There is no API family called <strong>{slug}</strong>. Choose one
              of the families below.
            </>
          }
        />
      ) : null}
      <FamilyIndex />
    </Stack>
  );
};

export default ApiWorkbenchPage;
