"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import type { Session } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useAction } from "@/lib/hooks/use-api";
import { Button, Chip, Field, Input, Select, Textarea, useToast } from "@/components/ui";
import { AuthCard } from "@/components/auth-form";

type ProfileType = "PESSOAL" | "MARCA" | "CELEBRIDADE";
const COUNTRIES = ["BR", "PT", "US", "AR", "ES", "IT", "FR", "GB", "MX", "CL"];

export default function RegisterPage() {
  const { t } = useI18n(); const { signIn } = useAuth(); const router = useRouter(); const toast = useToast();
  const [profileType, setProfileType] = useState<ProfileType>("PESSOAL");
  const [f, setF] = useState({ fullName: "", username: "", email: "", password: "", confirmPassword: "", birthDate: "", country: "BR", acceptTerms: false });
  const [brand, setBrand] = useState({ razaoSocial: "", cnpj: "", nomeFantasia: "", fashionCategory: "", storeUrl: "", commercialContact: "", officialHashtag: "" });
  const [celeb, setCeleb] = useState({ stageName: "", realName: "", areas: "", verificationUrl: "", professionalHistory: "", representationContact: "", sealConsentGranted: false });
  const [usernameState, setUsernameState] = useState<{ available?: boolean; suggestions?: string[] } | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string; checked?: boolean; type?: string } }) => setF((o) => ({ ...o, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  useEffect(() => {
    if (f.username.length < 3) { setUsernameState(null); return; }
    const h = setTimeout(async () => {
      try {
        const r = await api.get<{ available: boolean; suggestions?: string[] }>(`/api/usernames/${encodeURIComponent(f.username)}/availability`, { anonymous: true });
        setUsernameState(r);
      } catch { setUsernameState(null); }
    }, 400);
    return () => clearTimeout(h);
  }, [f.username]);

  const { run, busy, error } = useAction(async () => api.post<Session>("/api/auth/register", {
    profileType, ...f,
    brand: profileType === "MARCA" ? brand : null,
    celebrity: profileType === "CELEBRIDADE" ? { ...celeb, areas: celeb.areas.split(",").map((s) => s.trim()).filter(Boolean), fashionInterests: [] } : null,
  }, { anonymous: true }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const s = await run();
    if (!s) return;
    signIn(s);
    s.warnings?.forEach((w) => toast.info(w));
    toast.success(t("auth.verifyTitle"));
    router.push("/verify-email");
  }
  const err = error?.fields ?? {};
  return (
    <AuthCard title={t("auth.registerTitle")} lead={t("auth.registerLead")}
      footer={<>{t("auth.hasAccount")} <Link className="font-semibold text-ink underline" href="/login">{t("nav.login")}</Link></>}>
      <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label="tipo de perfil">
        {(["PESSOAL", "MARCA", "CELEBRIDADE"] as ProfileType[]).map((p) => (
          <Chip key={p} active={profileType === p} onClick={() => setProfileType(p)}>{t(p === "PESSOAL" ? "auth.profilePersonal" : p === "MARCA" ? "auth.profileBrand" : "auth.profileCelebrity")}</Chip>
        ))}
      </div>
      <form onSubmit={submit} noValidate>
        <Field label={t("auth.fullName")} id="fullName" required error={err.fullName}><Input id="fullName" autoComplete="name" value={f.fullName} onChange={set("fullName")} required /></Field>
        <Field label={t("auth.username")} id="username" required error={err.username}
          hint={usernameState ? (usernameState.available ? `✓ ${t("auth.usernameFree")}` : `✗ ${t("auth.usernameTaken")}${usernameState.suggestions?.length ? ` — ${t("auth.suggestions")}: ${usernameState.suggestions.join(", ")}` : ""}`) : "3–30 caracteres: letras, números, ponto e sublinhado"}>
          <Input id="username" autoComplete="username" value={f.username} onChange={set("username")} required error={usernameState?.available === false} />
        </Field>
        <Field label={t("auth.email")} id="email" required error={err.email}><Input id="email" type="email" autoComplete="email" value={f.email} onChange={set("email")} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("auth.password")} id="password" required error={err.password}><Input id="password" type="password" autoComplete="new-password" value={f.password} onChange={set("password")} required /></Field>
          <Field label={t("auth.confirmPassword")} id="confirmPassword" required error={err.confirmPassword}><Input id="confirmPassword" type="password" autoComplete="new-password" value={f.confirmPassword} onChange={set("confirmPassword")} required /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("auth.birthDate")} id="birthDate" required error={err.birthDate}><Input id="birthDate" type="date" value={f.birthDate} onChange={set("birthDate")} required /></Field>
          <Field label={t("auth.country")} id="country" required error={err.country}><Select id="country" value={f.country} onChange={set("country")}>{COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
        </div>
        {profileType === "MARCA" && (
          <fieldset className="mb-3 rounded-md border border-line-soft p-3">
            <legend className="label px-1">{t("auth.brandData")}</legend>
            {([["razaoSocial", "Razão social"], ["cnpj", "CNPJ"], ["nomeFantasia", "Nome fantasia"], ["fashionCategory", "Categoria de moda"], ["storeUrl", "Loja / site"], ["commercialContact", "Contato comercial"], ["officialHashtag", "Hashtag oficial"]] as const).map(([k, label]) => (
              <Field key={k} label={label} id={k} error={err[k]}><Input id={k} value={brand[k]} onChange={(e) => setBrand((b) => ({ ...b, [k]: e.target.value }))} /></Field>
            ))}
          </fieldset>
        )}
        {profileType === "CELEBRIDADE" && (
          <fieldset className="mb-3 rounded-md border border-line-soft p-3">
            <legend className="label px-1">{t("auth.celebrityData")}</legend>
            {([["stageName", "Nome artístico"], ["realName", "Nome real"], ["areas", "Áreas (separe por vírgula)"], ["verificationUrl", "Link para verificação"], ["representationContact", "Contato da representação"]] as const).map(([k, label]) => (
              <Field key={k} label={label} id={k} error={err[k]}><Input id={k} value={celeb[k]} onChange={(e) => setCeleb((c) => ({ ...c, [k]: e.target.value }))} /></Field>
            ))}
            <Field label="Histórico profissional" id="professionalHistory"><Textarea id="professionalHistory" value={celeb.professionalHistory} onChange={(e) => setCeleb((c) => ({ ...c, professionalHistory: e.target.value }))} /></Field>
            <label className="flex items-start gap-2 type-body-sm"><input type="checkbox" checked={celeb.sealConsentGranted} onChange={(e) => setCeleb((c) => ({ ...c, sealConsentGranted: e.target.checked }))} /> Autorizo o uso do meu nome/imagem em selos vinculados (RF20).</label>
          </fieldset>
        )}
        <label className="mb-3 flex items-start gap-2 type-body-sm"><input type="checkbox" checked={f.acceptTerms} onChange={set("acceptTerms")} required /> {t("auth.acceptTerms")}</label>
        {err.acceptTerms && <p className="error-text mb-2" role="alert">{err.acceptTerms}</p>}
        {error && Object.keys(err).length === 0 && <p role="alert" className="error-text mb-3">{error.message}</p>}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>{t("nav.register")}</Button>
      </form>
    </AuthCard>
  );
}
