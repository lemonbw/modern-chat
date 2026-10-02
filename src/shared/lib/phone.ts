/** Formats a phone number for display, always with a leading plus. */
export const formatPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
};
