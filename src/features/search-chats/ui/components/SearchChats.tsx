import type { ChatFilter } from "../../model/searchChats";

export const SearchChats = ({ query, onQueryChange, filter, onFilterChange }: {
  query: string;
  onQueryChange: (query: string) => void;
  filter: ChatFilter;
  onFilterChange: (filter: ChatFilter) => void;
}) => {
  return <>
    <label className="flex h-10 items-center gap-[9px] rounded-lg bg-[#242f3d] px-3 text-chat-muted">
      <span>⌕</span>
      <input className="w-full border-0 bg-transparent text-control text-[#e3edf3] outline-none placeholder:text-[#81909e]" aria-label="Search chats and messages" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search chats and messages" />
    </label>
    <div className="flex gap-1.5 border-b border-chat-border px-4 pt-2.5 pb-[9px] max-[760px]:px-3 max-[760px]:py-[7px]">
      {(["all", "personal", "groups", "archived"] as const).map((item) => <button key={item} className={`rounded-full border-0 px-3 py-[7px] text-xs ${filter === item ? "bg-[#2b3b49] font-semibold text-[#54bcf1]" : "bg-transparent text-[#99a8b5]"}`} onClick={() => onFilterChange(item)}>
        {item === "all" ? "All chats" : item === "personal" ? "Personal" : item === "groups" ? "Groups" : "Archived"}
      </button>)}
    </div>
  </>;
};
