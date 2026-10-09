import type { SvgIconComponent } from "@mui/icons-material";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Link as RouterLink } from "react-router-dom";

import { gridTemplateColumnsSx } from "@/components/common/gridColumns";
import SectionCard from "@/components/common/SectionCard";
import type { NavFlyoutItem } from "@/components/layout/navigation/navConfig";
import {
  isMouseLike,
  preloadRouteChunk,
} from "@/components/layout/navigation/navUtils";
import {
  API_EXPLORER,
  DATASET_COUNT,
  DIRECTORY_GROUPS,
  DIRECTORY_ID,
  EXPLORER_COUNT,
} from "@/features/home/config/directory";
import type { DirectoryGroup } from "@/features/home/config/directory";
import {
  API_EXPLORER_ICON,
  DATASET_ICON,
  DIRECTORY_ICON,
  SECTION_ICONS,
  iconForItem,
} from "@/features/home/config/directoryIcons";
import { formatNumber } from "@/lib/format";
import { mixins } from "@/theme";

const ICON_TILE = 36;
const DatasetIcon = DATASET_ICON;

const count = (value: number, one: string, many: string): string =>
  `${formatNumber(value)} ${value === 1 ? one : many}`;

const groupCount = (group: DirectoryGroup): string =>
  [
    group.explorers.length > 0
      ? count(group.explorers.length, "explorer", "explorers")
      : undefined,
    group.datasets.length > 0
      ? count(group.datasets.length, "API dataset", "API datasets")
      : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

/** Warms the route chunk only (never data), as the menu does on hover intent. */
const preloadHandlers = (path: string) => ({
  onPointerEnter: (event: ReactPointerEvent<HTMLElement>) => {
    if (isMouseLike(event)) {
      preloadRouteChunk(path);
    }
  },
  onFocus: () => preloadRouteChunk(path),
});

const IconTile = ({ Icon }: { Icon: SvgIconComponent }): JSX.Element => (
  <Box
    aria-hidden="true"
    sx={(theme) => ({
      width: ICON_TILE,
      height: ICON_TILE,
      flexShrink: 0,
      display: "grid",
      placeItems: "center",
      borderRadius: `${theme.wc.radius.md}px`,
      bgcolor: alpha(theme.palette.primary.main, 0.12),
      color: theme.palette.primary.light,
      "& svg": { fontSize: 20 },
    })}
  >
    <Icon />
  </Box>
);

type RowLinkProps = {
  id: string;
  to: string;
  label: string;
  description: string;
  Icon: SvgIconComponent;
  preload: boolean;
};

/**
 * One explorer: a single block link named by its label and described by
 * its blurb, so a screen reader reads "Mounts, link" and then what it holds
 * instead of both run together.
 */
const RowLink = ({
  id,
  to,
  label,
  description,
  Icon,
  preload,
}: RowLinkProps): JSX.Element => (
  <Box component="li" sx={{ minWidth: 0 }}>
    <Box
      component={RouterLink}
      to={to}
      aria-labelledby={`${id}-label`}
      aria-describedby={`${id}-desc`}
      {...(preload ? preloadHandlers(to) : {})}
      sx={(theme) => ({
        display: "grid",
        gridTemplateColumns: `${ICON_TILE}px minmax(0, 1fr)`,
        alignItems: "start",
        gap: 1.5,
        p: 1.5,
        height: "100%",
        boxSizing: "border-box",
        borderRadius: `${theme.wc.radius.md}px`,
        color: "inherit",
        textDecoration: "none",
        transition: theme.transitions.create("background-color", {
          duration: theme.wc.motion.fast,
        }),
        "@media (hover: hover)": {
          "&:hover": { bgcolor: theme.palette.action.hover },
        },
        "&:focus-visible": mixins.focusRing(theme),
      })}
    >
      <IconTile Icon={Icon} />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          id={`${id}-label`}
          variant="subtitle2"
          component="span"
          sx={{ display: "block", overflowWrap: "anywhere" }}
        >
          {label}
        </Typography>
        <Typography
          id={`${id}-desc`}
          variant="body2"
          color="text.secondary"
          component="span"
          sx={{ ...mixins.lineClamp(2), mt: 0.25 }}
        >
          {description}
        </Typography>
      </Box>
    </Box>
  </Box>
);

const RowList = ({ children }: { children: JSX.Element[] }): JSX.Element => (
  <Box
    component="ul"
    // Safari drops the list role from a list-style:none list without it.
    role="list"
    sx={{
      listStyle: "none",
      m: 0,
      p: 0,
      display: "grid",
      gap: 1.5,
      ...gridTemplateColumnsSx({ xs: 1, sm: 2, lg: 3 }),
    }}
  >
    {children}
  </Box>
);

type GroupHeaderProps = {
  id: string;
  Icon: SvgIconComponent;
  title: string;
  description?: string;
  caption?: string;
};

const GroupHeader = ({
  id,
  Icon,
  title,
  description,
  caption,
}: GroupHeaderProps): JSX.Element => (
  <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ minWidth: 0 }}>
    <IconTile Icon={Icon} />
    <Box sx={{ minWidth: 0 }}>
      <Typography id={id} variant="h6" component="h3" sx={{ m: 0 }}>
        {title}
      </Typography>
      {description ? (
        <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
          {description}
        </Typography>
      ) : null}
      {caption ? (
        <Typography
          variant="caption"
          color="text.secondary"
          component="p"
          sx={{ m: 0, fontVariantNumeric: "tabular-nums" }}
        >
          {caption}
        </Typography>
      ) : null}
    </Box>
  </Stack>
);

