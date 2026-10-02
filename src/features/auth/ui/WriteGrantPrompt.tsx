import { useEffect, useState } from "react";
import { writeGrantEvent, type WriteGrantRequest } from "../../../shared/api/greenApiClient";
import { sessionError } from "../../../shared/api/session";

type Props = {
  writesEnabled: boolean;
  onGrant: (password: string) => Promise<unknown>;
};

/** Sends, deletes and anything else that changes state ask for the write password once. */
export const WriteGrantPrompt = ({ writesEnabled, onGrant }: Props) => {
  const [request, setRequest] = useState<WriteGrantRequest | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onRequest = (event: Event) => {
      setPassword("");
      setError("");
      setRequest((event as CustomEvent<WriteGrantRequest>).detail);
    };
    window.addEventListener(writeGrantEvent, onRequest);
    return () => window.removeEventListener(writeGrantEvent, onRequest);
  }, []);

  if (!request) return null;

  const close = () => {
    setRequest(null);
    setPassword("");
    setError("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError("");
    try {
      await onGrant(password);
      await request.retry();
      close();
    } catch (grantError) {
      setError(sessionError(grantError, "Could not confirm the write password"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Confirm write access" className="fixed inset-0 z-50 grid place-items-center bg-[#050a0ecc] px-4">
      <form onSubmit={(event) => void submit(event)} className="w-[min(400px,100%)] rounded-2xl border border-[#354452] bg-[#1b2632] p-6 text-center shadow-[0_25px_90px_#0009]">
        <h2 className="mb-2 text-lg text-[#f5f8fa]">{writesEnabled ? "Confirm write access" : "This deployment is read only"}</h2>
        <p className="mb-5 text-control text-[#a2b0bb]">{writesEnabled ? "Sending, deleting and changing chats needs the write password." : "Sending and deleting are disabled by the server configuration."}</p>
        {writesEnabled && (
          <>
            <label className="sr-only" htmlFor="write-password">Write password</label>
            <input
              id="write-password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Write password"
              className="mb-3 w-full rounded-lg border border-[#3a4a58] bg-[#131d26] px-3 py-2.5 text-sm text-[#e6eef4] outline-none focus:border-[#43b2e5]"
            />
            <button type="submit" disabled={!password || busy} className="w-full rounded-lg bg-[#2aabee] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#38bdf0] disabled:opacity-50">{busy ? "Checking…" : "Continue"}</button>
          </>
        )}
        {error && <p role="alert" className="mt-4 text-xs text-red-300">{error}</p>}
        <button type="button" onClick={close} className="mt-4 text-xs text-[#8bd5ff] hover:underline">Cancel</button>
      </form>
    </div>
  );
};

export default WriteGrantPrompt;