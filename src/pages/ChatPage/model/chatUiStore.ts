import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type ChatUiState = {
  selectedChatId: string | null;
  mobileOpen: boolean;
  showDeletedMessages: boolean;
  selectChat: (chatId: string | null) => void;
  openMobileChat: (chatId: string) => void;
  closeMobileChat: () => void;
  toggleDeletedMessages: () => void;
};

/**
 * UI state survives a refresh of the same tab: the open chat, the mobile view and the
 * "show deleted messages" switch are kept in sessionStorage, not localStorage.
 */
export const useChatUiStore = create<ChatUiState>()(persist(
  (set) => ({
    selectedChatId: null,
    mobileOpen: false,
    showDeletedMessages: false,
    selectChat: (chatId) => set({ selectedChatId: chatId }),
    openMobileChat: (chatId) => set({ selectedChatId: chatId, mobileOpen: true }),
    closeMobileChat: () => set({ mobileOpen: false }),
    toggleDeletedMessages: () => set((state) => ({ showDeletedMessages: !state.showDeletedMessages })),
  }),
  {
    name: "modern-chat-ui",
    storage: createJSONStorage(() => sessionStorage),
    partialize: (state) => ({
      selectedChatId: state.selectedChatId,
      mobileOpen: state.mobileOpen,
      showDeletedMessages: state.showDeletedMessages,
    }),
  },
));