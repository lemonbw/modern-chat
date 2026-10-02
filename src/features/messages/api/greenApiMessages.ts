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
  stickerMessageData?: {
    downloadUrl?: string;
    fileName?: string;
    jpegThumbnail?: string;
    mimeType?: string;
  };
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

const JPEG_HEADER_HEX =
  "ffd8ffe000104a46494600010100000100010000ffdb004300281c1e231e19282321232d2b28303c64413c37373c7b585d4964918099968f808c8aa0b4e6c3a0aadaad8a8cc8ffcbdaeef5ffffff9bc1fffffffaffe6fdfff8ffdb0043012b2d2d3c353c76414176f8a58ca5f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8ffc00011080000000003012200021101031101ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffc4001f0100030101010101010101010000000000000102030405060708090a0bffc400b51100020102040403040705040400010277000102031104052131061241510761711322328108144291a1b1c109233352f0156272d10a162434e125f11718191a262728292a35363738393a434445464748494a535455565758595a636465666768696a737475767778797a82838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae2e3e4e5e6e7e8e9eaf2f3f4f5f6f7f8f9faffda000c03010002110311003f00";

const JPEG_HEADER_BYTES = new Uint8Array(JPEG_HEADER_HEX.match(/../g)!.map((h) => parseInt(h, 16)));
const JPEG_FOOTER_BYTES = new Uint8Array([0xff, 0xd9]);

const thumbnailDataUrl = (thumbnail?: string): string | undefined => {
  if (!thumbnail) return undefined;
  const clean = thumbnail.trim().replace(/\s/g, "");
  if (clean.startsWith("data:")) return clean;
  try {
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
      return `data:image/jpeg;base64,${clean}`;
    }
    if (bytes.length >= 3 && bytes[0] === 1) {
      const header = new Uint8Array(JPEG_HEADER_BYTES);
      header[164] = bytes[1];
      header[166] = bytes[2];
      const payload = bytes.subarray(3);
      const totalLen = header.length + payload.length + JPEG_FOOTER_BYTES.length;
      const result = new Uint8Array(totalLen);
      result.set(header, 0);
      result.set(payload, header.length);
      result.set(JPEG_FOOTER_BYTES, header.length + payload.length);
      let binaryStr = "";
      for (let i = 0; i < result.length; i++) {
        binaryStr += String.fromCharCode(result[i]);
      }
      return `data:image/jpeg;base64,${btoa(binaryStr)}`;
    }
    return `data:image/jpeg;base64,${clean}`;
  } catch {
    return clean.startsWith("data:") ? clean : `data:image/jpeg;base64,${clean}`;
  }
};

const messageMedia = (item: GreenApiMessage): ChatMessageMedia | undefined => {
  const stickerData = item.stickerMessageData;
  const downloadUrl = item.downloadUrl ?? stickerData?.downloadUrl;
  if (!downloadUrl) return undefined;
  let url: URL;
  try {
    url = new URL(downloadUrl);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:") return undefined;
  const kind = item.typeMessage === "stickerMessage" ? "sticker"
    : item.typeMessage === "imageMessage" ? "image"
    : item.typeMessage === "videoMessage" ? "video"
      : item.typeMessage === "audioMessage" ? "audio"
        : undefined;
  if (!kind) return undefined;
  return {
    kind,
    url: url.toString(),
    mimeType: item.mimeType ?? stickerData?.mimeType,
    fileName: item.fileName ?? stickerData?.fileName,
    caption: item.caption,
    thumbnail: thumbnailDataUrl(item.jpegThumbnail ?? stickerData?.jpegThumbnail),
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
