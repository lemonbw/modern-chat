import "../App.css";
import { AuthPage } from "../pages/AuthPage/AuthPage";
import { ChatPage } from "../pages/ChatPage/ChatPage";
import { useAccountSession } from "../features/auth/model/useAccountSession";

const App = () => {
  const { profile, accounts, isAddingAccount, signIn, signOut, switchAccount, addAccount, cancelAddAccount } = useAccountSession();
  return profile ? (
    <ChatPage key={profile.isDemo ?? (profile.name === "Demo User" && !profile.phone) ? "demo" : "connected"} profile={profile} accounts={accounts} onSwitchAccount={switchAccount} onAddAccount={addAccount} onSignOut={signOut} />
  ) : (
    <AuthPage onSignIn={signIn} isAddingAccount={isAddingAccount} onCancelAddAccount={cancelAddAccount} />
  );
};

export default App;
