import { memo } from "react";
import type { Conversation } from "../../../../entities/chat/types";
import { messageDateLabel } from "../../../../shared/lib/messageDate";
import { ContactAvatar } from "../../../contacts/ui/components/ContactAvatar";

/**
 * GREEN-API has no unread field, so the counter comes from the fetched history. When the unread run
 * reaches the end of that window the badge says "10+" instead of pretending 10 is the total.
 */
const unreadLabel = (unread?: number, truncated?: boolean) => {
  if (!unread) return "";
  if (unread > 99 || (truncated && unread >= 99)) return "99+";
  return truncated ? `${unread}+` : String(unread);
};

/** Muted chats keep the counter but lose the accent colour. */
const badgeColor = (muted?: boolean) => (muted ? "border-[#7f8f9e] text-[#7f8f9e]" : "border-chat-blue text-chat-blue");

type RowProps = {
  chat: Conversation;
  isSelected: boolean;
  onSelect: (id: string) => void;
};

/** One sidebar row, memoised because the list rerenders on every poll. */
const ChatRow = memo(({ chat, isSelected, onSelect }: RowProps) => {
  const badge = unreadLabel(chat.unread, chat.unreadTruncated);
  return <button
    className={`flex w-full items-center gap-3 rounded-[9px] border-0 bg-transparent p-2.5 text-left text-inherit hover:bg-[#202d39] ${isSelected ? "bg-[#2b5278]" : ""}`}
    onClick={() => onSelect(chat.id)}
  >
    <ContactAvatar chatId={chat.id} name={chat.name} initials={chat.initials} color={chat.color} avatar={chat.avatar} />
    <span className="min-w-0 flex-1">
      <span className="flex items-center justify-between gap-2">
        <span className="overflow-hidden text-ellipsis whitespace-nowrap text-control font-semibold text-[#edf4f8]">{chat.name}</span>
        <span className="shrink-0 text-2xs text-chat-muted">{chat.time}</span>
      </span>
      <span className="mt-[5px] block overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] text-[#a6b3bd]">{chat.group && chat.sender ? <span className="text-[#7f8f9e]">{chat.sender}: </span> : null}{chat.preview}</span>
      <span className="mt-[5px] flex items-center justify-between gap-2">
        <span className="truncate text-2xs text-[#7f8f9e]">{chat.lastTimestamp ? messageDateLabel(chat.lastTimestamp) : ""}</span>
        {badge ? <span className={`grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full border-[1.5px] px-[5px] text-[9px] font-semibold leading-none ${badgeColor(chat.notificationsOff)}`} aria-label={`${badge} unread`}>{badge}</span> : null}
      </span>
    </span>
  </button>;
});

export const ChatList = ({ chats, selected, onSelect, loading = false }: { chats: Conversation[]; selected: string | null; onSelect: (id: string) => void; loading?: boolean }) => {
  const conversations = chats.filter((chat) => chat.hasConversation !== false);
  return <div className="overflow-auto px-1.5 py-1">
    {conversations.map((chat) => <ChatRow key={chat.id} chat={chat} isSelected={selected === chat.id} onSelect={onSelect} />)}
    {conversations.length === 0 && <div className="px-3 py-6 text-center text-xs text-[#8697a5]">{loading ? "Checking conversations…" : "No chats found"}</div>}
  </div>;
};