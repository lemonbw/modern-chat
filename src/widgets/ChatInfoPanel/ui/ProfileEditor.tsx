import { useState } from "react";
import type { Conversation } from "../../../entities/chat/types";
import { ContactAvatar } from "../../../features/contacts/ui/components/ContactAvatar";
import { emptyProfile } from "../../../features/contacts/model/localProfile";
import type { InfoPanelModel } from "../model/useInfoPanel";
import { Field } from "./InfoPrimitives";

/** Profile editor. Everything stays in this browser, nothing is pushed to Telegram. */
export const ProfileEditor = ({ chat, model }: { chat: Conversation; model: InfoPanelModel }) => {
  const saved = { ...emptyProfile(), ...(model.stored ?? {}) };
  const [firstName, setFirstName] = useState(saved.firstName);
  const [lastName, setLastName] = useState(saved.lastName);
  const [birthday, setBirthday] = useState(saved.birthday);
  const [bio, setBio] = useState(saved.bio);

  return (
    <form
      className="flex flex-col gap-3 p-4 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        model.persist({ ...saved, firstName, lastName, birthday, bio });
        model.toggleEditing();
      }}
    >
      <AvatarPicker chat={chat} model={model} />
      <Field label="First name" value={firstName} onChange={setFirstName} placeholder="Leon" />
      <Field label="Last name" value={lastName} onChange={setLastName} placeholder="Gray" />
      <Field label="Birthday" value={birthday} onChange={setBirthday} placeholder="dd.mm.yyyy" />
      <label className="flex flex-col gap-1">
        <span className="text-[#8fa1ae]">About</span>
        <textarea
          rows={3}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          placeholder="Tell something about yourself"
          className="resize-none rounded-md border border-[#2c3b49] bg-[#202b36] px-2.5 py-2 text-sm text-[#e5edf3] outline-none focus:border-[#43b2e5]"
        />
      </label>
      <div className="mt-2 flex gap-2">
        <button type="submit" className="rounded-md border-0 bg-chat-blue px-3 py-2 text-xs font-semibold text-white hover:bg-[#179cde]">Save</button>
        <button type="button" className="rounded-md border-0 bg-transparent px-3 py-2 text-xs text-[#a6b3bd] hover:bg-[#253441]" onClick={model.toggleEditing}>Cancel</button>
      </div>
    </form>
  );
};

const AvatarPicker = ({ chat, model }: { chat: Conversation; model: InfoPanelModel }) => {
  const saved = { ...emptyProfile(), ...(model.stored ?? {}) };
  return (
    <div className="flex flex-col items-center gap-2 pb-2">
      <ContactAvatar chatId={undefined} name={chat.name} initials={chat.initials} color={chat.color} avatar={saved.avatar ?? chat.avatar} className="size-[96px]" />
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