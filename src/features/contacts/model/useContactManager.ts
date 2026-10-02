import { useState } from "react";
import type { FormEvent } from "react";
import { addContact, checkTelegramAccount, createGroup, getContacts, type GreenApiContact } from "../api/greenApiContacts";
import type { ContactDialogMode } from "../ui/NewMessageDialog";

type SelectChat = (id: string, preferredName?: string) => Promise<void>;
const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export const useContactManager = (enabled = true) => {
  const [dialog, setDialog] = useState<ContactDialogMode>("closed");
  const [contacts, setContacts] = useState<GreenApiContact[]>([]);
  const [contactsError, setContactsError] = useState("");
  const [busy, setBusy] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>([]);

  const openContacts = async () => {
    setDialog("contacts");
    setContactsError("");
    if (!enabled) { setContacts([]); return; }
    setBusy(true);
    try { setContacts(await getContacts()); }
    catch (error) { setContactsError(errorMessage(error, "Could not load contacts")); }
    finally { setBusy(false); }
  };

  const saveContact = async (event: FormEvent<HTMLFormElement>, selectChat: SelectChat) => {
    event.preventDefault();
    if (!enabled) { setContactsError("Contacts are not available in demo mode."); return; }
    setBusy(true);
    setContactsError("");
    try {
      const identifier = contactPhone.trim();
      const isUsername = /^@?[A-Za-z][A-Za-z0-9_]{4,31}$/.test(identifier);
      const normalizedPhone = identifier.replace(/\D/g, "");
      if (!isUsername && (normalizedPhone.length < 7 || normalizedPhone.length > 15)) throw new Error("Enter a valid phone number with country code or a Telegram username.");
      const account = await checkTelegramAccount(isUsername
        ? { username: identifier.startsWith("@") ? identifier : `@${identifier}` }
        : { phoneNumber: Number(normalizedPhone) });
      if (!account.exist || !account.chatId) throw new Error("No Telegram account found for this phone number or username.");
      let contact: GreenApiContact;
      try {
        contact = await addContact(contactName.trim(), account.chatId);
      } catch (error) {
        const currentContacts = await getContacts();
        const existingContact = currentContacts.find((item) => item.id === account.chatId);
        if (!existingContact) throw error;
        contact = existingContact;
      }
      setContacts((current) => [contact, ...current.filter((item) => item.id !== contact.id)]);
      setContactName("");
      setContactPhone("");
      await selectChat(contact.id, contact.contactName || contact.name || contactName.trim());
    } catch (error) { setContactsError(errorMessage(error, "Could not add contact")); }
    finally { setBusy(false); }
  };

  const saveGroup = async (event: FormEvent<HTMLFormElement>, selectChat: SelectChat) => {
    event.preventDefault();
    if (!enabled) { setContactsError("Groups are not available in demo mode."); return; }
    setBusy(true);
    setContactsError("");
    try {
      const result = await createGroup(groupName.trim(), groupMembers);
      const chatId = result.chatId ?? result.groupId;
      if (!chatId) throw new Error("Green API did not return the new group ID");
      setGroupName("");
      setGroupMembers([]);
      await selectChat(chatId);
    } catch (error) { setContactsError(errorMessage(error, "Could not create group")); }
    finally { setBusy(false); }
  };

  return {
    dialog, contacts, contactsError, busy, contactName, contactPhone, groupName, groupMembers,
    setDialog, setContactName, setContactPhone, setGroupName, setGroupMembers,
    openContacts, saveContact, saveGroup,
  };
};
