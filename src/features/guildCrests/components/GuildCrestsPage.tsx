import ShieldRounded from "@mui/icons-material/ShieldRounded";
import {
  Box,
  Chip,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { gridTemplateColumnsSx, useGridColumns } from "@/components/common/gridColumns";
import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import { EmptyState, ErrorState } from "@/components/common/StateBlocks";
import BorderPicker from "@/features/guildCrests/components/BorderPicker";
import CrestColorPicker, {
  SWATCH_GRID_SX,
} from "@/features/guildCrests/components/CrestColorPicker";
import CrestPalettes, {
  PALETTE_CELL_HEIGHT,
  PALETTE_COLS,
  PALETTE_SKELETON_COUNTS,
} from "@/features/guildCrests/components/CrestPalettes";
import type { CrestPalette } from "@/features/guildCrests/components/CrestPalettes";
import CrestPreview, { PREVIEW_MAX_WIDTH } from "@/features/guildCrests/components/CrestPreview";
import EmblemPicker, {
  EMBLEM_COLS,
  EMBLEM_ROWS,
} from "@/features/guildCrests/components/EmblemPicker";
import { guildCrestCatalogQuery } from "@/features/guildCrests/hooks/guildCrestQueries";
import useCrestArt from "@/features/guildCrests/hooks/useCrestArt";
import { contrastRatio } from "@/features/guildCrests/services/guildCrestService";
import type {
  CrestColor,
  CrestDesign,
  CrestRing,
  GuildCrestCatalog,
} from "@/features/guildCrests/types";
import { useSearchParamsRecord } from "@/hooks/useSearchParamState";
import type { SearchParamsPatch } from "@/hooks/useSearchParamState";
import { env } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import type { CategoryExplorerProps } from "@/pages/categoryRegistry";

const URL_DEFAULTS = {
  emblem: "",
  border: "",
  emblemColor: "",
  borderColor: "",
  backgroundColor: "",
  ring: "none",
};
type CrestParams = typeof URL_DEFAULTS;
type PartKey = Exclude<keyof CrestParams, "ring">;

/**
 * The crest a visitor starts from: Blizzard's first emblem (a laurel
 * wreath) and border, gold on navy, the Armory's classic look. Any id the
 * index no longer lists falls back to the first entry.
 */
const PREFERRED: Record<PartKey, number> = {
  emblem: 0,
  border: 0,
  emblemColor: 16,
  borderColor: 16,
  backgroundColor: 32,
};

/** A random crest re-rolls its colours until the emblem stands out this much. */
const MIN_RANDOM_CONTRAST = 3;
const RANDOM_ATTEMPTS = 24;

const ID_PATTERN = /^\d{1,6}$/;
const RINGS: readonly CrestRing[] = ["none", "alliance", "horde"];
const isRing = (value: string): value is CrestRing =>
  (RINGS as readonly string[]).includes(value);

/** The URL's id when the list has it, else the preferred id, else the first entry. */
const pickEntry = <T extends { id: number }>(
  raw: string,
  list: readonly T[],
  preferred: number,
): T | undefined => {
  if (ID_PATTERN.test(raw)) {
    const id = Number(raw);
    const match = list.find((entry) => entry.id === id);
    if (match) {
      return match;
    }
  }
  return list.find((entry) => entry.id === preferred) ?? list[0];
};

const randomEntry = <T,>(list: readonly T[]): T | undefined =>
  list.length > 0 ? list[Math.floor(Math.random() * list.length)] : undefined;

const idParam = (entry: { id: number } | undefined): string | null =>
  entry ? String(entry.id) : null;

const resolveDesign = (catalog: GuildCrestCatalog, params: CrestParams): CrestDesign => ({
  emblem: pickEntry(params.emblem, catalog.emblems, PREFERRED.emblem),
  border: pickEntry(params.border, catalog.borders, PREFERRED.border),
  emblemColor: pickEntry(params.emblemColor, catalog.emblemColors, PREFERRED.emblemColor),
  borderColor: pickEntry(params.borderColor, catalog.borderColors, PREFERRED.borderColor),
  backgroundColor: pickEntry(
    params.backgroundColor,
    catalog.backgroundColors,
    PREFERRED.backgroundColor,
  ),
  ring: isRing(params.ring) ? params.ring : "none",
});

const designParams = (design: CrestDesign): SearchParamsPatch<CrestParams> => ({
  emblem: idParam(design.emblem),
  border: idParam(design.border),
  emblemColor: idParam(design.emblemColor),
  borderColor: idParam(design.borderColor),
  backgroundColor: idParam(design.backgroundColor),
});

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

type DesignerTab = "emblem" | "border" | "background";

const TABS: ReadonlyArray<{ value: DesignerTab; label: string }> = [
  { value: "emblem", label: "Emblem" },
  { value: "border", label: "Border" },
  { value: "background", label: "Background" },
];

/**
 * The preview pins beside the pickers only where it fits on screen (about
 * 720px tall at lg): a sticky box taller than the viewport would hide its
 * own buttons until the section ends.
 */
const STICKY_PREVIEW = "@media (min-width: 900px) and (min-height: 820px)";

const designerGridSx = {
  display: "grid",
  gap: { xs: 3, md: 4 },
  gridTemplateColumns: {
    xs: "minmax(0, 1fr)",
    md: "300px minmax(0, 1fr)",
    lg: `${PREVIEW_MAX_WIDTH}px minmax(0, 1fr)`,
  },
  alignItems: "start",
} as const;

const squareCellsSx = {
  "& > .MuiSkeleton-root": { height: "auto", aspectRatio: "1 / 1" },
};

const SubHeading = ({ id, children }: { id: string; children: ReactNode }): JSX.Element => (
  <Typography id={id} variant="subtitle1" component="h3" sx={{ m: 0 }}>
    {children}
  </Typography>
);

/** The designer's shape while the index loads: preview, tabs, swatches, emblem grid. */
const DesignerSkeleton = (): JSX.Element => {
  const emblemCells = useGridColumns(EMBLEM_COLS) * EMBLEM_ROWS;
  return (
    <Box
      role="status"
      aria-label="Loading the crest designer"
      aria-busy="true"
      aria-live="polite"
      sx={designerGridSx}
    >
      <Stack spacing={2.5} sx={{ minWidth: 0 }}>
        <Skeleton
          variant="rounded"
          sx={{
            width: "100%",
            maxWidth: PREVIEW_MAX_WIDTH,
            height: "auto",
            aspectRatio: "216 / 240",
            mx: "auto",
          }}
        />
        <Skeleton variant="rounded" width={220} height={32} />
        <Stack spacing={0.75}>
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} variant="text" sx={{ fontSize: "0.875rem", width: index % 2 ? "70%" : "50%" }} />
          ))}
        </Stack>
        <Stack direction="row" spacing={1}>
          <Skeleton variant="rounded" width={112} height={32} />
          <Skeleton variant="rounded" width={128} height={32} />
        </Stack>
      </Stack>
      <Stack spacing={2.5} sx={{ minWidth: 0 }}>
        <Skeleton variant="rounded" height={44} />
        <Skeleton variant="text" width={120} sx={{ fontSize: "1rem" }} />
        <Box
          sx={{
            display: "grid",
            gap: 1,
            // The picker's own auto-fill template: a column map would be clamped
            // to 8 columns, three rows of large squares where 17 small swatches
            // fit in one or two, and the emblem grid would jump on load.
            ...SWATCH_GRID_SX,
            ...squareCellsSx,
          }}
        >
          {Array.from({ length: 17 }, (_, index) => (
            <Skeleton key={index} variant="rounded" />
          ))}
        </Box>
        <Skeleton variant="text" width={100} sx={{ fontSize: "1rem" }} />
        <Skeleton variant="rounded" height={40} sx={{ maxWidth: 320 }} />
        <Box sx={{ display: "grid", gap: 1, ...gridTemplateColumnsSx(EMBLEM_COLS), ...squareCellsSx }}>
          {Array.from({ length: emblemCells }, (_, index) => (
            <Skeleton key={index} variant="rounded" />
          ))}
        </Box>
      </Stack>
    </Box>
  );
};

