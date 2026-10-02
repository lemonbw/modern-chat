import { memo } from "react";
import { LuSearch } from "react-icons/lu";
import { messageDateLabel } from "../../../shared/lib/messageDate";

export type ChatSearchModel = {
  isOpen: boolean;
  query: string;
  setQuery: (value: string) => void;
  normalized: string;
  results: {
    message: { text: string; timestamp?: number; time: string };
    index: number;
  }[];
  open: () => void;
  close: () => void;
};

type Props = {
  search: ChatSearchModel;
  onJumpToMessage: (index: number) => void;
};

export const ChatSearchField = memo(({ search, onJumpToMessage }: Props) => (
  <div className="relative flex min-w-0 flex-1 items-center gap-2 rounded-[9px] bg-[#202b36] py-[7px] pr-2 pl-2.5">
    <LuSearch className="size-[16px] shrink-0 text-[#8fa1ae]" aria-hidden="true" />
    <input
      autoFocus
      type="search"
      aria-label="Search messages in this chat"
      placeholder="Search in this chat…"
      className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[#e5edf3] outline-none placeholder:text-[#8d9eaa]"
      value={search.query}
      onChange={(event) => search.setQuery(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Escape") search.close();
      }}
    />
    {search.normalized && (
      <div className="absolute top-full right-0 left-0 z-20 mt-1 rounded-lg border border-chat-border bg-[#1c2934] p-2 shadow-xl">
        <p className="px-1 pb-1 text-[11px] text-[#8fa1ae]">{search.results.length} found</p>
        <div className="max-h-64 overflow-auto">
          {search.results.map(({ message, index }) => (
            <button
              key={`${index}-${message.time}`}
              className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-[#253441]"
              onClick={() => onJumpToMessage(index)}
            >
              <span className="line-clamp-2 block text-xs text-[#d7e2e9]">{message.text}</span>
              <span className="mt-0.5 block text-[10px] text-[#8fa1ae]">{messageDateLabel(message.timestamp)} · {message.time}</span>
            </button>
          ))}
          {search.results.length === 0 && <p className="px-2 py-2 text-xs text-[#8fa1ae]">Nothing found</p>}
        </div>
      </div>
    )}
  </div>
));