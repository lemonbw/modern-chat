import { LuArrowLeft, LuSearch, LuX } from "react-icons/lu";
import { ContactAvatar } from "../../../features/contacts/ui/components/ContactAvatar";
import { lastSeenLabel } from "../../../shared/lib/lastSeen";
import { initialsOf } from "../../../pages/ChatPage/model/chatPageState";
import { contentGutter, contentInset, pageColumn } from "../lib/layout";
import { ChatHeaderMenu } from "./ChatHeaderMenu";
import { ChatSearchField, type ChatSearchModel } from "./ChatSearchField";

type Props = {
  chat: {
    id: string;
    name: string;
    initials: string;
    color: string;
    avatar?: string | null;
    group?: boolean;
    online?: boolean;
    lastSeen?: string | number | null;
    firstName?: string;
    lastName?: string;
  };
  archived: boolean;
  showDeletedMessages: boolean;
  onBack: () => void;
  onOpenInfo: () => void;
  onToggleArchive: () => void;
  onToggleDeletedMessages: () => void;
  search: ChatSearchModel;
  onJumpToMessage: (index: number) => void;
  menuOpen: boolean;
  setMenuOpen: (value: boolean) => void;
  _notificationsOff: boolean;
  // onToggleNotifications: () => void; // TODO: Re-enable when Green API supports per-chat notification state
};

/**
 * Title bar of the open chat: back, avatar, either the search field or the name, and the two
 * buttons. The search field and the overflow menu live in their own files.
 */
export const ChatHeader = ({
  chat,
  archived,
  showDeletedMessages,
  onBack,
  onOpenInfo,
  onToggleArchive,
  onToggleDeletedMessages,
  search,
  onJumpToMessage,
  menuOpen,
  setMenuOpen,
  _notificationsOff,
  // onToggleNotifications, // TODO: Re-enable when Green API supports per-chat notification state
}: Props) => {
  const closeMenu = () => setMenuOpen(false);
  return (
    <header className="z-[1] shrink-0 border-b border-[#202d39] bg-chat shadow-[0_1px_3px_#0002]">
      <div className={contentGutter}>
        <div className={`${pageColumn} ${contentInset} flex h-[62px] items-center max-[760px]:h-[58px]`}>
          <div className="flex w-full items-center gap-3">
            <button className="icon-button hidden max-[760px]:grid" aria-label="Back to conversations" onClick={onBack}>
              <LuArrowLeft className="size-[18px]" />
            </button>
            <button
              className="shrink-0 rounded-full border-0 bg-transparent p-0 hover:opacity-80"
              aria-label={`${chat.group ? "Group" : "User"} info for ${chat.name}`}
              title={`${chat.group ? "Group" : "User"} info`}
              onClick={onOpenInfo}
            >
              <ContactAvatar key={chat.id} chatId={chat.id} name={chat.firstName || chat.lastName ? [chat.firstName, chat.lastName].filter(Boolean).join(" ").trim() : chat.name} initials={chat.firstName || chat.lastName ? initialsOf([chat.firstName, chat.lastName].filter(Boolean).join(" ").trim()) : chat.initials} color={chat.color} avatar={chat.avatar} className="avatar avatar-small" />
            </button>
            {search.isOpen
              ? <ChatSearchField search={search} onJumpToMessage={onJumpToMessage} />
              : (
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-sm text-[#f1f5f7]">
                    {chat.firstName || chat.lastName
                      ? [chat.firstName, chat.lastName].filter(Boolean).join(" ").trim()
                      : chat.name}
                  </strong>
                  {!chat.group && (
                    <span className="text-caption text-[#8fa1ae]">
                      {chat.online ? "●  Online now" : lastSeenLabel(chat.lastSeen)}
                    </span>
                  )}
                </div>
              )}
            <button
              className="icon-button"
              aria-label={search.isOpen ? "Close search" : "Search messages"}
              title={search.isOpen ? "Close search" : "Search messages"}
              aria-expanded={search.isOpen}
              onClick={() => {
                if (search.isOpen) search.close();
                else search.open();
              }}
            >
              {search.isOpen ? <LuX className="size-[17px]" /> : <LuSearch className="size-[18px]" />}
            </button>
            <ChatHeaderMenu
              isOpen={menuOpen}
              archived={archived}
              _notificationsOff={_notificationsOff}
              showDeletedMessages={showDeletedMessages}
              onOpen={() => {
                search.close();
                setMenuOpen(!menuOpen);
              }}
              onToggleArchive={() => {
                onToggleArchive();
                closeMenu();
              }}
              onToggleDeletedMessages={() => {
                onToggleDeletedMessages();
                closeMenu();
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
};