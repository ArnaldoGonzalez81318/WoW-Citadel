import { useEffect, useState } from "react";
import type { RefCallback } from "react";

/**
 * A callback ref and a flag that turns true once the element comes within
 * `rootMargin` of the viewport, and stays true: cards use it to start their
 * own requests just before they scroll into view, so a long gallery only
 * costs what the visitor actually looks at.
 *
 * The observer lives in an effect keyed on the element (not in the ref
 * callback), so StrictMode's simulated unmount, which re-runs effects but
 * never ref callbacks, cannot leave it disconnected. Without
 * IntersectionObserver the flag is true at once (load everything).
 */
const useNearViewport = <T extends Element>(
  rootMargin = "600px 0px",
): [RefCallback<T>, boolean] => {
  const [node, setNode] = useState<T | null>(null);
  const [near, setNear] = useState(
    () => typeof IntersectionObserver === "undefined",
  );

  useEffect(() => {
    if (!node || near) {
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, near, rootMargin]);

  return [setNode, near];
};

export default useNearViewport;
