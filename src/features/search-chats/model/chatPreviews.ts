import type { Conversation } from "../../../entities/chat/types";
import { getChatSidebarInfo, messagePreview, senderNameOf } from "../../messages/api/greenApiMessages";

export type ChatPreviewPatch = {
  id: string;
  preview?: string;
  timestamp?: number;
  unread?: number;
  sender?: string;
};

const formatTime = (timestamp?: number) =>
  timestamp
    ? new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp * 1000))
    : "";

/**
 * Fills the sidebar for every chat that was not opened. Each chat costs one history request that
 * carries both the newest message and the unread run, so the list fills at the pace of the
 * GREEN-API rate limit instead of two requests per chat.
 */
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
      const { last, unread } = await getChatSidebarInfo(chat.id);
      if (isCancelled()) return;
      if (!last) {
        onPatch({ id: chat.id, preview: "", unread: 0 });
        continue;
      }
      onPatch({
        id: chat.id,
        preview: messagePreview(last),
        timestamp: last.timestamp,
        unread,
        sender: chat.group ? senderNameOf(last) || undefined : undefined,
      });
    } catch {
      // A chat without a preview stays usable, the next load retries it.
    }
  }
};

export const previewTimeLabel = formatTime;