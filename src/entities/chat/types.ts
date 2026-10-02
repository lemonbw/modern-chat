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
  lastTimestamp?: number;
  online?: boolean;
  lastSeen?: string | number | null;
  avatar?: string | null;
  hasConversation?: boolean;
  group?: boolean;
  archived?: boolean;
  messages: ChatMessage[];
};
