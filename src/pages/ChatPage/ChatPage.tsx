import { useState } from "react";
import { ChatWindow } from "../../widgets/ChatWindow/ChatWindow";
import { conversations, Sidebar } from "../../widgets/Sidebar/Sidebar";

export function ChatPage({ onSignOut }: { onSignOut: () => void }) {
  const [selected, setSelected] = useState(1);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [messages, setMessages] = useState<Record<number, { text: string; time: string; mine?: boolean }[]>>({});
  const active = conversations.find((chat) => chat.id === selected) ?? conversations[0];
  const items = [...active.messages, ...(messages[selected] ?? [])];
  function send(text: string) {
    const date = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
    setMessages((current) => ({ ...current, [selected]: [...(current[selected] ?? []), { text, time: date, mine: true }] }));
  }
  return <main className="app-shell"><div className={`messenger ${mobileOpen ? "mobile-chat" : ""}`}>
    <Sidebar selected={selected} onSelect={(id) => { setSelected(id); setMobileOpen(true); }} onSignOut={onSignOut} />
    <ChatWindow chat={active} messages={items} onSend={send} onBack={() => setMobileOpen(false)} />
  </div></main>;
}
