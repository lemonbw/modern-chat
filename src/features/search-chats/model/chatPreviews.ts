import type { Conversation } from "../../../entities/chat/types";
import { getChatUnreadCount, getLastChatMessage, messagePreview } from "../../messages/api/greenApiMessages";

export type ChatPreviewPatch = {
  id: string;
  preview?: string;
  timestamp?: number;
  unread?: number;
};

const formatTime = (timestamp?: number) =>
  timestamp
    ? new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp * 1000))
    : "";

/**
 * Fills the sidebar with the last message of every chat that was not opened.
 * GREEN-API Telegram has no unread counter, so a chat whose newest message is incoming
 * costs a second history request to count the unread run; chats ending with our own
 * message are known to be read without another call.
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
      const last = await getLastChatMessage(chat.id);
      if (isCancelled()) return;
      if (!last) {
        onPatch({ id: chat.id, preview: "", unread: 0 });
        continue;
      }
      onPatch({ id: chat.id, preview: messagePreview(last), timestamp: last.timestamp });
      if (last.type === "outgoing") {
        onPatch({ id: chat.id, unread: 0 });
        continue;
      }
      const unread = await getChatUnreadCount(chat.id);
      if (isCancelled()) return;
      onPatch({ id: chat.id, unread });
    } catch {
      // A chat without a preview stays usable, the next load retries it.
    }
  }
};

export const previewTimeLabel = formatTime;
