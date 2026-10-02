import type { Conversation } from "../../../entities/chat/types";
import { greenApiUrl } from "../../../shared/api/greenApiConfig";
import { greenApiRead } from "../../../shared/api/greenApiRead";
import axios from "axios";
import { getContacts } from "../../contacts/api/greenApiContacts";

type GreenApiChat = {
  id?: string;
  chatId?: string;
  name?: string;
  type?: string;
  username?: string;
  phoneNumber?: string | number;
  archive?: boolean;
  unreadCount?: number;
  lastMessage?: { textMessage?: string; extendedTextMessage?: { text?: string }; typeMessage?: string; timestamp?: number } | null;
  lastMsg?: { textMessage?: string; extendedTextMessage?: { text?: string }; typeMessage?: string; timestamp?: number } | null;
};

type GreenApiContactName = { id: string; name?: string; contactName?: string; username?: string; phoneNumber?: string | number };

const colors = [
  "linear-gradient(145deg,#efad78,#ce6d67)",
  "linear-gradient(145deg,#76c5bb,#38998e)",
  "linear-gradient(145deg,#8f9bd4,#5b68a8)",
  "linear-gradient(145deg,#e3a88d,#d46e70)",
  "linear-gradient(145deg,#d8ad71,#be8058)",
  "linear-gradient(145deg,#8cb48a,#5c8c72)",
];

const initials = (name: string) => {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase() || "?";
};

const toConversation = (chat: GreenApiChat, index: number): Conversation | null => {
  const id = chat.chatId ?? chat.id;
  if (!id) return null;
  const name = chat.name?.trim() || chat.username || String(chat.phoneNumber ?? id);
  const lastMessage = chat.lastMessage ?? chat.lastMsg;
  const timestamp = lastMessage?.timestamp;
  const preview = lastMessage?.textMessage || lastMessage?.extendedTextMessage?.text
    || (lastMessage?.typeMessage ? ({ imageMessage: "Photo", videoMessage: "Video", audioMessage: "Audio", documentMessage: "Document", stickerMessage: "Sticker", locationMessage: "Location", contactMessage: "Contact" }[lastMessage.typeMessage] ?? "Message") : "");
  return {
    id,
    name,
    initials: initials(name),
    color: colors[index % colors.length],
    preview: preview || ((chat.unreadCount ?? 0) > 0 ? "New message" : ""),
    time: timestamp ? new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp * 1000)) : "",
    group: chat.type ? ["group", "supergroup", "channel"].includes(chat.type) : id.startsWith("-"),
    archived: chat.archive ?? false,
    unread: chat.unreadCount ?? 0,
    hasConversation: Boolean(lastMessage) || (chat.unreadCount ?? 0) > 0,
    messages: [],
  };
};

export const searchChats = async (query = ""): Promise<Conversation[]> => {
  const [chats, contacts] = await Promise.all([loadChats(), getContacts().catch(() => [])]);
  if (!Array.isArray(chats)) throw new Error("Green API returned an invalid chats list");
  const names = new Map((contacts as GreenApiContactName[]).map((contact) => [contact.id, contact]));
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return chats
    .map((rawChat, index) => {
      const chat = rawChat as GreenApiChat;
      const id = chat.chatId ?? chat.id;
      const contact = id ? names.get(id) : undefined;
      return toConversation({ ...chat, name: contact?.name?.trim() || contact?.contactName?.trim() || chat.name, username: chat.username ?? contact?.username, phoneNumber: chat.phoneNumber ?? contact?.phoneNumber }, index);
    })
    .filter((chat): chat is Conversation => chat !== null)
    .filter((chat) => !normalizedQuery || `${chat.name} ${chat.preview}`.toLocaleLowerCase().includes(normalizedQuery));
};

const loadChats = async (): Promise<unknown[]> => {
  return greenApiRead("getChats", "all", async () => {
    const { data } = await axios.get<unknown[]>(greenApiUrl("getChats"));
    if (!Array.isArray(data)) throw new Error("Green API returned an invalid chats list");
    return data;
  });
};
