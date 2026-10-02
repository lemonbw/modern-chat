/** The chat column lines up with the space between the header picture and the menu button. */
export const pageColumn = "mx-auto w-full max-w-[min(100%,1000px)]";
export const contentGutter = "px-[clamp(8px,3vw,28px)] max-[760px]:px-3";
/** 42px avatar + 12px gap on the left, 12px gap + two 38px buttons on the right. */
export const contentInset =
  "pl-[54px] pr-[100px] max-[760px]:pl-[104px] max-[760px]:pr-[76px]";

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
