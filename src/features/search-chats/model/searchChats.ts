import type { Conversation } from "../../../entities/chat/types";

export type ChatFilter = "all" | "personal" | "groups" | "archived";

export const visibleChats = (chats: Conversation[], query: string, filter: ChatFilter, messageSearchIndex: Record<string, string> = {}) => {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return chats.filter((chat) => {
    const matchesSearch = chat.hasConversation !== false
      && `${chat.name} ${chat.preview} ${messageSearchIndex[chat.id] ?? ""}`.toLocaleLowerCase().includes(normalizedQuery);
    const matchesFilter = filter === "archived"
      ? chat.archived
      : !chat.archived && (filter === "all" || (filter === "groups" ? chat.group : !chat.group));
    return matchesSearch && matchesFilter;
  });
};
