export type UserProfile = {
  name: string;
  phone: string;
  avatar: string | null;
  firstName?: string;
  lastName?: string;
  /** Telegram username, kept apart from the first and last name shown in the sidebar. */
  nickname?: string;
  isDemo?: boolean;
};

/** "Leon Gray" -> { firstName: "Leon", lastName: "Gray" } */
export const splitFullName = (name: string) => {
  const [firstName = "", ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(" ") };
};
