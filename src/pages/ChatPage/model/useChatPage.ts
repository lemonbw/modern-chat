import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { ChatMessage, Conversation } from "../../../entities/chat/types";
import { archiveChat, getContactInfo, unarchiveChat } from "../../../features/contacts/api/greenApiContacts";
import { useContactManager } from "../../../features/contacts/model/useContactManager";
import { getChatMessages } from "../../../features/messages/api/greenApiMessages";
import { searchChats } from "../../../features/search-chats/api/greenApiChats";
import { loadChatPreviews, previewTimeLabel } from "../../../features/search-chats/model/chatPreviews";
import { useChatCommands } from "./useChatCommands";
import { useChatHistory } from "./useChatHistory";
import {
  errorMessage,
  initialHistorySize,
  initialsOf,
  lastSelectedChatStorageKey,
  rememberSelectedChat,
} from "./chatPageState";

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

export const useChatPage = (isDemo = false) => {
  const [chats, setChats] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(() => getInitialChatId(isDemo));
  const initialSelectedChatId = useRef(selected);
  const [isLoadingChats, setIsLoadingChats] = useState(!isDemo);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showDeletedMessages, setShowDeletedMessages] = useState(() => localStorage.getItem("modern-chat-show-deleted") === "true");
  const previewLoadedIds = useRef(new Set<string>());
  const previewBlockedIds = useRef(new Set<string>());
  const contactManager = useContactManager(!isDemo);

  const patchChat = useCallback((chatId: string, patch: Partial<Conversation>) => {
    setChats((current) => current.map((chat) => chat.id === chatId ? { ...chat, ...patch } : chat));
  }, []);

  const handleLatestMessage = useCallback((chatId: string, message: ChatMessage) => {
    patchChat(chatId, { preview: message.text, time: message.time });
  }, [patchChat]);

  const history = useChatHistory({
    isDemo,
    selected,
    onLoadError: setLoadError,
    onLatestMessage: handleLatestMessage,
  });

  const commands = useChatCommands({
    isDemo,
    selected,
    onLoadError: setLoadError,
    onPatchChat: patchChat,
    onLockPreview: (chatId) => { previewBlockedIds.current.add(chatId); },
    appendMessage: history.appendMessage,
    patchMessage: history.patchMessage,
    markDeleted: history.markDeleted,
    messagesOf: (chatId) => history.messages[chatId] ?? [],
  });

  const selectedRef = useRef(selected);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  // Sidebar previews: newest message and unread run for every chat that was never opened.
  useEffect(() => {
    if (isDemo || isLoadingChats || chats.length === 0) return;
    const pending = chats.filter((chat) => !previewLoadedIds.current.has(chat.id));
    if (pending.length === 0) return;
    pending.forEach((chat) => previewLoadedIds.current.add(chat.id));
    let isMounted = true;

    void loadChatPreviews(pending, new Set(selectedRef.current ? [selectedRef.current] : []), (patch) => {
      if (!isMounted) return;
      if (previewBlockedIds.current.has(patch.id)) return;
      patchChat(patch.id, {
        ...(patch.preview !== undefined ? { preview: patch.preview } : {}),
        ...(patch.timestamp !== undefined ? { time: previewTimeLabel(patch.timestamp), lastTimestamp: patch.timestamp } : {}),
        ...(patch.sender !== undefined ? { sender: patch.sender } : {}),
      });
      if (patch.unread !== undefined) patchChat(patch.id, { unread: patch.unread });
    }, () => !isMounted);

    return () => { isMounted = false; };
  }, [chats, isDemo, isLoadingChats, patchChat]);

  // Initial load: the active chat opens first, the chat list arrives while its media renders.
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
          chatListPromise = searchChats();
          resultChats = await chatListPromise;
          if (!isMounted) return;
          chatId = resultChats[0]?.id ?? null;
          if (chatId) {
            setSelected(chatId);
            window.history.replaceState({}, "", `/chat/${encodeURIComponent(chatId)}`);
            rememberSelectedChat(chatId);
          }
        }

        if (chatId) {
          history.setIsLoadingMessages(true);
          history.markLoaded(chatId);
          rememberSelectedChat(chatId);
          const result = await getChatMessages(chatId, initialHistorySize);
          if (!isMounted) return;
          await history.publishInStages(chatId, result, () => {
            if (!chatListPromise) {
              chatListPromise = searchChats();
              void chatListPromise.catch(() => undefined);
            }
          });
          history.setIsLoadingMessages(false);
          history.updateHistoryPage(chatId, { count: initialHistorySize, hasMore: result.length >= initialHistorySize, loadingOlder: false });
          latestLoadedMessage = result.find((message) => !message.deleted);
        }

        if (!resultChats) resultChats = await (chatListPromise ?? searchChats());
        if (!isMounted) return;

        if (chatId && latestLoadedMessage) {
          resultChats = resultChats.map((chat) => chat.id === chatId
            ? {
                ...chat,
                preview: latestLoadedMessage!.text,
                time: latestLoadedMessage!.time,
                lastTimestamp: latestLoadedMessage!.timestamp,
                sender: chat.group ? latestLoadedMessage!.sender : undefined,
              }
            : chat);
        }

        setChats(resultChats);
      } catch (error) {
        if (!isMounted) return;
        setLoadError(errorMessage(error, "Could not load chats"));
        if (!resultChats) {
          try { resultChats = await searchChats(); } catch { resultChats = []; }
        }
        setChats(resultChats ?? []);
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

  // Browser back and forward.
  useEffect(() => {
    const onPopState = () => {
      const chatId = isDemo ? null : decodeURIComponent(window.location.pathname.split("/")[2] ?? "") || null;
      setSelected(chatId);
      if (chatId) rememberSelectedChat(chatId);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isDemo]);

  // Name and last seen of the open personal chat.
  useEffect(() => {
    if (isDemo || isLoadingChats || !selected || selected.startsWith("-")) return;
    let isMounted = true;
    void getContactInfo(selected).then((info) => {
      if (!isMounted || !info) return;
      const name = info.name?.trim() || info.contactName?.trim();
      if (name) patchChat(selected, { name, initials: initialsOf(name) });
      if (info.lastSeen) patchChat(selected, { lastSeen: info.lastSeen });
    }).catch(() => {
      // Best effort, the chat stays usable without the contact card.
    });
    return () => { isMounted = false; };
  }, [isDemo, isLoadingChats, patchChat, selected]);

  const activeChat = chats.find((chat) => chat.id === selected);

  const selectChat = async (id: string, preferredName?: string) => {
    if (isDemo) return;
    setSelected(id);
    setMobileOpen(true);
    setLoadError(null);
    window.history.pushState({}, "", `/chat/${encodeURIComponent(id)}`);
    rememberSelectedChat(id);
    contactManager.setDialog("closed");
    if (!chats.some((chat) => chat.id === id)) {
      const matchedContact = contactManager.contacts.find((item) => item.id === id);
      const name = preferredName || matchedContact?.contactName || matchedContact?.name || matchedContact?.username || id;
      const group = ["group", "supergroup", "channel"].includes(matchedContact?.type ?? "") || (!matchedContact && id.startsWith("-"));
      setChats((current) => [{
        id,
        name,
        initials: initialsOf(name),
        color: "linear-gradient(145deg,#76c5bb,#38998e)",
        preview: "",
        time: "",
        group,
        hasConversation: true,
        messages: [],
      }, ...current]);
    }
  };

  const toggleArchive = async () => {
    if (isDemo || !activeChat) return;
    try {
      if (activeChat.archived) await unarchiveChat(activeChat.id);
      else await archiveChat(activeChat.id);
      patchChat(activeChat.id, { archived: !activeChat.archived });
      setLoadError(null);
    } catch (error) {
      setLoadError(errorMessage(error, "Could not update archived status"));
    }
  };

  const toggleDeletedMessages = () => {
    setShowDeletedMessages((current) => {
      const next = !current;
      localStorage.setItem("modern-chat-show-deleted", String(next));
      return next;
    });
  };

  const saveContact = (event: FormEvent<HTMLFormElement>) => contactManager.saveContact(event, selectChat);
  const saveGroup = (event: FormEvent<HTMLFormElement>) => contactManager.saveGroup(event, selectChat);

  return {
    chats, selected, isLoadingChats, isLoadingMessages: history.isLoadingMessages, loadError, mobileOpen,
    messages: history.messages, activeChat,
    hasMoreMessages: selected ? history.historyPages[selected]?.hasMore ?? false : false,
    isLoadingOlderMessages: selected ? history.historyPages[selected]?.loadingOlder ?? false : false,
    ...contactManager,
    setMobileOpen,
    selectChat,
    send: commands.send,
    sendFiles: commands.sendFiles,
    forwardMessage: commands.forwardMessage,
    deleteMessage: commands.deleteMessage,
    saveContact,
    saveGroup,
    toggleArchive,
    loadOlderMessages: history.loadOlderMessages,
    showDeletedMessages,
    toggleDeletedMessages,
  };
};