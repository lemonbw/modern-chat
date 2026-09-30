import { useState } from "react";
import "../App.css";
import { AuthPage } from "../pages/AuthPage/AuthPage";
import { ChatPage } from "../pages/ChatPage/ChatPage";

export default function App() {
  const [signedIn, setSignedIn] = useState(false);
  return signedIn ? <ChatPage onSignOut={() => setSignedIn(false)} /> : <AuthPage onSignIn={() => setSignedIn(true)} />;
}
