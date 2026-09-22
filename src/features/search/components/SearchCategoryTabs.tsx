import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import { Box, CircularProgress, Tab, Tabs, Typography } from "@mui/material";

import type { SearchCategoryState } from "@/features/search/hooks/useBlizzardSearch";
import type { SearchCategoryId } from "@/features/search/types";
import { formatNumber } from "@/lib/format";

export interface SearchCategoryTabsProps {
  states: SearchCategoryState[];
  value: SearchCategoryId;
  onChange: (id: SearchCategoryId) => void;
}

/** "1,204", or "24+" when more pages exist but Blizzard gave no total. */
const countLabel = (state: SearchCategoryState): string => {
  if (typeof state.total === "number") {
    return formatNumber(state.total);
  }
  return `${formatNumber(state.data.length)}${state.pageCount > 1 ? "+" : ""}`;
};

const TabBadge = ({ state }: { state: SearchCategoryState }): JSX.Element => {
  if (state.isError) {
    return (
      <WarningAmberRounded
        fontSize="inherit"
        color="warning"
        role="img"
        aria-label="Failed"
        sx={{ fontSize: 16 }}
      />
    );
  }

  // Also pending: a new key whose placeholder is an empty previous page.
  if (state.isLoading || (state.isPlaceholderData && state.data.length === 0)) {
    return (
      <CircularProgress
        size={12}
        thickness={5}
        aria-label={`Loading ${state.category.plural}`}
      />
    );
  }

  return (
    <Typography
      component="span"
      variant="caption"
      sx={(theme) => ({
        minWidth: 20,
        px: 0.75,
        py: 0.125,
        borderRadius: `${theme.wc.radius.pill}px`,
        bgcolor: theme.palette.action.selected,
        color: "text.primary",
        fontVariantNumeric: "tabular-nums",
        fontWeight: 500,
        lineHeight: 1.4,
        textAlign: "center",
      })}
    >
      {countLabel(state)}
    </Typography>
  );
};

/**
 * One Tab per searched category with a live count badge. The Tab itself is
 * the selected/focus surface (native `aria-selected`).
 */
const SearchCategoryTabs = ({
  states,
  value,
  onChange,
}: SearchCategoryTabsProps): JSX.Element => (
  <Tabs
    value={value}
    onChange={(_, next: SearchCategoryId) => onChange(next)}
    variant="scrollable"
    scrollButtons="auto"
    allowScrollButtonsMobile
    aria-label="Result categories"
    sx={(theme) => ({
      borderBottom: `1px solid ${theme.palette.border.subtle}`,
    })}
  >
    {states.map((state) => {
      const Icon = state.category.icon;
      return (
        <Tab
          key={state.category.id}
          value={state.category.id}
          icon={<Icon fontSize="small" />}
          iconPosition="start"
          label={
            <Box
              component="span"
              sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}
            >
              <span>{state.category.label}</span>
              <TabBadge state={state} />
            </Box>
          }
        />
      );
    })}
  </Tabs>
);

export default SearchCategoryTabs;
