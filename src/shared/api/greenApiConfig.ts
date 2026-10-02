const methods: Record<string, string> = {
  qr: "qr",
  getStateInstance: "getStateInstance",
  getAccountSettings: "getAccountSettings",
  logout: "logout",
  checkAccount: "checkAccount",
  sendAuthorizationPassword: "sendAuthorizationPassword",
  sendAuthorizationCode: "sendAuthorizationCode",
  getChats: "getChats",
  archiveChat: "archiveChat",
  unarchiveChat: "unarchiveChat",
  getContacts: "getContacts",
  getContactInfo: "getContactInfo",
  getGroupData: "getGroupData",
  getAvatar: "getAvatar",
  getChatHistory: "getChatHistory",
  getMessage: "getMessage",
  sendMessage: "sendMessage",
  forwardMessages: "forwardMessages",
  deleteMessage: "deleteMessage",
  addContact: "addContact",
  createGroup: "createGroup",
  uploadFile: "uploadFile",
  sendFileByUpload: "sendFileByUpload",
};

/**
 * The browser never sees the GREEN-API credentials: every call goes to the same-origin proxy,
 * which adds the instance and the token on the server.
 */
export const greenApiUrl = (method: string) => `/api/greenapi/${methods[method] ?? method}`;