const DatasetChips = ({
  groupId,
  datasets,
}: {
  groupId: string;
  datasets: readonly NavFlyoutItem[];
}): JSX.Element => {
  const labelId = `${groupId}-datasets`;
  return (
    <Stack spacing={1}>
      <Typography
        id={labelId}
        variant="overline"
        component="p"
        color="text.secondary"
        sx={{ m: 0, lineHeight: 1.6 }}
      >
        API datasets
      </Typography>
      <Stack
        component="ul"
        role="list"
        aria-labelledby={labelId}
        direction="row"
        flexWrap="wrap"
        useFlexGap
        gap={1}
        sx={{ listStyle: "none", m: 0, p: 0 }}
      >
        {datasets.map((item) => (
          <Box component="li" key={item.id} sx={{ minWidth: 0, maxWidth: "100%" }}>
            <Chip
              component={RouterLink}
              to={item.path}
              clickable
              size="small"
              variant="outlined"
              icon={<DatasetIcon />}
              label={item.label}
              {...preloadHandlers(item.path)}
              sx={{ maxWidth: "100%" }}
            />
          </Box>
        ))}
      </Stack>
    </Stack>
  );
};

/**
 * Every explorer and API dataset, grouped like the main menu and derived
 * from it (config/directory), plus the API Explorer, which the menu leaves
 * out. Static: no requests, no loading or error states.
 */
const ExplorerDirectory = (): JSX.Element => (
  <SectionCard
    id={DIRECTORY_ID}
    title="All explorers"
    icon={<DIRECTORY_ICON />}
    description={`${formatNumber(EXPLORER_COUNT)} explorers built on Blizzard's game-data API, grouped like the main menu, plus ${
      DATASET_COUNT > 0 ? `${formatNumber(DATASET_COUNT)} API datasets and ` : ""
    }the API Explorer.`}
    // The strip's "All explorers" link scrolls here with scrollIntoView;
    // keep the heading clear of the sticky header when it does.
    sx={(theme) => ({
      scrollMarginTop: {
        xs: `${theme.wc.layout.headerHeight.xs + 8}px`,
        md: `${theme.wc.layout.headerHeight.md + 8}px`,
      },
    })}
  >
    <Stack spacing={3}>
      {DIRECTORY_GROUPS.map((group) => {
        const groupId = `${DIRECTORY_ID}-${group.section.id}`;
        return (
          <Stack key={group.section.id} spacing={1.5} sx={{ minWidth: 0 }}>
            <GroupHeader
              id={`${groupId}-title`}
              Icon={SECTION_ICONS[group.section.id] ?? DIRECTORY_ICON}
              title={group.section.label}
              description={group.section.description}
              caption={groupCount(group)}
            />
            {group.explorers.length > 0 ? (
              <RowList>
                {group.explorers.map((item) => (
                  <RowLink
                    key={item.id}
                    id={`${groupId}-${item.id}`}
                    to={item.path}
                    label={item.label}
                    description={item.description}
                    Icon={iconForItem(item, group.section.id)}
                    preload
                  />
                ))}
              </RowList>
            ) : null}
            {group.datasets.length > 0 ? (
              <DatasetChips groupId={groupId} datasets={group.datasets} />
            ) : null}
          </Stack>
        );
      })}

      <Stack spacing={1.5} sx={{ minWidth: 0 }}>
        <GroupHeader
          id={`${DIRECTORY_ID}-developer-title`}
          Icon={API_EXPLORER_ICON}
          title="Developer tools"
        />
        <RowList>
          {[
            <RowLink
              key="api-explorer"
              id={`${DIRECTORY_ID}-api-explorer`}
              to={API_EXPLORER.path}
              label={API_EXPLORER.label}
              description={API_EXPLORER.description}
              Icon={API_EXPLORER_ICON}
              // navUtils has no preloader for /api-explorer.
              preload={false}
            />,
          ]}
        </RowList>
      </Stack>
    </Stack>
  </SectionCard>
);

export default ExplorerDirectory;
