import type { ChatMessage, Conversation } from "../../../entities/chat/types";

export const avatarColors = ["linear-gradient(145deg,#76c5bb,#38998e)", "linear-gradient(145deg,#8f9bd4,#5b68a8)", "linear-gradient(145deg,#efad78,#ce6d67)"];
export const deletedMessagesStorageKey = "modern-chat-deleted-message-ids";
export const lastSelectedChatStorageKey = "modern-chat-last-selected-chat";
export const initialHistorySize = 20;
export const historyPageSize = 20;

export type HistoryPage = { count: number; hasMore: boolean; loadingOlder: boolean };

export const initialsOf = (name: string) => name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase() || "?";
export const messageTime = () => new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date());
export const nowTimestamp = () => Math.floor(Date.now() / 1000);
export const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export const nextPaint = () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

/** Fresh history wins, locally sent messages survive, and deletions stay deleted. */
export const mergeHistory = (result: ChatMessage[], previous: ChatMessage[], deletedIds: Set<string>) => {
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

export const loadDeletedMessageIds = (): Record<string, string[]> => {
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

export const persistDeletedMessageIds = (deletedIds: Record<string, string[]>) => {
  try {
    localStorage.setItem(deletedMessagesStorageKey, JSON.stringify(deletedIds));
  } catch {
    return {};
  }
};

export const rememberSelectedChat = (chatId: string) => {
  try {
    window.localStorage.setItem(lastSelectedChatStorageKey, chatId);
  } catch {
    return {};
  }
};

export const placeholderConversation = (id: string, index: number, overrides: Partial<Conversation> = {}): Conversation => ({
  id,
  name: id,
  initials: initialsOf(id),
  color: avatarColors[index % avatarColors.length],
  preview: "",
  time: "",
  hasConversation: true,
  messages: [],
  ...overrides,
});