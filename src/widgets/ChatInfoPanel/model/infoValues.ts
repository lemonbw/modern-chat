import { lastSeenLabel } from "../../../shared/lib/lastSeen";

export const unknownValue = "unknown";

/** The chat id is an internal number, so only the phone from the contact card is shown. */
export const phoneOf = (phoneNumber?: string | number) => {
  const digits = String(phoneNumber ?? "").replace(/\D/g, "");
  return digits ? `+${digits}` : unknownValue;
};

export const usernameOf = (username?: string) => {
  const value = username?.trim();
  if (!value) return unknownValue;
  return value.startsWith("@") ? value : `@${value}`;
};

export const aboutOf = (about?: string) => about?.trim() || unknownValue;

export const linkOf = (link?: string) => (link?.trim() ? link.trim() : unknownValue);

export const lastSeenTextOf = (raw: string) => {
  if (!raw) return "Last seen recently";
  return lastSeenLabel(/^\d+$/.test(raw) ? Number(raw) : raw);
};