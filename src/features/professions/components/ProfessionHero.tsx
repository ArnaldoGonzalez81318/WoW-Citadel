import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";
import type { ReactNode, Ref } from "react";

import { FilterChipGroup } from "@/components/common/ExplorerFilterBar";
import MediaTile from "@/components/common/MediaTile";
import IconBackdrop from "@/features/professions/components/IconBackdrop";
import { professionIconQuery } from "@/features/professions/hooks/professionQueries";
import {
  formatSkillRange,
  pluralize,
  professionGroup,
} from "@/features/professions/services/professionService";
import type {
  Profession,
  ProfessionGroupKey,
} from "@/features/professions/types";

export type ProfessionHeroProps = {
  profession: Profession;
  /** The tier whose recipes are listed below (null without tiers). */
  tierId: number | null;
  onTierChange: (tierId: number) => void;
  /** The h2, focusable from script: a pick in the gallery moves focus here. */
  headingRef?: Ref<HTMLHeadingElement>;
};

const GROUP_LABEL: Record<ProfessionGroupKey, string> = {
  crafting: "Crafting profession",
  gathering: "Gathering profession",
  secondary: "Secondary profession",
  other: "Internal crafting line",
};

/** Why a profession without tiers shows no recipe list (a skill range shows as a chip). */
const noTiersNote = (profession: Profession): string =>
  professionGroup(profession) === "other"
    ? `Blizzard lists ${profession.name} as a profession but publishes no skill tiers or recipes for it.`
    : `Blizzard's API has no skill tiers or recipes for ${profession.name}.`;

/**
 * The selected profession: its icon over a blurred wash of the same art,
 * what kind of profession it is, Blizzard's description and the expansion
 * picker that chooses which recipe book is listed below.
 */
const ProfessionHero = ({
  profession,
  tierId,
  onTierChange,
  headingRef,
}: ProfessionHeroProps): JSX.Element => {
  // The gallery tile already asked for this icon; this reads its cache entry.
  const iconQuery = useQuery(professionIconQuery(profession.id));
  const icon = iconQuery.data ?? null;
  const titleId = useId();
  const tiers = profession.skillTiers;
  const skillRange = formatSkillRange(profession.minimumSkill, profession.maximumSkill);

  const group = professionGroup(profession);

  const facts: ReactNode[] = [];
  // An internal line's "Primary" would contradict the label above it.
  if (profession.typeName && group !== "other") {
    facts.push(<Chip key="type" size="small" label={profession.typeName} />);
  }
  if (tiers.length > 0) {
    facts.push(
      <Chip
        key="tiers"
        size="small"
        variant="outlined"
        label={pluralize(tiers.length, "expansion", "expansions")}
      />,
    );
  }
  if (skillRange) {
    facts.push(<Chip key="range" size="small" variant="outlined" label={skillRange} />);
  }

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby={titleId}
      sx={(theme) => ({
        position: "relative",
        overflow: "hidden",
        borderRadius: `${theme.wc.radius.lg}px`,
        borderColor: theme.palette.border.default,
      })}
    >
      <IconBackdrop src={icon} opacity={0.5} sx={{ height: 200, bottom: "auto" }} />
      <Stack spacing={2} sx={{ position: "relative", p: { xs: 2, md: 3 } }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
          <MediaTile
            size={56}
            src={icon}
            alt=""
            fallbackLabel={profession.name}
            loading={iconQuery.isPending}
            radius="md"
            sx={(theme) => ({ boxShadow: theme.palette.glow.card })}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="overline"
              component="p"
              sx={{ m: 0, color: "secondary.main", lineHeight: 1.4 }}
            >
              {GROUP_LABEL[group]}
            </Typography>
            <Typography
              ref={headingRef}
              id={titleId}
              variant="h3"
              component="h2"
              tabIndex={-1}
              // A script focus target only, never a Tab stop: no ring needed.
              sx={{ m: 0, overflowWrap: "anywhere", "&:focus": { outline: "none" } }}
            >
              {profession.name}
            </Typography>
          </Box>
        </Stack>

        {profession.description ? (
          <Typography variant="body1" color="text.secondary" component="p" sx={{ m: 0, maxWidth: "72ch" }}>
            {profession.description}
          </Typography>
        ) : null}

        {facts.length > 0 ? (
          <Stack direction="row" flexWrap="wrap" useFlexGap gap={1}>
            {facts}
          </Stack>
        ) : null}

        {tiers.length > 0 ? (
          <Stack spacing={1}>
            <Typography variant="subtitle2" component="p" sx={{ m: 0 }}>
              Expansion
            </Typography>
            <FilterChipGroup
              label="Expansion"
              hideAll
              options={tiers.map((tier) => ({
                value: String(tier.id),
                label: tier.label,
              }))}
              value={tierId === null ? null : String(tierId)}
              onChange={(next) => {
                // Pressing the selected expansion again would clear it; a profession always shows one.
                if (next !== null) {
                  onTierChange(Number(next));
                }
              }}
            />
          </Stack>
        ) : (
          <Typography
            variant="body2"
            color="text.secondary"
            component="p"
            sx={(theme) => ({
              m: 0,
              p: 1.5,
              maxWidth: "72ch",
              border: `1px dashed ${theme.palette.border.default}`,
              borderRadius: `${theme.wc.radius.md}px`,
              backgroundColor: theme.palette.surface.inset,
            })}
          >
            {noTiersNote(profession)}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
};

export default ProfessionHero;
