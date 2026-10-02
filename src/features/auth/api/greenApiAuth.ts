import axios from "axios";
import { greenApiClient } from "../../../shared/api/greenApiClient";
import { greenApiUrl } from "../../../shared/api/greenApiConfig";
import { greenApiRead } from "../../../shared/api/greenApiRead";
import type { UserProfile } from "../../../entities/user/types";
import { splitFullName } from "../../../entities/user/types";
import { getContactInfo } from "../../contacts/api/greenApiContacts";

export const greenApiErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError(error)) return error instanceof Error ? error.message : fallback;
  const responseData: unknown = error.response?.data;
  if (typeof responseData === "string" && responseData.trim()) return responseData;
  if (responseData && typeof responseData === "object") {
    const fields = responseData as Record<string, unknown>;
    for (const key of ["message", "error", "reason", "description"]) {
      if (typeof fields[key] === "string" && fields[key]) return fields[key] as string;
    }
  }
  if (error.response?.status) return `GREEN-API returned HTTP ${error.response.status}: ${error.message}`;
  return error.message || fallback;
};

type StateResponse = { stateInstance?: string } | null;
type TelegramSettings = { phone?: string; chatId?: string; avatar?: string; base64Avatar?: string; username?: string; name?: string };
type QrResponse = { type?: string; message?: string };

export const getQr = async () => {
  return greenApiRead("qr", "current", async () => {
    const { data } = await greenApiClient.get<QrResponse>(greenApiUrl("qr"), { params: { _ts: Date.now() } });
    return data;
  });
};

export const getAuthorizationState = async () => {
  return greenApiRead("getStateInstance", "current", async () => {
    const { data } = await greenApiClient.get<StateResponse>(greenApiUrl("getStateInstance"));
    return data?.stateInstance;
  });
};

export const logoutGreenApiInstance = async () => {
  const { data } = await greenApiClient.get<{ isLogout?: boolean }>(greenApiUrl("logout"));
  return data?.isLogout === true;
};

/** getAccountSettings has no name, but the account's own entry in the chat list is titled with it. */
const selfChatName = async (chatId?: string): Promise<string> => {
  if (!chatId) return "";
  const name = await greenApiRead("getChats", "account-name", async () => {
    const { data } = await greenApiClient.get<Array<{ chatId?: string; id?: string; name?: string }>>(greenApiUrl("getChats"));
    return (Array.isArray(data) ? data.find((chat) => (chat.chatId ?? chat.id) === chatId)?.name : "") ?? "";
  }).catch(() => "");
  return name.trim();
};

export const getUserProfile = async (): Promise<UserProfile> => {
  const { data } = await greenApiClient.get<TelegramSettings>(greenApiUrl("getAccountSettings"));
  const card = data.chatId ? await getContactInfo(data.chatId).catch(() => null) : null;
  const ownName = await selfChatName(data.chatId);
  // The contact card is the best source but its quota is often spent, the self chat is free.
  const cardName = splitFullName(card?.name ?? "");
  const chatName = splitFullName(ownName);
  const accountName = splitFullName(data.name ?? "");
  const firstName = cardName.firstName || chatName.firstName || accountName.firstName;
  const lastName = cardName.lastName || chatName.lastName || accountName.lastName;
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const nickname = data.username?.replace(/^@/, "") || card?.username?.replace(/^@/, "") || "";
  const avatar = data.avatar
    || (data.base64Avatar ? `data:image/jpeg;base64,${data.base64Avatar}` : null)
    || card?.avatar
    || (card?.base64Avatar ? `data:image/jpeg;base64,${card.base64Avatar}` : null);
  return {
    name: fullName || (nickname ? `@${nickname}` : "Telegram user"),
    phone: String(data.phone ?? card?.phoneNumber ?? ""),
    avatar: avatar ?? null,
    firstName,
    lastName,
    nickname: nickname || undefined,
  };
};

export const waitForAuthorization = async (signal: AbortSignal, requireFreshAuthorization = false) => {
  let observedNotAuthorized = !requireFreshAuthorization;
  while (!signal.aborted) {
    const state = await getAuthorizationState();
    if (signal.aborted) return null;
    if (state !== "authorized") observedNotAuthorized = true;
    if (state === "authorized" && observedNotAuthorized) {
      const profile = await getUserProfile();
      return signal.aborted ? null : profile;
    }
    await new Promise<void>((resolve) => {
      const finish = () => {
        window.clearTimeout(timer);
        signal.removeEventListener("abort", finish);
        resolve();
      };
      const timer = window.setTimeout(finish, 10_000);
      signal.addEventListener("abort", finish, { once: true });
    });
  }
  return null;
};

export const sendAuthorizationPassword = async (password: string) => {
  return greenApiClient.post(greenApiUrl("sendAuthorizationPassword"), { password });
};
