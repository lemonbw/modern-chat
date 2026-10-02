import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { VoiceWaveform } from "../../../features/messages/ui/VoiceWaveform";
import type { useVoiceRecorder } from "../../../features/messages/model/useVoiceRecorder";
import type { PendingFile } from "../model/useComposer";
import { contentColumn, contentGutter } from "../lib/layout";

type VoiceRecorder = ReturnType<typeof useVoiceRecorder>;

export type ComposerProps = {
  draft: string;
  setDraft: (value: string) => void;
  hasDraft: boolean;
  onSubmit: () => void;
  onDraftKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onAttachFiles: (list: FileList | null) => void;
  /** Bumped by the parent when the textarea should take the focus, for example after a reply. */
  focusSignal: number;
  pendingFiles: PendingFile[];
  onRemoveFile: (id: string) => void;
  replyTarget: { text: string } | null;
  onCancelReply: () => void;
  voice: VoiceRecorder;
  onSendVoice: () => void;
};

const maxDraftHeight = 200;
const singleLineDraftHeight = 47;

const formatElapsed = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
};

export const Composer = (props: ComposerProps) => {
  const { voice, pendingFiles, replyTarget } = props;
  const inputElement = useRef<HTMLTextAreaElement | null>(null);
  const fileInputElement = useRef<HTMLInputElement | null>(null);
  const [draftHeight, setDraftHeight] = useState(singleLineDraftHeight);

  useEffect(() => {
    inputElement.current?.focus();
  }, [props.focusSignal]);

  // The textarea grows with its content up to a cap and then scrolls.
  useEffect(() => {
    const field = inputElement.current;
    if (!field) return;
    field.style.height = "auto";
    const next = Math.min(field.scrollHeight, maxDraftHeight);
    field.style.height = `${next}px`;
    field.style.overflowY = field.scrollHeight > maxDraftHeight ? "auto" : "hidden";
    setDraftHeight(next);
  }, [props.draft]);

  return (
    <div className={`border-t border-[#202d39] bg-chat ${contentGutter} pt-3 pb-[15px] max-[760px]:pt-2 max-[760px]:pb-[calc(8px+env(safe-area-inset-bottom))]`}>
      <div className={`${contentColumn} flex flex-col`}>
        {replyTarget && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-chat-blue bg-[#202b36] px-3 py-2 text-xs">
            <span className="min-w-0 flex-1 truncate text-[#b9c7d0]">Replying to: {replyTarget.text}</span>
            <button type="button" className="text-[#9aabb7] hover:text-white" aria-label="Cancel reply" onClick={props.onCancelReply}>×</button>
          </div>
        )}
        <form className="flex min-h-[46px] w-full items-end gap-[5px] rounded-[9px] border border-[#253441] bg-[#202b36] py-[3px] pr-1.5 pl-2" onSubmit={(event) => { event.preventDefault(); props.onSubmit(); }}>
          <input
            ref={(element) => { fileInputElement.current = element; }}
            type="file"
            multiple
            className="hidden"
            aria-label="Attach photo, video, audio or document"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
            onChange={(event) => { props.onAttachFiles(event.target.files); event.target.value = ""; }}
          />
          <button type="button" className="grid h-[35px] w-[30px] shrink-0 place-items-center rounded-full border-0 bg-transparent text-xl text-[#8fa1ae] hover:bg-[#253441] hover:text-[#dce7ed]" aria-label="Attach file" title="Attach photo, video, audio or document" onClick={() => fileInputElement.current?.click()}>📎</button>
          {voice.isActive ? (
            <>
              <button type="button" className="grid h-[35px] w-[30px] shrink-0 place-items-center rounded-full border-0 bg-transparent text-lg text-[#e08b8b] hover:bg-[#3a2b2b]" aria-label="Discard voice message" title="Discard voice message" onClick={() => voice.cancel()}>🗑</button>
              <button type="button" className="grid h-[35px] w-[30px] shrink-0 place-items-center rounded-full border-0 bg-transparent text-base text-[#8fa1ae] hover:bg-[#253441] hover:text-[#dce7ed]" aria-label={voice.isPlaying ? "Stop playback" : "Play the recording"} title={voice.isPlaying ? "Stop playback" : "Play the recording"} onClick={() => void voice.togglePlayback()}>{voice.isPlaying ? "❚❚" : "▶"}</button>
              <span className="shrink-0 text-caption tabular-nums text-[#8fa1ae]">{formatElapsed(voice.elapsedMs)}</span>
              <VoiceWaveform peaks={voice.peaks} muted={voice.isPaused} />
              <button type="button" className="grid h-[35px] w-[30px] shrink-0 place-items-center rounded-full border-0 bg-transparent text-base text-[#8fa1ae] hover:bg-[#253441] hover:text-[#dce7ed]" aria-label={voice.isPaused ? "Resume recording" : "Pause recording"} title={voice.isPaused ? "Resume recording" : "Pause recording"} onClick={() => { if (voice.isPaused) { voice.stopPlayback(); voice.resume(); } else voice.pause(); }}>{voice.isPaused ? "🎙" : "❚❚"}</button>
            </>
          ) : (
            <textarea
              ref={(element) => { inputElement.current = element; }}
              rows={1}
              aria-label="Write a message"
              placeholder="Write a message..."
              className="max-h-40 min-h-[35px] min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent py-[6px] text-control leading-[1.4] text-[#e3edf3] outline-none transition-[height] duration-100 ease-out placeholder:text-[#8d9eaa]"
              style={{ height: `${draftHeight}px` }}
              value={props.draft}
              onChange={(event) => props.setDraft(event.target.value)}
              onKeyDown={props.onDraftKeyDown}
            />
          )}
          <button
            className="grid h-[35px] w-[38px] shrink-0 place-items-center rounded-full border-0 bg-chat-blue text-base text-white hover:bg-[#179cde]"
            type={voice.isActive ? "button" : "submit"}
            aria-label={voice.isActive ? "Send voice message" : props.hasDraft ? "Send message" : "Record voice message"}
            title={voice.isActive ? "Send voice message" : props.hasDraft ? "Send message" : "Record voice message"}
            onClick={voice.isActive ? props.onSendVoice : props.hasDraft ? undefined : () => void voice.start()}
          >
            {voice.isActive || props.hasDraft ? "➤" : "🎙"}
          </button>
        </form>
        {voice.error && <p role="alert" className="mt-1 px-1 text-xs text-red-300">{voice.error}</p>}
        {pendingFiles.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {pendingFiles.map((file) => (
              <li key={file.id} className="flex items-center gap-2 rounded-lg border border-[#2c3b49] bg-[#1b2734] py-1 pr-1 pl-2 text-xs text-[#d7e2e9]">
                <span className="max-w-[180px] truncate">{file.fileName}</span>
                <button type="button" className="grid size-6 place-items-center rounded-full text-[#8fa1ae] hover:bg-[#2a3946] hover:text-white" aria-label={`Remove ${file.fileName}`} onClick={() => props.onRemoveFile(file.id)}>×</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};