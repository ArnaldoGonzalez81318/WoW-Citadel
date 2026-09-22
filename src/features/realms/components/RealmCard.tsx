import { memo, useCallback, useMemo } from "react";

import ResultCard from "@/components/common/ResultCard";
import type { ResultCardResult } from "@/components/common/ResultCard";
import { statusChipColor } from "@/features/connectedRealms/services/connectedRealmService";
import { realmTypeLabel } from "@/features/realms/hooks/useRealmDirectory";
import type { RealmDirectoryRow } from "@/features/realms/types";
import { formatLocale, formatTimezone } from "@/lib/format";

export type RealmCardProps = {
  row: RealmDirectoryRow;
  onSelect: (row: RealmDirectoryRow) => void;
  index?: number;
};

const joinParts = (...parts: Array<string | undefined>): string | undefined => {
  const kept = parts.filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  );
  return kept.length > 0 ? kept.join(" · ") : undefined;
};

/**
 * Maps a directory row to a row ResultCard (below md). The row layout shows
 * one meta line with the status chip beside it, so the time zone rides along
 * in the subtitle and the labelled `meta` facts back it up for other layouts.
 */
const toRealmResult = (row: RealmDirectoryRow): ResultCardResult => {
  const timezone = row.timezone ? formatTimezone(row.timezone) : undefined;
  const locale = row.locale ? formatLocale(row.locale) : undefined;

  return {
    id: row.id,
    name: row.name,
    href: row.href,
    kind: "realm",
    subtitle: joinParts(realmTypeLabel(row) || undefined, row.category, timezone),
    meta: [
      timezone ? { label: "Time zone", value: timezone } : undefined,
      locale ? { label: "Locale", value: locale } : undefined,
    ].filter((entry): entry is { label: string; value: string } => Boolean(entry)),
    tag: row.statusLabel,
  };
};

const RealmCard = ({ row, onSelect, index }: RealmCardProps): JSX.Element => {
  const result = useMemo(() => toRealmResult(row), [row]);
  // Stable callback so `memo(ResultCard)` can skip unchanged cards.
  const handleSelect = useCallback(() => onSelect(row), [onSelect, row]);

  return (
    <ResultCard
      result={result}
      // Row (96px) fills its height with name, meta and status chip; the
      // compact layout left ~40px of empty space above a stranded chip.
      layout="row"
      // Same semantic status colour as the desktop table's status chip.
      tagColor={row.statusType ? statusChipColor(row.statusType) : undefined}
      showExternalLink={false}
      onSelect={handleSelect}
      index={index}
    />
  );
};

export default memo(RealmCard);
