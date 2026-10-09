import {
  Box,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useId, useMemo, useState } from "react";

import { LiveStatus } from "@/components/common/StateBlocks";
import ItemTooltip from "@/features/heirlooms/components/ItemTooltip";
import { upgradeLabel } from "@/features/heirlooms/services/heirloomService";
import type { Heirloom, HeirloomTier } from "@/features/heirlooms/types";
import { formatNumber } from "@/lib/format";
import { focusRing, qualityColor, visuallyHidden } from "@/theme";

export type UpgradeLadderProps = {
  heirloom: Heirloom;
};

const BAR_MAX_PX = 40;
const BAR_MIN_PX = 6;

type StatColumn = { type: string; name: string; negated: boolean };

/** Every stat any level carries, in Blizzard's order (primary stats, Stamina, then bonuses). */
const statColumns = (tiers: readonly HeirloomTier[]): StatColumn[] => {
  const columns = new Map<string, StatColumn>();
  tiers.forEach((tier) =>
    tier.stats.forEach((stat) => {
      if (!columns.has(stat.type)) {
        columns.set(stat.type, { type: stat.type, name: stat.name, negated: stat.negated });
      }
    }),
  );
  return [...columns.values()];
};

/** "1–34", from the level's requirement line. */
const levelsOf = (tier: HeirloomTier): string =>
  tier.levelRange
    ? `${formatNumber(tier.levelRange.min)}–${formatNumber(tier.levelRange.max)}`
    : "—";

/** "Upgrade 3 of 6: item level 44, character levels 1–44." */
const describeTier = (tier: HeirloomTier): string => {
  const parts: string[] = [];
  if (tier.itemLevel !== null) {
    parts.push(`item level ${formatNumber(tier.itemLevel)}`);
  }
  if (tier.levelRange) {
    parts.push(`character levels ${levelsOf(tier)}`);
  }
  const head =
    tier.upgrade !== null && tier.maxUpgrade !== null
      ? `Upgrade ${formatNumber(tier.upgrade)} of ${formatNumber(tier.maxUpgrade)}`
      : "Upgrade level";
  return parts.length > 0 ? `${head}: ${parts.join(", ")}.` : `${head}.`;
};

/**
 * The upgrade ladder: one step per upgrade level Blizzard lists, each a bar
 * as tall as its item level; the pressed step (the top one at first) shows
 * the full tooltip at that level, and a table sets every level's item
 * level, level range and stats side by side.
 */
