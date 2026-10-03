export type ChatMessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";

export type ChatMessageMedia = {
  kind: "sticker" | "image" | "video" | "audio" | "document";
  url: string;
  mimeType?: string;
  fileName?: string;
  caption?: string;
  thumbnail?: string;
};

export type OutgoingFile = { blob: Blob; fileName: string; mimeType?: string };

export type ChatMessage = {
  id?: string;
  text: string;
  time: string;
  timestamp?: number;
  mine?: boolean;
  status?: ChatMessageStatus;
  quotedText?: string;
  sender?: string;
  deleted?: boolean;
  media?: ChatMessageMedia;
};

export type Conversation = {
  id: string;
  name: string;
  initials: string;
  color: string;
  preview: string;
  time: string;
  unread?: number;
  /** True when the unread run reaches the end of the fetched window: the real count is higher. */
  unreadTruncated?: boolean;
  lastTimestamp?: number;
  sender?: string;
  online?: boolean;
  lastSeen?: string | number | null;
  /** getChats / getContacts return these for personal chats, unlike getContactInfo. */
  phoneNumber?: string | number;
  username?: string;
  avatar?: string | null;
  hasConversation?: boolean;
  /** Notifications off for this chat: the unread badge is grey instead of blue. */
  notificationsOff?: boolean;
  group?: boolean;
  archived?: boolean;
  /** Locally edited first/last name (stored in IndexedDB). */
  firstName?: string;
  lastName?: string;
  messages: ChatMessage[];
};
