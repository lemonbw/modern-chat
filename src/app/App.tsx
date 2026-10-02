import "../App.css";
import { AppGate } from "../features/auth/ui/AppGate";
import { WriteGrantPrompt } from "../features/auth/ui/WriteGrantPrompt";
import { useAppSession } from "../features/auth/model/useAppSession";
import { AuthPage } from "../pages/AuthPage/AuthPage";
import { ChatPage } from "../pages/ChatPage/ChatPage";
import { useAccountSession } from "../features/auth/model/useAccountSession";

const App = () => {
  const gate = useAppSession();
  const { profile, accounts, isAddingAccount, signIn, signOut, switchAccount, addAccount, cancelAddAccount } = useAccountSession();

  if (gate.status === "loading") return null;

  return (
    <>
      {gate.status === "guest" ? <AppGate onSignIn={gate.signIn} /> : profile ? (
        <ChatPage key={profile.isDemo ?? (profile.name === "Demo User" && !profile.phone) ? "demo" : "connected"} profile={profile} accounts={accounts} onSwitchAccount={switchAccount} onAddAccount={addAccount} onSignOut={signOut} />
      ) : (
        <AuthPage onSignIn={signIn} isAddingAccount={isAddingAccount} onCancelAddAccount={cancelAddAccount} />
      )}
      {gate.status === "ready" && (
        <WriteGrantPrompt writesEnabled={gate.writesEnabled} onGrant={gate.grantWrites} />
      )}
    </>
  );
};

export default App;