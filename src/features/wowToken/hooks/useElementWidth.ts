import { useEffect, useState } from "react";
import type { RefCallback } from "react";

/**
 * A callback ref and the element's rendered width in CSS pixels (0 until
 * measured). The chart draws in real pixels rather than a stretched
 * viewBox, so its text and 2px line never scale with the container.
 */
const useElementWidth = <T extends Element>(): [RefCallback<T>, number] => {
  const [node, setNode] = useState<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!node) {
      return undefined;
    }
    const measure = (): void => setWidth(Math.floor(node.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [setNode, width];
};

export default useElementWidth;
