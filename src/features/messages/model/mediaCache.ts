import type { ChatMessageMedia } from "../../../entities/chat/types";

export type MediaDescriptor = {
  media: ChatMessageMedia;
  previewSource: string | undefined;
  fallbackSource: string;
  downloadFileName: string;
};

const limit = 800;
const descriptors = new Map<string, MediaDescriptor>();

const isAnimatedSticker = (media: ChatMessageMedia) => media.mimeType === "application/x-tgsticker";

const previewSourceOf = (media: ChatMessageMedia) => {
  if (media.kind === "sticker") return media.thumbnail ?? (isAnimatedSticker(media) ? undefined : media.url);
  if (media.kind === "image") return media.url || media.thumbnail;
  return media.thumbnail ?? media.url;
};

const downloadNameOf = (media: ChatMessageMedia) =>
  media.fileName ?? media.url.split("/").pop()?.split("?")[0] ?? "image.jpg";

export const mediaDescriptorOf = (id: string, media: ChatMessageMedia): MediaDescriptor => {
  const key = `${id}|${media.kind}|${media.url}|${media.thumbnail ?? ""}|${media.mimeType ?? ""}`;
  const cached = descriptors.get(key);
  if (cached) return cached;

  const descriptor: MediaDescriptor = {
    media,
    previewSource: previewSourceOf(media),
    fallbackSource: media.url,
    downloadFileName: downloadNameOf(media),
  };
  if (descriptors.size >= limit) {
    const oldest = descriptors.keys().next().value;
    if (oldest !== undefined) descriptors.delete(oldest);
  }
  descriptors.set(key, descriptor);
  return descriptor;
};