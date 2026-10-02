import type { ChatMessage } from "../../../entities/chat/types";

export type InfoTab = "members" | "stories" | "media" | "files" | "links" | "music";

export type InfoItemKind = "photo" | "video" | "file" | "link" | "audio" | "member";

export type InfoItem = {
  id: string;
  kind: InfoItemKind;
  title: string;
  subtitle?: string;
  url?: string;
  thumbnail?: string;
  timestamp?: number;
};

export const userTabs: InfoTab[] = ["stories", "media", "files", "links", "music"];
export const groupTabs: InfoTab[] = ["members", ...userTabs];

export const tabLabel: Record<InfoTab, string> = {
  members: "Members",
  stories: "Stories",
  media: "Media",
  files: "Files",
  links: "Links",
  music: "Music",
};

const urlPattern = /https?:\/\/[^\s<>"']+/i;

const itemId = (message: ChatMessage, index: number) => message.id ?? `${message.timestamp ?? index}-${index}`;

type MediaKind = "image" | "video" | "audio" | "document" | "sticker";

const itemKindOf = (kind: MediaKind): InfoItemKind =>
  kind === "image" || kind === "sticker" ? "photo" : kind === "video" ? "video" : kind === "audio" ? "audio" : "file";

const collectMedia = (messages: ChatMessage[], kinds: readonly MediaKind[]): InfoItem[] =>
  messages.flatMap((message, index) => {
    const media = message.media;
    if (!media || !kinds.includes(media.kind as MediaKind)) return [];
    return [{
      id: itemId(message, index),
      kind: itemKindOf(media.kind as MediaKind),
      title: media.caption || media.fileName || tabLabel.media,
      url: media.url,
      thumbnail: media.thumbnail,
      timestamp: message.timestamp,
    }];
  });

export const buildTabItems = (messages: ChatMessage[], tab: InfoTab, options: { showPhotos?: boolean; showVideos?: boolean } = {}): InfoItem[] => {
  const { showPhotos = true, showVideos = true } = options;
  if (tab === "stories") return [];
  if (tab === "media") {
    const kinds: MediaKind[] = [];
    if (showPhotos) kinds.push("image", "sticker");
    if (showVideos) kinds.push("video");
    return collectMedia(messages, kinds);
  }
  if (tab === "files") return collectMedia(messages, ["document"]);
  if (tab === "music") return collectMedia(messages, ["audio"]);
  if (tab === "links") {
    return messages.flatMap((message, index) => {
      const url = message.text.match(urlPattern)?.[0];
      if (!url) return [];
      return [{ id: itemId(message, index), kind: "link" as const, title: url, subtitle: message.text, timestamp: message.timestamp }];
    });
  }
  return [];
};

export const mediaCountLabel = (messages: ChatMessage[], options: { showPhotos?: boolean; showVideos?: boolean } = {}) => {
  const { showPhotos = true, showVideos = true } = options;
  const photos = showPhotos ? collectMedia(messages, ["image", "sticker"]).length : 0;
  const videos = showVideos ? collectMedia(messages, ["video"]).length : 0;
  const parts: string[] = [];
  if (photos) parts.push(`${photos} ${photos === 1 ? "photo" : "photos"}`);
  if (videos) parts.push(`${videos} ${videos === 1 ? "video" : "videos"}`);
  return parts.join(", ");
};

/** Members are derived from message senders because GREEN-API returns an empty participant list. */
export const buildMembers = (messages: ChatMessage[]): InfoItem[] => {
  const members = new Map<string, InfoItem>();
  for (const message of [...messages].reverse()) {
    if (!message.sender || members.has(message.sender)) continue;
    members.set(message.sender, {
      id: message.sender,
      kind: "member",
      title: message.sender,
      subtitle: message.mine ? "You" : message.time,
      timestamp: message.timestamp,
    });
  }
  return [...members.values()];
};

export const membersCountLabel = (members: InfoItem[]) => `${members.length} ${members.length === 1 ? "member" : "members"}`;