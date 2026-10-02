import { greenApiClient } from "../../../shared/api/greenApiClient";
import { greenApiUrl } from "../../../shared/api/greenApiConfig";
import { greenApiRead } from "../../../shared/api/greenApiRead";

export type GreenApiContact = { id: string; chatId?: string; name?: string; contactName?: string; type?: string; phoneNumber?: string | number; username?: string; avatar?: string; base64Avatar?: string };
export type GreenApiContactInfo = {
  name?: string;
  contactName?: string;
  lastSeen?: string | number | null;
  avatar?: string;
  base64Avatar?: string;
  phoneNumber?: string | number;
  username?: string;
  chatType?: string;
};
export type GreenApiAvatar = { urlAvatar?: string | null; base64Avatar?: string | null; available?: boolean };
export type GreenApiGroupData = {
  chatId?: string;
  subject?: string;
  description?: string;
  groupInviteLink?: string;
  username?: string;
  owner?: string;
  size?: number;
  isChannel?: boolean;
  isSupergroup?: boolean;
  participants?: { id?: string; chatId?: string; name?: string; role?: string }[];
};

/** About a hundred calls per method per month: results and empty answers are cached for hours. */
const contactCacheStorageKey = "modern-chat-contact-cache";
const contactCacheTtlMs = 6 * 60 * 60 * 1000;

type CacheEntry = { at: number; info: GreenApiContactInfo | null };

const readCache = (): Map<string, CacheEntry> => {
  try {
    const raw = localStorage.getItem(contactCacheStorageKey);
    if (!raw) return new Map();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return new Map();
    return new Map(Object.entries(parsed as Record<string, CacheEntry>));
  } catch {
    return new Map();
  }
};

const contactCache = readCache();

const isQuotaError = (error: unknown) => {
  const status = typeof error === "object" && error !== null && "response" in error
    ? (error as { response?: { status?: number } }).response?.status
    : undefined;
  return status === 466 || status === 429;
};

const persistCache = (chatId: string, info: GreenApiContactInfo | null) => {
  contactCache.set(chatId, { at: Date.now(), info });
  if (contactCache.size < 400) return;
  try {
    localStorage.setItem(contactCacheStorageKey, JSON.stringify(Object.fromEntries(contactCache.entries())));
  } catch {
    return new Map();
  }
};

const cachedContactInfo = (chatId: string) => {
  const entry = contactCache.get(chatId);
  if (!entry) return undefined;
  if (Date.now() - entry.at > contactCacheTtlMs) {
    contactCache.delete(chatId);
    return undefined;
  }
  return entry.info;
};

export const checkTelegramAccount = async (value: { phoneNumber: number } | { username: string }) => {
  const { data } = await greenApiClient.post<{ exist?: boolean; chatId?: string; username?: string; phoneNumber?: number }>(greenApiUrl("checkAccount"), value);
  return data;
};

export const getContacts = async (): Promise<GreenApiContact[]> => {
  return greenApiRead("getContacts", "all", async () => {
    const { data } = await greenApiClient.get<Array<GreenApiContact & { chatId?: string }>>(greenApiUrl("getContacts"));
    if (!Array.isArray(data)) throw new Error("Green API returned an invalid contacts list");
    return data.flatMap((contact) => {
      const id = contact.chatId ?? contact.id;
      return id ? [{ ...contact, id, chatId: id }] : [];
    });
  });
};

export const getContactInfo = async (chatId: string): Promise<GreenApiContactInfo | null> => {
  const cached = cachedContactInfo(chatId);
  if (cached !== undefined) return cached;

  try {
    return await greenApiRead("getContactInfo", chatId, async () => {
      const { data } = await greenApiClient.post<GreenApiContactInfo | null>(greenApiUrl("getContactInfo"), { chatId });
      persistCache(chatId, data ?? null);
      return data;
    });
  } catch (error) {
    if (isQuotaError(error)) return null;
    throw error;
  }
};

export const getContactAvatar = async (chatId: string): Promise<GreenApiAvatar | null> => {
  try {
    return await greenApiRead("getAvatar", chatId, async () => {
      const { data } = await greenApiClient.post<GreenApiAvatar | null>(greenApiUrl("getAvatar"), { chatId });
      return data;
    });
  } catch (error) {
    if (isQuotaError(error)) return null;
    throw error;
  }
};

export const getGroupData = async (chatId: string) => {
  return greenApiRead("getGroupData", chatId, async () => {
    const { data } = await greenApiClient.post<GreenApiGroupData | null>(greenApiUrl("getGroupData"), { chatId });
    return data;
  });
};

export const addContact = async (name: string, chatId: string) => {
  await greenApiClient.post(greenApiUrl("addContact"), { chatId, firstName: name });
  return { id: chatId, chatId, name, type: "user" } satisfies GreenApiContact;
};

export const createGroup = async (name: string, chatIds: string[]) => {
  const { data } = await greenApiClient.post<{ chatId?: string; groupId?: string }>(greenApiUrl("createGroup"), { groupName: name, chatIds });
  return data;
};

export const deleteContact = async (chatId: string) => {
  await greenApiClient.post(greenApiUrl("deleteContact"), { chatId });
};

export const archiveChat = async (chatId: string) => {
  await greenApiClient.post(greenApiUrl("archiveChat"), { chatId });
};

export const unarchiveChat = async (chatId: string) => {
  await greenApiClient.post(greenApiUrl("unarchiveChat"), { chatId });
};