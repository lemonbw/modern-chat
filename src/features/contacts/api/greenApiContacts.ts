import axios from "axios";
import { greenApiUrl } from "../../../shared/api/greenApiConfig";
import { greenApiRead } from "../../../shared/api/greenApiRead";

export type GreenApiContact = { id: string; chatId?: string; name?: string; contactName?: string; type?: string; phoneNumber?: string | number; username?: string; avatar?: string; base64Avatar?: string };
export type GreenApiContactInfo = { name?: string; contactName?: string; lastSeen?: string | number | null; avatar?: string; base64Avatar?: string; phoneNumber?: string | number; username?: string; chatType?: string };
export type GreenApiAvatar = { urlAvatar?: string | null; base64Avatar?: string | null; available?: boolean };

export const checkTelegramAccount = async (value: { phoneNumber: number } | { username: string }) => {
  const { data } = await axios.post<{ exist?: boolean; chatId?: string; username?: string; phoneNumber?: number }>(greenApiUrl("checkAccount"), value);
  return data;
};

export const getContacts = async (): Promise<GreenApiContact[]> => {
  return greenApiRead("getContacts", "all", async () => {
    const { data } = await axios.get<Array<GreenApiContact & { chatId?: string }>>(greenApiUrl("getContacts"));
    if (!Array.isArray(data)) throw new Error("Green API returned an invalid contacts list");
    return data.flatMap((contact) => {
      const id = contact.chatId ?? contact.id;
      return id ? [{ ...contact, id, chatId: id }] : [];
    });
  });
};

export const getContactInfo = async (chatId: string): Promise<GreenApiContactInfo | null> => {
  return greenApiRead("getContactInfo", chatId, async () => {
    const { data } = await axios.post<GreenApiContactInfo | null>(greenApiUrl("getContactInfo"), { chatId });
    return data;
  });
};

export const getContactAvatar = async (chatId: string): Promise<GreenApiAvatar | null> => {
  return greenApiRead("getAvatar", chatId, async () => {
    const { data } = await axios.post<GreenApiAvatar | null>(greenApiUrl("getAvatar"), { chatId });
    return data;
  });
};

export const addContact = async (name: string, chatId: string) => {
  await axios.post(greenApiUrl("addContact"), { chatId, firstName: name });
  return { id: chatId, chatId, name, type: "user" } satisfies GreenApiContact;
};

export const createGroup = async (name: string, chatIds: string[]) => {
  const { data } = await axios.post<{ chatId?: string; groupId?: string }>(greenApiUrl("createGroup"), { groupName: name, chatIds });
  return data;
};

export const archiveChat = async (chatId: string) => {
  await axios.post(greenApiUrl("archiveChat"), { chatId });
};

export const unarchiveChat = async (chatId: string) => {
  await axios.post(greenApiUrl("unarchiveChat"), { chatId });
};
