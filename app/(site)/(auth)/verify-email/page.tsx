"use client";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useAction } from "@/lib/hooks/use-api";
import { Button, Field, Input, useNotice, useNoticeOnError } from "@/components/ui";
import { AuthCard } from "@/components/auth-form";

function VerifyForm() {
  const { t } = useI18n(); const params = useSearchParams(); const router = useRouter(); const notice = useNotice(); const { user, ready, refreshMe } = useAuth();
  const [code, setCode] = useState(params.get("code") ?? "");
  // o código do e-mail sai da barra de endereço assim que é lido (histórico do navegador, logs e Referer)
  useEffect(() => { if (params.get("code")) window.history.replaceState(null, "", window.location.pathname); }, [params]);
  const { run, busy, error } = useAction(async () => api.post("/api/auth/email-verification", { code }));
  const resend = useAction(async () => api.post("/api/auth/email-verification/resend"));
  useEffect(() => { if (ready && !user) router.push("/login?next=/verify-email"); }, [ready, user, router]);
  useNoticeOnError(error); useNoticeOnError(resend.error);
  async function submit(e: FormEvent) { e.preventDefault(); const r = await run(); if (r !== undefined) { await refreshMe(); notice.success(t("auth.verified"), { onClose: () => router.push("/closet") }); } }
  return (
    <AuthCard title={t("auth.verifyTitle")} lead={t("auth.verifyLead")}
      footer={<button type="button" className="underline" onClick={async () => { const r = await resend.run(); if (r !== undefined) notice.info(t("verifyEmail.codigo_reenviado")); }} disabled={resend.busy}>{t("auth.resend")}</button>}>
      <form onSubmit={submit} noValidate>
        <Field label={t("auth.code")} id="code" required error={error?.fields.code}><Input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="text-center tracking-[0.4em] text-2xl" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required autoFocus /></Field>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>{t("common.confirm")}</Button>
        <p className="mt-3 text-center type-body-sm text-muted"><button type="button" className="underline" onClick={() => router.push("/closet")}>{t("common.skip")} →</button></p>
      </form>
    </AuthCard>
  );
}
export default function VerifyEmailPage() { return <Suspense><VerifyForm /></Suspense>; }
