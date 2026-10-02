import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { phoneAuth, sendAuthorizationCode } from "../lib/phoneAuth";
import { getAuthorizationState, greenApiErrorMessage, sendAuthorizationPassword, waitForAuthorization } from "../api/greenApiAuth";
import type { UserProfile } from "../../../entities/user/types";
import { PhoneNumberInput } from "../../../shared/ui/PhoneNumberInput";

const LoginByPhoneNumber = ({ onSignIn, requireFreshAuthorization = false }: { onSignIn: (profile: UserProfile) => void; requireFreshAuthorization?: boolean }) => {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [stage, setStage] = useState<"phone" | "code" | "password">("phone");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => controllerRef.current?.abort(), []);
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (phone.replace(/\D/g, "").length < 7) {
      setStatus("Enter a valid phone number with country code.");
      return;
    }
    setBusy(true);
    setStatus("Starting phone authorization…");
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      if (requireFreshAuthorization && (await getAuthorizationState()) === "authorized") {
        setStatus("A separate GREEN-API instance is required to connect another account.");
        setBusy(false);
        return;
      }
      const response = await phoneAuth(phone.replace(/\D/g, ""));
      if (response.data?.status === false) throw new Error(response.data.data?.reason || "Could not send Telegram login code");
      if (controller.signal.aborted) return;
      setStage("code");
      setStatus("Enter the Telegram login code sent to your account.");
      setBusy(false);
    } catch (error) {
      if (!controller.signal.aborted) {
        setStatus(greenApiErrorMessage(error, "Phone authorization failed"));
        setBusy(false);
      }
    }
  };

  const handleCodeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setStatus("Verifying Telegram code…");
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const response = await sendAuthorizationCode(code.trim());
      if (controller.signal.aborted) return;
      const reason = response.data?.data?.reason;
      if (reason?.toLowerCase() === "2fa_required") {
        setStage("password");
        setStatus("Enter your Telegram two-step verification password.");
        setBusy(false);
        return;
      }
      const state = await getAuthorizationState();
      if (controller.signal.aborted) return;
      if (state === "pendingPassword") {
        setStage("password");
        setStatus("Enter your Telegram two-step verification password.");
        setBusy(false);
        return;
      }
      if (response.data?.status === false) throw new Error(reason || "Telegram code was rejected");
      setStatus("Waiting for Telegram authorization…");
      const profile = await waitForAuthorization(controller.signal, requireFreshAuthorization);
      if (profile) onSignIn(profile);
    } catch (error) {
      if (!controller.signal.aborted) { setStatus(greenApiErrorMessage(error, "Telegram code verification failed")); setBusy(false); }
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setStatus("Verifying Telegram password…");
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const response = await sendAuthorizationPassword(password);
      if (controller.signal.aborted) return;
      if (response.data?.status === false) throw new Error(response.data.data?.reason || "Telegram password was rejected");
      const profile = await waitForAuthorization(controller.signal, requireFreshAuthorization);
      if (profile) onSignIn(profile);
    } catch (error) {
      if (!controller.signal.aborted) { setStatus(greenApiErrorMessage(error, "Telegram password verification failed")); setBusy(false); }
    }
  };

  return (
    <form onSubmit={stage === "phone" ? handleSubmit : stage === "code" ? handleCodeSubmit : handlePasswordSubmit}>
      <label
        className="mt-4 mb-[7px] block text-left text-caption font-semibold text-[#b5c2cb]"
        htmlFor="phone"
      >
        {stage === "phone" ? "Phone number" : stage === "code" ? "Telegram login code" : "Two-step verification password"}
      </label>
      {stage === "phone" ? <PhoneNumberInput
        id="phone"
        value={phone}
        onChange={setPhone}
        required
        disabled={busy}
      /> : <input id="phone" className="h-[45px] w-full rounded-lg border border-[#40505c] bg-[#202c37] px-3 text-sm text-white" type={stage === "code" ? "text" : "password"} value={stage === "code" ? code : password} onChange={(event) => stage === "code" ? setCode(event.target.value) : setPassword(event.target.value)} required disabled={busy} autoComplete={stage === "code" ? "one-time-code" : "current-password"} />}
      {status && <p role="status" className="mt-3 text-xs text-[#aab7c0]">{status}</p>}
      <button
        className="mt-5 h-[45px] w-full rounded-lg border-0 bg-chat-blue font-semibold text-white hover:bg-[#169bdf]"
        type="submit"
        disabled={busy}
      >
        {busy ? "Verifying…" : stage === "phone" ? "Send login code" : stage === "code" ? "Verify code" : "Verify password"}
      </button>
    </form>
  );
};

export default LoginByPhoneNumber;
