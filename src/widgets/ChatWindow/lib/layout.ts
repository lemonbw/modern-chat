/** Header, message list and composer share one centred column so they stay vertically aligned. */
export const contentColumn = "mx-auto w-full max-w-[min(100%,640px)]";
export const chatBarColumn = "mx-auto w-full max-w-[min(100%,740px)]";
export const contentGutter = "px-[clamp(8px,3vw,28px)] max-[760px]:px-3";

export const statusGlyph: Record<string, string> = {
  sending: "◷",
  sent: "✓",
  delivered: "✓✓",
  read: "✓✓",
  failed: "!",
};

export const statusTitle: Record<string, string> = {
  sending: "Sending",
  sent: "Sent",
  delivered: "Delivered, not read",
  read: "Read",
  failed: "Not sent",
};

export const statusColor: Record<string, string> = {
  read: "#53bdeb",
  failed: "#fca5a5",
  sent: "#b7c3cc",
  delivered: "#b7c3cc",
  sending: "#b7c3cc",
};