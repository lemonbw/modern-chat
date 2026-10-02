import type { UserProfile } from "../../entities/user/types";
import { NewMessageDialog } from "../../features/contacts/ui/NewMessageDialog";
import { ChatWindow } from "../../widgets/ChatWindow/ChatWindow";
import { Sidebar } from "../../widgets/Sidebar/Sidebar";
import { useChatPage } from "./model/useChatPage";

type ChatPageProps = {
  profile: UserProfile;
  accounts: UserProfile[];
  onSwitchAccount: (account: UserProfile) => void;
  onAddAccount: () => void;
  onSignOut: () => Promise<void>;
};

export const ChatPage = ({ profile, accounts, onSwitchAccount, onAddAccount, onSignOut }: ChatPageProps) => {
  const isDemo = profile.isDemo ?? (profile.name === "Demo User" && !profile.phone);
  const page = useChatPage(isDemo);
  const activeMessages = page.activeChat
    ? [...page.activeChat.messages, ...(page.messages[page.activeChat.id] ?? [])]
    : [];
  const messageSearchIndex = Object.fromEntries(Object.entries(page.messages).map(([chatId, messages]) => [chatId, messages.map((message) => message.text).join(" ")]));

  return (
    <main className="app-backdrop min-h-dvh w-full bg-chat">
      <div className={`flex h-dvh min-h-0 w-full overflow-hidden bg-chat text-[#e5edf3] ${page.mobileOpen ? "mobile-chat" : ""}`}>
        <Sidebar
          chats={page.chats}
          profile={profile}
          accounts={[profile, ...accounts]}
          selected={page.selected}
          isLoadingChats={page.isLoadingChats}
          messageSearchIndex={messageSearchIndex}
          onSelect={(id) => void page.selectChat(id)}
          onSignOut={onSignOut}
          onNewMessage={() => { if (!isDemo) void page.openContacts(); }}
          onSwitchAccount={onSwitchAccount}
          onAddAccount={onAddAccount}
        />
        {page.activeChat ? (
          <ChatWindow
            key={page.activeChat.id}
            chat={page.activeChat}
            forwardingTargets={page.chats}
            messages={activeMessages}
            isLoadingMessages={page.isLoadingMessages}
            hasMoreMessages={page.hasMoreMessages}
            isLoadingOlderMessages={page.isLoadingOlderMessages}
            onLoadOlderMessages={() => void page.loadOlderMessages()}
            archived={page.activeChat.archived ?? false}
            error={page.loadError}
            onSend={(text, quotedMessage) => void page.send(text, quotedMessage)}
            onSendFiles={(files, quotedMessage, caption) => void page.sendFiles(files, quotedMessage, caption)}
            onBack={() => page.setMobileOpen(false)}
            onToggleArchive={() => void page.toggleArchive()}
            onDeleteMessage={(message, onlySenderDelete) => page.deleteMessage(message, onlySenderDelete)}
            showDeletedMessages={page.showDeletedMessages}
            onToggleDeletedMessages={page.toggleDeletedMessages}
            onForwardMessage={page.forwardMessage}
          />
        ) : (
          <section className="grid min-w-0 flex-1 place-items-center bg-chat-deep px-6 text-center text-sm text-[#a6b3bd] max-[760px]:hidden">
            {page.loadError ?? (page.isLoadingChats ? "Checking conversations…" : page.activeChat ? "" : "Select a chat")}
          </section>
        )}
      </div>
      <NewMessageDialog
        mode={page.dialog}
        contacts={page.contacts}
        busy={page.busy}
        error={page.contactsError}
        name={page.contactName}
        phone={page.contactPhone}
        groupName={page.groupName}
        groupMembers={page.groupMembers}
        onClose={() => page.setDialog("closed")}
        onModeChange={page.setDialog}
        onNameChange={page.setContactName}
        onPhoneChange={page.setContactPhone}
        onGroupNameChange={page.setGroupName}
        onGroupMembersChange={page.setGroupMembers}
        onSelectContact={(id) => void page.selectChat(id)}
        onSaveContact={(event) => void page.saveContact(event)}
        onSaveGroup={(event) => void page.saveGroup(event)}
      />
    </main>
  );
};
