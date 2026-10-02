import { idbGet, idbSet } from "../../../shared/lib/idb";

export type LocalProfile = {
  firstName: string;
  lastName: string;
  bio: string;
  birthday: string;
  avatar: string | null;
  notifications: boolean;
};

/**
 * Profile edits, the notification switch and the avatar override live only in this browser,
 * so nothing is ever written back to Telegram. They sit in IndexedDB because base64 avatars
 * outgrow the localStorage quota.
 */
const profileStorageKey = (chatId: string) => `profile:${chatId}`;

const legacyProfileStorageKey = (chatId: string) => `modern-chat-info:${chatId}`;

export const emptyProfile = (): LocalProfile => ({
  firstName: "",
  lastName: "",
  bio: "",
  birthday: "",
  avatar: null,
  notifications: true,
});

const sanitize = (parsed: unknown): LocalProfile | null => {
  if (!parsed || typeof parsed !== "object") return null;
  const fields = parsed as Partial<LocalProfile>;
  return {
    firstName: typeof fields.firstName === "string" ? fields.firstName : "",
    lastName: typeof fields.lastName === "string" ? fields.lastName : "",
    bio: typeof fields.bio === "string" ? fields.bio : "",
    birthday: typeof fields.birthday === "string" ? fields.birthday : "",
    avatar: typeof fields.avatar === "string" ? fields.avatar : null,
    notifications: fields.notifications !== false,
  };
};

const readLegacyProfile = (chatId: string): LocalProfile | null => {
  try {
    const raw = localStorage.getItem(legacyProfileStorageKey(chatId));
    return raw ? sanitize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

export const readLocalProfile = async (chatId: string): Promise<LocalProfile | null> => {
  try {
    const stored = sanitize(await idbGet<unknown>(profileStorageKey(chatId)));
    if (stored) return stored;
  } catch {
    return null;
  }
  const legacy = readLegacyProfile(chatId);
  if (legacy) await writeLocalProfile(chatId, legacy).catch(() => undefined);
  return legacy;
};

export const writeLocalProfile = async (chatId: string, profile: LocalProfile) => {
  try {
    await idbSet(profileStorageKey(chatId), profile);
    localStorage.removeItem(legacyProfileStorageKey(chatId));
  } catch {
    return;
  }
};