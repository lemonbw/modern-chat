import { useState } from "react";
import type { FormEvent } from "react";
import type { GreenApiContact } from "../api/greenApiContacts";
import { ContactAvatar } from "./components/ContactAvatar";

export type ContactDialogMode = "closed" | "contacts" | "contact" | "group";

const colors = ["linear-gradient(145deg,#76c5bb,#38998e)", "linear-gradient(145deg,#8f9bd4,#5b68a8)", "linear-gradient(145deg,#efad78,#ce6d67)"];
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase() || "?";

type Props = {
  mode: ContactDialogMode;
  contacts: GreenApiContact[];
  busy: boolean;
  error: string;
  name: string;
  phone: string;
  groupName: string;
  groupMembers: string[];
  onClose: () => void;
  onModeChange: (mode: ContactDialogMode) => void;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onGroupNameChange: (value: string) => void;
  onGroupMembersChange: (value: string[]) => void;
  onSelectContact: (id: string) => void;
  onSaveContact: (event: FormEvent<HTMLFormElement>) => void;
  onSaveGroup: (event: FormEvent<HTMLFormElement>) => void;
};

export const NewMessageDialog = (props: Props) => {
  const { mode, contacts, busy, error, name, phone, groupName, groupMembers } = props;
  const [contactQuery, setContactQuery] = useState("");
  if (mode === "closed") return null;
  const normalizedQuery = contactQuery.trim().toLocaleLowerCase();
  const visibleContacts = contacts
    .filter((item) => !["group", "supergroup", "channel"].includes(item.type ?? ""))
    .filter((item) => {
      if (!normalizedQuery) return true;
      const searchableText = [item.name, item.contactName, item.username, item.phoneNumber, item.id]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return searchableText.includes(normalizedQuery);
    });
  const closeDialog = () => {
    setContactQuery("");
    props.onClose();
  };
  return <div className="fixed inset-0 z-20 grid place-items-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
    <section className="w-full max-w-md rounded-xl border border-chat-border bg-chat p-5 text-[#e5edf3] shadow-2xl">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{mode === "contacts" ? "New Message" : mode === "contact" ? "New Contact" : "New Group"}</h2><button className="icon-button" onClick={closeDialog} aria-label="Close">×</button></div>
      {mode === "contacts" && <><div className="mb-4 flex gap-2"><button className="rounded-lg bg-[#263746] px-3 py-2 text-xs" onClick={() => props.onModeChange("contact")}>＋ New contact</button><button className="rounded-lg bg-[#263746] px-3 py-2 text-xs" onClick={() => props.onModeChange("group")}>＋ New group</button></div><label className="mb-2 block"><span className="sr-only">Search contacts</span><input className="w-full rounded-lg border border-[#40505c] bg-[#202c37] px-3 py-2 text-sm text-[#e5edf3] placeholder:text-[#91a2ae]" type="search" placeholder="Search contacts…" value={contactQuery} onChange={(event) => setContactQuery(event.target.value)} /></label><div className="max-h-80 overflow-auto">{busy ? <p className="p-3 text-sm text-[#91a2ae]">Loading contacts…</p> : visibleContacts.map((item, index) => { const name = item.name?.trim() || item.contactName?.trim() || item.username || item.id; return <button key={item.id} className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-[#202d39]" onClick={() => props.onSelectContact(item.id)}><ContactAvatar chatId={item.id} name={name} initials={initials(name)} color={colors[index % colors.length]} className="avatar avatar-small" /><span><strong className="block text-sm">{name}</strong><span className="text-xs text-[#91a2ae]">{item.username ? `@${item.username.replace(/^@/, "")}` : item.phoneNumber ?? item.id}</span></span></button>; })}{!busy && visibleContacts.length === 0 && <p className="p-3 text-sm text-[#91a2ae]">{contacts.length === 0 ? "No contacts found" : "No matching contacts"}</p>}</div></>}
      {mode === "contact" && <form className="grid gap-3" onSubmit={props.onSaveContact}><input className="rounded-lg border border-[#40505c] bg-[#202c37] px-3 py-2 text-sm" placeholder="Name" value={name} onChange={(event) => props.onNameChange(event.target.value)} required /><input className="rounded-lg border border-[#40505c] bg-[#202c37] px-3 py-2 text-sm" placeholder="Phone number or Telegram @username" value={phone} onChange={(event) => props.onPhoneChange(event.target.value)} required disabled={busy} autoComplete="off" /><button className="rounded-lg bg-chat-blue px-3 py-2 text-sm font-semibold disabled:opacity-60" disabled={busy}>Save and message</button></form>}
      {mode === "group" && <form className="grid gap-3" onSubmit={props.onSaveGroup}><input className="rounded-lg border border-[#40505c] bg-[#202c37] px-3 py-2 text-sm" placeholder="Group name" value={groupName} onChange={(event) => props.onGroupNameChange(event.target.value)} required maxLength={100} /><div className="max-h-52 overflow-auto">{contacts.filter((item) => !["group", "supergroup", "channel"].includes(item.type ?? "")).map((item) => <label key={item.id} className="flex items-center gap-2 p-2 text-sm"><input type="checkbox" checked={groupMembers.includes(item.id)} onChange={(event) => props.onGroupMembersChange(event.target.checked ? [...groupMembers, item.id] : groupMembers.filter((id) => id !== item.id))} />{item.contactName || item.name || item.username || item.id}</label>)}</div><button className="rounded-lg bg-chat-blue px-3 py-2 text-sm font-semibold disabled:opacity-60" disabled={busy || groupMembers.length < 2}>Create group</button></form>}
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    </section>
  </div>;
};