const UpgradeLadder = ({ heirloom }: UpgradeLadderProps): JSX.Element => {
  const { tiers } = heirloom;
  // The pick belongs to one heirloom: another one starts at its top level.
  const [picked, setPicked] = useState<{ heirloomId: number; index: number } | null>(null);
  const index =
    picked && picked.heirloomId === heirloom.id && picked.index < tiers.length
      ? picked.index
      : tiers.length - 1;
  const tier = tiers[index];
  const columns = useMemo(() => statColumns(tiers), [tiers]);
  const hasArmor = tiers.some((entry) => entry.armor !== null);
  const hasDps = tiers.some((entry) => entry.dps !== null);
  const captionId = useId();
  const top = heirloom.maxItemLevel ?? 0;

  if (!tier) {
    return (
      <Typography variant="body2" color="text.secondary">
        Blizzard lists no upgrade levels for this heirloom.
      </Typography>
    );
  }

  return (
    <Stack spacing={2}>
      <ToggleButtonGroup
        exclusive
        value={index}
        onChange={(_event, next: number | null) => {
          if (next !== null) {
            setPicked({ heirloomId: heirloom.id, index: next });
          }
        }}
        aria-label="Upgrade level"
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${tiers.length}, minmax(0, 1fr))`,
          width: "100%",
        }}
      >
        {tiers.map((step, stepIndex) => {
          const share = step.itemLevel !== null && top > 0 ? step.itemLevel / top : 0;
          return (
            <ToggleButton
              key={step.upgrade ?? `i${stepIndex}`}
              value={stepIndex}
              sx={(theme) => ({
                flexDirection: "column",
                justifyContent: "flex-end",
                gap: 0.5,
                minWidth: 0,
                px: 0.5,
                py: 1,
                textTransform: "none",
                "&.Mui-selected": {
                  backgroundColor: alpha(qualityColor(theme, "heirloom"), 0.14),
                },
                "&.Mui-focusVisible": focusRing(theme, true),
              })}
            >
              <Box
                aria-hidden="true"
                sx={(theme) => ({
                  width: "min(24px, 60%)",
                  height: Math.max(BAR_MIN_PX, Math.round(share * BAR_MAX_PX)),
                  borderRadius: "2px 2px 0 0",
                  backgroundColor: alpha(
                    qualityColor(theme, "heirloom"),
                    stepIndex === index ? 0.95 : 0.45,
                  ),
                })}
              />
              <Typography
                variant="subtitle2"
                component="span"
                sx={{ lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}
              >
                <Box component="span" sx={visuallyHidden}>
                  Upgrade{" "}
                </Box>
                {upgradeLabel(step)}
              </Typography>
              <Typography
                variant="caption"
                component="span"
                color="text.secondary"
                sx={{ lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}
              >
                {step.itemLevel !== null ? (
                  <>
                    <Box component="span" sx={visuallyHidden}>
                      item level{" "}
                    </Box>
                    <Box component="span" aria-hidden="true">
                      {"ilvl "}
                    </Box>
                    {formatNumber(step.itemLevel)}
                  </>
                ) : (
                  "—"
                )}
              </Typography>
            </ToggleButton>
          );
        })}
      </ToggleButtonGroup>

      {/* The tooltip below changes with each press; this says what it now shows. */}
      <LiveStatus visuallyHidden>{describeTier(tier)}</LiveStatus>

      <ItemTooltip heirloom={heirloom} tier={tier} />

      {/* Wide on phones (a column per stat): it scrolls inside its own box. */}
      <Box
        role="region"
        aria-labelledby={captionId}
        tabIndex={0}
        sx={(theme) => ({
          overflowX: "auto",
          borderRadius: `${theme.wc.radius.md}px`,
          border: `1px solid ${theme.palette.border.subtle}`,
          "&:focus-visible": focusRing(theme),
        })}
      >
        <Table size="small" sx={{ minWidth: 360 }}>
          <Box component="caption" id={captionId} sx={visuallyHidden}>
            {`${heirloom.name}: item level, level range and stats at each upgrade level`}
          </Box>
          <TableHead>
            <TableRow>
              <TableCell component="th" scope="col">
                Upgrade
              </TableCell>
              <TableCell component="th" scope="col" align="right">
                Item level
              </TableCell>
              <TableCell component="th" scope="col" align="right">
                Levels
              </TableCell>
              {hasArmor ? (
                <TableCell component="th" scope="col" align="right">
                  Armor
                </TableCell>
              ) : null}
              {hasDps ? (
                <TableCell component="th" scope="col" align="right">
                  <abbr title="Damage per second">DPS</abbr>
                </TableCell>
              ) : null}
              {columns.map((column) => (
                <TableCell
                  key={column.type}
                  component="th"
                  scope="col"
                  align="right"
                  sx={{ color: column.negated ? "text.secondary" : undefined }}
                >
                  {column.name}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {tiers.map((row, rowIndex) => {
              const byType = new Map(row.stats.map((stat) => [stat.type, stat]));
              return (
                <TableRow
                  key={row.upgrade ?? `i${rowIndex}`}
                  selected={rowIndex === index}
                  sx={{ "& td, & th": { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" } }}
                >
                  <TableCell component="th" scope="row">
                    {upgradeLabel(row)}
                  </TableCell>
                  <TableCell align="right">
                    {row.itemLevel !== null ? formatNumber(row.itemLevel) : "—"}
                  </TableCell>
                  <TableCell align="right">{levelsOf(row)}</TableCell>
                  {hasArmor ? (
                    <TableCell align="right">
                      {row.armor !== null ? formatNumber(row.armor) : "—"}
                    </TableCell>
                  ) : null}
                  {hasDps ? (
                    <TableCell align="right">
                      {row.dps !== null
                        ? formatNumber(row.dps, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                        : "—"}
                    </TableCell>
                  ) : null}
                  {columns.map((column) => {
                    const stat = byType.get(column.type);
                    return (
                      <TableCell
                        key={column.type}
                        align="right"
                        sx={(theme) => ({
                          color: stat?.bonus
                            ? qualityColor(theme, "uncommon")
                            : stat?.negated
                              ? theme.palette.text.secondary
                              : undefined,
                        })}
                      >
                        {stat ? formatNumber(stat.value) : "—"}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    </Stack>
  );
};

export default UpgradeLadder;
