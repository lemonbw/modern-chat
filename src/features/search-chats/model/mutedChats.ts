import type { Conversation } from "../../../entities/chat/types";

/**
 * GREEN-API exposes no per-chat notification state, so the mute lives in this browser.
 * The unread badge is drawn grey while a chat is muted and blue otherwise.
 */
export const mutedChatsStorageKey = "modern-chat-muted-chats";

const readMutedIds = (): string[] => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(mutedChatsStorageKey) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
};

const writeMutedIds = (ids: string[]) => {
  try {
    localStorage.setItem(mutedChatsStorageKey, JSON.stringify(ids));
  } catch {
    return;
  }
};

export const withMuteState = (chats: Conversation[]): Conversation[] => {
  const muted = new Set(readMutedIds());
  return chats.map((chat) => (chat.notificationsOff === undefined ? { ...chat, notificationsOff: muted.has(chat.id) } : chat));
};

export const isChatMuted = (chatId: string) => readMutedIds().includes(chatId);

export const setChatMuted = (chatId: string, muted: boolean) => {
  const ids = new Set(readMutedIds());
  if (muted) ids.add(chatId);
  else ids.delete(chatId);
  writeMutedIds([...ids]);
  return muted;
};