"use client";
import { useEffect, useState } from "react";
import { api, mediaUrl } from "@/lib/api/client";
import type { Me, UserCard } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { LOCALES } from "@/lib/i18n/dictionaries";
import { CHROME_BACKGROUNDS, chromeTile, useTheme } from "@/lib/theme/theme";
import { useApi } from "@/lib/hooks/use-api";
import { CARD_SKINS } from "@/lib/skins";
import { RequireAuth } from "@/components/app-shell";
import { Avatar, Button, Card, Dialog, Field, Input, PageHeader, Select, Skeleton, Switch, Tabs, Textarea, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";

type Tab = "account" | "appearance" | "privacy" | "data" | "sessions";
interface Prefs { theme: string; language: string; density: string; fontScale: number; highContrast: boolean; reduceMotion: boolean; chromeBackgroundId?: string | null; sizeSystem?: string; unitSystem?: string; defaultCardSkin?: string; lookDoDiaPanelVersion?: string; [k: string]: unknown; }
interface Consent { purpose: string; granted: boolean; label?: string; description?: string; grantedAt?: string; }

function Settings() {
  const { t, locale, setLocale } = useI18n(); const { me, refreshMe } = useAuth(); const { prefs: theme, update: updateTheme } = useTheme(); const toast = useToast();
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
  useEffect(() => { const p = server.data; if (!p) return; updateTheme({ theme: (p.theme as typeof theme.theme) ?? "AUTO", density: (p.density as typeof theme.density) ?? "COMFORTABLE", fontScale: p.fontScale ?? 100, highContrast: !!p.highContrast, reduceMotion: !!p.reduceMotion, chromeBackgroundId: p.chromeBackgroundId ?? null }); if (p.language) setLocale(p.language === "PT_BR" ? "pt-BR" : p.language === "EN" ? "en" : "es"); }, [server.data]); // eslint-disable-line react-hooks/exhaustive-deps
  async function savePrefs(patch: Partial<Prefs>) {
    try { server.setData(await api.put<Prefs>("/api/me/preferences", { ...patch, clientUpdatedAt: new Date().toISOString() })); toast.success(t("settings.saved")); } catch (e) { toast.fromError(e); }
  }
  const call = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast.success(ok); await refreshMe(); } catch (e) { toast.fromError(e); } };
  if (!me) return <Skeleton className="h-96" />;
  return (
    <>
      <PageHeader title={t("settings.title")} kicker="RF3 · RF23" />
      <Tabs tabs={[{ id: "account", label: t("settings.account") }, { id: "appearance", label: t("settings.appearance") }, { id: "privacy", label: t("settings.privacy") }, { id: "data", label: t("settings.data") }, { id: "sessions", label: t("settings.sessions") }]} value={tab} onChange={setTab} />
      {tab === "account" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="type-h3 mb-3">Perfil</h2>
            <div className="mb-3 flex items-center gap-3"><Avatar src={mediaUrl(me.user.avatarUrl)} name={me.user.displayName} size={56} />
              <label className="btn btn-sm cursor-pointer"><FaiIcon id="ACT-07" size={24} decorative />Foto<input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.append("file", f); call(() => api.upload("/api/me/avatar", fd), t("common.saved")); }} /></label>
              <label className="btn btn-sm cursor-pointer">Capa<input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.append("file", f); call(() => api.upload("/api/me/cover", fd), t("common.saved")); }} /></label></div>
            <Field label="Nome de exibição" id="displayName"><Input id="displayName" value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} /></Field>
            <Field label="Bio" id="bio"><Textarea id="bio" value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} maxLength={280} /></Field>
            <Field label={t("auth.country")} id="country"><Input id="country" value={profile.country} onChange={(e) => setProfile({ ...profile, country: e.target.value.toUpperCase() })} maxLength={2} /></Field>
            <Button variant="primary" onClick={() => call(() => api.patch("/api/me/profile", profile), t("common.saved"))}>{t("common.save")}</Button>
            <hr className="my-4 border-line-soft" />
            <Field label={t("auth.username")} id="username" hint="Trocas limitadas por período"><div className="flex gap-2"><Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} /><Button onClick={() => call(() => api.put("/api/me/username", { username }), t("common.saved"))}>{t("common.save")}</Button></div></Field>
          </Card>
          <Card>
            <h2 className="type-h3 mb-3">Dados sensíveis <span className="type-caption text-faint">(pede a senha atual)</span></h2>
            <Field label={t("auth.email")} id="email" hint={me.emailVerified ? "confirmado" : "não confirmado"}><Input id="email" type="email" value={sensitive.email} onChange={(e) => setSensitive({ ...sensitive, email: e.target.value })} /></Field>
            <Field label="Telefone" id="phone"><Input id="phone" value={sensitive.phone} onChange={(e) => setSensitive({ ...sensitive, phone: e.target.value })} /></Field>
            <Field label={t("auth.birthDate")} id="birthDate"><Input id="birthDate" type="date" value={sensitive.birthDate} onChange={(e) => setSensitive({ ...sensitive, birthDate: e.target.value })} /></Field>
            <Switch checked={sensitive.twoFactorEnabled} onChange={(v) => setSensitive({ ...sensitive, twoFactorEnabled: v })} label="Autenticação em duas etapas (código por e-mail)" />
            <Field label={t("auth.password")} id="curpwd" required><Input id="curpwd" type="password" autoComplete="current-password" value={sensitive.password} onChange={(e) => setSensitive({ ...sensitive, password: e.target.value })} /></Field>
            <Button variant="primary" onClick={() => call(() => api.patch("/api/me/sensitive", { ...sensitive, email: sensitive.email !== me.email ? sensitive.email : null, phone: sensitive.phone || null, birthDate: sensitive.birthDate || null }), t("common.saved"))}>{t("common.save")}</Button>
            {sensitive.email !== me.email && <div className="mt-3 flex gap-2"><Input placeholder="código enviado ao novo e-mail" value={emailCode} onChange={(e) => setEmailCode(e.target.value)} /><Button onClick={() => call(() => api.post("/api/me/email-change/confirm", { code: emailCode }), t("auth.verified"))}>{t("common.confirm")}</Button></div>}
            <hr className="my-4 border-line-soft" />
            <h2 className="type-h3 mb-3">{t("settings.changePassword")}</h2>
            <Field label="Senha atual" id="p1"><Input id="p1" type="password" autoComplete="current-password" value={pwd.currentPassword} onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label={t("auth.newPassword")} id="p2"><Input id="p2" type="password" autoComplete="new-password" value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} /></Field><Field label={t("auth.confirmPassword")} id="p3"><Input id="p3" type="password" autoComplete="new-password" value={pwd.confirmPassword} onChange={(e) => setPwd({ ...pwd, confirmPassword: e.target.value })} /></Field></div>
            <Button onClick={() => call(() => api.put("/api/auth/password", pwd), "Senha alterada; outras sessões encerradas.")}>{t("settings.changePassword")}</Button>
          </Card>
        </div>
      )}
      {tab === "appearance" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="type-h3 mb-3">{t("settings.appearance")}</h2>
            <Field label={t("settings.theme")} id="theme"><Select id="theme" value={theme.theme} onChange={(e) => { updateTheme({ theme: e.target.value as typeof theme.theme }); savePrefs({ theme: e.target.value }); }}><option value="AUTO">{t("settings.auto")}</option><option value="LIGHT">{t("settings.light")}</option><option value="DARK">{t("settings.dark")}</option><option value="HIGH_CONTRAST">{t("settings.contrast")}</option></Select></Field>
            <Field label={t("settings.language")} id="language"><Select id="language" value={locale} onChange={(e) => { const l = e.target.value as typeof locale; setLocale(l); savePrefs({ language: l === "pt-BR" ? "PT_BR" : l.toUpperCase() }); }}>{LOCALES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</Select></Field>
            <Field label={t("settings.density")} id="density"><Select id="density" value={theme.density} onChange={(e) => { updateTheme({ density: e.target.value as typeof theme.density }); savePrefs({ density: e.target.value }); }}><option value="COMFORTABLE">Confortável</option><option value="COMPACT">Compacta</option></Select></Field>
            <Field label={`${t("settings.fontScale")}: ${theme.fontScale}%`} id="fontScale"><input id="fontScale" type="range" min={85} max={140} step={5} value={theme.fontScale} onChange={(e) => updateTheme({ fontScale: Number(e.target.value) })} onMouseUp={() => savePrefs({ fontScale: theme.fontScale })} onTouchEnd={() => savePrefs({ fontScale: theme.fontScale })} className="w-full" /></Field>
            <Switch checked={theme.highContrast} onChange={(v) => { updateTheme({ highContrast: v }); savePrefs({ highContrast: v }); }} label={t("settings.contrast")} />
            <Switch checked={theme.reduceMotion} onChange={(v) => { updateTheme({ reduceMotion: v }); savePrefs({ reduceMotion: v }); }} label={t("settings.reduceMotion")} />
            <Field label="Sistema de tamanhos" id="sizeSystem"><Select id="sizeSystem" value={(server.data?.sizeSystem as string) ?? "BR"} onChange={(e) => savePrefs({ sizeSystem: e.target.value })}>{["BR", "US", "EU", "UK"].map((s) => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="Unidades" id="unitSystem"><Select id="unitSystem" value={(server.data?.unitSystem as string) ?? "CM"} onChange={(e) => savePrefs({ unitSystem: e.target.value })}>{["CM", "IN"].map((s) => <option key={s}>{s}</option>)}</Select></Field>
          </Card>
          <Card>
            <h2 className="type-h3 mb-3">{t("settings.chrome")} (RF23)</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{CHROME_BACKGROUNDS.map((b) => <button key={b.id} type="button" aria-pressed={theme.chromeBackgroundId === b.id} className={`rounded border-2 p-1 ${theme.chromeBackgroundId === b.id ? "border-mark" : "border-line-soft"}`} onClick={() => { updateTheme({ chromeBackgroundId: b.id }); savePrefs({ chromeBackgroundId: b.id }); }}><img src={chromeTile(b.id)} alt={b.label} className="aspect-video w-full rounded object-cover" /><span className="block type-caption mt-1">{b.label}</span></button>)}</div>
            <Button className="mt-2" size="sm" onClick={() => { updateTheme({ chromeBackgroundId: null }); savePrefs({ chromeBackgroundId: null }); }}>Padrão</Button>
            <h2 className="type-h3 mt-5 mb-2">Skin padrão dos cards</h2>
            <Select aria-label="skin" value={(server.data?.defaultCardSkin as string) ?? "atelier"} onChange={(e) => savePrefs({ defaultCardSkin: e.target.value })}>{Object.keys(CARD_SKINS).map((s) => <option key={s} value={s}>{s}</option>)}</Select>
          </Card>
        </div>
      )}
      {tab === "privacy" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="type-h3 mb-3">{t("common.visibility")}</h2>
            <p className="type-body text-muted mb-2">Visibilidade padrão do perfil e do conteúdo novo.</p>
            <Select aria-label="visibilidade" value={(me as Me & { profileVisibility?: string }).profileVisibility ?? (me.user.privateAccount ? "PRIVATE" : "PUBLIC")} onChange={(e) => call(() => api.put("/api/me/privacy", { visibility: e.target.value }), t("common.saved"))}><option value="PUBLIC">{t("common.public")}</option><option value="FOLLOWERS">{t("common.followers")}</option><option value="PRIVATE">{t("common.private")}</option></Select>
          </Card>
          <Card>
            <h2 className="type-h3 mb-3">{t("settings.consents")} (LGPD / RF24)</h2>
            {consents.loading && <Skeleton className="h-32" />}
            <ul className="divide-y divide-line-soft">{(consents.data ?? []).map((c) => <li key={c.purpose}><Switch checked={c.granted} onChange={async (v) => { try { consents.setData(await api.put<Consent[]>(`/api/me/consents/${c.purpose}`, { granted: v })); } catch (e) { toast.fromError(e); } }} label={c.label ?? c.purpose.replace(/_/g, " ").toLowerCase()} />{c.description && <p className="type-caption text-muted -mt-1 pb-2">{c.description}</p>}</li>)}</ul>
          </Card>
        </div>
      )}
      {tab === "data" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="type-h3 mb-2">{t("settings.export")}</h2>
            <p className="type-body text-muted mb-3">Geramos um pacote com todos os seus dados (peças, looks, interações, preferências).</p>
            <Button variant="primary" onClick={() => call(() => api.post("/api/me/exports"), "Exportação solicitada.").then(exports.reload)}>{t("settings.export")}</Button>
            <ul className="mt-3 divide-y divide-line-soft">{(exports.data ?? []).map((x) => <li key={x.id} className="flex items-center justify-between py-2 type-body-sm"><span>{x.status} · {x.requestedAt?.slice(0, 10)}</span>{x.status === "READY" && <a className="btn btn-sm" href={`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"}/api/me/exports/${x.id}/file`} onClick={async (e) => { e.preventDefault(); const u = await api.blobUrl(`/api/me/exports/${x.id}/file`); window.open(u); }}>Baixar</a>}</li>)}</ul>
          </Card>
          <Card>
            <h2 className="type-h3 mb-2">{t("settings.deleteAccount")}</h2>
            {me.deletionScheduledFor ? <><p className="type-body text-critical mb-3">Exclusão agendada para {me.deletionScheduledFor.slice(0, 10)}.</p><Button onClick={() => call(() => api.delete("/api/me/deletion"), "Exclusão cancelada.")}>{t("settings.cancelDeletion")}</Button></>
              : <><p className="type-body text-muted mb-3">A conta fica 30 dias em janela de arrependimento antes da exclusão definitiva.</p><Button variant="danger" onClick={() => setDel({ open: true, password: "" })}>{t("settings.deleteAccount")}</Button></>}
          </Card>
        </div>
      )}
      {tab === "sessions" && (
        <Card>
          <h2 className="type-h3 mb-3">{t("settings.sessions")}</h2>
          {sessions.loading && <Skeleton className="h-32" />}
          <ul className="divide-y divide-line-soft">{(sessions.data ?? []).map((s) => <li key={s.id} className="flex items-center justify-between gap-3 py-2 type-body-sm"><span>{s.deviceName ?? "dispositivo"} · {s.ip ?? ""} · {s.lastUsedAt?.slice(0, 16) ?? s.createdAt?.slice(0, 16)}{s.current && <b> · esta sessão</b>}</span>{!s.current && <Button size="sm" onClick={() => call(() => api.delete(`/api/auth/sessions/${s.id}`), "Sessão encerrada.").then(sessions.reload)}>Encerrar</Button>}</li>)}</ul>
          <Button className="mt-3" variant="danger" onClick={() => call(() => api.delete("/api/auth/sessions"), "Outras sessões encerradas.").then(sessions.reload)}>Sair de todos os outros dispositivos</Button>
        </Card>
      )}
      <Dialog open={del.open} onClose={() => setDel({ open: false, password: "" })} title={t("settings.deleteAccount")} footer={<><Button onClick={() => setDel({ open: false, password: "" })}>{t("common.cancel")}</Button><Button variant="danger" onClick={() => call(() => api.post("/api/me/deletion", { password: del.password }), "Exclusão agendada.").then(() => setDel({ open: false, password: "" }))}>{t("common.confirm")}</Button></>}>
        <Field label={t("auth.password")} id="delpwd"><Input id="delpwd" type="password" value={del.password} onChange={(e) => setDel({ ...del, password: e.target.value })} /></Field>
      </Dialog>
    </>
  );
}
export default function SettingsPage() { return <RequireAuth><Settings /></RequireAuth>; }
