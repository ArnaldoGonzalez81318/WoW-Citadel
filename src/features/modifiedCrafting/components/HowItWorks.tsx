import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CategoryRoundedIcon from "@mui/icons-material/CategoryRounded";
import ExtensionRoundedIcon from "@mui/icons-material/ExtensionRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import SchemaRoundedIcon from "@mui/icons-material/SchemaRounded";
import { Box, Chip, Skeleton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import type { ReactNode } from "react";

import SectionCard from "@/components/common/SectionCard";
import { scrollMarginSx } from "@/features/modifiedCrafting/components/cardStyles";
import { pluralize } from "@/features/modifiedCrafting/services/modifiedCraftingService";
import { formatNumber } from "@/lib/format";

/** The section's id; SectionCard gives its heading this id plus "-title". */
export const HOW_IT_WORKS_ID = "modified-crafting-guide";

/** A live count: null while it loads, "failed" when its index could not be read. */
export type LiveCount = number | null | "failed";

export type HowItWorksProps = {
  slotCount: LiveCount;
  categoryCount: LiveCount;
  /** Distinct category names (the unnamed categories are not among them). */
  categoryNameCount: LiveCount;
  /** Categories Blizzard lists without a name. */
  unnamedCategoryCount: number;
  /** The name the most category ids share, and how many. */
  mostRepeated: { name: string; count: number } | null;
};

/** The count in words, "Count unavailable" when its index failed, null (a skeleton) while it loads. */
const countFact = (count: LiveCount, format: (count: number) => string): string | null => {
  if (count === "failed") {
    return "Count unavailable";
  }
  return count === null ? null : format(count);
};

type Step = {
  key: string;
  icon: ReactNode;
  title: string;
  fact: string | null;
  body: string;
  color: (theme: Theme) => string;
};

const StepCard = ({ step }: { step: Step }): JSX.Element => (
  <Box
    component="li"
    sx={(theme) => {
      const color = step.color(theme);
      return {
        flex: 1,
        minWidth: 0,
        p: 2,
        borderRadius: `${theme.wc.radius.md}px`,
        border: `1px solid ${theme.palette.border.subtle}`,
        borderTop: `3px solid ${alpha(color, 0.8)}`,
        background: `linear-gradient(180deg, ${alpha(color, 0.12)} 0%, ${alpha(color, 0)} 70%)`,
      };
    }}
  >
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
      <Box
        aria-hidden="true"
        sx={(theme) => ({ display: "flex", color: step.color(theme), "& svg": { fontSize: 22 } })}
      >
        {step.icon}
      </Box>
      <Typography variant="subtitle2" component="h3" sx={{ m: 0, fontWeight: 700 }}>
        {step.title}
      </Typography>
    </Stack>
    {step.fact ? (
      <Typography
        variant="body2"
        component="p"
        sx={{ m: 0, mb: 0.5, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
      >
        {step.fact}
      </Typography>
    ) : (
      <Skeleton variant="text" width="60%" sx={{ fontSize: "0.875rem", mb: 0.5 }} />
    )}
    <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
      {step.body}
    </Typography>
  </Box>
);

/** "accepts", "carried by": the relation between two steps, an arrow that turns down on phones. */
const Relation = ({ label }: { label: string }): JSX.Element => (
  <Box
    component="li"
    aria-hidden="true"
    sx={{
      display: "flex",
      flexDirection: { xs: "row", md: "column" },
      alignItems: "center",
      justifyContent: "center",
      gap: 0.5,
      color: "text.secondary",
      flexShrink: 0,
      px: { md: 0.5 },
      "& svg": { fontSize: 20, transform: { xs: "rotate(90deg)", md: "none" } },
    }}
  >
    <ArrowForwardRoundedIcon />
    <Typography variant="caption" component="span">
      {label}
    </Typography>
  </Box>
);

/**
 * What the page is about, in two parts kept apart on purpose: how slot
 * types, categories and reagent items relate in Blizzard's data (with the
 * live counts), and what the slots do in the game, which the API never says
 * and is labelled as such.
 */
const HowItWorks = ({
  slotCount,
  categoryCount,
  categoryNameCount,
  unnamedCategoryCount,
  mostRepeated,
}: HowItWorksProps): JSX.Element => {
  const steps: Step[] = [
    {
      key: "slot",
      icon: <ExtensionRoundedIcon />,
      title: "Reagent slot type",
      fact: countFact(slotCount, (count) => pluralize(count, "slot type", "slot types")),
      body: "A slot a recipe offers for one kind of reagent. Its record lists the categories it accepts, and nothing else.",
      color: (theme) => theme.palette.quality.epic,
    },
    {
      key: "category",
      icon: <CategoryRoundedIcon />,
      title: "Reagent category",
      fact: countFact(categoryCount, (count) => {
        if (typeof categoryNameCount !== "number") {
          return pluralize(count, "category", "categories");
        }
        const unnamed =
          unnamedCategoryCount > 0 ? ` and ${formatNumber(unnamedCategoryCount)} unnamed` : "";
        return `${pluralize(count, "category", "categories")}: ${pluralize(categoryNameCount, "name", "names")}${unnamed}`;
      }),
      body:
        mostRepeated && mostRepeated.count > 1
          ? `A family of interchangeable reagents. Names repeat: “${mostRepeated.name}” alone is ${formatNumber(mostRepeated.count)} ids.`
          : "A family of interchangeable reagents, often one reagent in its quality ranks.",
      color: (theme) => theme.palette.primary.main,
    },
    {
      key: "item",
      icon: <Inventory2RoundedIcon />,
      title: "Reagent items",
      fact: "Found by item search",
      body: "The API's item records name the category each reagent belongs to, which is where this page's icons and effect text come from.",
      color: (theme) => theme.palette.quality.legendary,
    },
  ];

  return (
    <SectionCard
      id={HOW_IT_WORKS_ID}
      // The header's "How it works" scrolls here: clear of the sticky app bar.
      sx={scrollMarginSx}
      title="How modified crafting works"
      icon={<SchemaRoundedIcon />}
      description="Slot types and categories have no artwork and name no recipes: a recipe's own record lists its slots, one recipe at a time, so this page shows what fits each slot rather than where the slot appears."
    >
      <Stack spacing={2.5}>
        <Box
          component="ol"
          role="list"
          aria-label="How the data connects"
          sx={{
            listStyle: "none",
            m: 0,
            p: 0,
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            alignItems: "stretch",
            gap: 1,
          }}
        >
          <StepCard step={steps[0]} />
          <Relation label="accepts" />
          <StepCard step={steps[1]} />
          <Relation label="carried by" />
          <StepCard step={steps[2]} />
        </Box>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
          The slot type themes come from the words in the slot names: this page&apos;s grouping,
          not Blizzard&apos;s, which gives slot types no kind at all.
        </Typography>

        <Box
          sx={(theme) => ({
            p: 2,
            borderRadius: `${theme.wc.radius.md}px`,
            border: `1px dashed ${theme.palette.border.gold}`,
            backgroundColor: alpha(theme.palette.secondary.main, 0.04),
          })}
        >
          <Stack direction="row" flexWrap="wrap" useFlexGap gap={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle2" component="h3" sx={{ m: 0, fontWeight: 700 }}>
              In the game
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              label="Game knowledge, not from the API"
              sx={(theme) => ({ borderColor: theme.palette.border.gold })}
            />
          </Stack>
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
              <Box component="strong" sx={{ color: "text.primary" }}>
                Optional reagents
              </Box>{" "}
              change what is made: an embellishment adds a special effect (a character can wear
              only a few embellished items at once), a missive picks the secondary stats, and
              sparks and crests set or raise the item level.
            </Typography>
            <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
              <Box component="strong" sx={{ color: "text.primary" }}>
                Finishing reagents
              </Box>{" "}
              improve the craft itself: Illustrious Insight raises the crafting skill toward a
              higher quality, and polishing cloths, secret ingredients and spare parts add
              bonuses of their own.
            </Typography>
          </Stack>
        </Box>
      </Stack>
    </SectionCard>
  );
};

export default HowItWorks;
