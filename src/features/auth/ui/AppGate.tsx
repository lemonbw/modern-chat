import { useState } from "react";
import { AppLogo } from "../../../shared/ui/AppLogo";
import { sessionError } from "../../../shared/api/session";

type Props = { onSignIn: (password: string) => Promise<unknown> };

/** The outer gate: until the app password is entered the instance stays unreachable. */
export const AppGate = ({ onSignIn }: Props) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError("");
    try {
      await onSignIn(password);
      setPassword("");
    } catch (signInError) {
      setError(sessionError(signInError, "Could not sign in"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-backdrop relative grid min-h-screen place-items-center overflow-hidden text-[#edf5fa]">
      <section className="z-[1] w-[min(420px,calc(100%-36px))] rounded-2xl border border-[#354452] bg-[#1b2632f2] px-[38px] pt-9 pb-[29px] text-center shadow-[0_25px_90px_#0007,0_1px_#ffffff08_inset] max-[760px]:px-[22px]">
        <AppLogo className="mx-auto mb-[17px] size-[58px] rounded-[15px] shadow-[0_10px_24px_#239ddb45]" />
        <h1 className="mb-[7px] text-[22px] tracking-[-.45px] text-[#f5f8fa]">Modern Chat</h1>
        <p className="mb-[22px] text-control text-[#a2b0bb]">Enter the app password to open your messages</p>
        <form onSubmit={(event) => void submit(event)} className="grid gap-3">
          <label className="sr-only" htmlFor="app-password">App password</label>
          <input
            id="app-password"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className="w-full rounded-lg border border-[#3a4a58] bg-[#131d26] px-3 py-2.5 text-sm text-[#e6eef4] outline-none focus:border-[#43b2e5]"
          />
          <button type="submit" disabled={!password || busy} className="rounded-lg bg-[#2aabee] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#38bdf0] disabled:opacity-50">{busy ? "Checking…" : "Sign in"}</button>
        </form>
        {error && <p role="alert" className="mt-4 text-xs text-red-300">{error}</p>}
        <p className="mt-[15px] text-caption text-[#738390]">This app talks to one Telegram instance. Its token never leaves the server.</p>
      </section>
    </main>
  );
};