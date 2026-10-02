import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { ChatMessage, Conversation } from "../../../entities/chat/types";
import { getChatMessages, markChatAsRead } from "../../../features/messages/api/greenApiMessages";
import { searchChats } from "../../../features/search-chats/api/greenApiChats";
import { withMuteState } from "../../../features/search-chats/model/mutedChats";
import { loadChatPreviews, previewTimeLabel } from "../../../features/search-chats/model/chatPreviews";
import { errorMessage, initialHistorySize, rememberSelectedChat, type HistoryPage } from "./chatPageState";

/** The slice of the history hook the list needs: it opens the first chat and feeds the sidebar rows. */
export type ChatListHistory = {
  setIsLoadingMessages: (value: boolean) => void;
  markLoaded: (chatId: string) => void;
  publishInStages: (chatId: string, result: ChatMessage[]) => Promise<void>;
  updateHistoryPage: (chatId: string, page: HistoryPage) => void;
  isLoadingMessages: boolean;
  isLoaded: (chatId: string) => boolean;
};

type Options = {
  isDemo: boolean;
  history: ChatListHistory;
  /** The list state lives in the page hook; this hook only fills it. */
  chats: Conversation[];
  setChats: Dispatch<SetStateAction<Conversation[]>>;
  isLoadingChats: boolean;
  setIsLoadingChats: Dispatch<SetStateAction<boolean>>;
  patchChat: (chatId: string, patch: Partial<Conversation>) => void;
  initialChatIdRef: MutableRefObject<string | null>;
  /** Both forms on purpose: the value drives the effects, the ref reads the freshest one inside them. */
  selected: string | null;
  selectedRef: MutableRefObject<string | null>;
  onOpenChat: (chatId: string) => void;
  onLoadError: (message: string | null) => void;
};

/**
 * Owns the sidebar: the list itself, the initial screen and the background pass that fills every row
 * with its newest message. Split out of `useChatPage` because it is the part that talks to the API.
 */
export const useChatList = ({ isDemo, history, chats, setChats, isLoadingChats, setIsLoadingChats, patchChat, initialChatIdRef, selected, selectedRef, onOpenChat, onLoadError }: Options) => {
  const previewLoadedIds = useRef(new Set<string>());
  const previewBlockedIds = useRef(new Set<string>());
  const previewRunRef = useRef(false);
  // StrictMode mounts, unmounts and mounts again, so the flag is set on every mount.
  const isAliveRef = useRef(true);
  useEffect(() => {
    isAliveRef.current = true;
    return () => { isAliveRef.current = false; };
  }, []);

  useEffect(() => {
    if (isDemo || isLoadingChats || history.isLoadingMessages || chats.length === 0 || previewRunRef.current) return;
    // The chat on screen loads its own history, so it joins the queue once it is left.
    const openId = selectedRef.current;
    const pending = chats.filter((chat) => !previewLoadedIds.current.has(chat.id) && chat.id !== openId);
    if (pending.length === 0) return;
    pending.forEach((chat) => previewLoadedIds.current.add(chat.id));
    previewRunRef.current = true;

    void loadChatPreviews(pending, new Set(), (patch) => {
      if (!isAliveRef.current) return;
      if (previewBlockedIds.current.has(patch.id)) return;
      patchChat(patch.id, {
        ...(patch.preview !== undefined ? { preview: patch.preview } : {}),
        ...(patch.timestamp !== undefined ? { time: previewTimeLabel(patch.timestamp), lastTimestamp: patch.timestamp } : {}),
        ...(patch.sender !== undefined ? { sender: patch.sender } : {}),
      });
      if (patch.unread !== undefined) patchChat(patch.id, { unread: patch.unread, unreadTruncated: patch.unreadTruncated ?? false });
    }, () => !isAliveRef.current).finally(() => { previewRunRef.current = false; });
  }, [chats, isDemo, isLoadingChats, history.isLoadingMessages, patchChat, selected, selectedRef]);

  // Opening a chat clears its counter here and marks the chat read on the server side.
  const readChatRef = useRef<string | null>(null);
  useEffect(() => {
    if (isDemo || !selected || readChatRef.current === selected || !history.isLoaded(selected)) return;
    readChatRef.current = selected;
    patchChat(selected, { unread: 0, unreadTruncated: false });
    void markChatAsRead(selected).catch(() => undefined);
  }, [history, isDemo, patchChat, selected]);

  // Initial screen: the open chat first, the list arrives in parallel and is committed as it lands.
  useEffect(() => {
    if (isDemo) return;
    let isMounted = true;

    const loadInitialView = async () => {
      let resultChats: Conversation[] | null = null;
      let chatListPromise: Promise<Conversation[]> | null = null;
      let chatId = initialChatIdRef.current;
      let latestLoadedMessage: ChatMessage | undefined;

      const commitChats = (list: Conversation[]) => {
        if (!isMounted) return;
        // The open chat shows its newest message as the row preview once the history is in.
        setChats(withMuteState(chatId && latestLoadedMessage
          ? list.map((chat) => chat.id === chatId
            ? {
                ...chat,
                preview: latestLoadedMessage!.text,
                time: latestLoadedMessage!.time,
                lastTimestamp: latestLoadedMessage!.timestamp,
                sender: chat.group ? latestLoadedMessage!.sender : undefined,
              }
            : chat)
          : list));
        setIsLoadingChats(false);
      };

      const startChatList = () => {
        if (chatListPromise) return chatListPromise;
        chatListPromise = searchChats();
        void chatListPromise.then((list) => { resultChats = list; commitChats(list); }).catch(() => undefined);
        return chatListPromise;
      };

      try {
        if (!chatId) {
          resultChats = await startChatList();
          if (!isMounted) return;
          chatId = resultChats[0]?.id ?? null;
          if (chatId) onOpenChat(chatId);
        } else {
          startChatList();
        }

        if (chatId) {
          history.setIsLoadingMessages(true);
          history.markLoaded(chatId);
          rememberSelectedChat(chatId);
          const result = await getChatMessages(chatId, initialHistorySize);
          if (!isMounted) return;
          await history.publishInStages(chatId, result);
          history.setIsLoadingMessages(false);
          history.updateHistoryPage(chatId, { count: initialHistorySize, hasMore: result.length >= initialHistorySize, loadingOlder: false });
          latestLoadedMessage = result.find((message) => !message.deleted);
        }

        if (resultChats) commitChats(resultChats);
      } catch (error) {
        if (!isMounted) return;
        onLoadError(errorMessage(error, "Could not load chats"));
        if (!resultChats) {
          try { resultChats = await startChatList(); } catch { resultChats = []; }
        }
        commitChats(resultChats ?? []);
      } finally {
        if (isMounted) {
          setIsLoadingChats(false);
          history.setIsLoadingMessages(false);
        }
      }
    };

    void loadInitialView();
    return () => { isMounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo]);

  return {
    lockPreview: useCallback((chatId: string) => { previewBlockedIds.current.add(chatId); }, []),
  };
};