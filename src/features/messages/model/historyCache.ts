import type { ChatMessage } from "../../../entities/chat/types";
import { idbDelete, idbGet, idbGetAll, idbSet } from "../../../shared/lib/idb";

/**
 * Messages this browser has already read are kept in IndexedDB, so opening a chat paints the wall
 * from the cache while the network request is still on its way. The store is the same `profiles`
 * database as the local contact profiles, under the `history:` prefix.
 */
const messagesPerChat = 200;
const chatsKept = 30;

type HistoryCacheEntry = {
  chatId: string;
  savedAt: number;
  messages: ChatMessage[];
};

const historyKey = (chatId: string) => `history:${chatId}`;

const isChatMessage = (value: unknown): value is ChatMessage =>
  typeof value === "object" && value !== null && "time" in value;

export const readHistoryCache = async (chatId: string): Promise<ChatMessage[]> => {
  try {
    const entry = await idbGet<HistoryCacheEntry>(historyKey(chatId));
    if (!entry || !Array.isArray(entry.messages)) return [];
    return entry.messages.filter(isChatMessage);
  } catch {
    return [];
  }
};

export const writeHistoryCache = async (chatId: string, messages: ChatMessage[]) => {
  if (messages.length === 0) return;
  try {
    await idbSet(historyKey(chatId), {
      chatId,
      savedAt: Date.now(),
      messages: messages.slice(-messagesPerChat),
    } satisfies HistoryCacheEntry);
  } catch {
    return;
  }
  await pruneHistoryCache();
};

const pruneHistoryCache = async () => {
  try {
    const entries = (await idbGetAll<HistoryCacheEntry>()).filter((entry) => typeof entry?.savedAt === "number");
    const outdated = entries.sort((left, right) => right.savedAt - left.savedAt).slice(chatsKept);
    if (outdated.length === 0) return;
    await Promise.all(outdated.map((entry) => idbDelete(historyKey(entry.chatId))));
  } catch {
    return;
  }
};
