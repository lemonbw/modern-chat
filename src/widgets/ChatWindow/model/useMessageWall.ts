import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChatMessage } from "../../../entities/chat/types";
import { messageDateLabel } from "../../../shared/lib/messageDate";
import { useOlderPages } from "./useOlderPages";

type WallOptions = {
  chatId: string;
  messages: ChatMessage[];
  isLoading: boolean;
  isLoadingOlder: boolean;
  hasMore: boolean;
  onLoadOlder: () => Promise<boolean>;
};

/**
 * Scroll behaviour of the message wall: sticks to the bottom for new messages, keeps the reading
 * position when older pages are prepended and reports the date of the first visible bubble. Loading
 * those pages is `useOlderPages`.
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

  const onScroll = useCallback(() => {
    const list = listElement.current;
    if (!list) return;
    stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    updateTopDate();
  }, [updateTopDate]);

  const onWheel = useCallback((event: { deltaY: number }) => {
    if (event.deltaY < 0) stickToBottom.current = false;
  }, []);

  const bubbleCallbacks = useRef(new Map<number, (element: HTMLDivElement | null) => void>());
  useEffect(() => { bubbleCallbacks.current.clear(); }, [chatId]);

  const registerBubble = useCallback((index: number, timestamp?: number) => {
    const existing = bubbleCallbacks.current.get(index);
    if (existing) return existing;
    const callback = (element: HTMLDivElement | null) => {
      bubbleRefs.current[index] = element;
      bubbleTimestamps.current[index] = timestamp;
    };
    bubbleCallbacks.current.set(index, callback);
    return callback;
  }, []);

  const scrollToIndex = useCallback((index: number) => {
    bubbleRefs.current[index]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  const captureAnchor = useCallback(() => {
    const list = listElement.current;
    if (list) olderAnchor.current = { scrollHeight: list.scrollHeight, scrollTop: list.scrollTop };
  }, []);

  const leaveBottom = useCallback(() => { stickToBottom.current = false; }, []);

  const { registerSentinel } = useOlderPages({ chatId, listElement, hasMore, isLoadingOlder, onLoadOlder, captureAnchor, leaveBottom });

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
