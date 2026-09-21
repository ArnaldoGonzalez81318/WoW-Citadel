import {
  Chip,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useMemo } from "react";

import DetailDialog from "@/components/common/DetailDialog";
import type {
  DetailDialogRow,
  DetailDialogSection,
} from "@/components/common/DetailDialog";
import type {
  CovenantAbility,
  CovenantCardData,
  CovenantSummary,
} from "@/features/covenants/types";
import { getExternalLink } from "@/lib/externalLinks";
import { mixins } from "@/theme";

export type CovenantDetailDialogProps = {
  open: boolean;
  onClose: () => void;
  covenant?: CovenantSummary;
  data?: CovenantCardData;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
};

const ANY_CLASS_LABEL = "Any class";

type SpellNameProps = {
  ability: CovenantAbility;
  variant: "subtitle1" | "subtitle2" | "body2";
};

/** Spell name, linked to Wowhead when a spell id exists. */
const SpellName = ({ ability, variant }: SpellNameProps): JSX.Element => {
  const spell = ability.spellTooltip?.spell;
  const name = spell?.name || `Ability #${ability.id}`;
  const link = spell ? getExternalLink("spell", spell.id, spell.name) : undefined;

  if (!link) {
    return (
      <Typography variant={variant} component="span" sx={{ fontWeight: 500 }}>
        {name}
      </Typography>
    );
  }

  return (
    <Link
      href={link.url}
      target="_blank"
      rel="noreferrer"
      underline="hover"
      variant={variant}
      sx={{ fontWeight: 500 }}
    >
      {name}
    </Link>
  );
};

const tooltipChips = (
  ability: CovenantAbility,
): Array<{ key: string; label: string }> => {
  const tooltip = ability.spellTooltip;
  if (!tooltip) {
    return [];
  }

  return [
    tooltip.castTime ? { key: "cast", label: `Cast: ${tooltip.castTime}` } : null,
    tooltip.cooldown
      ? { key: "cooldown", label: `Cooldown: ${tooltip.cooldown}` }
      : null,
    tooltip.range ? { key: "range", label: `Range: ${tooltip.range}` } : null,
  ].filter((chip): chip is { key: string; label: string } => chip !== null);
};

const SignatureAbilitySection = ({
  ability,
}: {
  ability: CovenantAbility;
}): JSX.Element => {
  const chips = tooltipChips(ability);
  const description = ability.spellTooltip?.description;

  return (
    <Stack spacing={1}>
      <SpellName ability={ability} variant="subtitle1" />
      {chips.length > 0 ? (
        <Stack direction="row" flexWrap="wrap" useFlexGap gap={1}>
          {chips.map((chip) => (
            <Chip
              key={chip.key}
              size="small"
              variant="outlined"
              label={chip.label}
            />
          ))}
        </Stack>
      ) : null}
      {description ? (
        <Typography variant="body2" component="p" sx={{ margin: 0 }}>
          {description}
        </Typography>
      ) : null}
    </Stack>
  );
};

type ClassGroup = {
  className: string;
  abilities: CovenantAbility[];
};

const groupByClass = (abilities: CovenantAbility[]): ClassGroup[] => {
  const groups = new Map<string, CovenantAbility[]>();

  abilities.forEach((ability) => {
    const className = ability.playableClass?.name || ANY_CLASS_LABEL;
    const bucket = groups.get(className);
    if (bucket) {
      bucket.push(ability);
    } else {
      groups.set(className, [ability]);
    }
  });

  return [...groups.keys()]
    .sort((left, right) => left.localeCompare(right))
    .map((className) => ({
      className,
      abilities: groups.get(className) ?? [],
    }));
};

const ClassAbilitiesSection = ({
  groups,
}: {
  groups: ClassGroup[];
}): JSX.Element => {
  if (groups.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary" component="p">
        No class abilities listed.
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      {groups.map((group) => (
        <Stack key={group.className} spacing={0.5}>
          <Typography variant="subtitle2" component="p" sx={{ margin: 0 }}>
            {group.className}
          </Typography>
          {group.abilities.map((ability) => (
            <Stack key={ability.id} spacing={0.25}>
              <SpellName ability={ability} variant="body2" />
              {ability.spellTooltip?.description ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  component="p"
                  sx={{ ...mixins.lineClamp(3), margin: 0 }}
                >
                  {ability.spellTooltip.description}
                </Typography>
              ) : null}
            </Stack>
          ))}
        </Stack>
      ))}
    </Stack>
  );
};

const RenownRewardsSection = ({
  rewards,
}: {
  rewards: CovenantCardData["detail"]["renownRewards"];
}): JSX.Element => {
  if (rewards.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary" component="p">
        No renown rewards listed.
      </Typography>
    );
  }

  return (
    <TableContainer sx={{ maxHeight: 360 }}>
      <Table size="small" stickyHeader aria-label="Renown rewards">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 96 }}>Level</TableCell>
            <TableCell>Reward</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rewards.map((reward) => (
            <TableRow key={`${reward.level}-${reward.reward.id}`}>
              <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>
                {reward.level}
              </TableCell>
              <TableCell>{reward.reward.name}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

/**
 * Covenant detail: signature ability, class abilities grouped by class and
 * the renown reward table. Reads the card query's data; no extra fetch.
 */
const CovenantDetailDialog = ({
  open,
  onClose,
  covenant,
  data,
  loading = false,
  error,
  onRetry,
}: CovenantDetailDialogProps): JSX.Element => {
  const detail = data?.detail;

  const rows = useMemo<DetailDialogRow[] | undefined>(() => {
    if (!detail) {
      return undefined;
    }

    const renownMax = detail.renownRewards.reduce(
      (max, reward) => Math.max(max, reward.level),
      0,
    );

    return [
      { label: "Class abilities", value: detail.classAbilities.length },
      { label: "Renown levels", value: renownMax },
    ];
  }, [detail]);

  const sections = useMemo<DetailDialogSection[] | undefined>(() => {
    if (!detail) {
      return undefined;
    }

    const list: DetailDialogSection[] = [];

    if (detail.signatureAbility) {
      list.push({
        heading: "Signature ability",
        content: <SignatureAbilitySection ability={detail.signatureAbility} />,
      });
    }

    list.push({
      heading: "Class abilities",
      content: (
        <ClassAbilitiesSection groups={groupByClass(detail.classAbilities)} />
      ),
    });

    list.push({
      heading: "Renown rewards",
      content: <RenownRewardsSection rewards={detail.renownRewards} />,
    });

    return list;
  }, [detail]);

  return (
    <DetailDialog
      open={open}
      onClose={onClose}
      title={covenant?.name ?? "Covenant"}
      subtitle={detail?.description || undefined}
      media={{ src: data?.iconUrl ?? undefined, alt: "", kind: "icon" }}
      loading={loading && !detail}
      error={detail ? undefined : error}
      onRetry={onRetry}
      errorContext="covenant details"
      rows={rows}
      sections={sections}
      maxWidth="md"
    />
  );
};

export default CovenantDetailDialog;
