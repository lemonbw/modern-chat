import type { ReactNode } from "react";
import type { ChatMessage } from "../../../entities/chat/types";
import { messageDateLabel, messageDayKey } from "../../../shared/lib/messageDate";
import { contentGutter, contentInset, pageColumn } from "../lib/layout";
import { MessageBubble } from "./MessageBubble";

type Props = {
  messages: ChatMessage[];
  visibleMessages: ChatMessage[];
  isLoading: boolean;
  isLoadingOlder: boolean;
  isGroup?: boolean;
  topDateLabel: string;
  registerList: (element: HTMLDivElement | null) => void;
  registerSentinel: (element: HTMLDivElement | null) => void;
  hasMore: boolean;
  onScroll: () => void;
  onWheel: (event: { deltaY: number }) => void;
  onContextMenu: (event: React.MouseEvent<HTMLDivElement>, message: ChatMessage) => void;
  onAskDelete: (message: ChatMessage) => void;
  registerBubble: (index: number, timestamp?: number) => (element: HTMLDivElement | null) => void;
};

/** Scrolling wall of messages with sticky date separators and a floating top date. */
export const MessageWall = ({ messages, visibleMessages, isLoading, isLoadingOlder, isGroup, topDateLabel, registerList, registerSentinel, hasMore, onScroll, onWheel, onContextMenu, onAskDelete, registerBubble }: Props) => (
  <div
    ref={registerList}
    onScroll={onScroll}
    onWheel={onWheel}
    className={`message-wallpaper flex flex-1 flex-col overflow-auto ${contentGutter} py-6 max-[760px]:py-[17px]`}
  >
    <div className={`${pageColumn} ${contentInset} flex flex-col gap-[9px]`}>
      {hasMore && <div ref={registerSentinel} aria-hidden className="h-px w-full shrink-0" />}
      {visibleMessages.length > 0 && (
        <div className="sticky top-0 z-[1] self-center rounded-[14px] bg-[#182532d9] px-[11px] py-[5px] text-caption text-[#d3dde4] shadow-[0_1px_4px_#0003]">
          {topDateLabel}
          {isLoadingOlder && <span className="ml-2 text-[10px] text-[#9aabb7]">loading…</span>}
        </div>
      )}
      {messages.length === 0 && <p className="self-start px-1 text-xs text-[#9aabb7]">{isLoading ? "Loading messages…" : "No messages yet"}</p>}
      {messages.length > 0 && visibleMessages.length === 0 && <p className="self-start px-1 text-xs text-[#9aabb7]">Deleted messages are hidden</p>}
      {visibleMessages.flatMap((message, index) => {
        const previous = visibleMessages[index - 1];
        const key = message.id ?? `${message.time}-${index}-${message.text}`;
        const nodes: ReactNode[] = [];
        if (!previous || messageDayKey(previous.timestamp) !== messageDayKey(message.timestamp)) {
          nodes.push(<div key={`date-${key}`} className="my-[1px] self-center rounded-[14px] bg-[#182532d9] px-[11px] py-[5px] text-caption text-[#d3dde4] shadow-[0_1px_4px_#0003]">{messageDateLabel(message.timestamp)}</div>);
        }
        nodes.push(
          <MessageBubble
            key={key}
            message={message}
            isGroup={isGroup}
            onContextMenu={onContextMenu}
            onAskDelete={onAskDelete}
            registerRef={registerBubble(index, message.timestamp)}
          />,
        );
        return nodes;
      })}
    </div>
  </div>
);