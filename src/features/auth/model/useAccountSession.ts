import { useEffect, useRef, useState } from "react";
import type { UserProfile } from "../../../entities/user/types";
import { unauthorizedEvent } from "../../../shared/api/greenApiClient";
import { logoutGreenApiInstance } from "../api/greenApiAuth";

const PROFILE_KEY = "modern-chat-profile";
const ACCOUNTS_KEY = "modern-chat-accounts";
const ADD_ACCOUNT_RETURN_KEY = "modern-chat-add-account-return";

const isDemoProfile = (profile: UserProfile | null) => profile?.isDemo ?? (profile?.name === "Demo User" && !profile.phone);

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

  const profileRef = useRef(profile);

  const leaveSession = () => {
    localStorage.removeItem(PROFILE_KEY);
    profileRef.current = null;
    setProfile(null);
    if (!window.location.pathname.startsWith("/login")) window.history.pushState({}, "", "/login");
  };

  // A 401 means GREEN-API rejected the instance credentials, so the only way forward is a new authorization.
  useEffect(() => {
    const onUnauthorized = () => {
      const current = profileRef.current;
      if (!current || isDemoProfile(current)) return;
      leaveSession();
    };
    window.addEventListener(unauthorizedEvent, onUnauthorized);
    return () => window.removeEventListener(unauthorizedEvent, onUnauthorized);
  }, []);

  const signIn = (next: UserProfile) => {
    const nextAccounts = [next, ...accounts.filter((account) => account.phone !== next.phone)];
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(nextAccounts));
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    setAccounts(nextAccounts);
    profileRef.current = next;
    setProfile(next);
    sessionStorage.removeItem(ADD_ACCOUNT_RETURN_KEY);
    setAddAccountReturn(null);
    if (!window.location.pathname.startsWith("/chat")) window.history.pushState({}, "", "/chat");
  };

  const signOut = async () => {
    const isDemo = isDemoProfile(profile);
    if (profile && !isDemo) {
      const loggedOut = await logoutGreenApiInstance();
      if (!loggedOut) throw new Error("GREEN-API did not confirm logout. The Telegram instance may still be connected.");
    }
    const isCurrentAccount = (account: UserProfile) => isDemoProfile(account) === isDemo
      && (profile?.phone ? account.phone === profile.phone : account.name === profile?.name);
    const nextAccounts = accounts.filter((account) => !isCurrentAccount(account));
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(nextAccounts));
    leaveSession();
    setAccounts(nextAccounts);
  };

  const switchAccount = (account: UserProfile) => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(account));
    profileRef.current = account;
    setProfile(account);
  };

  const addAccount = () => {
    if (profile) {
      sessionStorage.setItem(ADD_ACCOUNT_RETURN_KEY, JSON.stringify(profile));
      setAddAccountReturn(profile);
    }
    leaveSession();
  };

  const cancelAddAccount = () => {
    if (!addAccountReturn) return;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(addAccountReturn));
    sessionStorage.removeItem(ADD_ACCOUNT_RETURN_KEY);
    profileRef.current = addAccountReturn;
    setProfile(addAccountReturn);
    setAddAccountReturn(null);
    window.history.pushState({}, "", "/chat");
  };

  return { profile, accounts, isAddingAccount: Boolean(addAccountReturn), signIn, signOut, switchAccount, addAccount, cancelAddAccount };
};
