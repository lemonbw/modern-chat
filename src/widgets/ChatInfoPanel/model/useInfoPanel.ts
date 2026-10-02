import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, Conversation } from "../../../entities/chat/types";
import { useContactDetails } from "./useContactDetails";
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
  phone: string | number | undefined;
  username: string | undefined;
  detailsFromChatList: boolean;
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

export const useInfoPanel = (chat: Conversation, messages: ChatMessage[]): InfoPanelModel => {
  const [stored, setStored] = useState<LocalProfile | null>(null);
  const chatIdRef = useRef(chat.id);

  useEffect(() => {
    const chatId = chat.id;
    chatIdRef.current = chatId;
    let isMounted = true;
    void readLocalProfile(chatId).then((profile) => { if (isMounted) setStored(profile); }).catch(() => { if (isMounted) setStored(null); });
    return () => { isMounted = false; };
  }, [chat.id]);
  const [tab, setTab] = useState<InfoTab>(chat.group ? "members" : "stories");
  const [openedTab, setOpenedTab] = useState<InfoTab | null>(null);
  const [isAvatarExpanded, setIsAvatarExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showPhotos, setShowPhotos] = useState(true);
  const [showVideos, setShowVideos] = useState(true);
  const [visibleCount, setVisibleCount] = useState(firstPageSize);

  const isGroup = chat.group === true;

  const details = useContactDetails(chat);
  const { contact, group } = details;

  const members = useMemo(() => buildMembers(messages), [messages]);
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
    void writeLocalProfile(chatIdRef.current, next);
  }, []);

  const displayName = [stored?.firstName, stored?.lastName].filter(Boolean).join(" ").trim() || chat.name;
  // getChats and getContacts already carry the phone and username.
  const phone = contact?.phoneNumber ?? chat.phoneNumber;
  const username = contact?.username ?? chat.username;
  // getContactInfo is limited to about a hundred calls a month, so the panel may show list data.
  const detailsFromChatList = !isGroup && contact === null;

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
    members, totalMembers, displayName, lastSeenText, phone, username, detailsFromChatList,
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