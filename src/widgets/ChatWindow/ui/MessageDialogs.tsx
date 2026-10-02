import type { ChatMessage, Conversation } from "../../../entities/chat/types";
import { LuX } from "react-icons/lu";
import type { ContextMenuState } from "../model/useMessageActions";

type Props = {
  state: ContextMenuState;
  onReply: (message: ChatMessage) => void;
  onForward: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
};

export const MessageContextMenu = ({ state, onReply, onForward, onDelete }: Props) => (
  <div role="menu" className="fixed z-30 w-44 rounded-lg border border-chat-border bg-[#1c2934] p-1.5 shadow-xl" style={{ left: state.left, top: state.top }} onClick={(event) => event.stopPropagation()}>
    <button role="menuitem" className="block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-[#2a3946] disabled:opacity-40" disabled={!state.message.id} onClick={() => onReply(state.message)}>Reply to this message</button>
    <button role="menuitem" className="block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-[#2a3946] disabled:opacity-40" disabled={!state.message.id} onClick={() => onForward(state.message)}>Forward</button>
    <button role="menuitem" className="block w-full rounded-md px-3 py-2 text-left text-xs text-red-300 hover:bg-[#2a3946]" onClick={() => onDelete(state.message)}>Delete</button>
  </div>
);

export const DeleteMessageDialog = ({ message, busy, error, onConfirm, onClose }: { message: ChatMessage; busy: boolean; error: string; onConfirm: (onlySenderDelete: boolean) => void; onClose: () => void }) => (
  <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="delete-message-title" className="w-full max-w-sm rounded-xl border border-chat-border bg-chat p-4 text-[#e5edf3] shadow-2xl">
      <div className="mb-3 flex items-center justify-between"><h2 id="delete-message-title" className="font-semibold">Delete message</h2><button type="button" className="icon-button" aria-label="Close" disabled={busy} onClick={onClose}><LuX className="size-[17px]" /></button></div>
      <p className="mb-3 line-clamp-2 rounded-lg bg-[#202b36] p-2 text-xs text-[#aebdc7]">{message.text}</p>
      {!message.mine && <p className="mb-2 text-xs text-amber-200">Telegram API only allows deleting messages sent from this account.</p>}
      <div className="grid gap-1">
        <button type="button" className="rounded-md px-3 py-2 text-left text-sm hover:bg-[#2a3946] disabled:opacity-40" disabled={busy || !message.mine} onClick={() => onConfirm(false)}>Delete for everyone</button>
        <button type="button" className="rounded-md px-3 py-2 text-left text-sm hover:bg-[#2a3946] disabled:opacity-40" disabled={busy || !message.mine} onClick={() => onConfirm(true)}>Delete for me</button>
      </div>
      {message.mine && <p className="mt-2 text-[11px] text-[#91a2ae]">Deleting for me keeps the message for other participants. Deleting for everyone removes it from the chat.</p>}
      {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
      <button type="button" className="mt-3 w-full rounded-md px-3 py-2 text-xs text-[#aebdc7] hover:bg-[#2a3946]" disabled={busy} onClick={onClose}>Cancel</button>
    </section>
  </div>
);

export const ForwardMessageDialog = ({ message, targets, currentChatId, busy, error, onForward, onClose }: { message: ChatMessage; targets: Conversation[]; currentChatId: string; busy: boolean; error: string; onForward: (chatId: string) => void; onClose: () => void }) => {
  const others = targets.filter((target) => target.id !== currentChatId);
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="forward-message-title" className="w-full max-w-sm rounded-xl border border-chat-border bg-chat p-4 text-[#e5edf3] shadow-2xl">
        <div className="mb-3 flex items-center justify-between"><h2 id="forward-message-title" className="font-semibold">Forward message</h2><button type="button" className="icon-button" aria-label="Close" disabled={busy} onClick={onClose}><LuX className="size-[17px]" /></button></div>
        <p className="mb-3 line-clamp-2 rounded-lg bg-[#202b36] p-2 text-xs text-[#aebdc7]">{message.text}</p>
        <div className="max-h-64 overflow-auto">{others.map((target) => <button key={target.id} type="button" className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[#2a3946] disabled:opacity-50" disabled={busy || !message.id} onClick={() => onForward(target.id)}>{target.name}</button>)}</div>
        {others.length === 0 && <p className="py-3 text-sm text-[#91a2ae]">No other chats available</p>}
        {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
      </section>
    </div>
  );
};