import { useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { ChatMessage } from "../../../entities/chat/types";

export type ContextMenuState = { message: ChatMessage; left: number; top: number };

/** Reply, forward and delete flows of a single message, including their error and busy flags. */
export const useMessageActions = ({
  onDeleteMessage,
  onForwardMessage,
  onStartReply,
}: {
  onDeleteMessage: (message: ChatMessage, onlySenderDelete: boolean) => Promise<void>;
  onForwardMessage: (message: ChatMessage, destinationChatId: string) => Promise<void>;
  onStartReply: (message: ChatMessage) => void;
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [replyMessage, setReplyMessage] = useState<ChatMessage | null>(null);
  const [forwardMessage, setForwardMessage] = useState<ChatMessage | null>(null);
  const [forwardError, setForwardError] = useState("");
  const [forwarding, setForwarding] = useState(false);
  const [deletingMessage, setDeletingMessage] = useState<ChatMessage | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const openMessageMenu = (event: ReactMouseEvent<HTMLDivElement>, message: ChatMessage) => {
    if (!message.id || message.deleted) return;
    event.preventDefault();
    setContextMenu({
      message,
      left: Math.min(event.clientX, window.innerWidth - 190),
      top: Math.min(event.clientY, window.innerHeight - 150),
    });
  };

  const startReply = (message: ChatMessage) => {
    setReplyMessage(message);
    setContextMenu(null);
    onStartReply(message);
  };

  const startForward = (message: ChatMessage) => {
    setForwardMessage(message);
    setForwardError("");
    setContextMenu(null);
  };

  const askDelete = (message: ChatMessage) => {
    setDeleteError("");
    setDeletingMessage(message);
    setContextMenu(null);
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

  return {
    contextMenu, closeContextMenu: () => setContextMenu(null), openMessageMenu,
    replyMessage, setReplyMessage,
    forwardMessage, setForwardMessage, forwardError, forwarding, forwardToChat, startForward,
    deletingMessage, setDeletingMessage, deleteError, deleting, chooseDeleteScope, askDelete,
    startReply,
  };
};