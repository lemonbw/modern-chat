import { useEffect, useRef, useState, type FormEvent } from "react";
import { getAuthorizationState, sendAuthorizationPassword, waitForAuthorization } from "../api/greenApiAuth";
import type { UserProfile } from "../../../entities/user/types";

export const AuthorizationPassword = ({ onSignIn, requireFreshAuthorization = false }: { onSignIn: (profile: UserProfile) => void; requireFreshAuthorization?: boolean }) => {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => controllerRef.current?.abort(), []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setStatus("Checking password…");
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      if (requireFreshAuthorization && (await getAuthorizationState()) === "authorized") {
        setStatus("A separate GREEN-API instance is required to connect another account.");
        setBusy(false);
        return;
      }
      await sendAuthorizationPassword(password);
      if (controller.signal.aborted) return;
      setStatus("Waiting for authorization…");
      const profile = await waitForAuthorization(controller.signal, requireFreshAuthorization);
      if (profile) onSignIn(profile);
    } catch (error) {
      if (!controllerRef.current?.signal.aborted) {
        setStatus(error instanceof Error ? error.message : "Password authorization failed");
        setBusy(false);
      }
    }
  };

  return <form onSubmit={submit}>
    <label className="mt-4 mb-[7px] block text-left text-caption font-semibold text-[#b5c2cb]" htmlFor="auth-password">Telegram two-step verification password</label>
    <input className="h-[46px] w-full rounded-lg border border-[#40505c] bg-[#202c37] px-[13px] text-[#eaf2f7] outline-none focus:border-[#43b2e5]" id="auth-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={busy} />
    {status && <p role="status" className="mt-3 text-xs text-[#aab7c0]">{status}</p>}
    <button className="mt-5 h-[45px] w-full rounded-lg border-0 bg-chat-blue font-semibold text-white hover:bg-[#169bdf] disabled:opacity-60" type="submit" disabled={busy}>{busy ? "Checking…" : "Continue"}</button>
  </form>;
};
