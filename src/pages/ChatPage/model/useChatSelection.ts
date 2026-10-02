import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import type { Conversation } from "../../../entities/chat/types";
import { archiveChat, getContactInfo, unarchiveChat } from "../../../features/contacts/api/greenApiContacts";
import type { ContactManagerModel } from "../../../features/contacts/model/useContactManager";
import { setChatMuted } from "../../../features/search-chats/model/mutedChats";
import { errorMessage, initialsOf, rememberSelectedChat } from "./chatPageState";
import { useChatUiStore } from "./chatUiStore";

type Options = {
  isDemo: boolean;
  selected: string | null;
  setSelected: Dispatch<SetStateAction<string | null>>;
  setLoadError: (message: string | null) => void;
  chats: Conversation[];
  setChats: Dispatch<SetStateAction<Conversation[]>>;
  isLoadingChats: boolean;
  patchChat: (chatId: string, patch: Partial<Conversation>) => void;
  contactManager: ContactManagerModel;
};

/** What happens because the open chat changed: back button, contact card, header actions. */
export const useChatSelection = ({ isDemo, selected, setSelected, setLoadError, chats, setChats, isLoadingChats, patchChat, contactManager }: Options) => {
  // Browser back and forward.
  useEffect(() => {
    const onPopState = () => {
      const chatId = isDemo ? null : decodeURIComponent(window.location.pathname.split("/")[2] ?? "") || null;
      setSelected(chatId);
      if (chatId) rememberSelectedChat(chatId);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isDemo, setSelected]);

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
    });
    return () => { isMounted = false; };
  }, [isDemo, isLoadingChats, patchChat, selected]);

  const activeChat = chats.find((chat) => chat.id === selected);

  const selectChat = useCallback(async (id: string, preferredName?: string) => {
    if (isDemo) return;
    setSelected(id);
    useChatUiStore.getState().openMobileChat(id);
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
  }, [chats, contactManager, isDemo, setChats, setLoadError, setSelected]);

  const toggleArchive = useCallback(async () => {
    if (isDemo || !activeChat) return;
    try {
      if (activeChat.archived) await unarchiveChat(activeChat.id);
      else await archiveChat(activeChat.id);
      patchChat(activeChat.id, { archived: !activeChat.archived });
      setLoadError(null);
    } catch (error) {
      setLoadError(errorMessage(error, "Could not update archived status"));
    }
  }, [activeChat, isDemo, patchChat, setLoadError]);

  const toggleNotifications = useCallback(() => {
    if (isDemo || !activeChat) return;
    patchChat(activeChat.id, { notificationsOff: setChatMuted(activeChat.id, !activeChat.notificationsOff) });
  }, [activeChat, isDemo, patchChat]);

  return { activeChat, selectChat, toggleArchive, toggleNotifications };
};