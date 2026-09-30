"use client";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { api } from "@/lib/api/client";
import type { Session } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useAction } from "@/lib/hooks/use-api";
import { Button, Field, Input, Switch, useNotice } from "@/components/ui";
import { AuthCard } from "@/components/auth-form";

function LoginForm() {
  const { t } = useI18n(); const { signIn } = useAuth(); const router = useRouter(); const params = useSearchParams(); const notice = useNotice();
  const [identifier, setIdentifier] = useState(""); const [password, setPassword] = useState(""); const [remember, setRemember] = useState(true); const [twoFactor, setTwoFactor] = useState("");
  const { run, busy, error } = useAction(async () => api.post<Session>("/bff/auth/login", { identifier, password, rememberMe: remember, deviceName: navigator.userAgent.slice(0, 60), twoFactorCode: twoFactor || null }, { anonymous: true }));
  const needs2fa = error?.code === "2FA_OBRIGATORIO" || error?.code === "CODIGO_2FA";
  // RF2 — todo aviso vai para o modal padrão: credenciais erradas/bloqueio oferecem o atalho de recuperação de senha
  useEffect(() => {
    if (!error) return;
    if (needs2fa) notice.info(error.message);
    else notice.fromError(error, undefined, error.status === 401 || error.status === 429 ? { action: { label: t("auth.recoverPassword"), href: "/forgot-password" } } : undefined);
  }, [error]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (params.get("reason") === "session") notice.warning(t("auth.sessionEnded")); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function submit(e: FormEvent) {
    e.preventDefault();
    const s = await run();
    if (!s) return;
    signIn(s);
    s.warnings?.forEach((w) => notice.warning(w));
    if (!s.emailVerified) router.push("/verify-email"); else router.push(safeNext(params.get("next"), "/feed"));
  }
  return (
    <AuthCard title={t("auth.loginTitle")} lead={t("auth.loginLead")}
      footer={<>{t("auth.noAccount")} <Link className="font-semibold text-ink underline" href="/register">{t("nav.register")}</Link></>}>
      <form onSubmit={submit} noValidate>
        <Field label={t("auth.identifier")} id="identifier" required error={error?.fields.identifier}>
          <Input id="identifier" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoFocus />
        </Field>
        <Field label={t("auth.password")} id="password" required error={error?.fields.password}>
          <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {needs2fa && <Field label={t("auth.twoFactor")} id="twoFactor"><Input id="twoFactor" inputMode="numeric" value={twoFactor} onChange={(e) => setTwoFactor(e.target.value)} /></Field>}
        <Switch checked={remember} onChange={setRemember} label={t("auth.remember")} />
        <Button type="submit" variant="primary" size="lg" className="mt-2 w-full" loading={busy}>{t("nav.login")}</Button>
        <p className="mt-4 text-center"><Link href="/forgot-password" className="type-body-sm underline text-muted">{t("auth.forgot")}</Link></p>
      </form>
    </AuthCard>
  );
}
export default function LoginPage() { return <Suspense><LoginForm /></Suspense>; }
