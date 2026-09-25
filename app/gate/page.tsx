"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Tela do gate de desenvolvedor. Propositalmente neutra: nada de nome, marca, textos ou componentes do app (nem os
 * catálogos de i18n), para não revelar o projeto a quem ainda não passou. 1º fator: login Google (conta autorizada);
 * 2º fator: PIN. Com DEV_GATE_GOOGLE=false, o 1º fator vira o usuário da equipe.
 */
type Status = { mode: "google" | "user"; googleDone: boolean; email: string | null };
const ERRORS: Record<string, string> = {
  conta_nao_autorizada: "This Google account is not authorized.",
  google_nao_configurado: "Google sign-in is not configured on this server.",
  google_cancelado: "Google sign-in was cancelled.",
  google_expirado: "The sign-in took too long. Try again.",
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function GateForm() {
  const sp = useSearchParams();
  const next = sp.get("next") ?? "/";
  const [status, setStatus] = useState<Status | null>(null);
  const [user, setUser] = useState(""); const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(() => { const e = sp.get("erro"); return e ? ERRORS[e] ?? "Google sign-in failed. Try again." : null; });
  useEffect(() => { fetch("/gate/status", { cache: "no-store" }).then((r) => r.json()).then(setStatus).catch(() => setStatus({ mode: "google", googleDone: false, email: null })); }, []);
  const firstDone = status?.mode === "user" ? user.trim().length > 0 : !!status?.googleDone;
  async function verify(e: React.FormEvent) {
    e.preventDefault(); if (!firstDone || !pin.trim()) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch("/gate/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user, pin, next }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { window.location.assign(j.next ?? "/"); return; }
      setPin("");
      setError(r.status === 429 ? "Too many attempts. Try again in 15 minutes." : r.status === 503 ? "Access is not configured on this server." : "Verification failed. Check your PIN.");
      if (status?.mode === "google") fetch("/gate/status", { cache: "no-store" }).then((x) => x.json()).then(setStatus).catch(() => undefined);
    } catch { setError("Network error. Try again."); } finally { setBusy(false); }
  }
  const googleHref = `/gate/google?next=${encodeURIComponent(next)}`;
  return (
    <main className="gate">
      <form className="gate-card" onSubmit={verify} noValidate>
        <p className="gate-kicker">/GATE</p>
        <h1 className="gate-title">{status?.mode === "user" ? "Enter your user and PIN" : "Sign in with Google and enter your PIN"}</h1>
        {status?.mode === "user" ? (
          <label className="gate-field"><span className="gate-label">User</span>
            <input className="gate-input" autoComplete="username" autoCapitalize="none" spellCheck={false} value={user} onChange={(e) => setUser(e.target.value)} /></label>
        ) : (
          <div className="gate-field"><span className="gate-label">Google sign-in</span>
            {status?.googleDone
              ? <p className="gate-google-done"><GoogleIcon /><span>{status.email}</span><a href={googleHref}>Switch</a></p>
              : <a className="gate-google" href={googleHref}><GoogleIcon /><span>Continuar com o Google</span></a>}
          </div>
        )}
        <label className="gate-field"><span className="gate-label">PIN password</span>
          <input className="gate-input gate-input-dark" type="password" inputMode="numeric" autoComplete="current-password" placeholder="Enter your PIN" value={pin} onChange={(e) => setPin(e.target.value)} disabled={!firstDone} /></label>
        {error && <p className="gate-error" role="alert">{error}</p>}
        <button type="submit" className="gate-submit" disabled={!firstDone || !pin.trim() || busy}>{busy ? "Verifying…" : "Verify PIN"}</button>
      </form>
    </main>
  );
}

export default function GatePage() { return <Suspense><GateForm /></Suspense>; }
