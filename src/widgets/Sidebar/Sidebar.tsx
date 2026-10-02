import { useState } from "react";
import type { Conversation } from "../../entities/chat/types";
import type { UserProfile } from "../../entities/user/types";
import { visibleChats, type ChatFilter } from "../../features/search-chats/model/searchChats";
import { ChatList } from "../../features/search-chats/ui/components/ChatList";
import { SearchChats } from "../../features/search-chats/ui/components/SearchChats";

export const Sidebar = ({ chats, profile, accounts, selected, isLoadingChats = false, messageSearchIndex = {}, onSelect, onSignOut, onNewMessage, onSwitchAccount, onAddAccount }: { chats: Conversation[]; profile: UserProfile; accounts: UserProfile[]; selected: string | null; isLoadingChats?: boolean; messageSearchIndex?: Record<string, string>; onSelect: (id: string) => void; onSignOut: () => Promise<void>; onNewMessage: () => void; onSwitchAccount: (account: UserProfile) => void; onAddAccount: () => void }) => {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ChatFilter>("all");
  const [accountMenu, setAccountMenu] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const handleSignOut = async () => {
    setSigningOut(true);
    setSignOutError("");
    try {
      await onSignOut();
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : "Could not log out of Telegram");
      setAccountMenu(true);
    } finally {
      setSigningOut(false);
    }
  };
  const filteredChats = visibleChats(chats, query, filter, messageSearchIndex);
  return <aside className="flex w-[320px] shrink-0 flex-col border-r border-chat-border bg-chat max-[760px]:w-full max-[760px]:border-0">
    <div className="px-4 pt-4 pb-2 max-[760px]:px-3 max-[760px]:pt-[11px] max-[760px]:pb-1.5">
      <div className="mb-[15px] flex items-center justify-between"><div className="flex items-center gap-2.5 text-base font-bold tracking-[-.35px] text-[#e8f0f6]"><span className="grid size-8 place-items-center rounded-full bg-chat-blue text-white shadow-[0_4px_16px_#2aabee33]">➤</span>Modern Chat</div><button className="rounded-lg border-0 bg-chat-blue px-3 py-2 text-xs font-semibold text-white hover:bg-[#179cde]" onClick={onNewMessage}>New Message</button></div>
      <SearchChats query={query} onQueryChange={setQuery} filter={filter} onFilterChange={setFilter} />
    </div>
    <ChatList chats={filteredChats} selected={selected} onSelect={onSelect} loading={isLoadingChats} />
    <div className="relative mt-auto flex items-center gap-2.5 border-t border-chat-border bg-chat px-[15px] py-3"><span className="avatar avatar-small overflow-hidden" style={{ background: "linear-gradient(145deg,#93bbc6,#477e91)" }}>{profile.avatar ? <img className="size-full object-cover" src={profile.avatar} alt="" /> : profile.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><strong className="block truncate text-xs text-[#e1ebf1]">{profile.name}</strong><span className="text-2xs text-[#8fa1ae]">{profile.phone || "Available"}</span></div><button className="icon-button" aria-label="Account options" title="Account options" onClick={() => setAccountMenu((open) => !open)}>⋯</button>
      {accountMenu && <div className="absolute right-3 bottom-[calc(100%-4px)] z-10 w-56 rounded-lg border border-chat-border bg-[#1c2934] p-1.5 shadow-xl">{accounts.filter((account) => account.phone !== profile.phone).map((account) => <button key={account.phone} className="block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-[#2a3946]" onClick={() => { setAccountMenu(false); onSwitchAccount(account); }}>Switch to {account.name}</button>)}<button className="block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-[#2a3946]" onClick={() => { setAccountMenu(false); onAddAccount(); }}>Add account</button><button className="block w-full rounded-md px-3 py-2 text-left text-xs text-red-300 hover:bg-[#2a3946] disabled:opacity-60" disabled={signingOut} onClick={() => void handleSignOut()}>{signingOut ? "Logging out…" : "Log out"}</button>{signOutError && <p role="alert" className="px-3 py-2 text-xs text-red-300">{signOutError}</p>}</div>}
    </div>
  </aside>;
};
