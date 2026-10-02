import type { InfoTab } from "../../../features/contacts/model/chatInfo";

export const tabLabel: Record<InfoTab, string> = {
  members: "Members",
  stories: "Stories",
  media: "Media",
  files: "Files",
  links: "Links",
  music: "Music",
};

export const emptyTabLabel = (tab: InfoTab, isGroup: boolean) => {
  if (tab === "stories") return "No stories yet";
  if (tab === "members") return isGroup ? "No members in the loaded history" : "No members";
  return `No ${tabLabel[tab].toLowerCase()} in the loaded history`;
};
