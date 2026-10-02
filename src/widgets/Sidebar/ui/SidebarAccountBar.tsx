import { memo, useState } from "react";
import { LuEllipsisVertical } from "react-icons/lu";
import type { UserProfile } from "../../../entities/user/types";
import { formatPhone } from "../../../shared/lib/phone";

type Props = {
  profile: UserProfile;
  accounts: UserProfile[];
  onSignOut: () => Promise<void>;
  onSwitchAccount: (account: UserProfile) => void;
  onAddAccount: () => void;
};

/** Account bar at the bottom of the sidebar: names, Telegram nickname, phone and the account menu. */
export const SidebarAccountBar = memo(({ profile, accounts, onSignOut, onSwitchAccount, onAddAccount }: Props) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    setSignOutError("");
    try {
      await onSignOut();
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : "Could not log out of Telegram");
      setIsMenuOpen(true);
    } finally {
      setSigningOut(false);
    }
  };

  const nickname = profile.nickname?.replace(/^@/, "") ?? "";
  const firstName = profile.firstName?.trim() ?? "";
  const lastName = profile.lastName?.trim() ?? "";

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()
    || (profile.name.replace(/^@/, "") !== nickname ? profile.name : "");
  const phone = formatPhone(profile.phone);

  return (
    <div className="relative mt-auto flex items-center gap-2.5 border-t border-chat-border bg-chat px-[15px] py-3">
      <span className="avatar avatar-small grid place-items-center overflow-hidden rounded-full font-semibold text-white" style={{ background: "linear-gradient(145deg,#93bbc6,#477e91)" }}>
        {profile.avatar ? <img className="size-full object-cover" src={profile.avatar} alt="" /> : (fullName || nickname || profile.name).slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <strong className="block truncate text-xs text-[#e1ebf1]">{fullName || "Telegram user"}</strong>
        {nickname && <span className="block truncate text-2xs text-[#8fa1ae]">@{nickname}</span>}
        <span className="block truncate text-2xs text-[#8fa1ae]">{phone || "unknown number"}</span>
      </div>
      <button className="icon-button" aria-label="Account options" title="Account options" onClick={() => setIsMenuOpen((open) => !open)}><LuEllipsisVertical className="size-[18px]" /></button>
      {isMenuOpen && (
        <div className="absolute right-3 bottom-[calc(100%-4px)] z-10 w-56 rounded-lg border border-chat-border bg-[#1c2934] p-1.5 shadow-xl">
          {accounts.filter((account) => account.phone !== profile.phone).map((account) => (
            <button key={account.phone} className="block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-[#2a3946]" onClick={() => { setIsMenuOpen(false); onSwitchAccount(account); }}>Switch to {account.name}</button>
          ))}
          <button className="block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-[#2a3946]" onClick={() => { setIsMenuOpen(false); onAddAccount(); }}>Add account</button>
          <button className="block w-full rounded-md px-3 py-2 text-left text-xs text-red-300 hover:bg-[#2a3946] disabled:opacity-60" disabled={signingOut} onClick={() => void handleSignOut()}>{signingOut ? "Logging out…" : "Log out"}</button>
          {signOutError && <p role="alert" className="px-3 py-2 text-xs text-red-300">{signOutError}</p>}
        </div>
      )}
    </div>
  );
});