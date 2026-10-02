import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { ChatMessage, Conversation } from "../../../entities/chat/types";
import { useContactManager } from "../../../features/contacts/model/useContactManager";
import { useChatCommands } from "./useChatCommands";
import { useChatHistory } from "./useChatHistory";
import { useChatList } from "./useChatList";
import { useChatSelection } from "./useChatSelection";
import { useChatUiStore } from "./chatUiStore";
import { lastSelectedChatStorageKey } from "./chatPageState";

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

/**
 * Composition root of the chat page: it owns the open chat and the error banner and hands the work to
 * the focused hooks — the list, the history, the commands and the selection.
 */
export const useChatPage = (isDemo = false) => {
  const [selected, setSelected] = useState<string | null>(() => getInitialChatId(isDemo) ?? useChatUiStore.getState().selectedChatId);
  const initialSelectedChatId = useRef(selected);
  const [loadError, setLoadError] = useState<string | null>(null);
  const mobileOpen = useChatUiStore((state) => state.mobileOpen);
  const closeMobileChat = useChatUiStore((state) => state.closeMobileChat);
  const showDeletedMessages = useChatUiStore((state) => state.showDeletedMessages);
  const toggleDeletedMessages = useChatUiStore((state) => state.toggleDeletedMessages);

  useEffect(() => useChatUiStore.getState().selectChat(selected), [selected]);
  const selectedRef = useRef(selected);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const contactManager = useContactManager(!isDemo);
  const [chats, setChats] = useState<Conversation[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(!isDemo);
  const patchChat = useCallback((chatId: string, patch: Partial<Conversation>) => {
    setChats((current) => current.map((chat) => chat.id === chatId ? { ...chat, ...patch } : chat));
  }, []);

  const onLatestMessage = useCallback((chatId: string, message: ChatMessage) => {
    patchChat(chatId, { preview: message.text, time: message.time });
  }, [patchChat]);

  const history = useChatHistory({
    isDemo,
    selected,
    onLoadError: setLoadError,
    onLatestMessage,
  });

  const list = useChatList({
    isDemo,
    history,
    chats,
    setChats,
    isLoadingChats,
    setIsLoadingChats,
    patchChat,
    initialChatIdRef: initialSelectedChatId,
    selected,
    selectedRef,
    onOpenChat: (chatId) => {
      setSelected(chatId);
      window.history.replaceState({}, "", `/chat/${encodeURIComponent(chatId)}`);
    },
    onLoadError: setLoadError,
  });

  const commands = useChatCommands({
    isDemo,
    selected,
    onLoadError: setLoadError,
    onPatchChat: patchChat,
    onLockPreview: list.lockPreview,
    appendMessage: history.appendMessage,
    patchMessage: history.patchMessage,
    markDeleted: history.markDeleted,
    messagesOf: (chatId) => history.messages[chatId] ?? [],
  });

  const selection = useChatSelection({
    isDemo,
    selected,
    setSelected,
    setLoadError,
    chats,
    setChats,
    isLoadingChats,
    patchChat,
    contactManager,
  });

  const saveContact = (event: FormEvent<HTMLFormElement>) => contactManager.saveContact(event, selection.selectChat);
  const saveGroup = (event: FormEvent<HTMLFormElement>) => contactManager.saveGroup(event, selection.selectChat);

  return {
    chats, selected, isLoadingChats, isLoadingMessages: history.isLoadingMessages, loadError, mobileOpen,
    messages: history.messages, activeChat: selection.activeChat,
    hasMoreMessages: selected ? history.historyPages[selected]?.hasMore ?? false : false,
    isLoadingOlderMessages: selected ? history.historyPages[selected]?.loadingOlder ?? false : false,
    ...contactManager,
    closeMobileChat,
    selectChat: selection.selectChat,
    send: commands.send,
    sendFiles: commands.sendFiles,
    forwardMessage: commands.forwardMessage,
    deleteMessage: commands.deleteMessage,
    saveContact,
    saveGroup,
    toggleArchive: selection.toggleArchive,
    toggleNotifications: selection.toggleNotifications,
    loadOlderMessages: history.loadOlderMessages,
    retry: list.retry,
    showDeletedMessages,
    toggleDeletedMessages,
  };
};