import { useEffect, useRef } from "react";
import type { ChatMessage } from "../../../entities/chat/types";
import { readHistoryCache, writeHistoryCache } from "../../../features/messages/model/historyCache";
import type { HistoryPage } from "./chatPageState";

type Options = {
  isDemo: boolean;
  selected: string | null;
  messages: Record<string, ChatMessage[]>;
  historyPagesRef: React.RefObject<Map<string, HistoryPage>>;
  publishHistory: (chatId: string, result: ChatMessage[]) => void;
  updateHistoryPage: (chatId: string, page: HistoryPage) => void;
};

/** The read history of every chat in IndexedDB, so a chat paints before the network answers. */
export const useHistoryCache = ({ isDemo, selected, messages, historyPagesRef, publishHistory, updateHistoryPage }: Options) => {
  useEffect(() => {
    if (isDemo || !selected) return;
    const chatId = selected;
    let isMounted = true;
    void readHistoryCache(chatId).then((cached) => {
      if (!isMounted || cached.length === 0) return;
      publishHistory(chatId, cached);
      const page = historyPagesRef.current?.get(chatId);
      updateHistoryPage(chatId, { count: Math.max(page?.count ?? 0, cached.length), hasMore: true, loadingOlder: false });
    }).catch(() => undefined);
    return () => { isMounted = false; };
  }, [historyPagesRef, isDemo, publishHistory, selected, updateHistoryPage]);

  // Polls run every fifteen seconds, so the cache is only written when the window really changed.
  const cachedSignatures = useRef(new Map<string, string>());
  useEffect(() => {
    if (isDemo) return;
    const timer = window.setTimeout(() => {
      for (const [chatId, list] of Object.entries(messages)) {
        if (list.length === 0) continue;
        const signature = `${list.length}:${list[0]?.id ?? ""}:${list[list.length - 1]?.id ?? ""}`;
        if (cachedSignatures.current.get(chatId) === signature) continue;
        cachedSignatures.current.set(chatId, signature);
        void writeHistoryCache(chatId, list);
      }
    }, 1_500);
    return () => window.clearTimeout(timer);
  }, [isDemo, messages]);
};