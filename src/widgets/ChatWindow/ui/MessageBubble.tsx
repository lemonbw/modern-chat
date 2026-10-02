import type { MouseEvent } from "react";
import { memo } from "react";
import type { ChatMessage } from "../../../entities/chat/types";
import { mediaDescriptorOf } from "../../../features/messages/model/mediaCache";
import { MessageMedia } from "../../../features/messages/ui/MessageMedia";
import { LuCircleAlert, LuCheck, LuCheckCheck, LuClock, LuX } from "react-icons/lu";
import { statusColor, statusTitle } from "../lib/layout";

const statusIcon = (status: string) => {
  if (status === "sending") return <LuClock className="size-[12px]" />;
  if (status === "failed") return <LuCircleAlert className="size-[12px]" />;
  return status === "sent" ? <LuCheck className="size-[13px]" /> : <LuCheckCheck className="size-[14px]" />;
};

type Props = {
  message: ChatMessage;
  isGroup?: boolean;
  onContextMenu: (event: MouseEvent<HTMLDivElement>, message: ChatMessage) => void;
  onAskDelete: (message: ChatMessage) => void;
  registerRef: (element: HTMLDivElement | null) => void;
};

/** Memoised: the wall renders a few hundred of these and polls every fifteen seconds. */
export const MessageBubble = memo(({ message, isGroup, onContextMenu, onAskDelete, registerRef }: Props) => (
  <div
    ref={registerRef}
    onContextMenu={(event: MouseEvent<HTMLDivElement>) => onContextMenu(event, message)}
    className={`max-w-full self-start break-words [overflow-wrap:anywhere] whitespace-pre-wrap rounded-[10px_10px_10px_2px] bg-[#182533] px-[11px] pt-2 pb-1.5 text-control leading-[1.48] text-[#e5edf3] shadow-[0_1px_2px_#0003] ${message.mine ? "self-end rounded-[10px_10px_2px_10px] bg-[#2b5278]" : ""}`}
  >
    {isGroup && message.sender && <span className="mb-[2px] block text-xs font-semibold text-chat-blue">{message.sender}</span>}
    {message.quotedText && <div className="mb-1.5 border-l-2 border-chat-blue pl-2 text-xs text-[#b5d5e6]">{message.quotedText}</div>}
    {message.deleted
      ? <span className="italic text-[#a3b1ba]">{message.text}</span>
      : message.media
        ? <><MessageMedia
            descriptor={mediaDescriptorOf(message.id ?? `${message.timestamp}-${message.time}`, message.media)}
            alt={message.media.caption || message.media.fileName || `${message.media.kind} message`}
          />{message.media.caption && <span className="block whitespace-pre-wrap">{message.media.caption}</span>}</>
        : message.text}
    <div className={`mt-[3px] flex items-center justify-end gap-1 text-micro text-[#8fa1ae] ${message.mine ? "text-[#8bc7e8]" : ""}`}>
      {message.time}
      {message.id && !message.deleted && message.mine && <button className="ml-1 text-[#8fa1ae] hover:text-red-300" aria-label="Delete message" title="Delete message" onClick={() => onAskDelete(message)}><LuX className="size-[12px]" /></button>}
      {message.mine && message.status && <span aria-label={message.status} title={statusTitle[message.status]} style={{ color: statusColor[message.status] }}>{statusIcon(message.status)}</span>}
    </div>
  </div>
));