import { Box, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import type { ReactNode } from "react";

import type { Heirloom, HeirloomStat, HeirloomTier } from "@/features/heirlooms/types";
import { qualityColor } from "@/theme";

type Tone = "primary" | "muted" | "gold" | "green";

const toneColor = (theme: Theme, tone: Tone): string => {
  switch (tone) {
    case "muted":
      return theme.palette.text.secondary;
    case "gold":
      return theme.palette.secondary.main;
    case "green":
      return qualityColor(theme, "uncommon");
    default:
      return theme.palette.text.primary;
  }
};

const Line = ({
  children,
  tone = "primary",
  italic = false,
}: {
  children: ReactNode;
  tone?: Tone;
  italic?: boolean;
}): JSX.Element => (
  <Typography
    variant="body2"
    component="p"
    sx={(theme) => ({
      m: 0,
      color: toneColor(theme, tone),
      fontStyle: italic ? "italic" : undefined,
      overflowWrap: "anywhere",
    })}
  >
    {children}
  </Typography>
);

/** Slot left, type right ("Two-Hand … Staff"), wrapping under each other when narrow. */
const Pair = ({ left, right }: { left?: string; right?: string }): JSX.Element | null =>
  left || right ? (
    <Stack direction="row" flexWrap="wrap" useFlexGap columnGap={2} justifyContent="space-between">
      {left ? <Line>{left}</Line> : <span />}
      {right ? <Line>{right}</Line> : null}
    </Stack>
  ) : null;

/** Blizzard's colours: white base stats, green equip bonuses, grey negated ones. */
const statTone = (stat: HeirloomStat): Tone => {
  if (stat.bonus) {
    return "green";
  }
  return stat.negated ? "muted" : "primary";
};

export type ItemTooltipProps = {
  heirloom: Heirloom;
  tier: HeirloomTier;
};

/**
 * The heirloom as the game's tooltip shows it at one upgrade level: every
 * line is Blizzard's own (localized) text from that level's item, in the
 * tooltip's order and colours, re-tuned for this dark surface.
 */
const ItemTooltip = ({ heirloom, tier }: ItemTooltipProps): JSX.Element => (
  <Box
    sx={(theme) => ({
      p: 2,
      minWidth: 0,
      borderRadius: `${theme.wc.radius.md}px`,
      border: `1px solid ${alpha(qualityColor(theme, "heirloom"), 0.4)}`,
      backgroundColor: theme.palette.surface.sunken,
      boxShadow: theme.palette.glow.card,
    })}
  >
    <Stack spacing={0.25}>
      <Typography
        variant="subtitle1"
        component="p"
        sx={(theme) => ({
          m: 0,
          fontWeight: 700,
          color: qualityColor(theme, "heirloom"),
          overflowWrap: "anywhere",
        })}
      >
        {heirloom.name}
      </Typography>
      {heirloom.variant ? <Line tone="green">{heirloom.variant}</Line> : null}
      {tier.upgradeText ? <Line tone="muted">{tier.upgradeText}</Line> : null}
      {tier.itemLevelText ? <Line tone="gold">{tier.itemLevelText}</Line> : null}
      {heirloom.binding ? <Line>{heirloom.binding}</Line> : null}
      {heirloom.limitCategory ? (
        <Line>{heirloom.limitCategory}</Line>
      ) : heirloom.unique ? (
        <Line>{heirloom.unique}</Line>
      ) : null}
      <Pair left={heirloom.slotName} right={heirloom.typeName ?? undefined} />
      <Pair left={tier.damageText} right={tier.speedText} />
      {tier.dpsText ? <Line>{tier.dpsText}</Line> : null}
      {tier.armorText ? <Line>{tier.armorText}</Line> : null}
      {tier.blockText ? <Line>{tier.blockText}</Line> : null}
      {tier.stats.map((stat) => (
        <Line key={stat.type} tone={statTone(stat)}>
          {stat.display}
        </Line>
      ))}
      {heirloom.sockets.map((socket, index) => (
        <Line key={`${socket}-${index}`} tone="muted">
          {socket}
        </Line>
      ))}
      {heirloom.socketBonus ? <Line tone="muted">{heirloom.socketBonus}</Line> : null}
      {tier.spells.map((spell, index) => (
        <Line key={index} tone="green">
          {spell}
        </Line>
      ))}
      {tier.set ? (
        <Box sx={{ pt: 1 }}>
          <Line tone="gold">{tier.set.name}</Line>
          {tier.set.effects.map((effect, index) => (
            <Line key={index} tone="muted">
              {effect.text}
            </Line>
          ))}
        </Box>
      ) : null}
      {heirloom.description ? (
        <Box sx={{ pt: 1 }}>
          <Line tone="gold" italic>
            {`“${heirloom.description}”`}
          </Line>
        </Box>
      ) : null}
      {tier.requirementText ? (
        <Box sx={{ pt: 1 }}>
          <Line>{tier.requirementText}</Line>
        </Box>
      ) : null}
    </Stack>
  </Box>
);

export default ItemTooltip;
