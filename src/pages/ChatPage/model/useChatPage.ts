import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { ChatMessage, Conversation } from "../../../entities/chat/types";
import { archiveChat, getContactInfo, unarchiveChat } from "../../../features/contacts/api/greenApiContacts";
import { useContactManager } from "../../../features/contacts/model/useContactManager";
import { deleteChatMessage, forwardChatMessage, getChatMessage, getChatMessages, sendChatMessage } from "../../../features/messages/api/greenApiMessages";
import { searchChats } from "../../../features/search-chats/api/greenApiChats";

const avatarColors = ["linear-gradient(145deg,#76c5bb,#38998e)", "linear-gradient(145deg,#8f9bd4,#5b68a8)", "linear-gradient(145deg,#efad78,#ce6d67)"];
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase() || "?";
const messageTime = () => new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date());
const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
const deletedMessagesStorageKey = "modern-chat-deleted-message-ids";
const lastSelectedChatStorageKey = "modern-chat-last-selected-chat";
const initialHistorySize = 20;
const historyPageSize = 20;
type HistoryPage = { count: number; hasMore: boolean; loadingOlder: boolean };

const getInitialChatId = (isDemo: boolean) => {
  if (isDemo) return null;
  const routeChatId = decodeURIComponent(window.location.pathname.split("/")[2] ?? "");
  if (routeChatId) return routeChatId;
  try {
    return window.localStorage.getItem(lastSelectedChatStorageKey);
  } catch {
    return null;
  }
};

const nextPaint = () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

const mergeHistory = (result: ChatMessage[], previous: ChatMessage[], deletedIds: Set<string>) => {
  const resultIds = new Set(result.map((message) => message.id).filter(Boolean));
  const previousById = new Map(previous.filter((message) => message.id).map((message) => [message.id!, message]));
  const historyMessages = result.map((message) => {
    const previousMessage = previousById.get(message.id ?? "");
    if (message.deleted || previousMessage?.deleted || (message.id && deletedIds.has(message.id))) {
      return { ...message, ...(previousMessage ?? {}), text: "This message was deleted", deleted: true, status: undefined, quotedText: undefined };
    }
    return { ...message, status: message.status ?? previousMessage?.status };
  });
  const localMessages = previous.filter((message) => !message.id || !resultIds.has(message.id));
  return [...historyMessages, ...localMessages];
};

const loadDeletedMessageIds = (): Record<string, string[]> => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(deletedMessagesStorageKey) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string[]] =>
      Array.isArray(entry[1]) && entry[1].every((id) => typeof id === "string"),
    ));
  } catch {
    return {};
  }
};

