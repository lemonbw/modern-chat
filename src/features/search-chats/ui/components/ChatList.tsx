import type { Conversation } from "../../../../entities/chat/types";
import { messageDateLabel } from "../../../../shared/lib/messageDate";
import { ContactAvatar } from "../../../contacts/ui/components/ContactAvatar";

const unreadLabel = (unread?: number) => (!unread ? "" : unread > 99 ? "99+" : String(unread));

export const ChatList = ({ chats, selected, onSelect, loading = false }: { chats: Conversation[]; selected: string | null; onSelect: (id: string) => void; loading?: boolean }) => {
  const conversations = chats.filter((chat) => chat.hasConversation !== false);
  return <div className="overflow-auto px-1.5 py-1">
    {conversations.map((chat) => {
      const badge = unreadLabel(chat.unread);
      return <button key={chat.id} className={`flex w-full items-center gap-3 rounded-[9px] border-0 bg-transparent p-2.5 text-left text-inherit hover:bg-[#202d39] ${selected === chat.id ? "bg-[#2b5278]" : ""}`} onClick={() => onSelect(chat.id)}>
      <ContactAvatar chatId={chat.id} name={chat.name} initials={chat.initials} color={chat.color} avatar={chat.avatar} />
      <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="overflow-hidden text-ellipsis whitespace-nowrap text-control font-semibold text-[#edf4f8]">{chat.name}</span><span className="shrink-0 text-2xs text-chat-muted">{chat.time}</span></span>
        <span className="mt-[5px] block overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] text-[#a6b3bd]">{chat.preview}</span>
        <span className="mt-[5px] flex items-center justify-between gap-2"><span className="truncate text-2xs text-[#7f8f9e]">{chat.lastTimestamp ? messageDateLabel(chat.lastTimestamp) : ""}</span>{badge ? <span className="grid size-[18px] shrink-0 place-items-center rounded-full border-[1.5px] border-chat-blue text-[9px] font-semibold leading-none text-chat-blue">{badge}</span> : null}</span>
      </span>
    </button>;
    })}
    {conversations.length === 0 && <div className="px-3 py-6 text-center text-xs text-[#8697a5]">{loading ? "Checking conversations…" : "No chats found"}</div>}
  </div>;
};
