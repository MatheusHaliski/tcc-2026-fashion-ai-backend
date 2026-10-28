"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import type { Me, UserCard } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { fromServerLanguage } from "@/lib/i18n/state";
import { CURRENCIES, isCurrency } from "@/lib/i18n/money";
import { CHROME_BACKGROUNDS, CONTAINER_PRESETS, chromeTile, useTheme } from "@/lib/theme/theme";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Avatar, Button, Card, Dialog, Field, Input, PageHeader, Select, Skeleton, Switch, Tabs, Textarea, useNotice } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { EditProfileForm } from "@/components/edit-profile";
import { NavOrderEditor } from "@/components/nav-order-editor";

/** "Dólar americano (USD)" no idioma da interface. */
const currencyName = (intl: string, c: string) => { try { return `${new Intl.DisplayNames(intl, { type: "currency" }).of(c) ?? c} (${c})`; } catch { return c; } };

type Tab = "account" | "appearance" | "privacy" | "data" | "sessions";
interface Prefs { auraImpersonation?: boolean; auraHype?: boolean; theme: string; language: string; density: string; fontScale: number; highContrast: boolean; reduceMotion: boolean; chromeBackgroundId?: string | null; contentContainerColor?: string | null; sizeSystem?: string; unitSystem?: string; defaultCardSkin?: string; lookDoDiaPanelVersion?: string; soundEnabled?: boolean; hapticsEnabled?: boolean; hypeCreatorOptOut?: boolean; [k: string]: unknown; }
interface Consent { purpose: string; granted: boolean; label?: string; description?: string; grantedAt?: string; }

