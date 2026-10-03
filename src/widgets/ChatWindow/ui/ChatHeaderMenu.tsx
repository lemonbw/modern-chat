import { memo } from "react";
import { LuEllipsisVertical } from "react-icons/lu";

type Props = {
  isOpen: boolean;
  archived: boolean;
  _notificationsOff: boolean;
  showDeletedMessages: boolean;
  onOpen: () => void;
  onToggleArchive: () => void;
  // onToggleNotifications: () => void; // TODO: Re-enable when Green API supports per-chat notification state
  onToggleDeletedMessages: () => void;
};

/** The overflow menu of the header: archive, notifications and deleted messages. */
export const ChatHeaderMenu = memo(({ isOpen, archived, /* _notificationsOff, */ showDeletedMessages, onOpen, onToggleArchive, onToggleDeletedMessages }: Props) => (
  <div className="relative">
    <button className="icon-button" aria-label="More options" onClick={onOpen}>
      <LuEllipsisVertical className="size-[18px]" />
    </button>
    {isOpen && (
      <div className="absolute top-11 right-0 z-10 w-56 rounded-lg border border-chat-border bg-[#1c2934] p-1.5 shadow-xl">
        <button
          className="block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-[#2a3946]"
          onClick={onToggleArchive}
        >
          {archived ? "Unarchive chat" : "Archive chat"}
        </button>
        {/* <button
          className="block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-[#2a3946]"
          onClick={onToggleNotifications}
        >
          {notificationsOff ? "Turn notifications on" : "Turn notifications off"}
        </button> */}
        <button
          className="block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-[#2a3946]"
          onClick={onToggleDeletedMessages}
        >
          {showDeletedMessages ? "Hide deleted messages" : "Show deleted messages"}
        </button>
      </div>
    )}
  </div>
));