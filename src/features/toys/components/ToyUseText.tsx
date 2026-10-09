import TimerRoundedIcon from "@mui/icons-material/TimerRounded";
import { Chip, Stack, Typography } from "@mui/material";

import type { ToyItem } from "@/features/toys/types";
import { mixins } from "@/theme";

export type ToyUseTextProps = {
  item: ToyItem;
  /** The spotlight's short form: effect and flavour clamped, no "Adds this toy" line. */
  compact?: boolean;
};

/**
 * What a toy does, as its tooltip words it: the effect in the tooltip's
 * green, the cooldown Blizzard writes after it as a chip of its own, and the
 * gold flavour line. Every word is Blizzard's; a toy whose item lists no
 * "Use:" text says so.
 */
const ToyUseText = ({ item, compact = false }: ToyUseTextProps): JSX.Element => {
  const cooldowns = [
    ...new Set(
      item.uses
        .map((use) => use.cooldown)
        .filter((cooldown): cooldown is string => cooldown !== undefined),
    ),
  ];
  const effects = item.uses.flatMap((use) => use.effect);
  const learn = item.uses.find((use) => use.learn !== undefined)?.learn;

  return (
    <Stack spacing={1} sx={{ minWidth: 0 }}>
      {!compact && learn ? (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
          {learn}
        </Typography>
      ) : null}
      {effects.length > 0 && compact ? (
        // One clamped paragraph: a line clamp does not reach across blocks.
        <Typography
          variant="body1"
          component="p"
          sx={(theme) => ({
            m: 0,
            color: theme.palette.quality.uncommon,
            overflowWrap: "anywhere",
            ...mixins.lineClamp(3),
          })}
        >
          {effects.join(" ")}
        </Typography>
      ) : effects.length > 0 ? (
        <Stack spacing={1}>
          {effects.map((paragraph, index) => (
            <Typography
              // Blizzard's paragraphs, in order; nothing to key them by but position.
              key={index}
              variant="body2"
              component="p"
              sx={(theme) => ({
                m: 0,
                color: theme.palette.quality.uncommon,
                overflowWrap: "anywhere",
              })}
            >
              {paragraph}
            </Typography>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" component="p" sx={{ m: 0 }}>
          Blizzard lists no &ldquo;Use&rdquo; text for this toy.
        </Typography>
      )}
      {cooldowns.length > 0 ? (
        <Stack direction="row" flexWrap="wrap" useFlexGap gap={1}>
          {cooldowns.map((cooldown) => (
            <Chip
              key={cooldown}
              size="small"
              variant="outlined"
              icon={<TimerRoundedIcon />}
              label={cooldown}
            />
          ))}
        </Stack>
      ) : null}
      {item.description ? (
        <Typography
          variant="body2"
          component="p"
          sx={(theme) => ({
            m: 0,
            color: theme.palette.secondary.light,
            fontStyle: "italic",
            overflowWrap: "anywhere",
            ...(compact ? mixins.lineClamp(2) : {}),
          })}
        >
          &ldquo;{item.description}&rdquo;
        </Typography>
      ) : null}
    </Stack>
  );
};

export default ToyUseText;
