"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { Button, Dialog, Input, Textarea, useNotice } from "@/components/ui";
import { MannequinGlyph } from "@/components/photo-picker";
import { useI18n } from "@/lib/i18n/i18n";

/**
 * RF23 · Editar perfil no formato do Instagram: foto de perfil (o "+" no círculo envia a foto) e o avatar 3D (a caixa
 * isométrica abre o criador do avatar, RF40),
 * e as linhas Nome, Nome de usuário (o @ único), Pronomes, Bio, Links e Gênero (o manequim da Passarela/foto com
 * manequim). A mesma tela abre nas Configurações, no próprio perfil e no Lookbook.
 */
export function EditProfileForm({ onDone }: { onDone?: () => void }) {
  const { t } = useI18n();
  const { me, refreshMe } = useAuth(); const notice = useNotice();
  const [f, setF] = useState({ displayName: "", username: "", pronouns: "", bio: "", links: [] as { title: string; url: string }[], sex: null as "FEMININO" | "MASCULINO" | null });
  const [free, setFree] = useState<{ available?: boolean; suggestions?: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { if (me) setF({ displayName: me.user.displayName ?? "", username: me.user.username, pronouns: me.pronouns ?? "", bio: me.bio ?? "", links: me.links ?? [], sex: me.sex ?? null }); }, [me]);
  useEffect(() => {
    if (!me || f.username === me.user.username || f.username.length < 3) { setFree(null); return; }
    const h = setTimeout(() => api.get<{ available: boolean; suggestions?: string[] }>(`/api/usernames/${encodeURIComponent(f.username)}/availability`).then(setFree).catch(() => setFree(null)), 350);
    return () => clearTimeout(h);
  }, [f.username, me]);
  if (!me) return null;
  const brand = me.user.profileType === "MARCA";
  async function upload(fl?: File) {
    if (!fl) return; setBusy(true);
    try { const fd = new FormData(); fd.append("file", fl); await api.upload("/api/me/avatar", fd); await refreshMe(); notice.success(t("editProfile.foto_de_perfil_atualizada")); } catch (e) { notice.fromError(e); } finally { setBusy(false); }
  }
  // foto que ficou deitada: gira 90° no sentido horário a cada toque (nova versão no acervo)
  async function rotate() {
    setBusy(true);
    try { await api.post("/api/me/avatar/rotate?degrees=90"); await refreshMe(); notice.success(t("editProfile.foto_girada")); } catch (e) { notice.fromError(e); } finally { setBusy(false); }
  }
  async function save() {
    setBusy(true);
    try {
      if (f.username !== me!.user.username) await api.put("/api/me/username", { username: f.username });
      await api.patch("/api/me/profile", { displayName: f.displayName, pronouns: f.pronouns, bio: f.bio, links: f.links.filter((l) => l.url.trim()), ...(f.sex ? { sex: f.sex } : {}) });
      await refreshMe(); notice.success(t("editProfile.perfil_salvo")); onDone?.();
    } catch (e) { notice.fromError(e); } finally { setBusy(false); }
  }
  const row = (label: string, body: React.ReactNode, id?: string) => (
    <div className="grid grid-cols-[120px_1fr] items-start gap-3 border-b border-line-soft py-3 last:border-b-0">
      <label htmlFor={id} className="pt-2 type-body">{label}</label><div className="min-w-0">{body}</div>
    </div>
  );
  return (
    <div className="edit-profile">
      <div className="flex items-center justify-center gap-6 border-b border-line-soft pb-4">
        <div className="relative h-24 w-24">
          <span className="block h-24 w-24 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line-soft">{me.user.avatarUrl ? <img src={mediaUrl(me.user.avatarUrl)} alt={t("editProfile.sua_foto_de_perfil")} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-3xl text-muted">{me.user.displayName?.[0] ?? "?"}</span>}</span>
          {/* foto de perfil: o "+" no círculo abre a escolha do arquivo */}
          <button type="button" onClick={() => file.current?.click()} disabled={busy} className="ep-plus" aria-label={t("editProfile.nova_foto_de_perfil")} title={t("editProfile.nova_foto_de_perfil")}><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg></button>
          {me.user.avatarUrl && <button type="button" className="ep-rotate" disabled={busy} aria-label={t("editProfile.girar_foto")} title={t("editProfile.girar_foto")} onClick={rotate}><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>}
          {me.user.avatarUrl && <button type="button" className="ep-remove" disabled={busy} aria-label={t("common.remover_foto")} title={t("common.remover_foto")} onClick={async () => { try { await api.patch("/api/me/profile", { avatarUrl: "" }); await refreshMe(); notice.success(t("editProfile.foto_removida_o_manequim_volta")); } catch (e) { notice.fromError(e); } }}>✕</button>}
        </div>
        {/* avatar 3D: a caixa isométrica leva ao criador do avatar (RF40) */}
        {!brand && <Link href="/avatar" className="ep-cube" aria-label={t("editProfile.meu_avatar_3d")} title={t("editProfile.meu_avatar_3d")}><IsoCube size={44} /></Link>}
        <input ref={file} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {row(t("common.nome"), <Input id="ep-name" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} maxLength={80} />, "ep-name")}
      {row(t("editProfile.nome_de_usuario"), <><Input id="ep-user" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase() })} maxLength={30} error={free?.available === false} />{free && <p className={`mt-1 type-caption ${free.available ? "text-muted" : "error-text"}`}>{free.available ? t("editProfile.disponivel") : t("editProfile.em_uso", { value: free.suggestions?.length ? t("editProfile.sugestoes", { join: free.suggestions.join(", ") }) : "" })}</p>}<p className="mt-1 type-caption text-faint">{t("editProfile.o_e_unico_e_aparece")}</p></>, "ep-user")}
      {row(t("editProfile.pronomes"), <Input id="ep-pron" value={f.pronouns} onChange={(e) => setF({ ...f, pronouns: e.target.value })} placeholder={t("editProfile.pronomes")} maxLength={40} />, "ep-pron")}
      {row(t("editProfile.bio"), <Textarea id="ep-bio" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} maxLength={300} rows={3} />, "ep-bio")}
      {row(t("editProfile.links"), <div className="grid gap-2">
        {f.links.map((l, i) => <div key={i} className="flex gap-2"><Input aria-label={t("editProfile.titulo_do_link", { value: i + 1 })} className="w-32" value={l.title} placeholder={t("scheme.title")} onChange={(e) => setF({ ...f, links: f.links.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)) })} /><Input aria-label={t("editProfile.endereco_do_link", { value: i + 1 })} value={l.url} placeholder="https://" onChange={(e) => setF({ ...f, links: f.links.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)) })} /><Button size="sm" variant="ghost" aria-label={t("editProfile.remover_link")} onClick={() => setF({ ...f, links: f.links.filter((_, k) => k !== i) })}>✕</Button></div>)}
        {f.links.length < 5 && <button type="button" className="justify-self-start type-body text-muted hover:underline" onClick={() => setF({ ...f, links: [...f.links, { title: "", url: "" }] })}>{t("editProfile.adicionar_links")}</button>}
      </div>)}
      {!brand && row(t("editProfile.genero"), <div role="radiogroup" aria-label={t("editProfile.genero_do_manequim")} className="flex gap-2 pt-1">{(["FEMININO", "MASCULINO"] as const).map((s) => <button key={s} type="button" role="radio" aria-checked={f.sex === s} className={`chip inline-flex items-center gap-1.5 ${f.sex === s ? "is-active" : ""}`} onClick={() => setF({ ...f, sex: s })}><MannequinGlyph sex={s} />{s === "FEMININO" ? t("editProfile.mulher") : t("editProfile.homem")}</button>)}<span className="self-center type-caption text-faint">{t("editProfile.define_o_manequim")}</span></div>)}
      <div className="mt-4 flex justify-end gap-2">{onDone && <Button onClick={onDone}>{t("common.cancel")}</Button>}<Button variant="primary" loading={busy} onClick={save} disabled={free?.available === false || f.displayName.trim().length < 2}>{t("common.save")}</Button></div>
    </div>
  );
}

/** Caixa isométrica 3D: o acesso ao avatar 3D (três faces do cubo com tons diferentes). */
function IsoCube({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path d="M24 4 42 14 24 24 6 14Z" fill="var(--color-accent, #22c55e)" />
      <path d="M6 14 24 24v20L6 34Z" fill="currentColor" opacity=".78" />
      <path d="M42 14 24 24v20l18-10Z" fill="currentColor" opacity=".45" />
      <path d="M24 4 42 14v20L24 44 6 34V14Z M6 14l18 10 18-10 M24 24v20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function EditProfileButton({ className = "btn btn-sm" }: { className?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{t("common.editar_perfil")}</button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("common.editar_perfil")} size="lg">{open && <EditProfileForm onDone={() => setOpen(false)} />}</Dialog>
    </>
  );
}
