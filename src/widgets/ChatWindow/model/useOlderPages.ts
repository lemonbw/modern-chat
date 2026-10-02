import { useCallback, useEffect, useRef, type RefObject } from "react";

/** Pages one trigger may pull at once, so one drag cannot flood the API. */
const olderBatchLimit = 2;

/** The observer fires this early, the same distance the geometry check allows. */
const loadAhead = 160;

/** Two frames: the first commits the prepended page, the second lets the scroll anchor settle. */
const afterPagePainted = () => new Promise<void>((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
});

type Options = {
  chatId: string;
  listElement: RefObject<HTMLDivElement | null>;
  hasMore: boolean;
  isLoadingOlder: boolean;
  onLoadOlder: () => Promise<boolean>;
  captureAnchor: () => void;
  leaveBottom: () => void;
};

export const useOlderPages = ({ chatId, listElement, hasMore, isLoadingOlder, onLoadOlder, captureAnchor, leaveBottom }: Options) => {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const list = listElement.current;
    const sentinel = sentinelRef.current;
    if (!list || !sentinel) return;

    const isTopInView = () => {
      const sentinelRect = sentinel.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      return sentinelRect.top >= listRect.top - loadAhead && sentinelRect.bottom <= listRect.bottom + loadAhead;
    };

    const loadOlder = async () => {
      if (!hasMore || isLoadingOlder) return;
      for (let page = 0; page < olderBatchLimit; page += 1) {
        if (!isTopInView()) break;
        captureAnchor();
        leaveBottom();
        const hasMoreLeft = await onLoadOlder();
        await afterPagePainted();
        if (!hasMoreLeft) break;
      }
    };

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadOlder();
    }, { root: list, rootMargin: `${loadAhead}px 0px` });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [captureAnchor, chatId, hasMore, isLoadingOlder, leaveBottom, listElement, onLoadOlder]);

  return {
    registerSentinel: useCallback((element: HTMLDivElement | null) => {
      sentinelRef.current = element;
    }, []),
  };
};