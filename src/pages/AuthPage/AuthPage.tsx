import { useState } from "react";
import type { FormEvent } from "react";

export function AuthPage({ onSignIn }: { onSignIn: () => void }) {
  const [phoneMode, setPhoneMode] = useState(false);
  const [phone, setPhone] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSignIn();
  }

  return (
    <main className="auth-page">
      <span className="auth-decor decor-one">✳</span><span className="auth-decor decor-two">◇</span>
      <span className="auth-decor decor-three">⌁</span><span className="auth-decor decor-four">✧</span>
      <section className="auth-card">
        <div className="auth-logo" aria-hidden="true">➤</div>
        <h1>Modern Chat</h1>
        <p className="auth-subtitle">{phoneMode ? "Sign in with your phone number" : "Log in to continue to your messages"}</p>
        {phoneMode ? <form onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="phone">Phone number</label>
          <input className="auth-input" id="phone" type="tel" autoComplete="tel" placeholder="+1 555 000 0000" value={phone} onChange={(event) => setPhone(event.target.value)} required />
          <button className="auth-submit" type="submit">Continue</button>
        </form> : <>
          <div className="qr-frame" aria-label="QR code will appear here"><div className="qr-placeholder"><span>▦</span></div></div>
          <p className="qr-help">Open <strong>Modern Chat</strong> on your phone<br />and scan this QR code to log in</p>
          <button className="auth-link" onClick={() => setPhoneMode(true)}>Log in by phone number</button>
          <div className="auth-divider" />
          <button className="auth-link" onClick={onSignIn}>Continue in demo mode <span aria-hidden="true">→</span></button>
        </>}
        {phoneMode && <button className="auth-link" onClick={() => setPhoneMode(false)}>← Back to QR code</button>}
        <p className="auth-caption">Fast · Secure · <strong>Synced across your devices</strong></p>
      </section>
    </main>
  );
}