export const useChatPage = (isDemo = false) => {
  const [chats, setChats] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(() => getInitialChatId(isDemo));
  const initialSelectedChatId = useRef(selected);
  const [isLoadingChats, setIsLoadingChats] = useState(!isDemo);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const messagesRef = useRef(messages);
  const [showDeletedMessages, setShowDeletedMessages] = useState(() => localStorage.getItem("modern-chat-show-deleted") === "true");
  const deletedMessageIds = useRef(loadDeletedMessageIds());
  const loadedHistoryIds = useRef(new Set<string>());
  const historyPagesRef = useRef(new Map<string, HistoryPage>());
  const [historyPages, setHistoryPages] = useState<Record<string, HistoryPage>>({});
  const contactManager = useContactManager(!isDemo);

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
   * Progressive history rendering:
   * 1. Text messages first
   * 2. + Stickers
   * 3. + Other media (parallel hook starts chat list)
   */
  const publishInitialHistoryInStages = useCallback(async (chatId: string, result: ChatMessage[], onMediaStageStart?: () => void) => {
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

    // Stage 1: Text messages
    publishStage(textMessages);
    await nextPaint();

    // Stage 2: Stickers
    if (stickerMessages.length > 0) {
      publishStage(chronological([...textMessages, ...stickerMessages]));
      await nextPaint();
    }

    // Stage 3: Media (parallel hook)
    onMediaStageStart?.();
    if (otherMedia.length > 0) {
      publishStage(chronological([...textMessages, ...stickerMessages, ...otherMedia]));
    }
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ─── Initial load sequence: Shell -> Active chat 20 msgs -> Chat list in parallel with media ───
  useEffect(() => {
    if (isDemo) return;
    let isMounted = true;

    const loadInitialView = async () => {
      let resultChats: Conversation[] | null = null;
      let chatListPromise: Promise<Conversation[]> | null = null;
      let chatId = initialSelectedChatId.current;
      let latestLoadedMessage: ChatMessage | undefined;

      try {
        if (!chatId) {
          // If no chat was remembered, fetch the chat list first to know which to open
          chatListPromise = searchChats();
          resultChats = await chatListPromise;
          if (!isMounted) return;
          chatId = resultChats[0]?.id ?? null;
          if (chatId) {
            setSelected(chatId);
            window.history.replaceState({}, "", `/chat/${encodeURIComponent(chatId)}`);
            try { window.localStorage.setItem(lastSelectedChatStorageKey, chatId); } catch { /* ignore */ }
          }
        }

        if (chatId) {
          setIsLoadingMessages(true);
          loadedHistoryIds.current.add(chatId);
          try { window.localStorage.setItem(lastSelectedChatStorageKey, chatId); } catch { /* ignore */ }

          // 1. Fetch last 20 messages of the active chat
          const result = await getChatMessages(chatId, initialHistorySize);
          if (!isMounted) return;

          // 2. Publish text first, then trigger chat list fetch in parallel with media
          await publishInitialHistoryInStages(chatId, result, () => {
            if (!chatListPromise) {
              chatListPromise = searchChats();
              void chatListPromise.catch(() => undefined);
            }
          });

          setIsLoadingMessages(false);
          updateHistoryPage(chatId, { count: initialHistorySize, hasMore: result.length >= initialHistorySize, loadingOlder: false });

          const deletedIds = new Set(deletedMessageIds.current[chatId] ?? []);
          latestLoadedMessage = [...result].reverse().find((m) => !m.deleted && (!m.id || !deletedIds.has(m.id)));
        }

        // 3. Await chat list (already running in parallel with media)
        if (!resultChats) {
          resultChats = await (chatListPromise ?? searchChats());
        }
        if (!isMounted) return;

        // If active chat has a preview from loaded messages, update it
        if (chatId && latestLoadedMessage) {
          resultChats = resultChats.map((c) => c.id === chatId
            ? { ...c, preview: latestLoadedMessage!.text, time: latestLoadedMessage!.time }
            : c);
        }

        setChats(resultChats);
      } catch (error) {
        if (!isMounted) return;
        setLoadError(errorMessage(error, "Could not load chats"));
        if (!resultChats) {
          try { resultChats = await searchChats(); } catch { resultChats = []; }
        }
        if (isMounted) setChats(resultChats ?? []);
      } finally {
        if (isMounted) {
          setIsLoadingChats(false);
          setIsLoadingMessages(false);
        }
      }
    };

    void loadInitialView();
    return () => { isMounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo]);

  // ─── Browser navigation (back/forward) ────────────────────────────────────
  useEffect(() => {
    const onPopState = () => {
      const chatId = isDemo ? null : decodeURIComponent(window.location.pathname.split("/")[2] ?? "") || null;
      setSelected(chatId);
      if (chatId) {
        try { window.localStorage.setItem(lastSelectedChatStorageKey, chatId); } catch { /* ignore */ }
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isDemo]);

  // ─── Per-chat message history on selection / polling ──────────────────────
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
        if (isInitial) {
          await publishInitialHistoryInStages(chatId, result);
        } else {
          publishHistory(chatId, result);
        }
        loadedHistoryIds.current.add(chatId);
        const page = historyPagesRef.current.get(chatId) ?? { count, hasMore: false, loadingOlder: false };
        updateHistoryPage(chatId, { ...page, hasMore: result.length >= count, loadingOlder: false });
        const deletedIds = new Set(deletedMessageIds.current[chatId] ?? []);
        const latest = [...result].reverse().find((m) => !m.deleted && (!m.id || !deletedIds.has(m.id)));
        if (latest) {
          setChats((current) => current.map((c) => c.id === chatId
            ? { ...c, preview: latest.text, time: latest.time }
            : c));
        }
      } catch (error) {
        if (isMounted) {
          loadedHistoryIds.current.delete(chatId);
          updateHistoryPage(chatId, { ...(historyPagesRef.current.get(chatId) ?? { count: initialHistorySize, hasMore: false }), loadingOlder: false });
          setLoadError(errorMessage(error, "Could not load messages"));
        }
      } finally {
        isLoading = false;
        if (isMounted && isInitial) setIsLoadingMessages(false);
      }
    };

    const needsInitialLoad = !loadedHistoryIds.current.has(chatId);
    if (needsInitialLoad) {
      loadedHistoryIds.current.add(chatId);
      void loadHistory(true);
    } else {
      void loadHistory();
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadHistory();
    }, 15_000);
    return () => { isMounted = false; window.clearInterval(interval); };
  }, [selected, isDemo, publishInitialHistoryInStages, publishHistory, updateHistoryPage]);

  // ─── Contact metadata (name, last seen) for personal chats ───────────────
  useEffect(() => {
    if (isDemo || isLoadingChats || !selected || selected.startsWith("-")) return;
    let isMounted = true;
    void getContactInfo(selected).then((info) => {
      if (!isMounted || !info) return;
      const name = info.name?.trim() || info.contactName?.trim();
      setChats((current) => current.map((chat) => chat.id === selected
        ? { ...chat, ...(name ? { name, initials: initials(name) } : {}), lastSeen: info.lastSeen }
        : chat));
    }).catch(() => {
      // Best effort
    });
    return () => { isMounted = false; };
  }, [selected, isDemo, isLoadingChats]);

  // ─── Load older messages (scroll-up pagination) ───────────────────────────
  const loadOlderMessages = async () => {
    if (isDemo || !selected) return;
    const chatId = selected;
    const currentPage = historyPagesRef.current.get(chatId);
    if (!currentPage?.hasMore || currentPage.loadingOlder) return;
    const nextCount = currentPage.count + historyPageSize;
    updateHistoryPage(chatId, { ...currentPage, loadingOlder: true });
    try {
      const result = await getChatMessages(chatId, nextCount);
      publishHistory(chatId, result);
      updateHistoryPage(chatId, { count: nextCount, hasMore: result.length >= nextCount, loadingOlder: false });
    } catch (error) {
      updateHistoryPage(chatId, { ...currentPage, loadingOlder: false });
      if (selected === chatId) setLoadError(errorMessage(error, "Could not load older messages"));
    }
  };

  const activeChat = chats.find((chat) => chat.id === selected) ?? (selected ? {
    id: selected,
    name: selected,
    initials: initials(selected),
    color: avatarColors[0],
    preview: "",
    time: "",
    hasConversation: true,
    messages: [],
  } satisfies Conversation : undefined);

  const selectChat = async (id: string, preferredName?: string) => {
    if (isDemo) return;
    setSelected(id);
    setMobileOpen(true);
    setLoadError(null);
    window.history.pushState({}, "", `/chat/${encodeURIComponent(id)}`);
    try { window.localStorage.setItem(lastSelectedChatStorageKey, id); } catch { /* ignore */ }
    contactManager.setDialog("closed");
    if (!chats.some((chat) => chat.id === id)) {
      const matchedContact = contactManager.contacts.find((item) => item.id === id);
      const name = preferredName || matchedContact?.contactName || matchedContact?.name || matchedContact?.username || id;
      const group = ["group", "supergroup", "channel"].includes(matchedContact?.type ?? "") || (!matchedContact && id.startsWith("-"));
      setChats((current) => [{ id, name, initials: initials(name), color: avatarColors[current.length % avatarColors.length], preview: "", time: "", group, hasConversation: true, messages: [] }, ...current]);
    }
  };

  const saveContact = (event: FormEvent<HTMLFormElement>) => contactManager.saveContact(event, selectChat);
  const saveGroup = (event: FormEvent<HTMLFormElement>) => contactManager.saveGroup(event, selectChat);

  const send = async (text: string, quotedMessage?: ChatMessage) => {
    if (isDemo || !selected) return;
    const chatId = selected;
    const optimisticMessage: ChatMessage = { text, time: messageTime(), mine: true, status: "sending", quotedText: quotedMessage?.text };
    setMessages((current) => ({ ...current, [chatId]: [...(current[chatId] ?? []), optimisticMessage] }));
    setChats((current) => current.map((chat) => chat.id === chatId ? { ...chat, preview: text, time: optimisticMessage.time } : chat));
    setLoadError(null);
    try {
      const { data } = await sendChatMessage(chatId, text, quotedMessage?.id);
      setMessages((current) => ({ ...current, [chatId]: (current[chatId] ?? []).map((message) => message === optimisticMessage ? { ...message, id: data.idMessage, status: "sent" } : message) }));
      setChats((current) => current.map((chat) => chat.id === chatId ? { ...chat, hasConversation: true } : chat));
    } catch (error) {
      setMessages((current) => ({ ...current, [chatId]: (current[chatId] ?? []).map((message) => message === optimisticMessage ? { ...message, status: "failed" } : message) }));
      setLoadError(errorMessage(error, "Could not send message"));
    }
  };

  const forwardMessage = async (message: ChatMessage, destinationChatId: string) => {
    if (isDemo || !selected || !message.id) return;
    const sourceChatId = selected;
    setLoadError(null);
    try {
      await getChatMessage(sourceChatId, message.id);
      const { data } = await forwardChatMessage(destinationChatId, sourceChatId, message.id);
      const destination = chats.find((chat) => chat.id === destinationChatId);
      const forwarded: ChatMessage = {
        id: data.messages?.[0],
        text: message.text,
        time: messageTime(),
        mine: true,
        status: "sent",
      };
      setChats((current) => current.map((chat) => chat.id === destinationChatId
        ? { ...chat, hasConversation: true, preview: message.text, time: forwarded.time }
        : chat));
      if (destination) {
        setMessages((current) => ({ ...current, [destinationChatId]: [...(current[destinationChatId] ?? []), forwarded] }));
      }
    } catch (error) {
      setLoadError(errorMessage(error, "Could not forward message"));
      throw error;
    }
  };

  const toggleArchive = async () => {
    if (isDemo || !activeChat) return;
    try {
      if (activeChat.archived) await unarchiveChat(activeChat.id);
      else await archiveChat(activeChat.id);
      setChats((current) => current.map((chat) => chat.id === activeChat.id ? { ...chat, archived: !activeChat.archived } : chat));
      setLoadError(null);
    } catch (error) { setLoadError(errorMessage(error, "Could not update archived status")); }
  };

  const deleteMessage = async (message: ChatMessage, onlySenderDelete: boolean) => {
    if (isDemo || !selected || !message.id || !message.mine || message.deleted) return;
    const chatId = selected;
    try {
      await deleteChatMessage(chatId, message.id, onlySenderDelete);
      const deletedIds = new Set(deletedMessageIds.current[chatId] ?? []);
      deletedIds.add(message.id);
      deletedMessageIds.current = { ...deletedMessageIds.current, [chatId]: [...deletedIds] };
      try {
        localStorage.setItem(deletedMessagesStorageKey, JSON.stringify(deletedMessageIds.current));
      } catch {
        /* ignore */
      }
      setMessages((current) => ({ ...current, [chatId]: (current[chatId] ?? []).map((item) => item.id === message.id
        ? { ...item, text: "This message was deleted", deleted: true, status: undefined, quotedText: undefined }
        : item) }));
      const lastVisibleMessage = [...(messages[chatId] ?? [])].reverse().find((item) => item.id !== message.id && !item.deleted);
      setChats((current) => current.map((chat) => chat.id === chatId
        ? { ...chat, preview: lastVisibleMessage?.text ?? "No messages yet", time: lastVisibleMessage?.time ?? "", hasConversation: Boolean(lastVisibleMessage) }
        : chat));
      setLoadError(null);
    } catch (error) {
      setLoadError(errorMessage(error, "Could not delete message"));
      throw error;
    }
  };

  const toggleDeletedMessages = () => {
    setShowDeletedMessages((current) => {
      const next = !current;
      localStorage.setItem("modern-chat-show-deleted", String(next));
      return next;
    });
  };

  return {
    chats, selected, isLoadingChats, isLoadingMessages, loadError, mobileOpen, messages, activeChat,
    hasMoreMessages: selected ? historyPages[selected]?.hasMore ?? false : false,
    isLoadingOlderMessages: selected ? historyPages[selected]?.loadingOlder ?? false : false,
    ...contactManager,
    setMobileOpen,
    selectChat, send, forwardMessage, saveContact, saveGroup, toggleArchive, deleteMessage, loadOlderMessages,
    showDeletedMessages, toggleDeletedMessages,
  };
};
