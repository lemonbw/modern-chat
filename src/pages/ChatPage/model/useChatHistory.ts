import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../../../entities/chat/types";
import { getChatMessages } from "../../../features/messages/api/greenApiMessages";
import { useHistoryCache } from "./useHistoryCache";
import {
  errorMessage,
  historyPageSize,
  initialHistorySize,
  loadDeletedMessageIds,
  mergeHistory,
  nextPaint,
  persistDeletedMessageIds,
  type HistoryPage,
} from "./chatPageState";

type Options = {
  isDemo: boolean;
  selected: string | null;
  onLoadError: (message: string | null) => void;
  onLatestMessage: (chatId: string, message: ChatMessage) => void;
};

/**
 * Owns the message wall of every chat: initial load, fifteen second polling, older pages and the
 * ids of the messages this account deleted.
 */
export const useChatHistory = ({ isDemo, selected, onLoadError, onLatestMessage }: Options) => {
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [historyPages, setHistoryPages] = useState<Record<string, HistoryPage>>({});
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesRef = useRef(messages);
  const historyPagesRef = useRef(new Map<string, HistoryPage>());
  const loadedHistoryIds = useRef(new Set<string>());
  const deletedMessageIds = useRef(loadDeletedMessageIds());

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const updateHistoryPage = useCallback((chatId: string, page: HistoryPage) => {
    historyPagesRef.current.set(chatId, page);
    setHistoryPages((current) => ({ ...current, [chatId]: page }));
  }, []);

  const publishHistory = useCallback((chatId: string, result: ChatMessage[]) => {
    setMessages((current) => ({
      ...current,
      [chatId]: mergeHistory(result, current[chatId] ?? [], new Set(deletedMessageIds.current[chatId] ?? [])),
    }));
  }, []);

  /**
   * Progressive rendering: text first, then stickers, then media, so a heavy chat opens fast.
   * The media stage also triggers the sidebar fetch so both run in parallel.
   */
  const publishInStages = useCallback(async (chatId: string, result: ChatMessage[], onMediaStageStart?: () => void) => {
    const merged = mergeHistory(result, messagesRef.current[chatId] ?? [], new Set(deletedMessageIds.current[chatId] ?? []));
    const positions = new Map(merged.map((message, index) => [message, index]));
    const chronological = (items: ChatMessage[]) => items.sort((left, right) => positions.get(left)! - positions.get(right)!);
    const textMessages = chronological(merged.filter((message) => !message.media || message.deleted));
    const stickerMessages = chronological(merged.filter((message) => message.media?.kind === "sticker"));
    const otherMedia = chronological(merged.filter((message) => message.media && message.media.kind !== "sticker" && !message.deleted));

    const publishStage = (visible: ChatMessage[]) => setMessages((current) => {
      const visibleIds = new Set(visible.map((message) => message.id).filter(Boolean));
      const newlyAddedLocal = (current[chatId] ?? []).filter((message) => !message.id || !visibleIds.has(message.id));
      return { ...current, [chatId]: [...visible, ...newlyAddedLocal] };
    });

    publishStage(textMessages);
    await nextPaint();
    if (stickerMessages.length > 0) {
      publishStage(chronological([...textMessages, ...stickerMessages]));
      await nextPaint();
    }
    onMediaStageStart?.();
    if (otherMedia.length > 0) publishStage(chronological([...textMessages, ...stickerMessages, ...otherMedia]));
  }, []);

  useHistoryCache({ isDemo, selected, messages, historyPagesRef, publishHistory, updateHistoryPage });

  const markLoaded = useCallback((chatId: string) => { loadedHistoryIds.current.add(chatId); }, []);
  const isLoaded = useCallback((chatId: string) => loadedHistoryIds.current.has(chatId), []);

  useEffect(() => {
    if (isDemo || !selected) return;
    let isMounted = true;
    let isLoading = false;
    const chatId = selected;

    const loadHistory = async (isInitial = false) => {
      if (isLoading || historyPagesRef.current.get(chatId)?.loadingOlder) return;
      isLoading = true;
      if (isInitial) setIsLoadingMessages(true);
      try {
        const count = historyPagesRef.current.get(chatId)?.count ?? initialHistorySize;
        const result = await getChatMessages(chatId, count);
        if (!isMounted) return;
        if (isInitial) await publishInStages(chatId, result);
        else publishHistory(chatId, result);
        loadedHistoryIds.current.add(chatId);
        updateHistoryPage(chatId, { count, hasMore: result.length >= count, loadingOlder: false });
        const deletedIds = new Set(deletedMessageIds.current[chatId] ?? []);
        // History arrives newest first, so the first live entry is the newest message.
        const latest = result.find((message) => !message.deleted && (!message.id || !deletedIds.has(message.id)));
        if (latest) onLatestMessage(chatId, latest);
      } catch (error) {
        if (!isMounted) return;
        loadedHistoryIds.current.delete(chatId);
        updateHistoryPage(chatId, { ...(historyPagesRef.current.get(chatId) ?? { count: initialHistorySize, hasMore: false }), loadingOlder: false });
        onLoadError(errorMessage(error, "Could not load messages"));
      } finally {
        isLoading = false;
        if (isMounted && isInitial) setIsLoadingMessages(false);
      }
    };

    void loadHistory(!loadedHistoryIds.current.has(chatId));

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadHistory();
    }, 15_000);
    return () => { isMounted = false; window.clearInterval(interval); };
  }, [isDemo, onLatestMessage, onLoadError, publishHistory, publishInStages, selected, updateHistoryPage]);

  const pendingOlderRef = useRef(false);

  /** Loads exactly one older page and reports whether the chat still has older messages. */
  const loadOlderMessages = useCallback(async (): Promise<boolean> => {
    if (isDemo || !selected) return false;
    const chatId = selected;
    if (pendingOlderRef.current) return false;
    const currentPage = historyPagesRef.current.get(chatId);
    if (!currentPage?.hasMore || currentPage.loadingOlder) return false;
    pendingOlderRef.current = true;
    const nextCount = currentPage.count + historyPageSize;
    updateHistoryPage(chatId, { ...currentPage, loadingOlder: true });
    try {
      const result = await getChatMessages(chatId, nextCount);
      publishHistory(chatId, result);
      const page = { count: nextCount, hasMore: result.length >= nextCount, loadingOlder: false };
      updateHistoryPage(chatId, page);
      return page.hasMore;
    } catch (error) {
      updateHistoryPage(chatId, { ...currentPage, loadingOlder: false });
      if (selected === chatId) onLoadError(errorMessage(error, "Could not load older messages"));
      return false;
    } finally {
      pendingOlderRef.current = false;
    }
  }, [isDemo, onLoadError, publishHistory, selected, updateHistoryPage]);

  const markDeleted = useCallback((chatId: string, messageId: string) => {
    const deletedIds = new Set(deletedMessageIds.current[chatId] ?? []);
    deletedIds.add(messageId);
    deletedMessageIds.current = { ...deletedMessageIds.current, [chatId]: [...deletedIds] };
    persistDeletedMessageIds(deletedMessageIds.current);
    setMessages((current) => ({ ...current, [chatId]: (current[chatId] ?? []).map((item) => item.id === messageId
      ? { ...item, text: "This message was deleted", deleted: true, status: undefined, quotedText: undefined }
      : item) }));
  }, []);

  const appendMessage = useCallback((chatId: string, message: ChatMessage) => {
    setMessages((current) => ({ ...current, [chatId]: [...(current[chatId] ?? []), message] }));
  }, []);

  const patchMessage = useCallback((chatId: string, message: ChatMessage, patch: Partial<ChatMessage>) => {
    setMessages((current) => ({ ...current, [chatId]: (current[chatId] ?? []).map((item) => (item === message ? { ...message, ...patch } : item)) }));
  }, []);

  return {
    messages, messagesRef, isLoadingMessages, setIsLoadingMessages,
    historyPages, updateHistoryPage, publishHistory, publishInStages,
    loadOlderMessages, markDeleted, appendMessage, patchMessage, markLoaded, isLoaded,
  };
};