/**
 * The palettes' shape while the index loads: three headed groups of today's
 * sizes, so the section is its loaded height (13 rows at lg, not one grid
 * of 3) and nothing below it moves. One status region for the three.
 */
const PalettesSkeleton = (): JSX.Element => (
  <Stack
    spacing={3}
    role="status"
    aria-label="Loading crest palettes"
    aria-busy="true"
    aria-live="polite"
  >
    {PALETTE_SKELETON_COUNTS.map((count, group) => (
      <Stack key={group} spacing={1.25}>
        <Skeleton variant="text" width={160} sx={{ fontSize: "1rem", lineHeight: 1.5 }} />
        <Box sx={{ display: "grid", gap: 1, ...gridTemplateColumnsSx(PALETTE_COLS) }}>
          {Array.from({ length: count }, (_, index) => (
            <Skeleton
              key={index}
              variant="rounded"
              height={PALETTE_CELL_HEIGHT}
              sx={(theme) => ({ borderRadius: `${theme.wc.radius.md}px` })}
            />
          ))}
        </Box>
      </Stack>
    ))}
  </Stack>
);

const emptyPaletteNote = (what: string): JSX.Element => (
  <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
    {`Blizzard lists no ${what}.`}
  </Typography>
);

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

/**
 * Guild Crests: a crest designer over Blizzard's guild crest index. Pick an
 * emblem, a border and three colours from the game's own palettes, and the
 * crest is drawn live from Blizzard's art, tinted the way the game tints it.
 * The whole crest lives in the URL, so a design can be shared; below it,
 * every palette colour with its id and hex value.
 */
