import { useState } from "react";
import type { Conversation } from "../../entities/chat/types";
import type { UserProfile } from "../../entities/user/types";
import { visibleChats, type ChatFilter } from "../../features/search-chats/model/searchChats";
import { ChatList } from "../../features/search-chats/ui/components/ChatList";
import { SearchChats } from "../../features/search-chats/ui/components/SearchChats";
import { SidebarAccountBar } from "./ui/SidebarAccountBar";

type SidebarProps = {
  chats: Conversation[];
  profile: UserProfile;
  accounts: UserProfile[];
  selected: string | null;
  isLoadingChats?: boolean;
  messageSearchIndex?: Record<string, string>;
  onSelect: (id: string) => void;
  onSignOut: () => Promise<void>;
  onNewMessage: () => void;
  onSwitchAccount: (account: UserProfile) => void;
  onAddAccount: () => void;
};

export const Sidebar = ({ chats, profile, accounts, selected, isLoadingChats = false, messageSearchIndex = {}, onSelect, onSignOut, onNewMessage, onSwitchAccount, onAddAccount }: SidebarProps) => {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ChatFilter>("all");
  const filteredChats = visibleChats(chats, query, filter, messageSearchIndex);

  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-r border-chat-border bg-chat max-[760px]:w-full max-[760px]:border-0">
      <div className="px-4 pt-4 pb-2 max-[760px]:px-3 max-[760px]:pt-[11px] max-[760px]:pb-1.5">
        <div className="mb-[15px] flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-base font-bold tracking-[-.35px] text-[#e8f0f6]"><span className="grid size-8 place-items-center rounded-full bg-chat-blue text-white shadow-[0_4px_16px_#2aabee33]">➤</span>Modern Chat</div>
          <button className="rounded-lg border-0 bg-chat-blue px-3 py-2 text-xs font-semibold text-white hover:bg-[#179cde]" onClick={onNewMessage}>New Message</button>
        </div>
        <SearchChats query={query} onQueryChange={setQuery} filter={filter} onFilterChange={setFilter} />
      </div>
      <ChatList chats={filteredChats} selected={selected} onSelect={onSelect} loading={isLoadingChats} />
      <SidebarAccountBar
        profile={profile}
        accounts={accounts}
        onSignOut={onSignOut}
        onSwitchAccount={onSwitchAccount}
        onAddAccount={onAddAccount}
      />
    </aside>
  );
};