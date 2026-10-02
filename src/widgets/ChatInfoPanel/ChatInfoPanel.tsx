import type { ChatMessage, Conversation } from "../../entities/chat/types";
import { mediaCountLabel, type InfoItem } from "../../features/contacts/model/chatInfo";
import { useInfoPanel } from "./model/useInfoPanel";
import { phoneOf, usernameOf } from "./model/infoValues";
import { ProfileDetails, ProfileSummary, ItemTile } from "./ui/InfoSections";
import { InfoTabs } from "./ui/InfoTabs";
import { emptyTabLabel } from "./model/infoLabels";
import { ProfileEditor } from "./ui/ProfileEditor";

const tabCountLabel = (model: ReturnType<typeof useInfoPanel>, messages: ChatMessage[]) => {
  if (model.activeTab === "members") return `${model.totalMembers} ${model.totalMembers === 1 ? "member" : "members"}`;
  if (model.activeTab === "media") return mediaCountLabel(messages, { showPhotos: model.showPhotos, showVideos: model.showVideos }) || "No media";
  return `${model.items.length} ${model.activeTab}`;
};

export const ChatInfoPanel = ({ chat, messages, onClose }: { chat: Conversation; messages: ChatMessage[]; onClose: () => void }) => {
  const model = useInfoPanel(chat, messages);
  const isGroup = chat.group === true;

  return (
    <aside className="z-20 flex w-full shrink-0 flex-col border-l border-chat-border bg-chat shadow-[-8px_0_24px_#0004] max-[1100px]:absolute max-[1100px]:inset-y-0 max-[1100px]:right-0 max-[1100px]:w-[330px] max-[760px]:w-full max-[760px]:shadow-none">
      <PanelHeader model={model} messages={messages} isGroup={isGroup} onClose={onClose} />
      <div className="flex-1 overflow-auto">
        {model.isEditing && !model.isPreview ? (
          <ProfileEditor chat={chat} model={model} />
        ) : (
          <>
            {model.isPreview && !model.isEditing && (
              <ProfileSummary
                chat={chat}
                displayName={model.displayName}
                lastSeenText={model.lastSeenText}
                avatar={model.stored?.avatar ?? chat.avatar ?? null}
                isExpanded={model.isAvatarExpanded}
                onToggleAvatar={model.toggleAvatar}
              />
            )}
            {model.isPreview && !model.isEditing && (
              <ProfileDetails
                isGroup={isGroup}
                phone={isGroup ? "—" : phoneOf(chat.id, model.contact?.phoneNumber)}
                username={usernameOf(isGroup ? model.group?.username : model.contact?.username)}
                birthday={model.stored?.birthday ?? ""}
                link={model.group?.groupInviteLink}
                about={model.group?.description}
                notificationsOn={model.stored?.notifications !== false}
                onToggleNotifications={model.setNotifications}
              />
            )}
            <InfoTabs tabs={model.tabs} activeTab={model.activeTab} onSelect={model.selectTab} />
            {model.visibleItems.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-[#8697a5]">{emptyTabLabel(model.activeTab, isGroup)}</p>
            ) : (
              <div
                onScroll={(event) => {
                  const list = event.currentTarget;
                  if (!model.isPreview && list.scrollHeight - list.scrollTop - list.clientHeight < 120) model.loadMore();
                }}
                className="grid grid-cols-3 gap-1 p-3"
              >
                {model.visibleItems.map((item: InfoItem) => <ItemTile key={item.id} item={item} onOpen={model.openTab} />)}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};

const PanelHeader = ({ model, messages, isGroup, onClose }: { model: ReturnType<typeof useInfoPanel>; messages: ChatMessage[]; isGroup: boolean; onClose: () => void }) => (
  <header className="flex h-[62px] shrink-0 items-center gap-3 border-b border-[#202d39] px-4">
    {model.openedTab
      ? <button className="icon-button" aria-label="Back to info" title="Back" onClick={model.closeTab}>←</button>
      : <button className="icon-button" aria-label="Close info" title="Close" onClick={onClose}>×</button>}
    <div className="min-w-0 flex-1">
      {model.openedTab
        ? (
            <>
              <strong className="block truncate text-sm text-[#f1f5f7]">{model.displayName}</strong>
              <span className="block truncate text-2xs text-[#8fa1ae]">{tabCountLabel(model, messages)}</span>
            </>
          )
        : <strong className="text-sm text-[#f1f5f7]">{isGroup ? "Group Info" : "User Info"}</strong>}
    </div>
    {!model.openedTab && !isGroup && (
      <button className="rounded-md border-0 bg-transparent px-2 py-1 text-xs font-semibold text-chat-blue hover:bg-[#253441]" onClick={model.toggleEditing}>Edit</button>
    )}
    {model.openedTab && model.activeTab === "media" && (
      <div className="relative">
        <button className="icon-button" aria-label="Media filters" title="Media filters" onClick={model.toggleFilter}>⋯</button>
        {model.isFilterOpen && (
          <div className="absolute top-11 right-0 z-20 w-48 rounded-lg border border-chat-border bg-[#1c2934] p-1.5 shadow-xl">
            <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-xs hover:bg-[#2a3946]">
              Photos
              <input type="checkbox" className="size-3.5 accent-chat-blue" checked={model.showPhotos} onChange={(event) => model.setShowPhotos(event.target.checked)} />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-xs hover:bg-[#2a3946]">
              Videos
              <input type="checkbox" className="size-3.5 accent-chat-blue" checked={model.showVideos} onChange={(event) => model.setShowVideos(event.target.checked)} />
            </label>
          </div>
        )}
      </div>
    )}
  </header>
);