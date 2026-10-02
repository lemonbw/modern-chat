import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { ChatMessage, Conversation } from "../../../entities/chat/types";
import { archiveChat, getContactInfo, unarchiveChat } from "../../../features/contacts/api/greenApiContacts";
import { useContactManager } from "../../../features/contacts/model/useContactManager";
import { deleteChatMessage, forwardChatMessage, getChatMessage, getChatMessageStatus, getChatMessages, sendChatMessage } from "../../../features/messages/api/greenApiMessages";
import { searchChats } from "../../../features/search-chats/api/greenApiChats";

const avatarColors = ["linear-gradient(145deg,#76c5bb,#38998e)", "linear-gradient(145deg,#8f9bd4,#5b68a8)", "linear-gradient(145deg,#efad78,#ce6d67)"];
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase() || "?";
const messageTime = () => new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date());
const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
const deletedMessagesStorageKey = "modern-chat-deleted-message-ids";
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
  const [selected, setSelected] = useState<string | null>(() => isDemo ? null : decodeURIComponent(window.location.pathname.split("/")[2] ?? "") || null);
  const requestedChatId = useRef(selected);
  const [isLoadingChats, setIsLoadingChats] = useState(!isDemo);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [showDeletedMessages, setShowDeletedMessages] = useState(() => localStorage.getItem("modern-chat-show-deleted") === "true");
  const deletedMessageIds = useRef(loadDeletedMessageIds());
  const checkedStatusIds = useRef(new Map<string, ChatMessage["status"]>());
  const indexedChatIds = useRef(new Set<string>());
  const contactManager = useContactManager(!isDemo);
  useEffect(() => {
    if (isDemo) return;
    let isMounted = true;
    void searchChats().then(async (result) => {
      if (!isMounted) return;
      setChats(result);
      if (requestedChatId.current && !result.some((chat) => chat.id === requestedChatId.current)) {
        setSelected(null);
        window.history.replaceState({}, "", "/chat");
      }
      for (const chat of result) {
        if (!isMounted) return;
        if (chat.hasConversation) {
          setSelected((current) => {
            if (current) return current;
            window.history.replaceState({}, "", `/chat/${encodeURIComponent(chat.id)}`);
            return chat.id;
          });
          continue;
        }
        try {
          const latest = (await getChatMessages(chat.id, 1)).at(-1);
          if (!isMounted) return;
          if (!latest) continue;
          setChats((current) => current.map((item) => item.id === chat.id
            ? { ...item, hasConversation: true, preview: latest.text, time: latest.time }
            : item));
          setSelected((current) => {
            if (current) return current;
            window.history.replaceState({}, "", `/chat/${encodeURIComponent(chat.id)}`);
            return chat.id;
          });
        } catch {
          // Keep the chat visible when history verification is unavailable (for example, while rate limited).
          setChats((current) => current.map((item) => item.id === chat.id ? { ...item, hasConversation: true } : item));
        }
      }
      if (isMounted) setIsLoadingChats(false);
    }).catch((error: unknown) => {
      if (isMounted) {
        setIsLoadingChats(false);
        setLoadError(errorMessage(error, "Could not load chats"));
      }
    });
    return () => { isMounted = false; };
  }, [isDemo]);

  useEffect(() => {
    const onPopState = () => setSelected(isDemo ? null : decodeURIComponent(window.location.pathname.split("/")[2] ?? "") || null);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isDemo]);

  useEffect(() => {
    if (isDemo || !selected) return;
    let isMounted = true;
    let initialRequest = true;
    indexedChatIds.current.add(selected);
    const loadHistory = async () => {
      try {
        const result = await getChatMessages(selected);
        if (!isMounted) return;
        setMessages((current) => {
          const previous = current[selected] ?? [];
          const resultIds = new Set(result.map((message) => message.id).filter(Boolean));
          const localMessages = previous.filter((message) => !message.id || !resultIds.has(message.id));
          const previousById = new Map(previous.filter((message) => message.id).map((message) => [message.id!, message]));
          const deletedIds = new Set(deletedMessageIds.current[selected] ?? []);
          const historyMessages = result.map((message) => {
            const previousMessage = previousById.get(message.id ?? "");
            if (message.deleted || previousMessage?.deleted || (message.id && deletedIds.has(message.id))) {
              return { ...message, ...(previousMessage ?? {}), text: "This message was deleted", deleted: true, status: undefined, quotedText: undefined };
            }
            return { ...message, status: message.status ?? previousMessage?.status };
          });
          return { ...current, [selected]: [...historyMessages, ...localMessages] };
        });
        const deletedIds = new Set(deletedMessageIds.current[selected] ?? []);
        const latest = [...result].reverse().find((message) => !message.deleted && (!message.id || !deletedIds.has(message.id)));
        if (latest) {
          setChats((current) => current.map((chat) => chat.id === selected ? { ...chat, hasConversation: true, preview: latest.text, time: latest.time } : chat));
        } else if (initialRequest) {
          setChats((current) => current.map((chat) => chat.id === selected ? { ...chat, hasConversation: false, preview: "No messages yet", time: "" } : chat));
        }
        const latestOutgoing = result.filter((message) => message.mine && message.id && !deletedIds.has(message.id)).slice(-20);
        latestOutgoing.forEach((message) => {
          const messageId = message.id!;
          const statusKey = `${selected}:${messageId}`;
          const knownStatus = message.status ?? checkedStatusIds.current.get(statusKey);
          if (knownStatus === "read" || knownStatus === "failed") {
            checkedStatusIds.current.set(statusKey, knownStatus);
            return;
          }
          if (!message.status && checkedStatusIds.current.has(statusKey) && !knownStatus) return;
          if (!message.status) checkedStatusIds.current.set(statusKey, undefined);
          void getChatMessageStatus(selected, messageId).then((status) => {
            if (!isMounted || !status) return;
            checkedStatusIds.current.set(statusKey, status);
            setMessages((current) => ({
              ...current,
              [selected]: (current[selected] ?? []).map((item) => item.id === messageId && !item.deleted ? { ...item, status } : item),
            }));
          }).catch(() => {
            // Status lookup is best-effort; the history remains visible if GREEN-API has not indexed it yet.
          });
        });
        initialRequest = false;
      } catch (error) {
        indexedChatIds.current.delete(selected);
        if (isMounted && initialRequest) setLoadError(errorMessage(error, "Could not load messages"));
        initialRequest = false;
      }
    };
    void loadHistory();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadHistory();
    }, 15_000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [selected, isDemo]);

  const indexChatMessages = useCallback(() => {
    if (isDemo) return;
    chats.filter((chat) => chat.hasConversation !== false && !indexedChatIds.current.has(chat.id)).forEach((chat) => {
      indexedChatIds.current.add(chat.id);
      void getChatMessages(chat.id).then((result) => {
        setMessages((current) => {
          const previous = current[chat.id] ?? [];
          const previousById = new Map(previous.filter((message) => message.id).map((message) => [message.id!, message]));
          const deletedIds = new Set(deletedMessageIds.current[chat.id] ?? []);
          const history = result.map((message) => {
            const previousMessage = previousById.get(message.id ?? "");
            if (message.deleted || previousMessage?.deleted || (message.id && deletedIds.has(message.id))) {
              return { ...message, ...(previousMessage ?? {}), text: "This message was deleted", deleted: true, status: undefined, quotedText: undefined };
            }
            return { ...message, status: message.status ?? previousMessage?.status };
          });
          const resultIds = new Set(history.map((message) => message.id).filter(Boolean));
          const pending = previous.filter((message) => !message.id || !resultIds.has(message.id));
          return { ...current, [chat.id]: [...history, ...pending] };
        });
        const deletedIds = new Set(deletedMessageIds.current[chat.id] ?? []);
        const latest = [...result].reverse().find((message) => !message.deleted && (!message.id || !deletedIds.has(message.id)));
        setChats((current) => current.map((item) => item.id === chat.id
          ? { ...item, hasConversation: Boolean(latest), preview: latest?.text ?? "No messages yet", time: latest?.time ?? "" }
          : item));
      }).catch(() => {
        indexedChatIds.current.delete(chat.id);
      });
    });
  }, [chats, isDemo]);

  useEffect(() => {
    if (isDemo || !selected || selected.startsWith("-")) return;
    let isMounted = true;
    void getContactInfo(selected).then((info) => {
      if (!isMounted || !info) return;
      const name = info.name?.trim() || info.contactName?.trim();
      setChats((current) => current.map((chat) => chat.id === selected
        ? { ...chat, ...(name ? { name, initials: initials(name) } : {}), lastSeen: info.lastSeen }
        : chat));
    }).catch(() => {
      // Telegram contact metadata is optional; message history remains available without it.
    });
    return () => { isMounted = false; };
  }, [selected, isDemo]);

  const activeChat = chats.find((chat) => chat.id === selected);

  const selectChat = async (id: string, preferredName?: string) => {
    if (isDemo) return;
    setSelected(id);
    setMobileOpen(true);
    setLoadError(null);
    window.history.pushState({}, "", `/chat/${encodeURIComponent(id)}`);
    contactManager.setDialog("closed");
    if (!chats.some((chat) => chat.id === id)) {
      const matchedContact = contactManager.contacts.find((item) => item.id === id);
      const name = preferredName || matchedContact?.contactName || matchedContact?.name || matchedContact?.username || id;
      const group = ["group", "supergroup", "channel"].includes(matchedContact?.type ?? "") || (!matchedContact && id.startsWith("-"));
      setChats((current) => [{ id, name, initials: initials(name), color: avatarColors[current.length % avatarColors.length], preview: "", time: "", group, hasConversation: false, messages: [] }, ...current]);
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
        // Keep the tombstone in memory if browser storage is unavailable.
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
    chats, selected, isLoadingChats, loadError, mobileOpen, messages, activeChat,
    ...contactManager,
    setMobileOpen,
    selectChat, send, forwardMessage, saveContact, saveGroup, toggleArchive, deleteMessage, indexChatMessages,
    showDeletedMessages, toggleDeletedMessages,
  };
};
