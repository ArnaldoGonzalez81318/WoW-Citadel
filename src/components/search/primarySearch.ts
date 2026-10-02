import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { RefObject } from "react";

/**
 * A page that renders its own primary search field (the home hero) registers
 * it here so the header can yield to it: the inline header field steps aside
 * and `/` / Ctrl+K focus the page's field while it is on screen.
 *
 * A module store rather than SearchContext: the flag flips on scroll, and
 * SearchContext consumers (SearchPage, every search field) must not re-render
 * for it. Only HeaderSearch subscribes.
 */

type Registration = {
  /** Identity of one mount, so a stale cleanup never clears a newer owner. */
  token: object;
  target: HTMLElement;
  focus: () => void;
};

let current: Registration | null = null;
let inView = false;
const listeners = new Set<() => void>();

const emit = (): void => {
  listeners.forEach((listener) => listener());
};

const setInView = (token: object, next: boolean): void => {
  if (current?.token !== token || inView === next) {
    return;
  }
  inView = next;
  emit();
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): boolean => inView;

/** True while a registered primary search is at least half visible below the header. */
export const usePrimarySearchInView = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, () => false);

/**
 * Focuses the primary search when it is on screen. True only if focus really
 * landed inside it: an open Modal's FocusTrap (the mobile nav drawer) can
 * pull it straight back, and the caller then falls back to its own field.
 */
export const focusPrimarySearch = (): boolean => {
  if (!current || !inView) {
    return false;
  }
  current.focus();
  return current.target.contains(document.activeElement);
};

const MIN_VISIBLE_RATIO = 0.5;

const visibleRatio = (rect: DOMRect, topInset: number): number => {
  if (rect.height <= 0) {
    return 0;
  }
  const top = Math.max(rect.top, topInset);
  const bottom = Math.min(rect.bottom, window.innerHeight);
  return Math.max(0, bottom - top) / rect.height;
};

/**
 * Registers `targetRef` as the page's primary search while mounted.
 * `topInset` is the sticky header's height: a field tucked under the header
 * is not "on screen".
 */
export const usePrimarySearch = (
  targetRef: RefObject<HTMLElement>,
  focus: () => void,
  topInset: number,
): void => {
  const focusRef = useRef(focus);
  focusRef.current = focus;

  useLayoutEffect(() => {
    const target = targetRef.current;
    // Without IntersectionObserver nothing registers, so the header keeps
    // today's behaviour.
    if (!target || typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    const token = {};
    current = { token, target, focus: () => focusRef.current() };
    // Synchronous first check so the header never paints both fields on mount.
    setInView(
      token,
      visibleRatio(target.getBoundingClientRect(), topInset) >=
        MIN_VISIBLE_RATIO,
    );

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setInView(token, entry.intersectionRatio >= MIN_VISIBLE_RATIO);
        }
      },
      {
        rootMargin: `-${topInset}px 0px 0px 0px`,
        threshold: MIN_VISIBLE_RATIO,
      },
    );
    observer.observe(target);

    return () => {
      observer.disconnect();
      if (current?.token === token) {
        current = null;
        if (inView) {
          inView = false;
          emit();
        }
      }
    };
  }, [targetRef, topInset]);
};
