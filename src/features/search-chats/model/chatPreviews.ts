import type { Conversation } from "../../../entities/chat/types";
import { formatTimeOfDay } from "../../../shared/lib/format";
import { getChatSidebarInfo, messagePreview, senderNameOf } from "../../messages/api/greenApiMessages";

export type ChatPreviewPatch = {
  id: string;
  preview?: string;
  timestamp?: number;
  unread?: number;
  unreadTruncated?: boolean;
  sender?: string;
};

const formatTime = (timestamp?: number) => (timestamp ? formatTimeOfDay(timestamp * 1000) : "");

/**
 * One request per background chat, no full history: the newest message feeds the sidebar row and
 * the run of incoming messages at its end is the unread counter GREEN-API Telegram does not expose.
 */
export const previewMessageCount = 10;

export const loadChatPreviews = async (
  chats: Conversation[],
  skipIds: Set<string>,
  onPatch: (patch: ChatPreviewPatch) => void,
  isCancelled: () => boolean = () => false,
) => {
  const pending = chats.filter((chat) => !skipIds.has(chat.id));
  for (const chat of pending) {
    if (isCancelled()) return;
    try {
      const { last, unread, unreadTruncated } = await getChatSidebarInfo(chat.id, previewMessageCount);
      if (isCancelled()) return;
      if (!last) {
        onPatch({ id: chat.id, preview: "", unread: 0, unreadTruncated: false });
        continue;
      }
      onPatch({
        id: chat.id,
        preview: messagePreview(last),
        timestamp: last.timestamp,
        unread,
        unreadTruncated,
        sender: chat.group ? senderNameOf(last) || undefined : undefined,
      });
    } catch {
      continue;
    }
  }
};

export const previewTimeLabel = formatTime;