function Settings() {
  const { t, locale, setLocale, locales, rich, intl, currency, currencyPref, setCurrency } = useI18n(); const { me, refreshMe, signOut } = useAuth(); const { prefs: theme, update: updateTheme } = useTheme(); const notice = useNotice();
  const [info, setInfo] = useState<{ title: string; paragraphs: ReactNode[] } | null>(null);
  const [impersonationBusy, setImpersonationBusy] = useState(false);
  const auraPermissions = useApi<{ currentTier: string; auras: Record<string, { allowed: boolean; requiredTier: string }> }>((signal) => api.get("/api/me/aura-permissions", { signal }), [me?.user.id]);
  const impersonationAccess = auraPermissions.data?.auras.AURA_IMPERSONATION;
  const impersonationAllowed = impersonationAccess?.allowed === true;
  const [auraBusy, setAuraBusy] = useState(false);
  const [auraLocal, setAuraLocal] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("account");
  const server = useApi<Prefs>((signal) => api.get("/api/me/preferences", { signal }), []);
  const consents = useApi<Consent[]>((signal) => api.get("/api/me/consents", { signal }), [], { enabled: tab === "privacy" });
  const sessions = useApi<{ sessionId: string; device?: string; ip?: string; createdAt?: string; lastUsedAt?: string; current?: boolean }[]>((signal) => api.get("/api/auth/sessions", { signal }), [], { enabled: tab === "sessions" });
  const exports = useApi<{ id: string; status: string; requestedAt?: string; expiresAt?: string }[]>((signal) => api.get("/api/me/exports", { signal }), [], { enabled: tab === "data" });
  const [profile, setProfile] = useState({ displayName: "", bio: "", country: "" }); const [username, setUsername] = useState("");
  const [sensitive, setSensitive] = useState({ password: "", email: "", phone: "", birthDate: "", twoFactorEnabled: false });
  const [del, setDel] = useState<{ open: boolean; password: string }>({ open: false, password: "" }); const [emailCode, setEmailCode] = useState("");
  useEffect(() => { if (me) { setProfile({ displayName: me.user.displayName ?? "", bio: me.bio ?? "", country: me.user.country ?? "" }); setUsername(me.user.username); setSensitive((s) => ({ ...s, email: me.email ?? "", phone: me.phone ?? "", birthDate: me.birthDate ?? "", twoFactorEnabled: me.twoFactorEnabled })); } }, [me]);
  // sincroniza tema/idioma locais com a preferência salva no servidor (RF23.CA02: last-write-wins)
  useEffect(() => { const p = server.data; if (!p) return; updateTheme({ theme: (p.theme as typeof theme.theme) ?? "AUTO", density: (p.density as typeof theme.density) ?? "COMFORTABLE", fontScale: p.fontScale ?? 100, ...(typeof p.auraImpersonation === "boolean" ? { auraImpersonation: p.auraImpersonation } : {}), ...(typeof p.auraHype === "boolean" ? { auraHype: p.auraHype } : {}), highContrast: !!p.highContrast, reduceMotion: !!p.reduceMotion, chromeBackgroundId: p.chromeBackgroundId ?? null, contentContainerColor: p.contentContainerColor ?? null }); const serverLocale = fromServerLanguage(p.language); if (serverLocale && serverLocale !== locale) setLocale(serverLocale, { persist: false }); const serverCurrency = isCurrency(p.currency) ? p.currency : null; if (serverCurrency !== currencyPref) setCurrency(serverCurrency, { persist: false }); }, [server.data]); // eslint-disable-line react-hooks/exhaustive-deps
  async function savePrefs(patch: Partial<Prefs>): Promise<boolean> {
    try { server.setData(await api.put<Prefs>("/api/me/preferences", { ...patch, clientUpdatedAt: new Date().toISOString() })); notice.success(t("settings.saved")); return true; } catch (e) { notice.fromError(e); return false; }
  }
  async function setAuraHype(enabled: boolean) {
    updateTheme({ auraHype: enabled });
    setAuraBusy(true); setAuraLocal(false);
    try {
      const saved = await api.put<Prefs>("/api/me/preferences", { auraHype: enabled, clientUpdatedAt: new Date().toISOString() });
      server.setData(saved);
      if (typeof saved.auraHype === "boolean") {
        updateTheme({ auraHype: saved.auraHype });
        notice.success(t("settings.saved"));
      } else setAuraLocal(true);
    } catch { setAuraLocal(true); }
    finally { setAuraBusy(false); }
  }
  async function setAuraImpersonation(enabled: boolean) {
    if (impersonationBusy || (enabled && !impersonationAllowed)) return;
    setImpersonationBusy(true);
    try {
      const saved = await api.put<Prefs>("/api/me/preferences", { auraImpersonation: enabled, clientUpdatedAt: new Date().toISOString() });
      server.setData(saved);
      if (typeof saved.auraImpersonation === "boolean") updateTheme({ auraImpersonation: saved.auraImpersonation });
      else throw new Error(t("settingsHelp.impersonationUnavailable"));
      notice.success(t("settings.saved"));
    } catch (error) { notice.fromError(error); }
    finally { setImpersonationBusy(false); }
  }
  const impersonationStatus = auraPermissions.loading ? t("auraGate.checking")
    : !impersonationAccess ? t("settingsHelp.impersonationUnavailable")
    : impersonationAllowed ? t("settingsHelp.impersonationUnlocked", { level: auraPermissions.data!.currentTier })
    : t("settingsHelp.impersonationLocked", { current: auraPermissions.data!.currentTier, required: impersonationAccess.requiredTier });
  async function logoutAll() {
    if (logoutBusy) return;
    setLogoutBusy(true);
    try { await api.delete("/api/auth/sessions"); await signOut(); }
    catch (error) { notice.fromError(error); }
    finally { setLogoutBusy(false); }
  }
  const infoButton = (title: string, paragraphs: ReactNode[]) => <button type="button" className="btn btn-sm h-10 w-10 shrink-0" aria-label={t("settingsHelp.more", { name: title })} onClick={() => setInfo({ title, paragraphs })}><span aria-hidden="true">ⓘ</span></button>;
  const heading = (title: string, help: string) => <div className="mb-3 flex items-center justify-between gap-3"><h2 className="type-h3">{title}</h2>{infoButton(title, [t(`settingsHelp.${help}`)])}</div>;
  const call = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) notice.success(ok); await refreshMe(); } catch (e) { notice.fromError(e); } };
  if (!me) return <Skeleton className="h-96" />;
  const profileVisibility = (me as Me & { profileVisibility?: string }).profileVisibility ?? (me.user.privateAccount ? "PRIVATE" : "PUBLIC");
  return (
    <>
      <PageHeader title={t("settings.title")} />
      <Tabs tabs={[{ id: "account", label: t("settings.account") }, { id: "appearance", label: t("settings.appearance") }, { id: "privacy", label: t("settings.privacy") }, { id: "data", label: t("settings.data") }, { id: "sessions", label: t("settings.sessions") }]} value={tab} onChange={setTab} />
      {tab === "account" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            {heading(t("common.editar_perfil"), "profile")}
            <EditProfileForm />
            <Switch checked={!me.runwayOptOut} onChange={(v) => call(() => api.patch("/api/me/profile", { runwayOptOut: !v }), v ? t("settings.seu_look_do_dia_volta") : t("settings.voce_saiu_da_passarela_3d"))} label={t("settings.desfilar_meu_look_do_dia")} />
            <div className="mt-2 flex flex-wrap gap-2"><label className="btn btn-sm cursor-pointer">{t("settings.imagem_de_capa")}<input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.append("file", f); call(() => api.upload("/api/me/cover", fd), t("common.saved")); }} /></label></div>
            <Field label={t("auth.country")} id="country"><div className="flex gap-2"><Input id="country" value={profile.country} onChange={(e) => setProfile({ ...profile, country: e.target.value.toUpperCase() })} maxLength={2} /><Button onClick={() => call(() => api.patch("/api/me/profile", { country: profile.country }), t("common.saved"))}>{t("common.save")}</Button></div></Field>

          </Card>
          <Card>
            {heading(t("settingsHelp.securityTitle"), "security")}
            <Field label={t("auth.email")} id="email" hint={me.emailVerified ? t("settings.confirmado") : t("settings.nao_confirmado")}><Input id="email" type="email" value={sensitive.email} onChange={(e) => setSensitive({ ...sensitive, email: e.target.value })} /></Field>
            <Field label={t("settings.telefone")} id="phone"><Input id="phone" value={sensitive.phone} onChange={(e) => setSensitive({ ...sensitive, phone: e.target.value })} /></Field>
            <Field label={t("auth.birthDate")} id="birthDate"><Input id="birthDate" type="date" value={sensitive.birthDate} onChange={(e) => setSensitive({ ...sensitive, birthDate: e.target.value })} /></Field>
            <Switch checked={sensitive.twoFactorEnabled} onChange={(v) => setSensitive({ ...sensitive, twoFactorEnabled: v })} label={t("settings.autenticacao_em_duas_etapas_codigo")} />
            <Field label={t("auth.password")} id="curpwd" required><Input id="curpwd" type="password" autoComplete="current-password" value={sensitive.password} onChange={(e) => setSensitive({ ...sensitive, password: e.target.value })} /></Field>
            <Button variant="primary" onClick={() => call(() => api.patch("/api/me/sensitive", { ...sensitive, email: sensitive.email !== me.email ? sensitive.email : null, phone: sensitive.phone || null, birthDate: sensitive.birthDate || null }), t("common.saved"))}>{t("common.save")}</Button>
            {sensitive.email !== me.email && <div className="mt-3 flex gap-2"><Input placeholder={t("settings.codigo_enviado_ao_novo_e")} value={emailCode} onChange={(e) => setEmailCode(e.target.value)} /><Button onClick={() => call(() => api.post("/api/me/email-change/confirm", { code: emailCode }), t("auth.verified"))}>{t("common.confirm")}</Button></div>}
          </Card>
        </div>
      )}
      {tab === "appearance" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            {heading(t("settingsHelp.effectsTitle"), "aura")}
            <Switch checked={!!theme.auraHype} disabled={auraBusy} label={t("auraHype.title")} hint={t("settingsHelp.auraShort")} onChange={setAuraHype} />
            <div className="mt-4 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <Switch checked={!!server.data?.auraImpersonation} disabled={impersonationBusy || (!impersonationAllowed && !server.data?.auraImpersonation)} label={t("settingsHelp.impersonationTitle")} hint={impersonationStatus} onChange={setAuraImpersonation} />
              </div>
              {infoButton(t("settingsHelp.impersonationTitle"), [t("settingsHelp.impersonationDescription"), <strong key="access" role="status">{impersonationStatus}</strong>])}
            </div>
            {auraLocal && <p role="status" className="type-body-sm text-muted mt-2">{t("settingsHelp.auraLocal")}</p>}
            {auraBusy && <p role="status" className="type-body-sm text-muted">{t("settingsHelp.saving")}</p>}
          </Card>
          <Card>
            {heading(t("settings.appearance"), "appearance")}
            <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><Field label={t("settings.theme")} id="theme"><Select id="theme" value={theme.theme} onChange={(e) => { updateTheme({ theme: e.target.value as typeof theme.theme }); savePrefs({ theme: e.target.value }); }}><option value="AUTO">{t("settings.auto")}</option><option value="LIGHT">{t("settings.light")}</option><option value="DARK">{t("settings.dark")}</option><option value="HIGH_CONTRAST">{t("settings.contrast")}</option></Select></Field></div>{infoButton(t("settings.theme"), [t("settingsHelp.theme")])}</div>
            <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><Field label={t("settings.language")} id="language"><Select id="language" value={locale} onChange={(e) => setLocale(e.target.value as typeof locale)}>{locales.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</Select></Field></div>{infoButton(t("settings.language"), [t("settingsHelp.language")])}</div>
            <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><Field label={t("settings.currency")} id="currency"><Select id="currency" value={currencyPref ?? "AUTO"} onChange={(e) => setCurrency(isCurrency(e.target.value) ? e.target.value : null)}><option value="AUTO">{t("settings.currency_auto", { currency })}</option>{CURRENCIES.map((c) => <option key={c} value={c}>{currencyName(intl, c)}</option>)}</Select></Field></div>{infoButton(t("settings.currency"), [t("settingsHelp.currency")])}</div>
            <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><Switch checked={theme.highContrast} onChange={(v) => { updateTheme({ highContrast: v }); savePrefs({ highContrast: v }); }} label={t("settings.contrast")} /></div>{infoButton(t("settings.contrast"), [t("settingsHelp.contrast")])}</div>
            <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><Switch checked={theme.reduceMotion} onChange={(v) => { updateTheme({ reduceMotion: v }); savePrefs({ reduceMotion: v }); }} label={t("settings.reduceMotion")} /></div>{infoButton(t("settings.reduceMotion"), [t("settingsHelp.reduceMotion")])}</div>
            {/* DET-D04 — som de tecido (desligado por padrão) e háptico (ligado) no Meu Quarto */}
            <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><Switch checked={!!server.data?.soundEnabled} onChange={(v) => { server.setData({ ...server.data!, soundEnabled: v }); savePrefs({ soundEnabled: v }); }} label={t("settings.som_do_quarto")} hint={t("settings.som_do_quarto_dica")} /></div>{infoButton(t("settings.som_do_quarto"), [t("settingsHelp.sound")])}</div>
            <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><Switch checked={server.data?.hapticsEnabled !== false} onChange={(v) => { server.setData({ ...server.data!, hapticsEnabled: v }); savePrefs({ hapticsEnabled: v }); }} label={t("settings.haptico")} hint={t("settings.haptico_dica")} /></div>{infoButton(t("settings.haptico"), [t("settingsHelp.haptics")])}</div>
            <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><Field label={t("settings.sistema_de_tamanhos")} id="sizeSystem"><Select id="sizeSystem" value={(server.data?.sizeSystem as string) ?? "BR"} onChange={(e) => savePrefs({ sizeSystem: e.target.value })}>{["BR", "US", "EU", "UK"].map((s) => <option key={s}>{s}</option>)}</Select></Field></div>{infoButton(t("settings.sistema_de_tamanhos"), [t("settingsHelp.sizeSystem")])}</div>
            <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><Field label={t("settings.unidades")} id="unitSystem"><Select id="unitSystem" value={(server.data?.unitSystem as string) ?? "CM"} onChange={(e) => savePrefs({ unitSystem: e.target.value })}>{["CM", "IN"].map((s) => <option key={s}>{s}</option>)}</Select></Field></div>{infoButton(t("settings.unidades"), [t("settingsHelp.unitSystem")])}</div>
          </Card>
          <Card>
            {heading(t("settings.chrome"), "chrome")}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><button type="button" aria-pressed={!theme.chromeBackgroundId} className={`rounded border-2 p-1 ${!theme.chromeBackgroundId ? "border-mark" : "border-line-soft"}`} onClick={() => { updateTheme({ chromeBackgroundId: null }); savePrefs({ chromeBackgroundId: null }); }}><span className="block aspect-video w-full rounded bg-surface" aria-hidden="true" /><span className="block type-caption mt-1">{t("settings.chromeNone")}</span></button>{CHROME_BACKGROUNDS.map((b) => <button key={b.id} type="button" aria-pressed={theme.chromeBackgroundId === b.id} className={`rounded border-2 p-1 ${theme.chromeBackgroundId === b.id ? "border-mark" : "border-line-soft"}`} onClick={() => { updateTheme({ chromeBackgroundId: b.id }); savePrefs({ chromeBackgroundId: b.id }); }}><img src={chromeTile(b.id)} alt={b.label} className="aspect-video w-full rounded object-cover" /><span className="block type-caption mt-1">{b.label}</span></button>)}</div>

            <div className="mt-5">{heading(t("settingsHelp.containerTitle"), "container")}</div>
            <p className="type-caption text-muted mb-2">{t("settings.todo_o_conteudo_das_paginas")}</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">{CONTAINER_PRESETS.map((c) => { const on = (theme.contentContainerColor ?? "#FFFFFF").toUpperCase() === c.hex; return <button key={c.hex} type="button" aria-pressed={on} title={c.label} aria-label={c.label} onClick={() => { const v = c.hex === "#FFFFFF" ? null : c.hex; updateTheme({ contentContainerColor: v }); savePrefs({ contentContainerColor: v ?? "" }); }} className={`h-12 rounded-lg border-2 ${on ? "border-mark ring-2 ring-mark/40" : "border-line-soft"}`} style={{ background: c.hex }} />; })}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2"><label className="type-body-sm flex items-center gap-2">{t("settings.outra_cor")}{" "}<input type="color" aria-label={t("settings.cor_personalizada_dos_containers")} className="h-9 w-14 rounded border border-line-soft" value={theme.contentContainerColor ?? "#FFFFFF"} onChange={(e) => updateTheme({ contentContainerColor: e.target.value.toUpperCase() })} onBlur={(e) => savePrefs({ contentContainerColor: e.target.value.toUpperCase() })} /></label><Button size="sm" onClick={() => { updateTheme({ contentContainerColor: null }); savePrefs({ contentContainerColor: "" }); }}>{t("settings.padrao_branco")}</Button></div>
          </Card>
          <Card className="lg:col-span-2">
            {heading(t("settings.navOrder.title"), "navOrder")}
            <p className="type-body-sm text-muted mb-3">{t("settings.navOrder.hint")}</p>
            <NavOrderEditor />
          </Card>
        </div>
      )}
      {tab === "privacy" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-4">
          <Card>
            {heading(t("common.visibility"), "visibility")}
            <p className="type-body-sm text-muted mb-2">{t("settings.visibilidade_padrao_do_perfil_e")}</p>
            <Select aria-label={t("settings.visibilidade")} value={profileVisibility} onChange={(e) => call(() => api.put("/api/me/privacy", { visibility: e.target.value }), t("common.saved"))}><option value="PUBLIC">{t("common.public")}</option><option value="FOLLOWERS">{t("common.followers")}</option><option value="PRIVATE">{t("common.private")}</option></Select>
          </Card>
          <Card>
            {heading(t("hypePrivacy.title"), "hype")}
            <p className="type-body-sm text-muted mb-3">{t("settingsHelp.hypeShort")}</p>
            <div className="divide-y divide-line-soft">
              {[
                { title: t("settingsHelp.hypeSignalsTitle"), paragraphs: [t("hypePrivacy.lead"), t("hypePrivacy.signals"), t("hypePrivacy.sponsorship")] },
                { title: t("settingsHelp.hypeVisibilityTitle"), paragraphs: [profileVisibility === "PRIVATE" ? t("hypePrivacy.status_private") : t("hypePrivacy.status_open"), t("hypePrivacy.public"), t("hypePrivacy.personal"), t("hypePrivacy.private_profile")] },
                { title: t("settingsHelp.hypeNotificationsTitle"), paragraphs: [rich("hypePrivacy.notifications", undefined, { 0: ($c) => <Link className="underline" href="/notifications" onClick={() => setInfo(null)}>{$c}</Link> })] },
              ].map(topic => <div key={topic.title} className="flex items-center justify-between gap-3 py-2"><span className="type-body-sm">{topic.title}</span>{infoButton(topic.title, topic.paragraphs)}</div>)}
            </div>
          </Card>
          </div>
          <Card>
            {heading(t("settings.consents"), "consents")}
            {consents.loading && <Skeleton className="h-32" />}
            {consents.error && <p role="alert" className="type-body-sm text-critical">{t("settingsHelp.consentsError")}</p>}
            <ul className="divide-y divide-line-soft">{(consents.data ?? []).map((c) => {
              const name = (c.label ?? c.purpose.replace(/_/g, " ")).toLocaleUpperCase(locale);
              return <li key={c.purpose} className="flex items-center gap-3 py-2"><div className="min-w-0 flex-1"><Switch checked={c.granted} onChange={async (v) => { try { consents.setData(await api.put<Consent[]>(`/api/me/consents/${c.purpose}`, { granted: v })); } catch (e) { notice.fromError(e); } }} label={name} /></div>{infoButton(name, [c.description ?? t("settingsHelp.consentMissing"), t("settingsHelp.consentChoice")])}</li>;
            })}</ul>
          </Card>
        </div>
      )}
      {tab === "data" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            {heading(t("settings.export"), "export")}
            <p className="type-body text-muted mb-1">{t("settings.geramos_um_pacote_com_todos")}</p>
            <p className="type-caption text-muted mb-3">{t("hypePrivacy.export_hint")}</p>
            <Button variant="primary" onClick={() => call(() => api.post("/api/me/exports"), t("settings.exportacao_solicitada")).then(exports.reload)}>{t("settings.export")}</Button>
            <ul className="fai-list mt-3">{(exports.data ?? []).map((x) => <li key={x.id} className="flex items-center justify-between py-2 type-body-sm"><span>{x.status} · {x.requestedAt?.slice(0, 10)}</span>{x.status === "READY" && <a className="btn btn-sm" href={`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"}/api/me/exports/${x.id}/file`} onClick={async (e) => { e.preventDefault(); const u = await api.blobUrl(`/api/me/exports/${x.id}/file`); window.open(u); }}>{t("settings.baixar")}</a>}</li>)}</ul>
          </Card>
          <Card>
            {heading(t("settings.deleteAccount"), "delete")}
            {me.deletionScheduledFor ? <><p className="type-body text-critical mb-3">{t("settings.exclusao_agendada_para", { slice: me.deletionScheduledFor.slice(0, 10) })}</p><Button onClick={() => call(() => api.delete("/api/me/deletion"), t("settings.exclusao_cancelada"))}>{t("settings.cancelDeletion")}</Button></>
              : <><p className="type-body text-muted mb-3">{t("settings.a_conta_fica_30_dias")}</p><Button variant="danger" onClick={() => setDel({ open: true, password: "" })}>{t("settings.deleteAccount")}</Button></>}
          </Card>
        </div>
      )}
      {tab === "sessions" && (
        <Card>
          {heading(t("settings.sessions"), "sessions")}
          {sessions.loading && <Skeleton className="h-32" />}
          <ul className="fai-list">{(sessions.data ?? []).map((s) => <li key={s.sessionId} className="flex items-center justify-between gap-3 py-2 type-body-sm"><span>{s.device ?? t("settings.dispositivo")} · {s.ip ?? ""} · {s.lastUsedAt?.slice(0, 16) ?? s.createdAt?.slice(0, 16)}{s.current && <b>{t("settings.esta_sessao")}</b>}</span>{!s.current && <Button size="sm" onClick={() => call(() => api.delete(`/api/auth/sessions/${s.sessionId}`), t("settings.sessao_encerrada")).then(sessions.reload)}>{t("settings.encerrar")}</Button>}</li>)}</ul>
          <Button className="mt-3" variant="danger" loading={logoutBusy} onClick={logoutAll}>{t("settings.logoutAll")}</Button>
        </Card>
      )}
      <Dialog open={!!info} onClose={() => setInfo(null)} title={info?.title ?? ""} footer={<Button onClick={() => setInfo(null)}>{t("common.close")}</Button>}>
        <div className="grid gap-3">{info?.paragraphs.map((paragraph, i) => <p key={i} className="type-body-sm">{paragraph}</p>)}</div>
      </Dialog>
      <Dialog open={del.open} onClose={() => setDel({ open: false, password: "" })} title={t("settings.deleteAccount")} footer={<><Button onClick={() => setDel({ open: false, password: "" })}>{t("common.cancel")}</Button><Button variant="danger" disabled={!del.password} onClick={async () => { try { await api.post("/api/me/deletion", { password: del.password }); setDel({ open: false, password: "" }); notice.success(t("settings.exclusao_agendada")); await refreshMe(); } catch (error) { notice.fromError(error); } }}>{t("common.confirm")}</Button></>}>
        <p className="type-body mb-3">{t("settings.deleteConsequences")}</p><p className="type-body-sm mb-3">{t("settings.deletePolicy")}</p>
        <Field label={t("auth.password")} id="delpwd"><Input id="delpwd" type="password" value={del.password} onChange={(e) => setDel({ ...del, password: e.target.value })} /></Field>
      </Dialog>
    </>
  );
}
export default function SettingsPage() { return <RequireAuth><Settings /></RequireAuth>; }
