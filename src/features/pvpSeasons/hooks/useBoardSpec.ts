import { useQuery } from "@tanstack/react-query";

import { specQuery } from "@/features/mythicLeaderboard/hooks/leaderboardQueries";
import { specLabelFromSlug } from "@/features/pvpSeasons/services/pvpBrackets";
import type { PvpBoardRef } from "@/features/pvpSeasons/types";

export type BoardSpec = {
  /** "Frost" (localized once loaded). */
  spec: string;
  /** "Mage" */
  className: string;
  /** "Frost Mage" */
  label: string;
  iconUrl: string | null;
  loading: boolean;
};

/**
 * A per-spec board's specialization, localized and with its icon (the
 * Mythic Keystone Leaderboards page's cache entry, kept for the session).
 * Until it loads, or for a spec the page has no id for, the label comes
 * from the board's slug. Undefined for an overall or team board.
 */
const useBoardSpec = (board: PvpBoardRef | null | undefined): BoardSpec | undefined => {
  const specId = board?.specId;
  const query = useQuery({
    ...specQuery(specId ?? 0),
    enabled: specId !== undefined,
  });
  if (!board?.specSlug) {
    return undefined;
  }
  const fallback = specLabelFromSlug(board.specSlug);
  const spec = query.data?.name ?? fallback.spec;
  const className = query.data?.className ?? fallback.className;
  return {
    spec,
    className,
    label: `${spec} ${className}`,
    iconUrl: query.data?.iconUrl ?? null,
    loading: specId !== undefined && query.isPending,
  };
};

export default useBoardSpec;
