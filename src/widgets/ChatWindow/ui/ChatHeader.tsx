import { ContactAvatar } from "../../../features/contacts/ui/components/ContactAvatar";
import { lastSeenLabel } from "../../../shared/lib/lastSeen";
import { messageDateLabel } from "../../../shared/lib/messageDate";
import { chatBarColumn, contentGutter } from "../lib/layout";

type Props = {
  chat: { id: string; name: string; initials: string; color: string; avatar?: string | null; group?: boolean; online?: boolean; lastSeen?: string | number | null };
  archived: boolean;
  showDeletedMessages: boolean;
  onBack: () => void;
  onOpenInfo: () => void;
  onToggleArchive: () => void;
  onToggleDeletedMessages: () => void;
  search: { isOpen: boolean; query: string; setQuery: (value: string) => void; normalized: string; results: { message: { text: string; timestamp?: number; time: string }; index: number }[]; open: () => void; close: () => void };
  onJumpToMessage: (index: number) => void;
  menuOpen: boolean;
  setMenuOpen: (value: boolean) => void;
};

/** The chat bar: avatar button that opens the info panel, title or in-chat search field, and the menu. */
export const ChatHeader = ({ chat, archived, showDeletedMessages, onBack, onOpenInfo, onToggleArchive, onToggleDeletedMessages, search, onJumpToMessage, menuOpen, setMenuOpen }: Props) => (
  <header className="z-[1] shrink-0 border-b border-[#202d39] bg-chat shadow-[0_1px_3px_#0002]">
    <div className={`${contentGutter} flex h-[62px] items-center max-[760px]:h-[58px]`}>
      <div className={`${chatBarColumn} flex items-center gap-3`}>
        <button className="icon-button hidden max-[760px]:grid" aria-label="Back to conversations" onClick={onBack}>←</button>
        <button
          className="shrink-0 rounded-full border-0 bg-transparent p-0 hover:opacity-80"
          aria-label={`${chat.group ? "Group" : "User"} info for ${chat.name}`}
          title={`${chat.group ? "Group" : "User"} info`}
          onClick={onOpenInfo}
        >
          <ContactAvatar key={chat.id} chatId={chat.id} name={chat.name} initials={chat.initials} color={chat.color} avatar={chat.avatar} className="avatar avatar-small" />
        </button>
        {search.isOpen ? (
          <div className="relative flex min-w-0 flex-1 items-center gap-2 rounded-[9px] bg-[#202b36] py-[7px] pr-2 pl-2.5">
            <span className="shrink-0 text-sm text-[#8fa1ae]" aria-hidden="true">⌕</span>
            <input
              autoFocus
              type="search"
              aria-label="Search messages in this chat"
              placeholder="Search in this chat…"
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[#e5edf3] outline-none placeholder:text-[#8d9eaa]"
              value={search.query}
              onChange={(event) => search.setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Escape") search.close(); }}
            />
            {search.normalized && (
              <div className="absolute top-full right-0 left-0 z-20 mt-1 rounded-lg border border-chat-border bg-[#1c2934] p-2 shadow-xl">
                <p className="px-1 pb-1 text-[11px] text-[#8fa1ae]">{search.results.length} found</p>
                <div className="max-h-64 overflow-auto">
                  {search.results.map(({ message, index }) => (
                    <button key={`${index}-${message.time}`} className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-[#253441]" onClick={() => onJumpToMessage(index)}>
                      <span className="line-clamp-2 block text-xs text-[#d7e2e9]">{message.text}</span>
                      <span className="mt-0.5 block text-[10px] text-[#8fa1ae]">{messageDateLabel(message.timestamp)} · {message.time}</span>
                    </button>
                  ))}
                  {search.results.length === 0 && <p className="px-2 py-2 text-xs text-[#8fa1ae]">Nothing found</p>}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-sm text-[#f1f5f7]">{chat.name}</strong>
            {!chat.group && <span className="text-caption text-[#8fa1ae]">{chat.online ? "●  Online now" : lastSeenLabel(chat.lastSeen)}</span>}
          </div>
        )}
        <button
          className="icon-button"
          aria-label={search.isOpen ? "Close search" : "Search messages"}
          title={search.isOpen ? "Close search" : "Search messages"}
          aria-expanded={search.isOpen}
          onClick={() => { if (search.isOpen) search.close(); else search.open(); }}
        >
          {search.isOpen ? "×" : "⌕"}
        </button>
        <div className="relative">
          <button className="icon-button" aria-label="More options" onClick={() => { search.close(); setMenuOpen(!menuOpen); }}>⋯</button>
          {menuOpen && (
            <div className="absolute top-11 right-0 z-10 w-56 rounded-lg border border-chat-border bg-[#1c2934] p-1.5 shadow-xl">
              <button className="block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-[#2a3946]" onClick={() => { onToggleArchive(); setMenuOpen(false); }}>{archived ? "Unarchive chat" : "Archive chat"}</button>
              <button className="block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-[#2a3946]" onClick={() => { onToggleDeletedMessages(); setMenuOpen(false); }}>{showDeletedMessages ? "Hide deleted messages" : "Show deleted messages"}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  </header>
);