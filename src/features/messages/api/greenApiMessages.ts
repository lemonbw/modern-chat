import axios from "axios";
import type { ChatMessage, ChatMessageMedia } from "../../../entities/chat/types";
import { greenApiUrl } from "../../../shared/api/greenApiConfig";
import { greenApiRead } from "../../../shared/api/greenApiRead";

type GreenApiMessage = {
  type?: string;
  textMessage?: string;
  timestamp?: number;
  typeMessage?: string;
  idMessage?: string;
  statusMessage?: string;
  extendedTextMessage?: { text?: string };
  deletedMessageData?: { stanzaId?: string };
  downloadUrl?: string;
  caption?: string;
  fileName?: string;
  mimeType?: string;
  jpegThumbnail?: string;
};

const statusFromApi = (status?: string): ChatMessage["status"] => {
  const normalized = status?.toLowerCase();
  if (normalized === "pending") return "sending";
  if (normalized === "sent" || normalized === "delivered" || normalized === "read") return normalized;
  if (normalized === "failed" || normalized === "noaccount" || normalized === "noactivesession") return "failed";
  return undefined;
};

export const getChatMessage = async (chatId: string, idMessage: string) => {
  return greenApiRead("getMessage", `${chatId}:${idMessage}`, async () => {
    const { data } = await axios.post<GreenApiMessage>(greenApiUrl("getMessage"), { chatId, idMessage });
    return data;
  });
};

export const getChatMessageStatus = async (chatId: string, idMessage: string): Promise<ChatMessage["status"]> => {
  const message = await getChatMessage(chatId, idMessage);
  return statusFromApi(message.statusMessage);
};

const messageText = (item: GreenApiMessage) => {
  if (item.textMessage || item.extendedTextMessage?.text || item.caption) return item.textMessage ?? item.extendedTextMessage?.text ?? item.caption ?? "";
  const labels: Record<string, string> = {
    imageMessage: "Photo",
    videoMessage: "Video",
    audioMessage: "Audio",
    documentMessage: "Document",
    stickerMessage: "Sticker",
    locationMessage: "Location",
    contactMessage: "Contact",
  };
  return labels[item.typeMessage ?? ""] ?? "Message";
};

const thumbnailDataUrl = (thumbnail?: string) => {
  if (!thumbnail) return undefined;
  const normalized = thumbnail.trim().replace(/\s/g, "");
  return normalized.startsWith("data:") ? normalized : `data:image/jpeg;base64,${normalized}`;
};

const messageMedia = (item: GreenApiMessage): ChatMessageMedia | undefined => {
  if (!item.downloadUrl) return undefined;
  let url: URL;
  try {
    url = new URL(item.downloadUrl);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:") return undefined;
  const kind = item.typeMessage === "imageMessage" ? "image"
    : item.typeMessage === "videoMessage" ? "video"
      : item.typeMessage === "audioMessage" ? "audio"
        : undefined;
  if (!kind) return undefined;
  return {
    kind,
    url: url.toString(),
    mimeType: item.mimeType,
    fileName: item.fileName,
    caption: item.caption,
    thumbnail: thumbnailDataUrl(item.jpegThumbnail),
  };
};

export const getChatMessages = async (chatId: string, count = 100): Promise<ChatMessage[]> => {
  return greenApiRead("getChatHistory", `${chatId}:${count}`, async () => {
    const { data } = await axios.post<GreenApiMessage[]>(greenApiUrl("getChatHistory"), { chatId, count });
    if (!Array.isArray(data)) throw new Error("Green API returned an invalid message history");
    return data
      .reverse()
      .map((item) => ({
        id: item.typeMessage === "deletedMessage" ? item.deletedMessageData?.stanzaId ?? item.idMessage : item.idMessage,
        text: item.typeMessage === "deletedMessage" ? "This message was deleted" : messageText(item),
        time: item.timestamp
          ? new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(item.timestamp * 1000))
          : "",
        mine: item.type === "outgoing",
        status: item.type === "outgoing" ? statusFromApi(item.statusMessage) : undefined,
        deleted: item.typeMessage === "deletedMessage",
        media: messageMedia(item),
      }));
  });
};

export const sendChatMessage = async (chatId: string, message: string, quotedMessageId?: string) => {
  return axios.post<{ idMessage?: string }>(greenApiUrl("sendMessage"), {
    chatId,
    message,
    ...(quotedMessageId ? { quotedMessageId } : {}),
  });
};

export const forwardChatMessage = async (chatId: string, chatIdFrom: string, messageId: string) => {
  return axios.post<{ messages?: string[] }>(greenApiUrl("forwardMessages"), {
    chatId,
    chatIdFrom,
    messages: [messageId],
  });
};

export const deleteChatMessage = async (chatId: string, idMessage: string, onlySenderDelete: boolean) => {
  return axios.post(greenApiUrl("deleteMessage"), { chatId, idMessage, onlySenderDelete });
};
