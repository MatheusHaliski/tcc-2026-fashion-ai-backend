"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { useAction } from "@/lib/hooks/use-api";
import { Button, Field, Input, useNotice, useNoticeOnError } from "@/components/ui";
import { AuthCard } from "@/components/auth-form";

export default function ForgotPasswordPage() {
  const { t } = useI18n(); const notice = useNotice(); const [email, setEmail] = useState(""); const [sent, setSent] = useState<string | null>(null);
  const { run, busy, error } = useAction(async () => api.post<{ message: string }>("/api/auth/password-reset/request", { email }, { anonymous: true }));
  useNoticeOnError(error);
  async function submit(e: FormEvent) { e.preventDefault(); const r = await run(); if (r) { setSent(r.message); notice.success(r.message); } }
  return (
    <AuthCard title={t("auth.forgotTitle")} lead={t("auth.forgotLead")} footer={<Link href="/login" className="underline">← {t("nav.login")}</Link>}>
      {sent ? <Link href="/login" className="btn btn-primary btn-lg w-full">{t("nav.login")}</Link> : (
        <form onSubmit={submit} noValidate>
          <Field label={t("auth.email")} id="email" required error={error?.fields.email}><Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></Field>
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>{t("auth.send")}</Button>
        </form>
      )}
    </AuthCard>
  );
}
