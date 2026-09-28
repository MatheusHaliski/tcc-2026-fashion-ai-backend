"use client";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useAction } from "@/lib/hooks/use-api";
import { Button, Field, Input, useToast } from "@/components/ui";
import { AuthCard } from "@/components/auth-form";

function ResetForm() {
  const { t } = useI18n(); const params = useSearchParams(); const router = useRouter(); const toast = useToast();
  const [token, setToken] = useState(params.get("token") ?? ""); const [fromLink] = useState(() => !!params.get("token"));
  // o token do link sai da barra de endereço (histórico do navegador, logs e Referer) assim que é lido
  useEffect(() => { if (fromLink) window.history.replaceState(null, "", window.location.pathname); }, [fromLink]);
  const [newPassword, setNewPassword] = useState(""); const [confirmPassword, setConfirm] = useState("");
  const { run, busy, error } = useAction(async () => api.post("/api/auth/password-reset/confirm", { token, newPassword, confirmPassword }, { anonymous: true }));
  async function submit(e: FormEvent) { e.preventDefault(); const r = await run(); if (r !== undefined) { toast.success(t("common.saved")); router.push("/login"); } }
  return (
    <AuthCard title={t("auth.resetTitle")} lead={t("auth.resetLead")} footer={<Link href="/login" className="underline">← {t("nav.login")}</Link>}>
      <form onSubmit={submit} noValidate>
        {!fromLink && <Field label={t("resetPassword.token")} id="token" required><Input id="token" value={token} onChange={(e) => setToken(e.target.value)} required /></Field>}
        <Field label={t("auth.newPassword")} id="newPassword" required error={error?.fields.newPassword}><Input id="newPassword" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required autoFocus /></Field>
        <Field label={t("auth.confirmPassword")} id="confirmPassword" required error={error?.fields.confirmPassword}><Input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirm(e.target.value)} required /></Field>
        {error && <p role="alert" className="error-text mb-3">{error.message}</p>}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>{t("common.confirm")}</Button>
      </form>
    </AuthCard>
  );
}
export default function ResetPasswordPage() { return <Suspense><ResetForm /></Suspense>; }
