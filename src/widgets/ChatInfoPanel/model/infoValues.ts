import { lastSeenLabel } from "../../../shared/lib/lastSeen";

export const phoneOf = (chatId: string, contactPhone?: string | number) => {
  const digits = String(contactPhone ?? chatId ?? "").replace(/\D/g, "");
  return digits ? `+${digits}` : "—";
};

export const usernameOf = (...values: (string | undefined)[]) => {
  const found = values.find((value) => value?.trim());
  if (!found) return "—";
  return found.startsWith("@") ? found : `@${found}`;
};

export const lastSeenTextOf = (raw: string) => {
  if (!raw) return "Last seen recently";
  return lastSeenLabel(/^\d+$/.test(raw) ? Number(raw) : raw);
};