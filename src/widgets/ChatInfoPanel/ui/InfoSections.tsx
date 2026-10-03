import { LuPlay } from "react-icons/lu";
import type { Conversation } from "../../../entities/chat/types";
import { ContactAvatar } from "../../../features/contacts/ui/components/ContactAvatar";
import type { InfoItem } from "../../../features/contacts/model/chatInfo";
import { InfoRow } from "./InfoPrimitives";
import { lastSeenTextOf } from "../model/infoValues";

export const ProfileSummary = ({ chat, displayName, lastSeenText, avatar, isExpanded, onToggleAvatar }: {
  chat: Conversation;
  displayName: string;
  lastSeenText: string;
  avatar: string | null;
  isExpanded: boolean;
  onToggleAvatar: () => void;
}) => (
  <section className="flex flex-col items-center gap-2 px-4 pt-6 pb-4 text-center">
    <button
      type="button"
      className={`overflow-hidden border-0 bg-transparent p-0 transition-all ${isExpanded ? "w-[180px] rounded-xl" : "size-[96px] rounded-full"}`}
      aria-label={isExpanded ? "Shrink avatar" : "Expand avatar"}
      aria-expanded={isExpanded}
      onClick={onToggleAvatar}
    >
      <ContactAvatar chatId={chat.id} name={displayName} initials={chat.initials} color={chat.color} avatar={avatar} className="size-full" />
    </button>
    <strong className="mt-1 text-base text-[#f1f5f7]">{displayName}</strong>
    <span className="text-xs text-[#8fa1ae]">{chat.group ? lastSeenText : lastSeenTextOf(lastSeenText)}</span>
  </section>
);

export const ProfileDetails = ({ isGroup, phone, username, link, about, /* _notificationsOn, */ _detailsFromChatList, /* _onToggleNotifications */ }: {
  isGroup: boolean;
  phone: string;
  username: string;
  link?: string;
  about?: string;
  /* _notificationsOn: boolean; */
  _detailsFromChatList?: boolean;
  /* _onToggleNotifications: (value: boolean) => void; */
}) => (
  <section className="flex flex-col gap-3 px-4 pb-4 text-sm">
    <InfoRow label="Phone" value={phone} />
    <InfoRow label="Username" value={username} />
    {isGroup && <InfoRow label="Link" value={link} />}
    {isGroup && <InfoRow label="About" value={about} />}
    {_detailsFromChatList && (
      <p className="-mt-1 rounded-[8px] bg-[#1b2734] px-2.5 py-1.5 text-2xs leading-4 text-[#8fa1ae]">
        Name, phone and username come from the chat list: getContactInfo was not called, its monthly quota is spent.
      </p>
    )}
    {/* <div className="flex items-center justify-between gap-3">
      <span className="text-[#8fa1ae]">Notifications</span>
      <Toggle checked={_notificationsOn} onChange={_onToggleNotifications} label="Toggle notifications" />
    </div> */}
  </section>
);

export const ItemTile = ({ item, onOpen }: { item: InfoItem; onOpen: () => void }) => (
  <button type="button" onClick={onOpen} className="group relative aspect-square overflow-hidden rounded-md border-0 bg-[#1b2734] p-0 text-left hover:brightness-110">
    {item.thumbnail || item.url
      ? <img src={item.thumbnail ?? item.url} alt={item.title} loading="lazy" decoding="async" className="size-full object-cover" />
      : <span className="grid size-full place-items-center p-2 text-center text-[11px] text-[#a6b3bd]">{item.title}</span>}
    {item.kind === "video" && <span className="absolute inset-0 grid place-items-center text-white/90" aria-hidden="true"><LuPlay className="size-[18px]" /></span>}
  </button>
);