const GuildCrestsPage = ({
  eyebrow = "World & Factions",
  breadcrumbs,
}: CategoryExplorerProps): JSX.Element => {
  const [params, setParams] = useSearchParamsRecord(URL_DEFAULTS);
  const catalogQuery = useQuery(guildCrestCatalogQuery());
  const catalog = catalogQuery.data ?? null;
  const [tab, setTab] = useState<DesignerTab>("emblem");
  const baseId = `crest-designer-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;

  /* ---------------- Selection (URL first, then the preferred crest) ---------------- */

  const design = useMemo(
    () => (catalog ? resolveDesign(catalog, params) : null),
    [catalog, params],
  );

  // Write the resolved crest into the URL (and correct ids the index does
  // not list), so the address bar always names the crest on screen and
  // "Copy link" shares exactly that.
  useEffect(() => {
    if (!design) {
      return;
    }
    const wanted = designParams(design);
    const patch: SearchParamsPatch<CrestParams> = {};
    (Object.keys(wanted) as PartKey[]).forEach((key) => {
      if ((params[key] || null) !== wanted[key]) {
        patch[key] = wanted[key];
      }
    });
    if (!isRing(params.ring)) {
      patch.ring = null;
    }
    if (Object.keys(patch).length > 0) {
      setParams(patch, { replace: true });
    }
  }, [design, params, setParams]);

  const emblemArt = useCrestArt("emblem", design?.emblem);
  const borderArt = useCrestArt("border", design?.border);

  // The cloth (one file every crest shares) falls back to a flat shape when
  // it fails, and a crest never retries it on its own: a Retry remounts the
  // preview and the border tiles under a new key. Any one Retry tries every
  // failed layer, since one network blip usually takes out several.
  const [clothFailed, setClothFailed] = useState(false);
  const [clothAttempt, setClothAttempt] = useState(0);
  const handleClothError = useCallback(() => setClothFailed(true), []);
  const { missing: emblemMissing, retry: retryEmblem } = emblemArt;
  const { missing: borderMissing, retry: retryBorder } = borderArt;
  const handleRetryArt = useCallback(() => {
    if (emblemMissing) {
      retryEmblem();
    }
    if (borderMissing) {
      retryBorder();
    }
    if (clothFailed) {
      setClothFailed(false);
      setClothAttempt((attempt) => attempt + 1);
    }
  }, [emblemMissing, retryEmblem, borderMissing, retryBorder, clothFailed]);

  /* ---------------- Handlers ---------------- */

  // Each pick replaces the history entry (Back leaves the designer instead
  // of stepping through every swatch); a random crest or a reset pushes one,
  // so Back returns to the crest before it.
  const setPart = useCallback(
    (key: PartKey, id: number) => setParams({ [key]: String(id) }, { replace: true }),
    [setParams],
  );
  const handleEmblem = useCallback((id: number) => setPart("emblem", id), [setPart]);
  const handleBorder = useCallback((id: number) => setPart("border", id), [setPart]);
  const handleEmblemColor = useCallback((id: number) => setPart("emblemColor", id), [setPart]);
  const handleBorderColor = useCallback((id: number) => setPart("borderColor", id), [setPart]);
  const handleBackgroundColor = useCallback(
    (id: number) => setPart("backgroundColor", id),
    [setPart],
  );
  const handleRing = useCallback(
    (ring: CrestRing) => setParams({ ring: ring === "none" ? null : ring }, { replace: true }),
    [setParams],
  );

  const handleRandom = useCallback(() => {
    if (!catalog) {
      return;
    }
    let emblemColor: CrestColor | undefined;
    let backgroundColor: CrestColor | undefined;
    for (let attempt = 0; attempt < RANDOM_ATTEMPTS; attempt += 1) {
      emblemColor = randomEntry(catalog.emblemColors);
      backgroundColor = randomEntry(catalog.backgroundColors);
      if (
        !emblemColor ||
        !backgroundColor ||
        contrastRatio(emblemColor, backgroundColor) >= MIN_RANDOM_CONTRAST
      ) {
        break;
      }
    }
    setParams({
      emblem: idParam(randomEntry(catalog.emblems)),
      border: idParam(randomEntry(catalog.borders)),
      emblemColor: idParam(emblemColor),
      borderColor: idParam(randomEntry(catalog.borderColors)),
      backgroundColor: idParam(backgroundColor),
    });
  }, [catalog, setParams]);

  const handleReset = useCallback(() => {
    if (!catalog || !design) {
      return;
    }
    const target = designParams(resolveDesign(catalog, URL_DEFAULTS));
    const current = designParams(design);
    const unchanged =
      design.ring === "none" &&
      (Object.keys(target) as PartKey[]).every((key) => target[key] === current[key]);
    // Already the starting crest: no history entry for a no-op.
    if (!unchanged) {
      setParams({ ...target, ring: null });
    }
  }, [catalog, design, setParams]);

  /* ---------------- Render ---------------- */

  const colourCount = catalog
    ? catalog.emblemColors.length + catalog.borderColors.length + catalog.backgroundColors.length
    : 0;
  const isEmpty =
    catalog !== null &&
    catalog.emblems.length === 0 &&
    catalog.borders.length === 0 &&
    colourCount === 0;

  const headingId = (key: string): string => `${baseId}-${key}-heading`;

  const renderPanels = (current: CrestDesign, data: GuildCrestCatalog): JSX.Element => {
    const look = {
      emblemColor: current.emblemColor,
      borderColor: current.borderColor,
      backgroundColor: current.backgroundColor,
    };
    const panels: Record<DesignerTab, JSX.Element> = {
      emblem: (
        <Stack spacing={3}>
          <Stack spacing={1.25}>
            <SubHeading id={headingId("emblem-colour")}>Emblem colour</SubHeading>
            {data.emblemColors.length > 0 ? (
              <CrestColorPicker
                labelledBy={headingId("emblem-colour")}
                colors={data.emblemColors}
                value={current.emblemColor?.id ?? null}
                onChange={handleEmblemColor}
              />
            ) : (
              emptyPaletteNote("emblem colours")
            )}
          </Stack>
          <Stack spacing={1.25}>
            <SubHeading id={headingId("emblems")}>Emblems</SubHeading>
            {data.emblems.length > 0 ? (
              <EmblemPicker
                emblems={data.emblems}
                value={current.emblem?.id ?? null}
                onChange={handleEmblem}
                emblemColor={look.emblemColor}
                backgroundColor={look.backgroundColor}
                labelledBy={headingId("emblems")}
              />
            ) : (
              <EmptyState
                compact
                icon={<ShieldRounded />}
                title="No emblems listed"
                description="Blizzard's crest index lists no emblems; the crest is drawn without one."
              />
            )}
          </Stack>
        </Stack>
      ),
      border: (
        <Stack spacing={3}>
          <Stack spacing={1.25}>
            <SubHeading id={headingId("border-colour")}>Border colour</SubHeading>
            {data.borderColors.length > 0 ? (
              <CrestColorPicker
                labelledBy={headingId("border-colour")}
                colors={data.borderColors}
                value={current.borderColor?.id ?? null}
                onChange={handleBorderColor}
              />
            ) : (
              emptyPaletteNote("border colours")
            )}
          </Stack>
          <Stack spacing={1.25}>
            <SubHeading id={headingId("borders")}>Borders</SubHeading>
            {data.borders.length > 0 ? (
              <BorderPicker
                borders={data.borders}
                value={current.border?.id ?? null}
                onChange={handleBorder}
                labelledBy={headingId("borders")}
                emblemSrc={emblemArt.src}
                clothAttempt={clothAttempt}
                onClothError={handleClothError}
                {...look}
              />
            ) : (
              <EmptyState
                compact
                icon={<ShieldRounded />}
                title="No borders listed"
                description="Blizzard's crest index lists no borders; the crest is drawn without one."
              />
            )}
          </Stack>
        </Stack>
      ),
      background: (
        <Stack spacing={1.25}>
          <SubHeading id={headingId("background-colour")}>Background colour</SubHeading>
          <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0, maxWidth: "60ch" }}>
            The cloth is shaded, so a colour reads darker in its folds than in its swatch.
          </Typography>
          {data.backgroundColors.length > 0 ? (
            <CrestColorPicker
              labelledBy={headingId("background-colour")}
              colors={data.backgroundColors}
              value={current.backgroundColor?.id ?? null}
              onChange={handleBackgroundColor}
            />
          ) : (
            emptyPaletteNote("background colours")
          )}
        </Stack>
      ),
    };

    return (
      <Box sx={{ minWidth: 0 }}>
        <Tabs
          value={tab}
          onChange={(_event, next: DesignerTab) => setTab(next)}
          variant="scrollable"
          scrollButtons={false}
          aria-label="Crest part"
          sx={(theme) => ({
            mb: 2.5,
            borderBottom: `1px solid ${theme.palette.border.subtle}`,
          })}
        >
          {TABS.map((entry) => (
            <Tab
              key={entry.value}
              value={entry.value}
              label={entry.label}
              id={`${baseId}-tab-${entry.value}`}
              aria-controls={`${baseId}-panel-${entry.value}`}
              // Three tabs fit a 320px screen without scrolling.
              sx={{ minWidth: 0, px: { xs: 1, sm: 2 } }}
            />
          ))}
        </Tabs>
        {TABS.map((entry) => (
          // Panels stay mounted (hidden), so the emblem filter and page
          // survive a look at the other tabs.
          <Box
            key={entry.value}
            role="tabpanel"
            id={`${baseId}-panel-${entry.value}`}
            aria-labelledby={`${baseId}-tab-${entry.value}`}
            hidden={tab !== entry.value}
          >
            {panels[entry.value]}
          </Box>
        ))}
      </Box>
    );
  };

  const renderDesigner = (): JSX.Element => {
    if (catalogQuery.isPending) {
      return <DesignerSkeleton />;
    }
    if (catalogQuery.isError && !catalog) {
      return (
        <ErrorState
          error={catalogQuery.error}
          context="the guild crest parts"
          onRetry={() => void catalogQuery.refetch()}
        />
      );
    }
    if (!catalog || !design || isEmpty) {
      return (
        <EmptyState
          icon={<ShieldRounded />}
          title="No guild crest parts listed"
          description="Blizzard's guild crest index lists no emblems, borders or colours for this region."
        />
      );
    }
    return (
      <Box sx={designerGridSx}>
        <Box
          sx={(theme: Theme) => ({
            minWidth: 0,
            [STICKY_PREVIEW]: {
              position: "sticky",
              top: theme.wc.layout.headerHeight.md + 16,
            },
          })}
        >
          <CrestPreview
            design={design}
            emblemArt={emblemArt}
            borderArt={borderArt}
            clothFailed={clothFailed}
            clothAttempt={clothAttempt}
            onClothError={handleClothError}
            onRetryArt={handleRetryArt}
            onRingChange={handleRing}
            onRandom={handleRandom}
            onReset={handleReset}
          />
        </Box>
        {renderPanels(design, catalog)}
      </Box>
    );
  };

  const palettes: CrestPalette[] = catalog
    ? [
        {
          key: "emblem",
          title: "Emblem colours",
          colors: catalog.emblemColors,
          selectedId: design?.emblemColor?.id ?? null,
        },
        {
          key: "border",
          title: "Border colours",
          colors: catalog.borderColors,
          selectedId: design?.borderColor?.id ?? null,
        },
        {
          key: "background",
          title: "Background colours",
          colors: catalog.backgroundColors,
          selectedId: design?.backgroundColor?.id ?? null,
        },
      ]
    : [];

  const renderPalettes = (): JSX.Element => {
    if (catalogQuery.isPending) {
      return <PalettesSkeleton />;
    }
    if (catalogQuery.isError && !catalog) {
      return (
        <ErrorState
          compact
          error={catalogQuery.error}
          context="the crest palettes"
          onRetry={() => void catalogQuery.refetch()}
        />
      );
    }
    if (colourCount === 0) {
      return (
        <EmptyState
          compact
          title="No crest colours listed"
          description="Blizzard's guild crest index lists no palette colours for this region."
        />
      );
    }
    return <CrestPalettes palettes={palettes} />;
  };

  return (
    <Stack
      sx={(theme) => ({
        gap: {
          xs: theme.spacing(theme.wc.layout.sectionGap.xs),
          md: theme.spacing(theme.wc.layout.sectionGap.md),
        },
      })}
    >
      <PageHeader
        eyebrow={eyebrow}
        breadcrumbs={breadcrumbs}
        title="Guild Crests"
        documentTitle="Guild Crests"
        icon={<ShieldRounded />}
        description="Design a guild crest from the game's own parts: every emblem, border and palette colour in Blizzard's guild crest index, drawn and tinted the way the Armory drew it. The crest lives in the address bar, so a design can be shared."
        meta={
          <>
            <Chip size="small" label={`Region ${env.region.toUpperCase()}`} />
            {catalog ? (
              <>
                <Chip size="small" label={`${formatNumber(catalog.emblems.length)} emblems`} />
                <Chip size="small" label={`${formatNumber(catalog.borders.length)} borders`} />
                <Chip size="small" label={`${formatNumber(colourCount)} palette colours`} />
              </>
            ) : null}
          </>
        }
      />

      <SectionCard
        title="Crest designer"
        description="Pick an emblem, a border and their colours. Emblem and border art is greyscale; the game multiplies it by the colour, so the result runs a shade darker than the swatch."
      >
        {renderDesigner()}
      </SectionCard>

      <SectionCard
        title="Crest palettes"
        description="Every colour Blizzard offers for a crest, by id. Blizzard names none of them; the names here are approximate, the hex values exact."
      >
        {renderPalettes()}
      </SectionCard>
    </Stack>
  );
};

export default GuildCrestsPage;
