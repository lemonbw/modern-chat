import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { ChatMessage, Conversation } from "../../entities/chat/types";
import { ContactAvatar } from "../../features/contacts/ui/components/ContactAvatar";
import { MessageMedia } from "../../features/messages/ui/MessageMedia";

const lastSeenLabel = (value?: string | number | null) => {
  if (value === null || value === undefined || value === "" || value === 0) return "Last seen hidden";
  const normalized = value.toString().toLowerCase().replace(/[\s_-]/g, "");
  if (normalized === "online") return "Online now";
  if (normalized === "recently" || normalized === "lastseenrecently") return "Last seen recently";
  if (normalized === "lastweek" || normalized === "lastseenwithinweek") return "Last seen within a week";
  if (normalized === "lastmonth" || normalized === "lastseenwithinmonth") return "Last seen within a month";
  if (normalized === "alongtimeago" || normalized === "lastseenalongtimeago") return "Last seen a long time ago";
  const numericValue = Number(value);
  const date = new Date(Number.isFinite(numericValue) ? (numericValue < 100_000_000_000 ? numericValue * 1000 : numericValue) : value);
  if (Number.isNaN(date.getTime())) return "Online status hidden";
  return `Last seen ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date)}`;
};
export const ChatWindow = ({
  chat,
  messages,
  isLoadingMessages,
  hasMoreMessages,
  isLoadingOlderMessages,
  onLoadOlderMessages,
  onSend,
  onBack,
  onToggleArchive,
  onDeleteMessage,
  onToggleDeletedMessages,
  onForwardMessage,
  forwardingTargets,
  showDeletedMessages,
  archived,
  error,
}: {
  chat: Conversation;
  messages: ChatMessage[];
  isLoadingMessages: boolean;
  hasMoreMessages: boolean;
  isLoadingOlderMessages: boolean;
  onLoadOlderMessages: () => void;
  onSend: (text: string, quotedMessage?: ChatMessage) => void;
  onBack: () => void;
  onToggleArchive: () => void;
  onDeleteMessage: (message: ChatMessage, onlySenderDelete: boolean) => Promise<void>;
  onToggleDeletedMessages: () => void;
  onForwardMessage: (message: ChatMessage, destinationChatId: string) => Promise<void>;
  forwardingTargets: Conversation[];
  showDeletedMessages: boolean;
  archived: boolean;
  error: string | null;
}) => {
  const [draft, setDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ message: ChatMessage; left: number; top: number } | null>(null);
  const [replyMessage, setReplyMessage] = useState<ChatMessage | null>(null);
  const [forwardMessage, setForwardMessage] = useState<ChatMessage | null>(null);
  const [forwardError, setForwardError] = useState("");
  const [forwarding, setForwarding] = useState(false);
  const [deletingMessage, setDeletingMessage] = useState<ChatMessage | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = useRef(true);
  const olderScrollAnchor = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const renderedChatId = useRef(chat.id);

  useLayoutEffect(() => {
    const messageList = messagesRef.current;
    if (!messageList) return;
    if (renderedChatId.current !== chat.id) {
      renderedChatId.current = chat.id;
      scrollToBottom.current = true;
      olderScrollAnchor.current = null;
    }
    if (olderScrollAnchor.current) {
      const anchor = olderScrollAnchor.current;
      messageList.scrollTop = anchor.scrollTop + (messageList.scrollHeight - anchor.scrollHeight);
      olderScrollAnchor.current = null;
      return;
    }
    if (scrollToBottom.current) messageList.scrollTop = messageList.scrollHeight;
  }, [chat.id, messages.length, isLoadingMessages]);

  useEffect(() => {
    if (!isLoadingOlderMessages && olderScrollAnchor.current) olderScrollAnchor.current = null;
  }, [isLoadingOlderMessages]);

  const openMessageMenu = (event: ReactMouseEvent<HTMLDivElement>, message: ChatMessage) => {
    if (!message.id || message.deleted) return;
    event.preventDefault();
    setContextMenu({
      message,
      left: Math.min(event.clientX, window.innerWidth - 190),
      top: Math.min(event.clientY, window.innerHeight - 150),
    });
  };

  const chooseDeleteScope = async (onlySenderDelete: boolean) => {
    if (!deletingMessage) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await onDeleteMessage(deletingMessage, onlySenderDelete);
      setDeletingMessage(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete message");
    } finally {
      setDeleting(false);
    }
  };

  const startReply = (message: ChatMessage) => {
    setReplyMessage(message);
    setContextMenu(null);
    inputRef.current?.focus();
  };

  const startForward = (message: ChatMessage) => {
    setForwardMessage(message);
    setForwardError("");
    setContextMenu(null);
  };

  const forwardToChat = async (chatId: string) => {
    if (!forwardMessage) return;
    setForwarding(true);
    setForwardError("");
    try {
      await onForwardMessage(forwardMessage, chatId);
      setForwardMessage(null);
    } catch (error) {
      setForwardError(error instanceof Error ? error.message : "Could not forward message");
    } finally {
      setForwarding(false);
    }
  };
  const loadOlderAtTop = (scrollHeight: number, scrollTop: number) => {
    if (!hasMoreMessages || isLoadingOlderMessages || olderScrollAnchor.current) return;
    olderScrollAnchor.current = { scrollHeight, scrollTop };
    scrollToBottom.current = false;
    onLoadOlderMessages();
  };
  const visibleMessages = messages.filter((message) => showDeletedMessages || !message.deleted);
  return (
    <section className="flex min-w-0 flex-1 flex-col bg-chat-deep max-[760px]:hidden" onClick={() => { if (contextMenu) setContextMenu(null); }}>
      <header className="z-[1] flex h-[62px] shrink-0 items-center gap-3 border-b border-[#202d39] bg-chat px-5 shadow-[0_1px_3px_#0002] max-[760px]:h-[58px] max-[760px]:px-[9px]">
        <button
          className="icon-button hidden max-[760px]:grid"
          aria-label="Back to conversations"
          onClick={onBack}
        >
          ←
        </button>
        <ContactAvatar key={chat.id} chatId={chat.id} name={chat.name} initials={chat.initials} color={chat.color} avatar={chat.avatar} className="avatar avatar-small" />
        <div className="flex-1">
          <strong className="block text-sm text-[#f1f5f7]">{chat.name}</strong>
          {!chat.group && <span className="text-caption text-[#8fa1ae]">{chat.online ? "●  Online now" : lastSeenLabel(chat.lastSeen)}</span>}
        </div>
        <div className="relative"><button className="icon-button" aria-label="More options" onClick={() => setMenuOpen((open) => !open)}>⋯</button>{menuOpen && <div className="absolute top-11 right-0 z-10 w-56 rounded-lg border border-chat-border bg-[#1c2934] p-1.5 shadow-xl"><button className="block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-[#2a3946]" onClick={() => { onToggleArchive(); setMenuOpen(false); }}>{archived ? "Unarchive chat" : "Archive chat"}</button><button className="block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-[#2a3946]" onClick={() => { onToggleDeletedMessages(); setMenuOpen(false); }}>{showDeletedMessages ? "Hide deleted messages" : "Show deleted messages"}</button></div>}</div>
      </header>
      {error && <p role="alert" className="border-b border-red-900/60 bg-red-950/40 px-5 py-2 text-xs text-red-200">{error}</p>}
      <div ref={messagesRef} onScroll={(event) => {
        const list = event.currentTarget;
        scrollToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
        if (list.scrollTop <= 32) loadOlderAtTop(list.scrollHeight, list.scrollTop);
      }} onWheel={(event) => {
        const list = event.currentTarget;
        if (event.deltaY < 0 && list.scrollTop <= 32) loadOlderAtTop(list.scrollHeight, list.scrollTop);
      }} className="message-wallpaper flex flex-1 flex-col gap-[9px] overflow-auto pl-[7px] pr-[clamp(20px,6vw,90px)] py-6 max-[760px]:px-3 max-[760px]:py-[17px]">
        {hasMoreMessages && <button type="button" className="sticky top-0 z-[1] min-h-5 self-center rounded-full bg-[#182532d9] px-2 py-1 text-[10px] text-[#9aabb7] hover:text-white disabled:opacity-70" disabled={isLoadingOlderMessages} onClick={() => {
          const list = messagesRef.current;
          if (list) loadOlderAtTop(list.scrollHeight, list.scrollTop);
        }}>{isLoadingOlderMessages ? "Loading older messages…" : "Load earlier messages"}</button>}
        <div className="my-[1px] mb-[9px] self-center rounded-[14px] bg-[#182532d9] px-[11px] py-[5px] text-caption text-[#d3dde4] shadow-[0_1px_4px_#0003]">
          Today
        </div>
        {messages.length === 0 && <p className="self-start px-1 text-xs text-[#9aabb7]">{isLoadingMessages ? "Loading messages…" : "No messages yet"}</p>}
        {messages.length > 0 && visibleMessages.length === 0 && <p className="self-start px-1 text-xs text-[#9aabb7]">Deleted messages are hidden</p>}
        {visibleMessages.map((message, index) => (
          <div
            key={message.id ?? `${message.time}-${index}-${message.text}`}
            onContextMenu={(event) => openMessageMenu(event, message)}
            className={`max-w-[min(72%,560px)] self-start break-words [overflow-wrap:anywhere] whitespace-pre-wrap rounded-[10px_10px_10px_2px] bg-[#182533] px-[11px] pt-2 pb-1.5 text-control leading-[1.48] text-[#e5edf3] shadow-[0_1px_2px_#0003] max-[760px]:max-w-[87%] ${message.mine ? "self-end rounded-[10px_10px_2px_10px] bg-[#2b5278]" : ""}`}
          >
            {message.quotedText && <div className="mb-1.5 border-l-2 border-chat-blue pl-2 text-xs text-[#b5d5e6]">{message.quotedText}</div>}
            {message.deleted ? <span className="italic text-[#a3b1ba]">{message.text}</span> : message.media ? <><MessageMedia media={message.media} alt={message.media.caption || message.media.fileName || `${message.media.kind} message`} />{message.media.caption && <span className="block whitespace-pre-wrap">{message.media.caption}</span>}</> : message.text}
            <div
              className={`mt-[3px] flex items-center justify-end gap-1 text-micro text-[#8fa1ae] ${message.mine ? "text-[#8bc7e8]" : ""}`}
            >
              {message.time}
              {message.id && !message.deleted && message.mine && <button className="ml-1 text-[#8fa1ae] hover:text-red-300" aria-label="Delete message" title="Delete message" onClick={() => { setDeleteError(""); setDeletingMessage(message); }}>×</button>}
              {message.mine && message.status && <span aria-label={message.status} title={{ sending: "Sending", sent: "Sent", delivered: "Delivered, not read", read: "Read", failed: "Not sent" }[message.status]} style={{ color: message.status === "read" ? "#53bdeb" : message.status === "failed" ? "#fca5a5" : "#b7c3cc" }}>{message.status === "sending" ? "◷" : message.status === "failed" ? "!" : message.status === "sent" ? "✓" : "✓✓"}</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-[#202d39] bg-chat pl-[7px] pr-[clamp(20px,6vw,90px)] pt-3 pb-[15px] max-[760px]:px-3 max-[760px]:pt-2 max-[760px]:pb-[calc(8px+env(safe-area-inset-bottom))]">
        {replyMessage && <div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-chat-blue bg-[#202b36] px-3 py-2 text-xs"><span className="min-w-0 flex-1 truncate text-[#b9c7d0]">Replying to: {replyMessage.text}</span><button type="button" className="text-[#9aabb7] hover:text-white" aria-label="Cancel reply" onClick={() => setReplyMessage(null)}>×</button></div>}
        <form className="flex min-h-[46px] w-full items-center gap-[5px] rounded-[9px] border border-[#253441] bg-[#202b36] py-[3px] pr-1.5 pl-2" onSubmit={(event) => { event.preventDefault(); if (draft.trim()) { onSend(draft.trim(), replyMessage ?? undefined); setDraft(""); setReplyMessage(null); } }}>
          <input
            ref={inputRef}
            className="min-w-0 flex-1 border-0 bg-transparent text-control text-[#e3edf3] outline-none placeholder:text-[#8d9eaa]"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a message..."
            aria-label="Write a message"
          />
          <button
            className="h-[35px] w-[38px] rounded-full border-0 bg-chat-blue text-base text-white hover:bg-[#179cde]"
            type="submit"
            aria-label="Send message"
          >
            ➤
          </button>
        </form>
      </div>
      {contextMenu && <div role="menu" className="fixed z-30 w-44 rounded-lg border border-chat-border bg-[#1c2934] p-1.5 shadow-xl" style={{ left: contextMenu.left, top: contextMenu.top }} onClick={(event) => event.stopPropagation()}>
        <button role="menuitem" className="block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-[#2a3946] disabled:opacity-40" disabled={!contextMenu.message.id} onClick={() => startReply(contextMenu.message)}>Reply to this message</button>
        <button role="menuitem" className="block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-[#2a3946] disabled:opacity-40" disabled={!contextMenu.message.id} onClick={() => startForward(contextMenu.message)}>Forward</button>
        <button role="menuitem" className="block w-full rounded-md px-3 py-2 text-left text-xs text-red-300 hover:bg-[#2a3946]" onClick={() => { setDeleteError(""); setDeletingMessage(contextMenu.message); setContextMenu(null); }}>Delete</button>
      </div>}
      {deletingMessage && <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setDeletingMessage(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="delete-message-title" className="w-full max-w-sm rounded-xl border border-chat-border bg-chat p-4 text-[#e5edf3] shadow-2xl">
          <div className="mb-3 flex items-center justify-between"><h2 id="delete-message-title" className="font-semibold">Delete message</h2><button type="button" className="icon-button" aria-label="Close" disabled={deleting} onClick={() => setDeletingMessage(null)}>×</button></div>
          <p className="mb-3 line-clamp-2 rounded-lg bg-[#202b36] p-2 text-xs text-[#aebdc7]">{deletingMessage.text}</p>
          {!deletingMessage.mine && <p className="mb-2 text-xs text-amber-200">Telegram API only allows deleting messages sent from this account.</p>}
          <div className="grid gap-1">
            <button type="button" className="rounded-md px-3 py-2 text-left text-sm hover:bg-[#2a3946] disabled:opacity-40" disabled={deleting || !deletingMessage.mine} onClick={() => void chooseDeleteScope(false)}>Delete for everyone</button>
            <button type="button" className="rounded-md px-3 py-2 text-left text-sm hover:bg-[#2a3946] disabled:opacity-40" disabled={deleting || !deletingMessage.mine} onClick={() => void chooseDeleteScope(true)}>Delete for me</button>
          </div>
          {deletingMessage.mine && <p className="mt-2 text-[11px] text-[#91a2ae]">Deleting for me keeps the message for other participants. Deleting for everyone removes it from the chat.</p>}
          {deleteError && <p role="alert" className="mt-2 text-xs text-red-300">{deleteError}</p>}
          <button type="button" className="mt-3 w-full rounded-md px-3 py-2 text-xs text-[#aebdc7] hover:bg-[#2a3946]" disabled={deleting} onClick={() => setDeletingMessage(null)}>Cancel</button>
        </section>
      </div>}
      {forwardMessage && <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !forwarding) setForwardMessage(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="forward-message-title" className="w-full max-w-sm rounded-xl border border-chat-border bg-chat p-4 text-[#e5edf3] shadow-2xl">
          <div className="mb-3 flex items-center justify-between"><h2 id="forward-message-title" className="font-semibold">Forward message</h2><button type="button" className="icon-button" aria-label="Close" disabled={forwarding} onClick={() => setForwardMessage(null)}>×</button></div>
          <p className="mb-3 line-clamp-2 rounded-lg bg-[#202b36] p-2 text-xs text-[#aebdc7]">{forwardMessage.text}</p>
          <div className="max-h-64 overflow-auto">{forwardingTargets.filter((target) => target.id !== chat.id).map((target) => <button key={target.id} type="button" className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[#2a3946] disabled:opacity-50" disabled={forwarding || !forwardMessage.id} onClick={() => void forwardToChat(target.id)}>{target.name}</button>)}</div>
          {forwardingTargets.filter((target) => target.id !== chat.id).length === 0 && <p className="py-3 text-sm text-[#91a2ae]">No other chats available</p>}
          {forwardError && <p role="alert" className="mt-2 text-xs text-red-300">{forwardError}</p>}
        </section>
      </div>}
    </section>
  );
};
