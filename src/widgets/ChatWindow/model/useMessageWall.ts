import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChatMessage } from "../../../entities/chat/types";
import { messageDateLabel } from "../../../shared/lib/messageDate";

type WallOptions = {
  chatId: string;
  messages: ChatMessage[];
  isLoading: boolean;
  isLoadingOlder: boolean;
  hasMore: boolean;
  onLoadOlder: () => Promise<boolean>;
};

/** Pages one trigger may pull at once, so one drag cannot flood the API. */
const olderBatchLimit = 2;

/** The observer fires this early, the same distance the geometry check below allows. */
const loadAhead = 160;

/** Two frames: the first commits the prepended page, the second lets the scroll anchor settle. */
const afterPagePainted = () => new Promise<void>((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
});

/**
 * Scroll behaviour of the message wall: sticks to the bottom for new messages, keeps the reading
 * position when older pages are prepended and reports the date of the first visible bubble.
 */
export const useMessageWall = ({ chatId, messages, isLoading, isLoadingOlder, hasMore, onLoadOlder }: WallOptions) => {
  const listElement = useRef<HTMLDivElement | null>(null);
  const registerList = useCallback((element: HTMLDivElement | null) => {
    listElement.current = element;
  }, []);
  const stickToBottom = useRef(true);
  const olderAnchor = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const renderedChatId = useRef(chatId);
  const bubbleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const bubbleTimestamps = useRef<(number | undefined)[]>([]);
  const [topDateLabel, setTopDateLabel] = useState("");

  const updateTopDate = useCallback(() => {
    const list = listElement.current;
    if (!list) return;
    const listTop = list.getBoundingClientRect().top;
    for (let index = 0; index < bubbleTimestamps.current.length; index += 1) {
      const bubble = bubbleRefs.current[index];
      if (bubble && bubble.getBoundingClientRect().bottom > listTop + 8) {
        setTopDateLabel(messageDateLabel(bubbleTimestamps.current[index]));
        return;
      }
    }
  }, []);

  useLayoutEffect(() => {
    const list = listElement.current;
    if (!list) return;
    if (renderedChatId.current !== chatId) {
      renderedChatId.current = chatId;
      stickToBottom.current = true;
      olderAnchor.current = null;
    }
    if (olderAnchor.current) {
      const anchor = olderAnchor.current;
      list.scrollTop = anchor.scrollTop + (list.scrollHeight - anchor.scrollHeight);
      olderAnchor.current = null;
      return;
    }
    if (stickToBottom.current) list.scrollTop = list.scrollHeight;
  }, [chatId, messages.length, isLoading]);

  useEffect(() => {
    if (!isLoadingOlder && olderAnchor.current) olderAnchor.current = null;
  }, [isLoadingOlder]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const isTopInView = useCallback(() => {
    const list = listElement.current;
    const sentinel = sentinelRef.current;
    if (!list || !sentinel) return false;
    const sentinelRect = sentinel.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    return sentinelRect.top >= listRect.top - loadAhead && sentinelRect.bottom <= listRect.bottom + loadAhead;
  }, []);

  const loadOlder = useCallback(async () => {
    const list = listElement.current;
    if (!list || !hasMore || isLoadingOlder || olderAnchor.current) return;
    for (let page = 0; page < olderBatchLimit; page += 1) {
      if (!isTopInView()) break;
      olderAnchor.current = { scrollHeight: list.scrollHeight, scrollTop: list.scrollTop };
      stickToBottom.current = false;
      const hasMoreLeft = await onLoadOlder();
      await afterPagePainted();
      if (!hasMoreLeft) break;
    }
  }, [hasMore, isLoadingOlder, isTopInView, onLoadOlder]);

  useEffect(() => {
    const list = listElement.current;
    const sentinel = sentinelRef.current;
    if (!list || !sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadOlder();
    }, { root: list, rootMargin: `${loadAhead}px 0px` });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [chatId, hasMore, isLoadingOlder, loadOlder]);

  const onScroll = useCallback(() => {
    const list = listElement.current;
    if (!list) return;
    stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    updateTopDate();
  }, [updateTopDate]);

  const onWheel = useCallback((event: { deltaY: number }) => {
    if (event.deltaY < 0) stickToBottom.current = false;
  }, []);

  const registerSentinel = useCallback((element: HTMLDivElement | null) => {
    sentinelRef.current = element;
  }, []);

  const registerBubble = useCallback((index: number, timestamp?: number) => (element: HTMLDivElement | null) => {
    bubbleRefs.current[index] = element;
    bubbleTimestamps.current[index] = timestamp;
  }, []);

  const scrollToIndex = useCallback((index: number) => {
    bubbleRefs.current[index]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  return {
    registerList,
    registerSentinel,
    topDateLabel,
    updateTopDate,
    onScroll,
    onWheel,
    registerBubble,
    scrollToIndex,
  };
};