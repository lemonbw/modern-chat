import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChatMessage } from "../../../entities/chat/types";
import { messageDateLabel } from "../../../shared/lib/messageDate";

type WallOptions = {
  chatId: string;
  messages: ChatMessage[];
  isLoading: boolean;
  isLoadingOlder: boolean;
  hasMore: boolean;
  onLoadOlder: () => void;
};

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

  const loadOlder = useCallback(() => {
    const list = listElement.current;
    if (!list || !hasMore || isLoadingOlder || olderAnchor.current) return;
    olderAnchor.current = { scrollHeight: list.scrollHeight, scrollTop: list.scrollTop };
    stickToBottom.current = false;
    onLoadOlder();
  }, [hasMore, isLoadingOlder, onLoadOlder]);

  const onScroll = useCallback(() => {
    const list = listElement.current;
    if (!list) return;
    stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    if (list.scrollTop <= 32) loadOlder();
    updateTopDate();
  }, [loadOlder, updateTopDate]);

  const onWheel = useCallback((event: { deltaY: number }) => {
    const list = listElement.current;
    if (event.deltaY < 0 && list && list.scrollTop <= 32) loadOlder();
  }, [loadOlder]);

  const registerBubble = useCallback((index: number, timestamp?: number) => (element: HTMLDivElement | null) => {
    bubbleRefs.current[index] = element;
    bubbleTimestamps.current[index] = timestamp;
  }, []);

  const scrollToIndex = useCallback((index: number) => {
    bubbleRefs.current[index]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  return {
    registerList,
    topDateLabel,
    updateTopDate,
    onScroll,
    onWheel,
    registerBubble,
    scrollToIndex,
  };
};