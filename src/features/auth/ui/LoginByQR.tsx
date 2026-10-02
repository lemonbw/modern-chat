import { useEffect, useState } from "react";
import { getAuthorizationState, getQr, getUserProfile, greenApiErrorMessage } from "../api/greenApiAuth";
import type { UserProfile } from "../../../entities/user/types";

type QrState = { image: string | null; message: string; loading: boolean };

const LoginByQR = ({ onSignIn, onPasswordRequired, requireFreshAuthorization = false }: { onSignIn: (profile: UserProfile) => void; onPasswordRequired: () => void; requireFreshAuthorization?: boolean }) => {
  const [qrState, setQrState] = useState<QrState>({ image: null, message: "Waiting for QR code…", loading: true });

  useEffect(() => {
    const controller = new AbortController();
    let loadingQr = false;
    let checkingState = false;
    let completed = false;
    let newQrWasPresented = false;
    let qrWasScanned = false;
    const refresh = async () => {
      if (loadingQr || completed || controller.signal.aborted) return;
      loadingQr = true;
      try {
        const qr = await getQr();
        if (controller.signal.aborted) return;
        if (qr.type === "passkeyRequired") {
          completed = true;
          onPasswordRequired();
          return;
        }
        if (qr.type === "qrCode" && qr.message) {
          newQrWasPresented = true;
          setQrState({ image: `data:image/png;base64,${qr.message}`, message: "Scan this code with Telegram", loading: false });
        } else if (qr.type === "alreadyLogged" || qr.type === "already_registered") {
          if (newQrWasPresented) qrWasScanned = true;
          setQrState((current) => ({
            ...current,
            message: requireFreshAuthorization && !qrWasScanned
              ? "A separate GREEN-API instance is required to connect another account."
              : "Checking signed-in account…",
            loading: !requireFreshAuthorization || qrWasScanned,
          }));
        } else if (qr.type === "timeout") {
          setQrState((current) => ({ ...current, message: "Refreshing QR code…", loading: true }));
        } else if (qr.type === "error") {
          setQrState((current) => ({ ...current, message: qr.message || "Could not load QR code", loading: false }));
        }
      } catch (error) {
        if (!controller.signal.aborted) setQrState((current) => ({ ...current, message: `${greenApiErrorMessage(error, "Could not reach Green API")}. Retrying…`, loading: false }));
      } finally {
        loadingQr = false;
      }
    };
    const checkAuthorization = async () => {
      if (checkingState || completed || controller.signal.aborted) return;
      if (requireFreshAuthorization && !qrWasScanned) return;
      checkingState = true;
      try {
        const authorizationState = await getAuthorizationState();
        if (authorizationState === "pendingPassword") {
          completed = true;
          onPasswordRequired();
          return;
        }
        if (authorizationState === "authorized") {
          const profile = await getUserProfile();
          if (!controller.signal.aborted) {
            completed = true;
            onSignIn(profile);
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setQrState((current) => ({ ...current, message: `${greenApiErrorMessage(error, "Could not check Telegram authorization state")}. Retrying…`, loading: false }));
        }
      } finally {
        checkingState = false;
      }
    };
    void refresh();
    void checkAuthorization();
    const qrTimer = window.setInterval(() => void refresh(), 5000);
    const stateTimer = window.setInterval(() => void checkAuthorization(), 15_000);
    return () => { controller.abort(); window.clearInterval(qrTimer); window.clearInterval(stateTimer); };
  }, [onPasswordRequired, onSignIn, requireFreshAuthorization]);

  return <div className="grid justify-items-center gap-2">
    {qrState.image ? <img src={qrState.image} alt="Telegram login QR code" width={300} height={300} /> : <span className="grid size-[176px] place-items-center px-3 text-center text-xs text-[#52606b]">{qrState.loading ? "Loading QR…" : qrState.message || "Could not load the QR code"}</span>}
    {qrState.image && <span className="text-center text-[11px] text-[#52606b]">{qrState.message}</span>}
  </div>;
};

export default LoginByQR;
