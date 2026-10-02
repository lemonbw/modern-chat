import { useCallback, useEffect, useState } from "react";
import { sessionExpiredEvent } from "../../../shared/api/greenApiClient";
import { fetchAppSession, requestWriteGrant, signInToApp, signOutOfApp, type AppSessionStatus } from "../../../shared/api/session";

export type AppGateState = AppSessionStatus & { status: "loading" | "guest" | "ready" };

const loading: AppGateState = { status: "loading", authenticated: false, writesEnabled: true, writeGranted: false };
const guest = (writesEnabled: boolean): AppGateState => ({ status: "guest", authenticated: false, writesEnabled, writeGranted: false });

/** Owns the app password session. The GREEN-API credential never reaches the browser. */
export const useAppSession = () => {
  const [state, setState] = useState<AppGateState>(loading);

  useEffect(() => {
    let alive = true;
    void fetchAppSession().then((session) => {
      if (alive) setState({ ...session, status: session.authenticated ? "ready" : "guest" });
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const onExpired = () => setState((current) => guest(current.writesEnabled));
    window.addEventListener(sessionExpiredEvent, onExpired);
    return () => window.removeEventListener(sessionExpiredEvent, onExpired);
  }, []);

  const signIn = useCallback(async (password: string) => {
    const session = await signInToApp(password);
    setState({ ...session, status: session.authenticated ? "ready" : "guest" });
    return session;
  }, []);

  const grantWrites = useCallback(async (password: string) => {
    const session = await requestWriteGrant(password);
    setState((current) => ({ ...current, ...session }));
    return session;
  }, []);

  const signOut = useCallback(async () => {
    const session = await signOutOfApp();
    setState(guest(session.writesEnabled));
  }, []);

  return { ...state, signIn, grantWrites, signOut };
};