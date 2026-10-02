const { VITE_GREEN_API_URL, VITE_GREEN_API_INSTANCE, VITE_GREEN_API_TOKEN } = import.meta.env;

const methods: Record<string, string | undefined> = {
  qr: import.meta.env.VITE_GREEN_API_QR_METHOD,
  getStateInstance: import.meta.env.VITE_GREEN_API_STATE_METHOD,
  logout: import.meta.env.VITE_GREEN_API_LOGOUT_METHOD,
  // These Telegram endpoints are fixed. Ignoring legacy .env overrides prevents
  // WhatsApp's getSettings/getWaSettings values from breaking Telegram login.
  checkAccount: import.meta.env.VITE_GREEN_API_CHECK_ACCOUNT_METHOD,
  sendAuthorizationPassword: import.meta.env.VITE_GREEN_API_PASSWORD_METHOD,
  sendAuthorizationCode: import.meta.env.VITE_GREEN_API_CODE_METHOD,
  getChats: import.meta.env.VITE_GREEN_API_CHATS_METHOD,
  archiveChat: import.meta.env.VITE_GREEN_API_ARCHIVE_CHAT_METHOD,
  unarchiveChat: import.meta.env.VITE_GREEN_API_UNARCHIVE_CHAT_METHOD,
  getContacts: import.meta.env.VITE_GREEN_API_CONTACTS_METHOD,
  getContactInfo: import.meta.env.VITE_GREEN_API_CONTACT_INFO_METHOD,
  getAvatar: import.meta.env.VITE_GREEN_API_AVATAR_METHOD,
  getChatHistory: import.meta.env.VITE_GREEN_API_HISTORY_METHOD,
  getMessage: import.meta.env.VITE_GREEN_API_MESSAGE_METHOD,
  sendMessage: import.meta.env.VITE_GREEN_API_SEND_MESSAGE_METHOD,
  forwardMessages: import.meta.env.VITE_GREEN_API_FORWARD_MESSAGES_METHOD,
  deleteMessage: import.meta.env.VITE_GREEN_API_DELETE_MESSAGE_METHOD,
  addContact: import.meta.env.VITE_GREEN_API_ADD_CONTACT_METHOD,
  createGroup: import.meta.env.VITE_GREEN_API_CREATE_GROUP_METHOD,
};

export const greenApiUrl = (method: string) => {
  if (!VITE_GREEN_API_URL || !VITE_GREEN_API_INSTANCE || !VITE_GREEN_API_TOKEN) {
    throw new Error("Green API is not configured. Set VITE_GREEN_API_URL, VITE_GREEN_API_INSTANCE and VITE_GREEN_API_TOKEN in .env.local.");
  }
  const endpoint = methods[method] || method;
  return `${VITE_GREEN_API_URL.replace(/\/$/, "")}/waInstance${VITE_GREEN_API_INSTANCE}/${endpoint}/${VITE_GREEN_API_TOKEN}`;
};
