import { useState } from "react";
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
export const SidebarAccountBar = ({ profile, accounts, onSignOut, onSwitchAccount, onAddAccount }: Props) => {
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

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() || profile.name;
  const phone = formatPhone(profile.phone);

  return (
    <div className="relative mt-auto flex items-center gap-2.5 border-t border-chat-border bg-chat px-[15px] py-3">
      <span className="avatar avatar-small overflow-hidden" style={{ background: "linear-gradient(145deg,#93bbc6,#477e91)" }}>
        {profile.avatar ? <img className="size-full object-cover" src={profile.avatar} alt="" /> : profile.name.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <strong className="block truncate text-xs text-[#e1ebf1]">{fullName}</strong>
        {profile.nickname && <span className="block truncate text-2xs text-[#8fa1ae]">@{profile.nickname.replace(/^@/, "")}</span>}
        {phone && <span className="block truncate text-2xs text-[#8fa1ae]">{phone}</span>}
      </div>
      <button className="icon-button" aria-label="Account options" title="Account options" onClick={() => setIsMenuOpen((open) => !open)}>⋯</button>
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
};