"use client";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useAction } from "@/lib/hooks/use-api";
import { Button, Field, Input, useToast } from "@/components/ui";
import { AuthCard } from "@/components/auth-form";

function VerifyForm() {
  const { t } = useI18n(); const params = useSearchParams(); const router = useRouter(); const toast = useToast(); const { user, ready, refreshMe } = useAuth();
  const [code, setCode] = useState(params.get("code") ?? "");
  const { run, busy, error } = useAction(async () => api.post("/api/auth/email-verification", { code }));
  const resend = useAction(async () => api.post("/api/auth/email-verification/resend"));
  useEffect(() => { if (ready && !user) router.push("/login?next=/verify-email"); }, [ready, user, router]);
  async function submit(e: FormEvent) { e.preventDefault(); const r = await run(); if (r !== undefined) { await refreshMe(); toast.success(t("auth.verified")); router.push("/closet"); } }
  return (
    <AuthCard title={t("auth.verifyTitle")} lead={t("auth.verifyLead")}
      footer={<button type="button" className="underline" onClick={async () => { const r = await resend.run(); if (r !== undefined) toast.info(t("verifyEmail.codigo_reenviado")); }} disabled={resend.busy}>{t("auth.resend")}</button>}>
      <form onSubmit={submit} noValidate>
        <Field label={t("auth.code")} id="code" required error={error?.fields.code}><Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="text-center tracking-[0.4em] text-2xl" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required autoFocus /></Field>
        {error && <p role="alert" className="error-text mb-3">{error.message}</p>}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>{t("common.confirm")}</Button>
        <p className="mt-3 text-center type-body-sm text-muted"><button type="button" className="underline" onClick={() => router.push("/closet")}>{t("common.skip")} →</button></p>
      </form>
    </AuthCard>
  );
}
export default function VerifyEmailPage() { return <Suspense><VerifyForm /></Suspense>; }
