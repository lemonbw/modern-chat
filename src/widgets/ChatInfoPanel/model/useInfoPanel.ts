import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChatMessage, Conversation } from "../../../entities/chat/types";
import { getContactInfo, getGroupData } from "../../../features/contacts/api/greenApiContacts";
import type { GreenApiContactInfo, GreenApiGroupData } from "../../../features/contacts/api/greenApiContacts";
import { buildMembers, buildTabItems, groupTabs, userTabs, type InfoTab } from "../../../features/contacts/model/chatInfo";
import { emptyProfile, readLocalProfile, writeLocalProfile, type LocalProfile } from "../../../features/contacts/model/localProfile";

export const firstPageSize = 9;
const pageStep = 12;
const previewTiles = 6;

export type InfoPanelModel = {
  contact: GreenApiContactInfo | null;
  group: GreenApiGroupData | null;
  stored: LocalProfile | null;
  tabs: InfoTab[];
  tab: InfoTab;
  openedTab: InfoTab | null;
  activeTab: InfoTab;
  items: ReturnType<typeof buildTabItems>;
  visibleItems: ReturnType<typeof buildTabItems>;
  members: ReturnType<typeof buildMembers>;
  totalMembers: number;
  displayName: string;
  lastSeenText: string;
  isAvatarExpanded: boolean;
  isEditing: boolean;
  isFilterOpen: boolean;
  showPhotos: boolean;
  showVideos: boolean;
  isPreview: boolean;
  selectTab: (tab: InfoTab) => void;
  openTab: () => void;
  closeTab: () => void;
  toggleAvatar: () => void;
  toggleEditing: () => void;
  toggleFilter: () => void;
  setShowPhotos: (value: boolean) => void;
  setShowVideos: (value: boolean) => void;
  loadMore: () => void;
  persist: (profile: LocalProfile) => void;
  setNotifications: (value: boolean) => void;
};

/** State of the info panel: which source is loaded, the tab, the media filter and local edits. */
export const useInfoPanel = (chat: Conversation, messages: ChatMessage[]): InfoPanelModel => {
  const [contact, setContact] = useState<GreenApiContactInfo | null>(null);
  const [group, setGroup] = useState<GreenApiGroupData | null>(null);
  const [stored, setStored] = useState<LocalProfile | null>(() => readLocalProfile(chat.id));
  const [tab, setTab] = useState<InfoTab>(chat.group ? "members" : "stories");
  const [openedTab, setOpenedTab] = useState<InfoTab | null>(null);
  const [isAvatarExpanded, setIsAvatarExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showPhotos, setShowPhotos] = useState(true);
  const [showVideos, setShowVideos] = useState(true);
  const [visibleCount, setVisibleCount] = useState(firstPageSize);

  const isGroup = chat.group === true;

  useEffect(() => {
    let isMounted = true;
    const request = isGroup
      ? getGroupData(chat.id).then((data) => { if (isMounted) setGroup(data); }).catch(() => { if (isMounted) setGroup(null); })
      : getContactInfo(chat.id).then((data) => { if (isMounted) setContact(data); }).catch(() => { if (isMounted) setContact(null); });
    void request;
    return () => { isMounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const members = useMemo(() => buildMembers(messages), [messages]);
  // The API reports the real participant count; the history-derived list only fills the tab.
  const totalMembers = group?.size ?? members.length;

  const items = useMemo(
    () => (isGroup && tab === "members" ? members : buildTabItems(messages, tab, { showPhotos, showVideos })),
    [isGroup, members, messages, showPhotos, showVideos, tab],
  );

  const selectTab = useCallback((next: InfoTab) => {
    setTab(next);
    setOpenedTab(null);
    setVisibleCount(firstPageSize);
  }, []);

  const openTab = useCallback(() => {
    setVisibleCount(firstPageSize);
    setOpenedTab(tab);
  }, [tab]);

  const persist = useCallback((next: LocalProfile) => {
    setStored(next);
    writeLocalProfile(chat.id, next);
  }, [chat.id]);

  const displayName = [stored?.firstName, stored?.lastName].filter(Boolean).join(" ").trim() || chat.name;

  const lastSeenText = isGroup
    ? `${totalMembers} ${totalMembers === 1 ? "member" : "members"}`
    : chat.online ? "Online now"
      : contact?.lastSeen ? String(contact.lastSeen) : "";

  const isPreview = openedTab === null;

  return {
    contact, group, stored,
    tabs: isGroup ? groupTabs : userTabs,
    tab, openedTab, activeTab: openedTab ?? tab,
    items,
    visibleItems: isPreview ? items.slice(0, previewTiles) : items.slice(0, visibleCount),
    members, totalMembers, displayName, lastSeenText,
    isAvatarExpanded, isEditing, isFilterOpen, showPhotos, showVideos, isPreview,
    selectTab,
    openTab,
    closeTab: () => setOpenedTab(null),
    toggleAvatar: () => setIsAvatarExpanded((value) => !value),
    toggleEditing: () => setIsEditing((value) => !value),
    toggleFilter: () => setIsFilterOpen((value) => !value),
    setShowPhotos,
    setShowVideos,
    loadMore: () => setVisibleCount((count) => Math.min(count + pageStep, items.length)),
    persist,
    setNotifications: (value) => persist({ ...emptyProfile(), ...(stored ?? {}), notifications: value }),
  };
};