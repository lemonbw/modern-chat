import { useState } from "react";
import type { Conversation } from "../../../entities/chat/types";
import { ContactAvatar } from "../../../features/contacts/ui/components/ContactAvatar";
import { deleteContact } from "../../../features/contacts/api/greenApiContacts";
import { emptyProfile } from "../../../features/contacts/model/localProfile";
import type { InfoPanelModel } from "../model/useInfoPanel";
import { Field } from "./InfoPrimitives";

/** The Edit button replaces the whole panel with this form. Everything stays in this browser. */
export const ProfileEditor = ({ chat, model }: { chat: Conversation; model: InfoPanelModel }) => {
  const saved = { ...emptyProfile(), ...(model.stored ?? {}) };
  // The profile is read from IndexedDB; the panel remounts this form once it arrives.
  const [draft, setDraft] = useState(() => ({ firstName: saved.firstName, lastName: saved.lastName, notes: saved.bio }));
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [askDelete, setAskDelete] = useState(false);

  const removeContact = async () => {
    setIsDeleting(true);
    setDeleteError("");
    try {
      await deleteContact(chat.id);
      model.toggleEditing();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete the contact");
    } finally {
      setIsDeleting(false);
    }
  };

  const { firstName, lastName, notes } = draft;

  return (
    <form
      className="flex flex-col gap-3 p-4 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        model.persist({ ...saved, firstName: draft.firstName, lastName: draft.lastName, bio: draft.notes });
        model.toggleEditing();
      }}
    >
      <AvatarPicker chat={chat} model={model} />
      <Field label="First name" value={firstName} onChange={(value) => setDraft({ ...draft, firstName: value })} placeholder="Leon" />
      <Field label="Last name" value={lastName} onChange={(value) => setDraft({ ...draft, lastName: value })} placeholder="Gray" />
      <label className="flex flex-col gap-1">
        <span className="text-[#8fa1ae]">Notes</span>
        <textarea
          rows={4}
          value={notes}
          onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
          placeholder="Notes about this contact"
          className="resize-none rounded-md border border-[#2c3b49] bg-[#202b36] px-2.5 py-2 text-sm text-[#e5edf3] outline-none focus:border-[#43b2e5]"
        />
      </label>
      <div className="mt-2 flex gap-2">
        <button type="submit" className="rounded-md border-0 bg-chat-blue px-3 py-2 text-xs font-semibold text-white hover:bg-[#179cde]">Save</button>
        <button type="button" className="rounded-md border-0 bg-transparent px-3 py-2 text-xs text-[#a6b3bd] hover:bg-[#253441]" onClick={model.toggleEditing}>Cancel</button>
      </div>
      <div className="mt-2 border-t border-[#202d39] pt-3">
        {askDelete
          ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-amber-200">Delete {chat.name} from your contacts?</p>
                <div className="flex gap-2">
                  <button type="button" className="rounded-md border-0 bg-[#7f2b2b] px-3 py-2 text-xs font-semibold text-white hover:bg-[#943434]" disabled={isDeleting} onClick={() => void removeContact()}>{isDeleting ? "Deleting…" : "Delete contact"}</button>
                  <button type="button" className="rounded-md border-0 bg-transparent px-3 py-2 text-xs text-[#a6b3bd] hover:bg-[#253441]" disabled={isDeleting} onClick={() => setAskDelete(false)}>Cancel</button>
                </div>
                {deleteError && <p role="alert" className="text-xs text-red-300">{deleteError}</p>}
              </div>
            )
          : (
              <button type="button" className="rounded-md border-0 bg-transparent px-3 py-2 text-xs text-red-300 hover:bg-[#2a3946]" onClick={() => setAskDelete(true)}>Delete contact</button>
            )}
      </div>
    </form>
  );
};

const AvatarPicker = ({ chat, model }: { chat: Conversation; model: InfoPanelModel }) => {
  const saved = { ...emptyProfile(), ...(model.stored ?? {}) };
  return (
    <div className="flex flex-col items-center gap-2 pb-2">
      <ContactAvatar chatId={undefined} name={chat.name} initials={chat.initials} color={chat.color} avatar={saved.avatar ?? chat.avatar} className="size-[96px] text-[15px]" />
      <label className="cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 text-xs font-semibold text-chat-blue hover:bg-[#253441]">
        Change avatar
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => model.persist({ ...saved, avatar: typeof reader.result === "string" ? reader.result : null });
            reader.readAsDataURL(file);
          }}
        />
      </label>
    </div>
  );
};