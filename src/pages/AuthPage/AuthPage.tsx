import { LuArrowLeft } from "react-icons/lu";
import { AppLogo } from "../../shared/ui/AppLogo";
import { useCallback, useState } from "react";
import LoginByQR from "../../features/auth/ui/LoginByQR";
import LoginByPhoneNumber from "../../features/auth/ui/LoginByPhoneNumber";
import { AuthorizationPassword } from "../../features/auth/ui/AuthorizationPassword";
import type { UserProfile } from "../../entities/user/types";

export const AuthPage = ({ onSignIn, isAddingAccount = false, onCancelAddAccount }: { onSignIn: (profile: UserProfile) => void; isAddingAccount?: boolean; onCancelAddAccount?: () => void }) => {
  const [mode, setMode] = useState<"qr" | "phone" | "password">("qr");
  const requirePassword = useCallback(() => setMode("password"), []);
  const signIn = useCallback((profile: UserProfile) => onSignIn(profile), [onSignIn]);

  return (
    <main className="auth-backdrop relative grid min-h-screen place-items-center overflow-hidden text-[#edf5fa] before:absolute before:-left-[240px] before:-top-[210px] before:size-[520px] before:rounded-full before:bg-[#2aabee0c] before:blur-[2px] after:absolute after:-right-[230px] after:-bottom-[210px] after:size-[460px] after:rounded-full after:bg-[#9d71ff0b]">
      <span className="absolute left-[17%] top-[17%] z-0 -rotate-[18deg] text-[28px] text-[#89bbd02b] max-[760px]:left-[6%] max-[760px]:top-[12%] max-[760px]:opacity-60">
        ✳
      </span>
      <span className="absolute right-[19%] top-[23%] z-0 rotate-[14deg] text-[23px] text-[#89bbd02b] max-[760px]:right-[7%] max-[760px]:top-[15%] max-[760px]:opacity-60">
        ◇
      </span>
      <span className="absolute bottom-[19%] left-[22%] z-0 text-xl text-[#89bbd02b] max-[760px]:bottom-[13%] max-[760px]:left-[7%] max-[760px]:opacity-60">
        ⌁
      </span>
      <span className="absolute right-[17%] bottom-[22%] z-0 -rotate-20 text-[28px] text-[#89bbd02b] max-[760px]:right-[7%] max-[760px]:bottom-[15%] max-[760px]:opacity-60">
        ✧
      </span>
      {isAddingAccount && onCancelAddAccount && (
        <button
          type="button"
          aria-label="Cancel and return to current account"
          title="Cancel and return to current account"
          onClick={onCancelAddAccount}
          className="fixed left-4 top-4 z-20 grid size-11 place-items-center rounded-full border border-[#40505c] bg-[#1b2632cc] text-2xl text-[#c6d2da] shadow-lg transition duration-200 hover:scale-105 hover:border-[#43b2e5] hover:bg-[#2aabee] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#43b2e5]"
        >
          <LuArrowLeft className="size-5" aria-hidden="true" />
        </button>
      )}
      <section className="z-[1] w-[min(420px,calc(100%-36px))] rounded-2xl border border-[#354452] bg-[#1b2632f2] px-[38px] pt-9 pb-[29px] text-center shadow-[0_25px_90px_#0007,0_1px_#ffffff08_inset] max-[760px]:px-[22px] max-[760px]:pt-[29px] max-[760px]:pb-[23px]">
        <AppLogo className="mx-auto mb-[17px] size-[58px] rounded-[15px] shadow-[0_10px_24px_#239ddb45]" />
        <h1 className="mb-[7px] text-[22px] tracking-[-.45px] text-[#f5f8fa]">
          Modern Chat
        </h1>
        <p className="mb-[22px] text-control text-[#a2b0bb]">
          {isAddingAccount ? "Connect another Telegram account" : mode === "phone"
            ? "Sign in with your phone number"
            : mode === "password"
              ? "Enter your Telegram two-step verification password"
            : "Log in to continue to your messages"}
        </p>
        {mode === "phone" ? (
          <LoginByPhoneNumber onSignIn={signIn} requireFreshAuthorization={isAddingAccount} />
        ) : mode === "password" ? (
          <AuthorizationPassword onSignIn={signIn} requireFreshAuthorization={isAddingAccount} />
        ) : (
          <>
            <div
              className="mx-auto mb-5 grid size-[204px] place-items-center rounded-[11px] bg-[#f4f7f9] p-3 shadow-[0_6px_28px_#0003] max-[760px]:size-[190px]"
              aria-label="QR code will appear here"
            >
            <LoginByQR onSignIn={signIn} onPasswordRequired={requirePassword} requireFreshAuthorization={isAddingAccount} />
            </div>
            <p className="mx-auto mb-5 max-w-[290px] text-xs leading-[1.55] text-[#aab7c0]">
              Open <strong>Telegram</strong> on your phone
              <br />
              and scan this QR code to log in
            </p>
            <button
              className="rounded border-0 bg-transparent px-[7px] py-[7px] text-control font-semibold text-[#51b9ed] hover:text-[#8bd5ff]"
              onClick={() => setMode("phone")}
            >
              Log in by phone number
            </button>
            <div className="my-[18px] h-px bg-[#34414d]" />
            <button
              className="rounded border-0 bg-transparent px-[7px] py-[7px] text-control font-semibold text-[#51b9ed] hover:text-[#8bd5ff]"
              onClick={() => onSignIn({ name: "Demo User", phone: "", avatar: null, isDemo: true })}
            >
              Continue in demo mode <span aria-hidden="true">→</span>
            </button>
          </>
        )}
        {mode !== "qr" && (
          <button
            className="rounded border-0 bg-transparent px-[7px] py-[7px] text-control font-semibold text-[#51b9ed] hover:text-[#8bd5ff]"
            onClick={() => setMode("qr")}
          >
            <LuArrowLeft className="mr-1 size-[15px]" aria-hidden="true" /> Back to QR code
          </button>
        )}
        <p className="mt-[15px] text-caption text-[#738390]">
          Fast · Secure ·{" "}
          <strong className="font-medium text-[#91a3b0]">
            Synced across your devices
          </strong>
        </p>
      </section>
    </main>
  );
};
