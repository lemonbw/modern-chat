import { useEffect, useRef, useState } from "react";
import type { UserProfile } from "../../../entities/user/types";
import { unauthorizedEvent } from "../../../shared/api/greenApiClient";
import { getUserProfile, logoutGreenApiInstance } from "../api/greenApiAuth";

const PROFILE_KEY = "modern-chat-profile";
const ACCOUNTS_KEY = "modern-chat-accounts";
const ADD_ACCOUNT_RETURN_KEY = "modern-chat-add-account-return";

const isDemoProfile = (profile: UserProfile | null) => profile?.isDemo ?? (profile?.name === "Demo User" && !profile.phone);

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/** Older builds stored the Telegram username in the name fields, so those need one fresh fetch. */
const looksLikeNicknameOnly = (profile: UserProfile) => {
  const nickname = (profile.nickname ?? "").replace(/^@/, "");
  const first = (profile.firstName ?? "").replace(/^@/, "");
  const name = (profile.name ?? "").replace(/^@/, "");
  if (!nickname) return !first;
  return !first || first === nickname || name === nickname;
};

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

  useEffect(() => {
    const onUnauthorized = () => {
      const current = profileRef.current;
      if (!current || isDemoProfile(current)) return;
      leaveSession();
    };
    window.addEventListener(unauthorizedEvent, onUnauthorized);
    return () => window.removeEventListener(unauthorizedEvent, onUnauthorized);
  }, []);

  const profileRefreshRef = useRef(false);

const retryRefresh = async (refresh: (attempt: number) => Promise<void>, attempt: number) => {
  await wait(1_200 * (attempt + 1));
  await refresh(attempt + 1);
};

  const isAliveRef = useRef(true);
  useEffect(() => {
    isAliveRef.current = true;
    return () => { isAliveRef.current = false; };
  }, []);

  useEffect(() => {
    const current = profileRef.current;
    if (!current || isDemoProfile(current) || !looksLikeNicknameOnly(current) || profileRefreshRef.current) return;
    profileRefreshRef.current = true;

    const refresh = async (attempt: number) => {
      try {
        const fresh = await getUserProfile();
        if (!isAliveRef.current) return;
        const merged: UserProfile = { ...fresh, isDemo: current.isDemo };
        setProfile(merged);
        setAccounts((existing) => {
          const next = [merged, ...existing.filter((account) => account.phone !== merged.phone)];
          localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next));
          return next;
        });
        profileRef.current = merged;
        localStorage.setItem(PROFILE_KEY, JSON.stringify(merged));
        if (!fresh.firstName && attempt < 2) await retryRefresh(refresh, attempt);
      } catch {
        if (attempt < 2) await retryRefresh(refresh, attempt);
      }
    };

    void refresh(0);
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
