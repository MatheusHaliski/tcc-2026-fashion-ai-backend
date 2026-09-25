"use client";
import { useEffect, useState } from "react";
import { api, mediaUrl } from "@/lib/api/client";
import type { Me, UserCard } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { fromServerLanguage } from "@/lib/i18n/state";
import { CHROME_BACKGROUNDS, CONTAINER_PRESETS, chromeTile, useTheme } from "@/lib/theme/theme";
import { useApi } from "@/lib/hooks/use-api";
import { CARD_SKINS } from "@/lib/skins";
import { RequireAuth } from "@/components/app-shell";
import { Avatar, Button, Card, Dialog, Field, Input, PageHeader, Select, Skeleton, Switch, Tabs, Textarea, useToast } from "@/components/ui";
import { setDevRefs, useDevRefs } from "@/lib/dev-refs";
import { FaiIcon } from "@/components/fai-icon";
import { EditProfileForm } from "@/components/edit-profile";

type Tab = "account" | "appearance" | "privacy" | "data" | "sessions";
interface Prefs { theme: string; language: string; density: string; fontScale: number; highContrast: boolean; reduceMotion: boolean; chromeBackgroundId?: string | null; contentContainerColor?: string | null; sizeSystem?: string; unitSystem?: string; defaultCardSkin?: string; lookDoDiaPanelVersion?: string; [k: string]: unknown; }
interface Consent { purpose: string; granted: boolean; label?: string; description?: string; grantedAt?: string; }

