"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Field, Input } from "@/components/ui";

/** Tela do gate de desenvolvedor: aparece antes de qualquer página enquanto o app não é público. */
function GateForm() {
  const { t } = useI18n(); const sp = useSearchParams();
  const [user, setUser] = useState(""); const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const r = await fetch("/gate/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user, pin, next: sp.get("next") ?? "/" }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { window.location.assign(j.next ?? "/"); return; }
      setError(r.status === 429 ? t("gate.muitas_tentativas") : r.status === 503 ? t("gate.nao_configurado") : t("gate.invalido"));
      setPin("");
    } catch { setError(t("gate.falha_rede")); } finally { setBusy(false); }
  }
  return (
    <main className="gate">
      <form className="gate-card" onSubmit={submit} noValidate>
        <p className="label">{t("gate.marca")}</p>
        <h1 className="type-h2">{t("gate.titulo")}</h1>
        <p className="type-body-sm text-muted">{t("gate.lead")}</p>
        <Field label={t("gate.usuario")} id="gate-user"><Input id="gate-user" autoComplete="username" autoCapitalize="none" spellCheck={false} value={user} onChange={(e) => setUser(e.target.value)} required /></Field>
        <Field label={t("gate.pin")} id="gate-pin"><Input id="gate-pin" type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} required /></Field>
        {error && <p className="type-body-sm gate-error" role="alert">{error}</p>}
        <Button type="submit" variant="primary" loading={busy} disabled={!user.trim() || !pin.trim()}>{t("gate.entrar")}</Button>
      </form>
    </main>
  );
}
export default function GatePage() { return <Suspense><GateForm /></Suspense>; }
