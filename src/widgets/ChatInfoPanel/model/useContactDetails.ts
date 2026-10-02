import { useEffect, useState } from "react";
import type { Conversation } from "../../../entities/chat/types";
import { getContactInfo, getGroupData, type GreenApiContactInfo, type GreenApiGroupData } from "../../../features/contacts/api/greenApiContacts";

/**
 * The contact card or the group card of the open chat. Both calls sit behind the quota guard, so they
 * may never arrive at all: the panel then falls back to what the chat list already knows and says so.
 */
export const useContactDetails = (chat: Conversation) => {
  const [contact, setContact] = useState<GreenApiContactInfo | null>(null);
  const [group, setGroup] = useState<GreenApiGroupData | null>(null);
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

  return { contact, group, isGroup };
};