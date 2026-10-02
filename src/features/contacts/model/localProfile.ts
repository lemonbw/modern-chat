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
 * so nothing is ever written back to Telegram.
 */
const profileStorageKey = (chatId: string) => `modern-chat-info:${chatId}`;

export const emptyProfile = (): LocalProfile => ({
  firstName: "",
  lastName: "",
  bio: "",
  birthday: "",
  avatar: null,
  notifications: true,
});

export const readLocalProfile = (chatId: string): LocalProfile | null => {
  try {
    const raw = localStorage.getItem(profileStorageKey(chatId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
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
  } catch {
    return null;
  }
};

export const writeLocalProfile = (chatId: string, profile: LocalProfile) => {
  try {
    localStorage.setItem(profileStorageKey(chatId), JSON.stringify(profile));
  } catch {
    // Storage may be full or blocked; the edits simply stay in memory for this session.
  }
};