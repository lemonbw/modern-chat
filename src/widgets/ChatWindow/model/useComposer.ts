import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import type { ChatMessage, OutgoingFile } from "../../../entities/chat/types";
import { useVoiceRecorder } from "../../../features/messages/model/useVoiceRecorder";

const draftMaxLength = 4096;

export type PendingFile = OutgoingFile & { id: string };

/** Draft text, auto-growing textarea, attachments and the voice recording of the composer. */
export const useComposer = ({
  onSend,
  onSendFiles,
}: {
  onSend: (text: string, quotedMessage?: ChatMessage) => void;
  onSendFiles: (files: OutgoingFile[], quotedMessage?: ChatMessage, caption?: string) => void;
}) => {
  const [draft, setDraft] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  const voice = useVoiceRecorder();
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);

  const reset = () => {
    setDraft("");
    setPendingFiles([]);
    setReplyTarget(null);
  };

  const submitDraft = () => {
    if (pendingFiles.length > 0) {
      onSendFiles(pendingFiles, replyTarget ?? undefined, draft.trim().slice(0, draftMaxLength) || undefined);
      reset();
      return;
    }
    if (!draft.trim()) return;
    onSend(draft.slice(0, draftMaxLength), replyTarget ?? undefined);
    reset();
  };

  const onDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submitDraft();
  };

  const attachFiles = (list: FileList | null) => {
    if (!list?.length) return;
    setPendingFiles((current) => [...current, ...Array.from(list).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      blob: file,
      fileName: file.name,
      mimeType: file.type,
    }))]);
  };

  const removePendingFile = (id: string) => setPendingFiles((current) => current.filter((file) => file.id !== id));

  const sendVoiceRecording = async () => {
    const recording = await voice.finish();
    if (!recording) return;
    onSendFiles([{ blob: recording.blob, fileName: `voice-${Date.now()}.${recording.extension}`, mimeType: recording.mimeType }]);
  };

  useEffect(() => () => {
    if (voice.isActive) voice.cancel();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasDraft = draft.trim().length > 0 || pendingFiles.length > 0;

  return {
    draft, setDraft, onDraftKeyDown, submitDraft, hasDraft,
    pendingFiles, attachFiles, removePendingFile,
    voice, sendVoiceRecording,
    replyTarget, setReplyTarget,
  };
};