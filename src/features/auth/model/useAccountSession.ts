import { useState } from "react";
import type { UserProfile } from "../../../entities/user/types";
import { logoutGreenApiInstance } from "../api/greenApiAuth";

const PROFILE_KEY = "modern-chat-profile";
const ACCOUNTS_KEY = "modern-chat-accounts";
const ADD_ACCOUNT_RETURN_KEY = "modern-chat-add-account-return";

const readProfile = (): UserProfile | null => {
  try {
    const saved = localStorage.getItem(PROFILE_KEY);
    return saved ? JSON.parse(saved) as UserProfile : null;
  } catch {
    return null;
  }
};

const readAccounts = (): UserProfile[] => {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? "[]") as UserProfile[];
  } catch {
    return [];
  }
};

export const useAccountSession = () => {
  const [profile, setProfile] = useState<UserProfile | null>(readProfile);
  const [accounts, setAccounts] = useState<UserProfile[]>(readAccounts);
  const [addAccountReturn, setAddAccountReturn] = useState<UserProfile | null>(() => {
    try {
      const saved = sessionStorage.getItem(ADD_ACCOUNT_RETURN_KEY);
      return saved ? JSON.parse(saved) as UserProfile : null;
    } catch {
      return null;
    }
  });

  const signIn = (next: UserProfile) => {
    const nextAccounts = [next, ...accounts.filter((account) => account.phone !== next.phone)];
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(nextAccounts));
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    setAccounts(nextAccounts);
    setProfile(next);
    sessionStorage.removeItem(ADD_ACCOUNT_RETURN_KEY);
    setAddAccountReturn(null);
    if (!window.location.pathname.startsWith("/chat")) window.history.pushState({}, "", "/chat");
  };

  const signOut = async () => {
    const isDemo = profile?.isDemo ?? (profile?.name === "Demo User" && !profile.phone);
    if (profile && !isDemo) {
      const loggedOut = await logoutGreenApiInstance();
      if (!loggedOut) throw new Error("GREEN-API did not confirm logout. The Telegram instance may still be connected.");
    }
    const isCurrentAccount = (account: UserProfile) => (account.isDemo ?? (account.name === "Demo User" && !account.phone)) === isDemo
      && (profile?.phone ? account.phone === profile.phone : account.name === profile?.name);
    const nextAccounts = accounts.filter((account) => !isCurrentAccount(account));
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(nextAccounts));
    localStorage.removeItem(PROFILE_KEY);
    setAccounts(nextAccounts);
    setProfile(null);
    window.history.pushState({}, "", "/login");
  };

  const switchAccount = (account: UserProfile) => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(account));
    setProfile(account);
  };

  const addAccount = () => {
    if (profile) {
      sessionStorage.setItem(ADD_ACCOUNT_RETURN_KEY, JSON.stringify(profile));
      setAddAccountReturn(profile);
    }
    localStorage.removeItem(PROFILE_KEY);
    setProfile(null);
    window.history.pushState({}, "", "/login");
  };

  const cancelAddAccount = () => {
    if (!addAccountReturn) return;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(addAccountReturn));
    sessionStorage.removeItem(ADD_ACCOUNT_RETURN_KEY);
    setProfile(addAccountReturn);
    setAddAccountReturn(null);
    window.history.pushState({}, "", "/chat");
  };

  return { profile, accounts, isAddingAccount: Boolean(addAccountReturn), signIn, signOut, switchAccount, addAccount, cancelAddAccount };
};
