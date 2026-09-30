import { useState } from "react";
import type { FormEvent } from "react";
import type { Conversation } from "../Sidebar/Sidebar";

type Message = { text: string; time: string; mine?: boolean };
export function ChatWindow({ chat, messages, onSend, onBack }: { chat: Conversation; messages: Message[]; onSend: (text: string) => void; onBack: () => void }) {
  const [draft, setDraft] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  }
  return <section className="chat-window">
    <header className="chat-header"><button className="icon-button mobile-back" aria-label="Back to conversations" onClick={onBack}>←</button><span className="avatar small" style={{ background: chat.color }}>{chat.initials}{chat.online && <i className="online-dot" />}</span><div className="chat-header-copy"><strong>{chat.name}</strong><span>{chat.online ? "●  Online now" : "last seen recently"}</span></div><div className="header-actions"><button className="icon-button" aria-label="Search in chat">⌕</button><button className="icon-button" aria-label="More options">⋯</button></div></header>
    <div className="messages-area"><div className="date-chip">Today</div>{messages.map((message, index) => <div key={`${index}-${message.time}`} className={`message ${message.mine ? "mine" : ""}`}>{message.text}<div className="message-meta">{message.time}{message.mine && <span>✓✓</span>}</div></div>)}</div>
    <div className="composer-wrap"><form className="composer" onSubmit={submit}><button type="button" className="icon-button" aria-label="Attach file">＋</button><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message..." aria-label="Write a message" /><button type="button" className="icon-button" aria-label="Add emoji">☺</button><button className="send-button" type="submit" aria-label="Send message">➤</button></form><div className="composer-note">Enter to send · Shift + Enter for a new line</div></div>
  </section>;
}
