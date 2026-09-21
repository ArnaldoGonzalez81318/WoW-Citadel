import {
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import type {
  AzeriteEssencePower,
  AzeriteSpellReference,
} from "@/features/azeriteEssences/types";
import { getExternalLink } from "@/lib/externalLinks";

export type EssencePowerTableProps = {
  powers: AzeriteEssencePower[];
};

/** Spell name linked to Wowhead; never the Blizzard API `key.href`. */
const SpellCell = ({
  spell,
}: {
  spell?: AzeriteSpellReference;
}): JSX.Element => {
  const link = spell ? getExternalLink("spell", spell.id, spell.name) : undefined;

  if (!spell || !link) {
    return (
      <Typography variant="body2" color="text.secondary" component="span">
        {spell?.name || "—"}
      </Typography>
    );
  }

  return (
    <Link
      href={link.url}
      target="_blank"
      rel="noreferrer"
      underline="hover"
      variant="body2"
    >
      {spell.name}
    </Link>
  );
};

/** Rank | Major power | Minor power, one row per essence power. */
const EssencePowerTable = ({ powers }: EssencePowerTableProps): JSX.Element => {
  if (powers.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary" component="p">
        No power ranks listed.
      </Typography>
    );
  }

  return (
    <TableContainer>
      <Table size="small" aria-label="Essence power ranks">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 72 }}>Rank</TableCell>
            <TableCell>Major power</TableCell>
            <TableCell>Minor power</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {powers.map((power) => (
            <TableRow key={power.id}>
              <TableCell>
                <Typography
                  variant="body2"
                  component="span"
                  sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
                >
                  {power.rank}
                </Typography>
              </TableCell>
              <TableCell>
                <SpellCell spell={power.mainPowerSpell} />
              </TableCell>
              <TableCell>
                <SpellCell spell={power.passivePowerSpell} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default EssencePowerTable;
