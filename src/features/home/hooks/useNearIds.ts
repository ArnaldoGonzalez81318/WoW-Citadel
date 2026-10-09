import { useCallback, useState } from "react";

/**
 * The ids of the tiles that have come near the viewport. The set only
 * grows (a tile that loaded stays loaded when it scrolls away), a repeat
 * mark returns the same set so nothing re-renders, and `markNear` keeps one
 * identity, so tiles can list it in their effects without re-running them.
 * A panel gates its `useQueries` entries on it: each tile's requests start
 * one short scroll before it shows, never all at once on load.
 */
const useNearIds = (): [ReadonlySet<number>, (id: number) => void] => {
  const [ids, setIds] = useState<ReadonlySet<number>>(() => new Set());
  const markNear = useCallback((id: number) => {
    setIds((current) => (current.has(id) ? current : new Set(current).add(id)));
  }, []);
  return [ids, markNear];
};

export default useNearIds;
