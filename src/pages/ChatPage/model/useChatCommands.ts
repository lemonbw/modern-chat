import { useCallback, useEffect, useRef } from "react";
import type { ChatMessage, Conversation, OutgoingFile } from "../../../entities/chat/types";
import {
  deleteChatMessage,
  fileKind,
  filePreviewLabel,
  forwardChatMessage,
  getChatMessage,
  sendChatFile,
  sendChatMessage,
} from "../../../features/messages/api/greenApiMessages";
import { errorMessage, messageTime, nowTimestamp } from "./chatPageState";

type Options = {
  isDemo: boolean;
  selected: string | null;
  onLoadError: (message: string | null) => void;
  onPatchChat: (chatId: string, patch: Partial<Conversation>) => void;
  onLockPreview: (chatId: string) => void;
  appendMessage: (chatId: string, message: ChatMessage) => void;
  patchMessage: (chatId: string, message: ChatMessage, patch: Partial<ChatMessage>) => void;
  markDeleted: (chatId: string, messageId: string) => void;
  messagesOf: (chatId: string) => ChatMessage[];
};

/** Sending, forwarding and deleting: every action writes an optimistic message first. */
export const useChatCommands = ({ isDemo, selected, onLoadError, onPatchChat, onLockPreview, appendMessage, patchMessage, markDeleted, messagesOf }: Options) => {
  const objectUrls = useRef<string[]>([]);

  useEffect(() => () => {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.current = [];
  }, []);

  const send = useCallback(async (text: string, quotedMessage?: ChatMessage) => {
    if (isDemo || !selected) return;
    const chatId = selected;
    const optimistic: ChatMessage = { text, time: messageTime(), timestamp: nowTimestamp(), mine: true, status: "sending", quotedText: quotedMessage?.text };
    appendMessage(chatId, optimistic);
    onLockPreview(chatId);
    onPatchChat(chatId, { preview: text, time: optimistic.time, lastTimestamp: optimistic.timestamp, unread: 0 });
    onLoadError(null);
    try {
      const { data } = await sendChatMessage(chatId, text, quotedMessage?.id);
      patchMessage(chatId, optimistic, { id: data.idMessage, status: "sent" });
      onPatchChat(chatId, { hasConversation: true });
    } catch (error) {
      patchMessage(chatId, optimistic, { status: "failed" });
      onLoadError(errorMessage(error, "Could not send message"));
    }
  }, [appendMessage, isDemo, onLoadError, onLockPreview, onPatchChat, patchMessage, selected]);

  const sendFile = useCallback(async (file: OutgoingFile, caption?: string, quotedMessage?: ChatMessage) => {
    if (isDemo || !selected) return;
    const chatId = selected;
    const previewUrl = URL.createObjectURL(file.blob);
    objectUrls.current.push(previewUrl);
    const optimistic: ChatMessage = {
      text: caption?.trim() || filePreviewLabel(file),
      time: messageTime(),
      timestamp: nowTimestamp(),
      mine: true,
      status: "sending",
      quotedText: quotedMessage?.text,
      media: { kind: fileKind(file), url: previewUrl, mimeType: file.mimeType, fileName: file.fileName, caption: caption?.trim() || undefined },
    };
    appendMessage(chatId, optimistic);
    onLockPreview(chatId);
    onPatchChat(chatId, { preview: optimistic.text, time: optimistic.time, lastTimestamp: optimistic.timestamp, unread: 0, hasConversation: true });
    onLoadError(null);
    try {
      const { data } = await sendChatFile(chatId, file, caption?.trim() || undefined, quotedMessage?.id);
      patchMessage(chatId, optimistic, { id: data.idMessage, status: "sent" });
    } catch (error) {
      patchMessage(chatId, optimistic, { status: "failed" });
      onLoadError(errorMessage(error, "Could not send the file"));
    }
  }, [appendMessage, isDemo, onLoadError, onLockPreview, onPatchChat, patchMessage, selected]);

  const sendFiles = useCallback(async (files: OutgoingFile[], quotedMessage?: ChatMessage, caption?: string) => {
    for (const [index, file] of files.entries()) {
      await sendFile(file, files.length === 1 ? caption : undefined, quotedMessage);
      if (index === files.length - 1) break;
    }
  }, [sendFile]);

  const forwardMessage = useCallback(async (message: ChatMessage, destinationChatId: string) => {
    if (isDemo || !selected || !message.id) return;
    const sourceChatId = selected;
    onLoadError(null);
    try {
      await getChatMessage(sourceChatId, message.id);
      const { data } = await forwardChatMessage(destinationChatId, sourceChatId, message.id);
      const forwarded: ChatMessage = { id: data.messages?.[0], text: message.text, time: messageTime(), mine: true, status: "sent" };
      onPatchChat(destinationChatId, { hasConversation: true, preview: message.text, time: forwarded.time });
      appendMessage(destinationChatId, forwarded);
    } catch (error) {
      onLoadError(errorMessage(error, "Could not forward message"));
      throw error;
    }
  }, [appendMessage, isDemo, onLoadError, onPatchChat, selected]);

  const deleteMessage = useCallback(async (message: ChatMessage, onlySenderDelete: boolean) => {
    if (isDemo || !selected || !message.id || !message.mine || message.deleted) return;
    const chatId = selected;
    try {
      await deleteChatMessage(chatId, message.id, onlySenderDelete);
      markDeleted(chatId, message.id);
      const lastVisible = [...messagesOf(chatId)].reverse().find((item) => item.id !== message.id && !item.deleted);
      onPatchChat(chatId, {
        preview: lastVisible?.text ?? "No messages yet",
        time: lastVisible?.time ?? "",
        hasConversation: Boolean(lastVisible),
      });
      onLoadError(null);
    } catch (error) {
      onLoadError(errorMessage(error, "Could not delete message"));
      throw error;
    }
  }, [isDemo, markDeleted, messagesOf, onLoadError, onPatchChat, selected]);

  return { send, sendFile, sendFiles, forwardMessage, deleteMessage };
};