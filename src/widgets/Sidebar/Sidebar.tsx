import { useState } from "react";

export type Conversation = { id: number; name: string; initials: string; color: string; preview: string; time: string; unread?: number; online?: boolean; group?: boolean; messages: { text: string; time: string; mine?: boolean }[] };

export const conversations: Conversation[] = [
  { id: 1, name: "Sophie Chen", initials: "SC", color: "linear-gradient(145deg,#efad78,#ce6d67)", preview: "That little café was such a good find ☕", time: "10:42", unread: 2, online: true, messages: [{ text: "Morning! Did you get a chance to look at the photos from yesterday?", time: "10:36" }, { text: "Just saw them — the light in that little café was perfect ✨", time: "10:39", mine: true }, { text: "That little café was such a good find ☕ We should go back this weekend!", time: "10:42" }] },
  { id: 2, name: "Design team", initials: "DT", color: "linear-gradient(145deg,#76c5bb,#38998e)", preview: "Maya: Updated the moodboard ✨", time: "10:18", unread: 4, group: true, messages: [{ text: "Good morning, everyone! Sharing the first direction for the new landing page.", time: "10:05" }, { text: "Love the softer colors. Could we try one with a little more contrast?", time: "10:11", mine: true }, { text: "Updated the moodboard ✨ take a look when you have a sec", time: "10:18" }] },
  { id: 3, name: "Alex Morgan", initials: "AM", color: "linear-gradient(145deg,#8f9bd4,#5b68a8)", preview: "Voice message · 0:24", time: "Yesterday", online: true, messages: [{ text: "Are we still on for Saturday? I found a trail by the lake that looks lovely.", time: "Yesterday" }, { text: "Absolutely! Send me the details and I'll bring snacks 🥐", time: "Yesterday", mine: true }] },
  { id: 4, name: "Weekend plans 🌿", initials: "WP", color: "linear-gradient(145deg,#e3a88d,#d46e70)", preview: "You: Sounds like a plan!", time: "Yesterday", group: true, messages: [{ text: "Picnic in the park if the weather holds?", time: "Yesterday" }, { text: "Sounds like a plan! I'll bring something sweet 🍓", time: "Yesterday", mine: true }] },
  { id: 5, name: "Mom", initials: "M", color: "linear-gradient(145deg,#d8ad71,#be8058)", preview: "Thank you for calling ❤️", time: "Mon", messages: [{ text: "Thank you for calling ❤️ It was lovely to catch up.", time: "Mon" }] },
  { id: 6, name: "Noah Williams", initials: "NW", color: "linear-gradient(145deg,#8cb48a,#5c8c72)", preview: "See you at the studio!", time: "Sun", messages: [{ text: "See you at the studio!", time: "Sun" }] },
];

export function Sidebar({ selected, onSelect, onSignOut }: { selected: number; onSelect: (id: number) => void; onSignOut: () => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "personal" | "groups">("all");
  const visibleChats = conversations.filter((chat) => {
    const matchesSearch = `${chat.name} ${chat.preview}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
    const matchesFilter = filter === "all" || (filter === "groups" ? chat.group : !chat.group);
    return matchesSearch && matchesFilter;
  });
  return <aside className="sidebar">
    <div className="side-head">
      <div className="brand-row"><div className="brand"><span className="brand-mark">➤</span>Modern Chat</div><button className="icon-button" aria-label="New message" title="New message">✎</button></div>
      <label className="searchbox"><span>⌕</span><input aria-label="Search conversations" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations" /></label>
    </div>
    <div className="filter-row"><button className={`filter-pill ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All chats</button><button className={`filter-pill ${filter === "personal" ? "active" : ""}`} onClick={() => setFilter("personal")}>Personal</button><button className={`filter-pill ${filter === "groups" ? "active" : ""}`} onClick={() => setFilter("groups")}>Groups</button></div>
    <div className="chat-list">{visibleChats.map((chat) => <button key={chat.id} className={`chat-row ${selected === chat.id ? "selected" : ""}`} onClick={() => onSelect(chat.id)}>
      <span className="avatar" style={{ background: chat.color }}>{chat.initials}{chat.online && <i className="online-dot" />}</span>
      <span className="chat-info"><span className="chat-name-row"><span className="chat-name">{chat.name}</span><span className="chat-time">{chat.time}</span></span><span className="chat-preview-row"><span className="chat-preview">{chat.preview}</span>{chat.unread && <span className="unread">{chat.unread}</span>}</span></span>
    </button>)}{visibleChats.length === 0 && <div className="empty-search">No conversations found</div>}</div>
    <div className="side-footer"><span className="avatar small" style={{ background: "linear-gradient(145deg,#93bbc6,#477e91)" }}>JD</span><div className="profile-copy"><strong>Jamie Davis</strong><span>Available</span></div><button className="icon-button" aria-label="Sign out" title="Sign out" onClick={onSignOut}>⋯</button></div>
  </aside>;
}