function Settings() {
  const { t, locale, setLocale, locales, rich } = useI18n(); const { me, refreshMe } = useAuth(); const { prefs: theme, update: updateTheme } = useTheme(); const toast = useToast(); const devRefs = useDevRefs();
  const [tab, setTab] = useState<Tab>("account");
  const server = useApi<Prefs>((signal) => api.get("/api/me/preferences", { signal }), []);
  const consents = useApi<Consent[]>((signal) => api.get("/api/me/consents", { signal }), [], { enabled: tab === "privacy" });
  const sessions = useApi<{ id: string; deviceName?: string; ip?: string; createdAt?: string; lastUsedAt?: string; current?: boolean }[]>((signal) => api.get("/api/auth/sessions", { signal }), [], { enabled: tab === "sessions" });
  const exports = useApi<{ id: string; status: string; requestedAt?: string; expiresAt?: string }[]>((signal) => api.get("/api/me/exports", { signal }), [], { enabled: tab === "data" });
  const [profile, setProfile] = useState({ displayName: "", bio: "", country: "" }); const [username, setUsername] = useState("");
  const [sensitive, setSensitive] = useState({ password: "", email: "", phone: "", birthDate: "", twoFactorEnabled: false }); const [pwd, setPwd] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [del, setDel] = useState<{ open: boolean; password: string }>({ open: false, password: "" }); const [emailCode, setEmailCode] = useState("");
  useEffect(() => { if (me) { setProfile({ displayName: me.user.displayName ?? "", bio: me.bio ?? "", country: me.user.country ?? "" }); setUsername(me.user.username); setSensitive((s) => ({ ...s, email: me.email ?? "", phone: me.phone ?? "", birthDate: me.birthDate ?? "", twoFactorEnabled: me.twoFactorEnabled })); } }, [me]);
  // sincroniza tema/idioma locais com a preferência salva no servidor (RF23.CA02: last-write-wins)
  useEffect(() => { const p = server.data; if (!p) return; updateTheme({ theme: (p.theme as typeof theme.theme) ?? "AUTO", density: (p.density as typeof theme.density) ?? "COMFORTABLE", fontScale: p.fontScale ?? 100, highContrast: !!p.highContrast, reduceMotion: !!p.reduceMotion, chromeBackgroundId: p.chromeBackgroundId ?? null, contentContainerColor: p.contentContainerColor ?? null }); const serverLocale = fromServerLanguage(p.language); if (serverLocale && serverLocale !== locale) setLocale(serverLocale, { persist: false }); }, [server.data]); // eslint-disable-line react-hooks/exhaustive-deps
  async function savePrefs(patch: Partial<Prefs>) {
    try { server.setData(await api.put<Prefs>("/api/me/preferences", { ...patch, clientUpdatedAt: new Date().toISOString() })); toast.success(t("settings.saved")); } catch (e) { toast.fromError(e); }
  }
  const call = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast.success(ok); await refreshMe(); } catch (e) { toast.fromError(e); } };
  if (!me) return <Skeleton className="h-96" />;
  return (
    <>
      <PageHeader title={t("settings.title")} kicker={t("settings.rf3_rf23")} />
      <Tabs tabs={[{ id: "account", label: t("settings.account") }, { id: "appearance", label: t("settings.appearance") }, { id: "privacy", label: t("settings.privacy") }, { id: "data", label: t("settings.data") }, { id: "sessions", label: t("settings.sessions") }]} value={tab} onChange={setTab} />
      {tab === "account" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="type-h3 mb-3">{t("common.editar_perfil")}</h2>
            <EditProfileForm />
            <Switch checked={!me.runwayOptOut} onChange={(v) => call(() => api.patch("/api/me/profile", { runwayOptOut: !v }), v ? t("settings.seu_look_do_dia_volta") : t("settings.voce_saiu_da_passarela_3d"))} label={t("settings.desfilar_meu_look_do_dia")} />
            <div className="mt-2 flex flex-wrap gap-2"><label className="btn btn-sm cursor-pointer">{t("settings.imagem_de_capa")}<input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.append("file", f); call(() => api.upload("/api/me/cover", fd), t("common.saved")); }} /></label></div>
            <Field label={t("auth.country")} id="country"><div className="flex gap-2"><Input id="country" value={profile.country} onChange={(e) => setProfile({ ...profile, country: e.target.value.toUpperCase() })} maxLength={2} /><Button onClick={() => call(() => api.patch("/api/me/profile", { country: profile.country }), t("common.saved"))}>{t("common.save")}</Button></div></Field>

          </Card>
          <Card>
            <h2 className="type-h3 mb-3">{rich("settings.dados_sensiveis_pede_a_senha", undefined, { 0: ($c) => <span className="type-caption text-faint">{$c}</span> })}</h2>
            <Field label={t("auth.email")} id="email" hint={me.emailVerified ? t("settings.confirmado") : t("settings.nao_confirmado")}><Input id="email" type="email" value={sensitive.email} onChange={(e) => setSensitive({ ...sensitive, email: e.target.value })} /></Field>
            <Field label={t("settings.telefone")} id="phone"><Input id="phone" value={sensitive.phone} onChange={(e) => setSensitive({ ...sensitive, phone: e.target.value })} /></Field>
            <Field label={t("auth.birthDate")} id="birthDate"><Input id="birthDate" type="date" value={sensitive.birthDate} onChange={(e) => setSensitive({ ...sensitive, birthDate: e.target.value })} /></Field>
            <Switch checked={sensitive.twoFactorEnabled} onChange={(v) => setSensitive({ ...sensitive, twoFactorEnabled: v })} label={t("settings.autenticacao_em_duas_etapas_codigo")} />
            <Field label={t("auth.password")} id="curpwd" required><Input id="curpwd" type="password" autoComplete="current-password" value={sensitive.password} onChange={(e) => setSensitive({ ...sensitive, password: e.target.value })} /></Field>
            <Button variant="primary" onClick={() => call(() => api.patch("/api/me/sensitive", { ...sensitive, email: sensitive.email !== me.email ? sensitive.email : null, phone: sensitive.phone || null, birthDate: sensitive.birthDate || null }), t("common.saved"))}>{t("common.save")}</Button>
            {sensitive.email !== me.email && <div className="mt-3 flex gap-2"><Input placeholder={t("settings.codigo_enviado_ao_novo_e")} value={emailCode} onChange={(e) => setEmailCode(e.target.value)} /><Button onClick={() => call(() => api.post("/api/me/email-change/confirm", { code: emailCode }), t("auth.verified"))}>{t("common.confirm")}</Button></div>}
            <hr className="my-4 border-line-soft" />
            <h2 className="type-h3 mb-3">{t("settings.changePassword")}</h2>
            <Field label={t("settings.senha_atual")} id="p1"><Input id="p1" type="password" autoComplete="current-password" value={pwd.currentPassword} onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label={t("auth.newPassword")} id="p2"><Input id="p2" type="password" autoComplete="new-password" value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} /></Field><Field label={t("auth.confirmPassword")} id="p3"><Input id="p3" type="password" autoComplete="new-password" value={pwd.confirmPassword} onChange={(e) => setPwd({ ...pwd, confirmPassword: e.target.value })} /></Field></div>
            <Button onClick={() => call(() => api.put("/api/auth/password", pwd), t("settings.senha_alterada_outras_sessoes_encerradas"))}>{t("settings.changePassword")}</Button>
          </Card>
        </div>
      )}
      {tab === "appearance" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="type-h3 mb-3">{t("settings.appearance")}</h2>
            <Field label={t("settings.theme")} id="theme"><Select id="theme" value={theme.theme} onChange={(e) => { updateTheme({ theme: e.target.value as typeof theme.theme }); savePrefs({ theme: e.target.value }); }}><option value="AUTO">{t("settings.auto")}</option><option value="LIGHT">{t("settings.light")}</option><option value="DARK">{t("settings.dark")}</option><option value="HIGH_CONTRAST">{t("settings.contrast")}</option></Select></Field>
            <Field label={t("settings.language")} id="language"><Select id="language" value={locale} onChange={(e) => setLocale(e.target.value as typeof locale)}>{locales.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</Select></Field>
            <Field label={t("settings.density")} id="density"><Select id="density" value={theme.density} onChange={(e) => { updateTheme({ density: e.target.value as typeof theme.density }); savePrefs({ density: e.target.value }); }}><option value="COMFORTABLE">{t("settings.confortavel")}</option><option value="COMPACT">{t("settings.compacta")}</option></Select></Field>
            <Field label={`${t("settings.fontScale")}: ${theme.fontScale}%`} id="fontScale"><input id="fontScale" type="range" min={85} max={140} step={5} value={theme.fontScale} onChange={(e) => updateTheme({ fontScale: Number(e.target.value) })} onMouseUp={() => savePrefs({ fontScale: theme.fontScale })} onTouchEnd={() => savePrefs({ fontScale: theme.fontScale })} className="w-full" /></Field>
            <Switch checked={theme.highContrast} onChange={(v) => { updateTheme({ highContrast: v }); savePrefs({ highContrast: v }); }} label={t("settings.contrast")} />
            <Switch checked={devRefs} onChange={setDevRefs} label={t("settings.devRefs")} hint={t("settings.devRefsHint")} />
            <Switch checked={theme.reduceMotion} onChange={(v) => { updateTheme({ reduceMotion: v }); savePrefs({ reduceMotion: v }); }} label={t("settings.reduceMotion")} />
            <Field label={t("settings.sistema_de_tamanhos")} id="sizeSystem"><Select id="sizeSystem" value={(server.data?.sizeSystem as string) ?? "BR"} onChange={(e) => savePrefs({ sizeSystem: e.target.value })}>{["BR", "US", "EU", "UK"].map((s) => <option key={s}>{s}</option>)}</Select></Field>
            <Field label={t("settings.unidades")} id="unitSystem"><Select id="unitSystem" value={(server.data?.unitSystem as string) ?? "CM"} onChange={(e) => savePrefs({ unitSystem: e.target.value })}>{["CM", "IN"].map((s) => <option key={s}>{s}</option>)}</Select></Field>
          </Card>
          <Card>
            <h2 className="type-h3 mb-3">{t("settings.rf23", { txt: t("settings.chrome") })}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{CHROME_BACKGROUNDS.map((b) => <button key={b.id} type="button" aria-pressed={theme.chromeBackgroundId === b.id} className={`rounded border-2 p-1 ${theme.chromeBackgroundId === b.id ? "border-mark" : "border-line-soft"}`} onClick={() => { updateTheme({ chromeBackgroundId: b.id }); savePrefs({ chromeBackgroundId: b.id }); }}><img src={chromeTile(b.id)} alt={b.label} className="aspect-video w-full rounded object-cover" /><span className="block type-caption mt-1">{b.label}</span></button>)}</div>
            <Button className="mt-2" size="sm" onClick={() => { updateTheme({ chromeBackgroundId: null }); savePrefs({ chromeBackgroundId: null }); }} aria-pressed={!theme.chromeBackgroundId}>{t("settings.chromeNone")}</Button>
            <h2 className="type-h3 mt-5 mb-1">{t("settings.cor_dos_containers_rf23")}</h2>
            <p className="type-caption text-muted mb-2">{t("settings.todo_o_conteudo_das_paginas")}</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">{CONTAINER_PRESETS.map((c) => { const on = (theme.contentContainerColor ?? "#FFFFFF").toUpperCase() === c.hex; return <button key={c.hex} type="button" aria-pressed={on} title={c.label} aria-label={c.label} onClick={() => { const v = c.hex === "#FFFFFF" ? null : c.hex; updateTheme({ contentContainerColor: v }); savePrefs({ contentContainerColor: v ?? "" }); }} className={`h-12 rounded-lg border-2 ${on ? "border-mark ring-2 ring-mark/40" : "border-line-soft"}`} style={{ background: c.hex }} />; })}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2"><label className="type-body-sm flex items-center gap-2">{t("settings.outra_cor")}{" "}<input type="color" aria-label={t("settings.cor_personalizada_dos_containers")} className="h-9 w-14 rounded border border-line-soft" value={theme.contentContainerColor ?? "#FFFFFF"} onChange={(e) => updateTheme({ contentContainerColor: e.target.value.toUpperCase() })} onBlur={(e) => savePrefs({ contentContainerColor: e.target.value.toUpperCase() })} /></label><Button size="sm" onClick={() => { updateTheme({ contentContainerColor: null }); savePrefs({ contentContainerColor: "" }); }}>{t("settings.padrao_branco")}</Button></div>
            <h2 className="type-h3 mt-5 mb-2">{t("settings.skin_padrao_dos_cards")}</h2>
            <Select aria-label={t("settings.skin")} value={(server.data?.defaultCardSkin as string) ?? "atelier"} onChange={(e) => savePrefs({ defaultCardSkin: e.target.value })}>{Object.keys(CARD_SKINS).map((s) => <option key={s} value={s}>{s}</option>)}</Select>
          </Card>
        </div>
      )}
      {tab === "privacy" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="type-h3 mb-3">{t("common.visibility")}</h2>
            <p className="type-body text-muted mb-2">{t("settings.visibilidade_padrao_do_perfil_e")}</p>
            <Select aria-label={t("settings.visibilidade")} value={(me as Me & { profileVisibility?: string }).profileVisibility ?? (me.user.privateAccount ? "PRIVATE" : "PUBLIC")} onChange={(e) => call(() => api.put("/api/me/privacy", { visibility: e.target.value }), t("common.saved"))}><option value="PUBLIC">{t("common.public")}</option><option value="FOLLOWERS">{t("common.followers")}</option><option value="PRIVATE">{t("common.private")}</option></Select>
          </Card>
          <Card>
            <h2 className="type-h3 mb-3">{t("settings.lgpd_rf24", { txt: t("settings.consents") })}</h2>
            {consents.loading && <Skeleton className="h-32" />}
            <ul className="divide-y divide-line-soft">{(consents.data ?? []).map((c) => <li key={c.purpose}><Switch checked={c.granted} onChange={async (v) => { try { consents.setData(await api.put<Consent[]>(`/api/me/consents/${c.purpose}`, { granted: v })); } catch (e) { toast.fromError(e); } }} label={c.label ?? c.purpose.replace(/_/g, " ").toLowerCase()} />{c.description && <p className="type-caption text-muted -mt-1 pb-2">{c.description}</p>}</li>)}</ul>
          </Card>
        </div>
      )}
      {tab === "data" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="type-h3 mb-2">{t("settings.export")}</h2>
            <p className="type-body text-muted mb-3">{t("settings.geramos_um_pacote_com_todos")}</p>
            <Button variant="primary" onClick={() => call(() => api.post("/api/me/exports"), t("settings.exportacao_solicitada")).then(exports.reload)}>{t("settings.export")}</Button>
            <ul className="mt-3 divide-y divide-line-soft">{(exports.data ?? []).map((x) => <li key={x.id} className="flex items-center justify-between py-2 type-body-sm"><span>{x.status} · {x.requestedAt?.slice(0, 10)}</span>{x.status === "READY" && <a className="btn btn-sm" href={`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"}/api/me/exports/${x.id}/file`} onClick={async (e) => { e.preventDefault(); const u = await api.blobUrl(`/api/me/exports/${x.id}/file`); window.open(u); }}>{t("settings.baixar")}</a>}</li>)}</ul>
          </Card>
          <Card>
            <h2 className="type-h3 mb-2">{t("settings.deleteAccount")}</h2>
            {me.deletionScheduledFor ? <><p className="type-body text-critical mb-3">{t("settings.exclusao_agendada_para", { slice: me.deletionScheduledFor.slice(0, 10) })}</p><Button onClick={() => call(() => api.delete("/api/me/deletion"), t("settings.exclusao_cancelada"))}>{t("settings.cancelDeletion")}</Button></>
              : <><p className="type-body text-muted mb-3">{t("settings.a_conta_fica_30_dias")}</p><Button variant="danger" onClick={() => setDel({ open: true, password: "" })}>{t("settings.deleteAccount")}</Button></>}
          </Card>
        </div>
      )}
      {tab === "sessions" && (
        <Card>
          <h2 className="type-h3 mb-3">{t("settings.sessions")}</h2>
          {sessions.loading && <Skeleton className="h-32" />}
          <ul className="divide-y divide-line-soft">{(sessions.data ?? []).map((s) => <li key={s.id} className="flex items-center justify-between gap-3 py-2 type-body-sm"><span>{s.deviceName ?? t("settings.dispositivo")} · {s.ip ?? ""} · {s.lastUsedAt?.slice(0, 16) ?? s.createdAt?.slice(0, 16)}{s.current && <b>{t("settings.esta_sessao")}</b>}</span>{!s.current && <Button size="sm" onClick={() => call(() => api.delete(`/api/auth/sessions/${s.id}`), t("settings.sessao_encerrada")).then(sessions.reload)}>{t("settings.encerrar")}</Button>}</li>)}</ul>
          <Button className="mt-3" variant="danger" onClick={() => call(() => api.delete("/api/auth/sessions"), t("settings.outras_sessoes_encerradas")).then(sessions.reload)}>{t("settings.sair_de_todos_os_outros")}</Button>
        </Card>
      )}
      <Dialog open={del.open} onClose={() => setDel({ open: false, password: "" })} title={t("settings.deleteAccount")} footer={<><Button onClick={() => setDel({ open: false, password: "" })}>{t("common.cancel")}</Button><Button variant="danger" onClick={() => call(() => api.post("/api/me/deletion", { password: del.password }), t("settings.exclusao_agendada")).then(() => setDel({ open: false, password: "" }))}>{t("common.confirm")}</Button></>}>
        <Field label={t("auth.password")} id="delpwd"><Input id="delpwd" type="password" value={del.password} onChange={(e) => setDel({ ...del, password: e.target.value })} /></Field>
      </Dialog>
    </>
  );
}
export default function SettingsPage() { return <RequireAuth><Settings /></RequireAuth>; }
