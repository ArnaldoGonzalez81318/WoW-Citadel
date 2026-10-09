import { Box, Button, Skeleton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import { useId } from "react";
import type { ReactNode } from "react";

import GoldAmount from "@/components/common/GoldAmount";
import type {
  ItemRecord,
  ItemSetBonus,
  TooltipColor,
} from "@/features/items/types";
import { qualityColor, visuallyHidden } from "@/theme";

export type SetBonusState = {
  bonuses?: ItemSetBonus[];
  loading: boolean;
  /** The set record failed (and has nothing to show). */
  failed: boolean;
  retrying: boolean;
  onRetry: () => void;
};

export type ItemTooltipPanelProps = {
  record: ItemRecord;
  /** The set's bonuses, from its own record (the preview lists only the pieces). */
  setBonuses?: SetBonusState;
};

/**
 * The colours Blizzard sends with a line, mapped onto the theme's where the
 * game uses its stock ones (white text, green bonuses, grey inactive
 * stats, drawn in the theme's secondary text so they keep AA contrast), so
 * they match every other quality colour in the app. Any other
 * colour (a name description's gold, say) is the game's own, as sent.
 */
const lineColor = (theme: Theme, color: TooltipColor | undefined, fallback: string): string => {
  if (!color) {
    return fallback;
  }
  const { r, g, b } = color;
  if (r === 255 && g === 255 && b === 255) {
    return theme.palette.text.primary;
  }
  if (r === 0 && g === 255 && b === 0) {
    return theme.palette.quality.uncommon;
  }
  if (r === 128 && g === 128 && b === 128) {
    return theme.palette.text.secondary;
  }
  return `rgb(${r}, ${g}, ${b})`;
};

/** One tooltip line; `right` puts a second text flush right ("Head      Plate"). */
const Line = ({
  children,
  right,
  color,
  sx,
}: {
  children: ReactNode;
  right?: ReactNode;
  color?: string | ((theme: Theme) => string);
  sx?: object;
}): JSX.Element => (
  <Box
    sx={(theme) => ({
      display: "flex",
      justifyContent: "space-between",
      gap: 2,
      color: typeof color === "function" ? color(theme) : (color ?? theme.palette.text.primary),
      overflowWrap: "anywhere",
      ...sx,
    })}
  >
    <span>{children}</span>
    {right ? <Box component="span" sx={{ textAlign: "right", flexShrink: 0 }}>{right}</Box> : null}
  </Box>
);

/**
 * An item's tooltip as the game draws it, line for line from Blizzard's
 * `preview_item`: name, item level, binding, slot and type, armor or
 * damage, stats in the game's colours, sockets, requirements, Use / Equip
 * effects in green, the set and its bonuses, the flavour text in gold and
 * the vendor price. Lines Blizzard does not send are not drawn.
 */
const ItemTooltipPanel = ({ record, setBonuses }: ItemTooltipPanelProps): JSX.Element => {
  const headingId = useId();
  const tip = record.tooltip;
  const green = (theme: Theme): string => theme.palette.quality.uncommon;
  const gold = (theme: Theme): string => theme.palette.secondary.light;
  // Dimmed, not disabled: these lines are content and must stay readable (AA).
  const grey = (theme: Theme): string => theme.palette.text.secondary;

  return (
    <Box
      component="section"
      aria-labelledby={headingId}
      sx={(theme) => ({
        width: "100%",
        maxWidth: 400,
        justifySelf: "center",
        p: 1.75,
        borderRadius: `${theme.wc.radius.md}px`,
        border: `1px solid ${alpha(qualityColor(theme, record.quality), 0.45)}`,
        background: `linear-gradient(180deg, ${theme.palette.surface.popover} 0%, ${theme.palette.surface.sunken} 100%)`,
        boxShadow: theme.palette.glow.card,
        typography: "body2",
        lineHeight: 1.5,
        display: "flex",
        flexDirection: "column",
        gap: 0.25,
      })}
    >
      <Typography id={headingId} component="h3" sx={visuallyHidden}>
        In-game tooltip
      </Typography>
      {/* The dialog's title already names the item; this line is the picture of it. */}
      <Line
        color={(theme) => qualityColor(theme, record.quality)}
        sx={{ fontSize: "1rem", fontWeight: 600 }}
      >
        <span aria-hidden="true">{record.name}</span>
      </Line>
      {tip.nameDescription ? (
        <Line color={(theme) => lineColor(theme, tip.nameDescription?.color, theme.palette.text.primary)}>
          {tip.nameDescription.text}
        </Line>
      ) : null}
      {tip.itemLevel ? <Line color={gold}>{tip.itemLevel}</Line> : null}
      {tip.toy ? <Line color={(theme) => theme.palette.info.light}>{tip.toy}</Line> : null}
      {tip.craftingReagent ? (
        <Line color={(theme) => theme.palette.info.light}>{tip.craftingReagent}</Line>
      ) : null}
      {tip.binding ? <Line>{tip.binding}</Line> : null}
      {tip.conjured ? <Line>{tip.conjured}</Line> : null}
      {tip.unique ? <Line>{tip.unique}</Line> : null}
      {tip.limitCategory ? <Line>{tip.limitCategory}</Line> : null}
      {tip.slot ? <Line right={tip.subclass}>{tip.slot}</Line> : null}
      {tip.containerSlots ? <Line>{tip.containerSlots}</Line> : null}
      {tip.damage ? <Line right={tip.attackSpeed}>{tip.damage}</Line> : null}
      {tip.dps ? <Line>{tip.dps}</Line> : null}
      {tip.armor ? <Line>{tip.armor}</Line> : null}
      {tip.shieldBlock ? <Line>{tip.shieldBlock}</Line> : null}
      {tip.stats.map((stat, index) => (
        <Line
          key={`${stat.text}-${index}`}
          color={(theme) =>
            stat.negated
              ? theme.palette.text.secondary
              : lineColor(
                  theme,
                  stat.color,
                  stat.equipBonus ? theme.palette.quality.uncommon : theme.palette.text.primary,
                )
          }
        >
          {stat.text}
          {stat.negated ? (
            <Box component="span" sx={visuallyHidden}>
              {" (inactive)"}
            </Box>
          ) : null}
        </Line>
      ))}
      {tip.sockets.map((socket, index) => (
        <Line key={`${socket}-${index}`} color={grey}>
          {socket}
        </Line>
      ))}
      {tip.gemEffect && tip.spells.length === 0 ? <Line>{tip.gemEffect}</Line> : null}
      {tip.durability ? <Line>{tip.durability}</Line> : null}
      {tip.requirements.map((line) => (
        <Line key={line}>{line}</Line>
      ))}
      {tip.spells.map((spell, index) => (
        <Line key={`${spell}-${index}`} color={green} sx={{ mt: index === 0 ? 0.5 : 0 }}>
          {spell}
        </Line>
      ))}
      {tip.charges ? <Line>{tip.charges}</Line> : null}
      {tip.set ? (
        <Stack spacing={0.25} sx={{ mt: 1 }}>
          <Line color={gold}>{tip.set.label}</Line>
          {setBonuses?.bonuses?.map((bonus) => (
            <Line key={`${bonus.requiredCount}-${bonus.text}`} color={grey}>
              {`(${bonus.requiredCount}) ${bonus.text}`}
            </Line>
          ))}
          {setBonuses?.loading ? (
            <Box role="status" aria-label="Loading set bonuses">
              <Skeleton variant="text" width="90%" />
              <Skeleton variant="text" width="70%" />
            </Box>
          ) : null}
          {setBonuses?.failed ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Set bonuses couldn&apos;t be loaded.
              </Typography>
              {/* Enabled while retrying (a disabled button drops focus). */}
              <Button size="small" onClick={setBonuses.onRetry}>
                {setBonuses.retrying ? "Retrying…" : "Retry"}
              </Button>
            </Stack>
          ) : null}
        </Stack>
      ) : null}
      {tip.description ? (
        <Line color={gold} sx={{ mt: 1 }}>
          {`“${tip.description}”`}
        </Line>
      ) : null}
      {tip.sellPrice !== undefined ? (
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, mt: 1, flexWrap: "wrap" }}>
          <span>{tip.sellPriceLabel ?? "Sell Price:"}</span>
          <GoldAmount copper={tip.sellPrice} size="small" />
        </Box>
      ) : null}
    </Box>
  );
};

export default ItemTooltipPanel;
