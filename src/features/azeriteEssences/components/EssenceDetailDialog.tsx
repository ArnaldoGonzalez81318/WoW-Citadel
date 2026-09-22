import { useMemo } from "react";

import DetailDialog from "@/components/common/DetailDialog";
import type {
  DetailDialogRow,
  DetailDialogSection,
} from "@/components/common/DetailDialog";
import EssencePowerTable from "@/features/azeriteEssences/components/EssencePowerTable";
import type {
  AzeriteEssenceCardData,
  AzeriteEssenceDetail,
  AzeriteEssenceSummary,
} from "@/features/azeriteEssences/types";

/**
 * Blizzard names specializations without their class, so "Frost" appears
 * once for mages and once for death knights. Repeats are collapsed with a
 * count ("Frost (2)") rather than listed twice.
 */
const describeSpecializations = (
  specs: AzeriteEssenceDetail["allowedSpecializations"],
): string => {
  const counts = new Map<string, number>();
  specs.forEach((spec) => {
    counts.set(spec.name, (counts.get(spec.name) ?? 0) + 1);
  });

  const names = [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, count]) => (count > 1 ? `${name} (${count})` : name))
    .join(", ");

  return `${specs.length} specializations: ${names}`;
};

export type EssenceDetailDialogProps = {
  open: boolean;
  onClose: () => void;
  essence?: AzeriteEssenceSummary;
  data?: AzeriteEssenceCardData;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
};

/**
 * Azerite essence detail: specializations, rank count and the power table.
 * Reads the card query's data; no extra fetch.
 */
const EssenceDetailDialog = ({
  open,
  onClose,
  essence,
  data,
  loading = false,
  error,
  onRetry,
}: EssenceDetailDialogProps): JSX.Element => {
  const detail = data?.detail;

  const rows = useMemo<DetailDialogRow[] | undefined>(() => {
    if (!detail) {
      return undefined;
    }

    const specs = detail.allowedSpecializations;

    return [
      {
        label: "Specializations",
        value: specs.length
          ? describeSpecializations(specs)
          : "All specializations",
      },
      { label: "Ranks", value: detail.powers.length },
    ];
  }, [detail]);

  const sections = useMemo<DetailDialogSection[] | undefined>(
    () =>
      detail
        ? [
            {
              heading: "Power ranks",
              content: <EssencePowerTable powers={detail.powers} />,
            },
          ]
        : undefined,
    [detail],
  );

  return (
    <DetailDialog
      open={open}
      onClose={onClose}
      title={essence?.name ?? "Azerite essence"}
      media={{ src: data?.iconUrl, alt: "", kind: "icon" }}
      loading={loading && !detail}
      error={detail ? undefined : error}
      onRetry={onRetry}
      errorContext="essence details"
      rows={rows}
      sections={sections}
      maxWidth="sm"
    />
  );
};

export default EssenceDetailDialog;
