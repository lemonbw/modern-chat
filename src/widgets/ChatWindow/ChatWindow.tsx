import { useState } from "react";
import type { ChatMessage, Conversation, OutgoingFile } from "../../entities/chat/types";
import { ChatInfoPanel } from "../ChatInfoPanel/ChatInfoPanel";
import { useChatSearch } from "./model/useChatSearch";
import { useComposer } from "./model/useComposer";
import { useMessageActions } from "./model/useMessageActions";
import { useMessageWall } from "./model/useMessageWall";
import { ChatHeader } from "./ui/ChatHeader";
import { Composer } from "./ui/Composer";
import { MessageWall } from "./ui/MessageWall";
import { DeleteMessageDialog, ForwardMessageDialog, MessageContextMenu } from "./ui/MessageDialogs";

export type ChatWindowProps = {
  chat: Conversation;
  messages: ChatMessage[];
  isLoadingMessages: boolean;
  hasMoreMessages: boolean;
  isLoadingOlderMessages: boolean;
  onLoadOlderMessages: () => void;
  onSend: (text: string, quotedMessage?: ChatMessage) => void;
  onSendFiles: (files: OutgoingFile[], quotedMessage?: ChatMessage, caption?: string) => void;
  onBack: () => void;
  onToggleArchive: () => void;
  onDeleteMessage: (message: ChatMessage, onlySenderDelete: boolean) => Promise<void>;
  onToggleDeletedMessages: () => void;
  onForwardMessage: (message: ChatMessage, destinationChatId: string) => Promise<void>;
  forwardingTargets: Conversation[];
  showDeletedMessages: boolean;
  archived: boolean;
  error: string | null;
};

/** Composes the chat column with the optional info panel that opens next to it. */
export const ChatWindow = (props: ChatWindowProps) => {
  const { chat, messages, isLoadingMessages, hasMoreMessages, isLoadingOlderMessages, onLoadOlderMessages, onSend, onSendFiles, onBack, onToggleArchive, onDeleteMessage, onToggleDeletedMessages, onForwardMessage, forwardingTargets, showDeletedMessages, archived, error } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [focusSignal, setFocusSignal] = useState(0);

  const visibleMessages = messages.filter((message) => showDeletedMessages || !message.deleted);
  const search = useChatSearch(visibleMessages);
  const composer = useComposer({ onSend, onSendFiles });
  const actions = useMessageActions({
    onDeleteMessage,
    onForwardMessage,
    onStartReply: (message) => {
      composer.setReplyTarget(message);
      setFocusSignal((value) => value + 1);
    },
  });
  const wall = useMessageWall({
    chatId: chat.id,
    messages,
    isLoading: isLoadingMessages,
    isLoadingOlder: isLoadingOlderMessages,
    hasMore: hasMoreMessages,
    onLoadOlder: onLoadOlderMessages,
  });

  return (
    <section className="chat-window relative flex min-w-0 flex-1 max-[760px]:hidden" onClick={() => { if (actions.contextMenu) actions.closeContextMenu(); }}>
      <div className="flex min-w-0 flex-1 flex-col bg-chat-deep">
        <ChatHeader
          chat={chat}
          archived={archived}
          showDeletedMessages={showDeletedMessages}
          onBack={onBack}
          onOpenInfo={() => setIsInfoOpen(true)}
          onToggleArchive={onToggleArchive}
          onToggleDeletedMessages={onToggleDeletedMessages}
          search={search}
          onJumpToMessage={(index) => { wall.scrollToIndex(index); search.close(); setFocusSignal((value) => value + 1); }}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
        />
        {error && <p role="alert" className="border-b border-red-900/60 bg-red-950/40 px-5 py-2 text-xs text-red-200">{error}</p>}
        <MessageWall
          messages={messages}
          visibleMessages={visibleMessages}
          isLoading={isLoadingMessages}
          isLoadingOlder={isLoadingOlderMessages}
          isGroup={chat.group}
          topDateLabel={wall.topDateLabel}
          registerList={wall.registerList}
          onScroll={wall.onScroll}
          onWheel={wall.onWheel}
          onContextMenu={actions.openMessageMenu}
          onAskDelete={actions.askDelete}
          registerBubble={wall.registerBubble}
        />
        <Composer
          draft={composer.draft}
          setDraft={composer.setDraft}
          hasDraft={composer.hasDraft}
          onSubmit={composer.submitDraft}
          onDraftKeyDown={composer.onDraftKeyDown}
          onAttachFiles={composer.attachFiles}
          pendingFiles={composer.pendingFiles}
          onRemoveFile={composer.removePendingFile}
          replyTarget={composer.replyTarget}
          onCancelReply={() => composer.setReplyTarget(null)}
          focusSignal={focusSignal}
          voice={composer.voice}
          onSendVoice={() => void composer.sendVoiceRecording()}
        />
      </div>
      {isInfoOpen && <ChatInfoPanel chat={chat} messages={visibleMessages} onClose={() => setIsInfoOpen(false)} />}
      {actions.contextMenu && <MessageContextMenu state={actions.contextMenu} onReply={actions.startReply} onForward={actions.startForward} onDelete={actions.askDelete} />}
      {actions.deletingMessage && (
        <DeleteMessageDialog
          message={actions.deletingMessage}
          busy={actions.deleting}
          error={actions.deleteError}
          onConfirm={(onlySenderDelete) => void actions.chooseDeleteScope(onlySenderDelete)}
          onClose={() => actions.setDeletingMessage(null)}
        />
      )}
      {actions.forwardMessage && (
        <ForwardMessageDialog
          message={actions.forwardMessage}
          targets={forwardingTargets}
          currentChatId={chat.id}
          busy={actions.forwarding}
          error={actions.forwardError}
          onForward={(chatId) => void actions.forwardToChat(chatId)}
          onClose={() => actions.setForwardMessage(null)}
        />
      )}
    </section>
  );
};