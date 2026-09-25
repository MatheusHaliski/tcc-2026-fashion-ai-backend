"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { api, mediaUrl } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { Button, Dialog, Input, Textarea, useToast } from "@/components/ui";
import { MannequinGlyph } from "@/components/photo-picker";
import type { FaceFit, Look3d } from "@/components/three/common";
import { tr, useI18n } from "@/lib/i18n/i18n";

const LookViewer = dynamic(() => import("@/components/three/look-viewer"), { ssr: false, loading: () => <div className="grid h-full place-items-center type-caption text-muted">{tr("editProfile.montando_o_rosto")}</div> });

/**
 * RF23 · Editar perfil no formato do Instagram: foto de perfil + "avatar" (o rosto 3D do manequim feito da foto),
 * e as linhas Nome, Nome de usuário (o @ único), Pronomes, Bio, Links e Gênero (o manequim da Passarela/foto com
 * manequim). A mesma tela abre nas Configurações, no próprio perfil e no Lookbook.
 */
export function EditProfileForm({ onDone }: { onDone?: () => void }) {
  const { t } = useI18n();
  const { me, refreshMe } = useAuth(); const toast = useToast();
  const [f, setF] = useState({ displayName: "", username: "", pronouns: "", bio: "", links: [] as { title: string; url: string }[], sex: null as "FEMININO" | "MASCULINO" | null });
  const [free, setFree] = useState<{ available?: boolean; suggestions?: string[] } | null>(null);
  const [busy, setBusy] = useState(false); const [photoMenu, setPhotoMenu] = useState(false); const [faceOpen, setFaceOpen] = useState(false);
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
    try { const fd = new FormData(); fd.append("file", fl); await api.upload("/api/me/avatar", fd); await refreshMe(); toast.success(t("editProfile.foto_de_perfil_atualizada")); } catch (e) { toast.fromError(e); } finally { setBusy(false); setPhotoMenu(false); }
  }
  async function save() {
    setBusy(true);
    try {
      if (f.username !== me!.user.username) await api.put("/api/me/username", { username: f.username });
      await api.patch("/api/me/profile", { displayName: f.displayName, pronouns: f.pronouns, bio: f.bio, links: f.links.filter((l) => l.url.trim()), ...(f.sex ? { sex: f.sex } : {}) });
      await refreshMe(); toast.success(t("editProfile.perfil_salvo")); onDone?.();
    } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  const row = (label: string, body: React.ReactNode, id?: string) => (
    <div className="grid grid-cols-[120px_1fr] items-start gap-3 border-b border-line-soft py-3 last:border-b-0">
      <label htmlFor={id} className="pt-2 type-body">{label}</label><div className="min-w-0">{body}</div>
    </div>
  );
  return (
    <div className="edit-profile">
      <div className="flex flex-col items-center gap-2 border-b border-line-soft pb-4">
        <div className="flex items-center gap-4">
          <span className="h-24 w-24 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line-soft">{me.user.avatarUrl ? <img src={mediaUrl(me.user.avatarUrl)} alt={t("editProfile.sua_foto_de_perfil")} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-3xl text-muted">{me.user.displayName?.[0] ?? "?"}</span>}</span>
          {!brand && <button type="button" onClick={() => setFaceOpen(true)} className="flex h-24 w-24 items-center justify-center rounded-full border border-line-soft bg-surface hover:bg-surface-2" aria-label={t("editProfile.ver_e_ajustar_o_rosto")} title={t("editProfile.rosto_do_manequim_avatar_3d")}><MannequinGlyph sex={f.sex ?? "FEMININO"} size={40} /></button>}
        </div>
        <button type="button" className="type-body font-semibold text-[#3B5BDB] hover:underline" onClick={() => setPhotoMenu(true)} disabled={busy}>{t("editProfile.editar_foto_ou_avatar")}</button>
        <input ref={file} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {row("Nome", <Input id="ep-name" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} maxLength={80} />, "ep-name")}
      {row("Nome de usuário", <><Input id="ep-user" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase() })} maxLength={30} error={free?.available === false} />{free && <p className={`mt-1 type-caption ${free.available ? "text-muted" : "error-text"}`}>{free.available ? t("editProfile.disponivel") : t("editProfile.em_uso", { value: free.suggestions?.length ? ` — sugestões: ${free.suggestions.join(", ")}` : "" })}</p>}<p className="mt-1 type-caption text-faint">{t("editProfile.o_e_unico_e_aparece")}</p></>, "ep-user")}
      {row("Pronomes", <Input id="ep-pron" value={f.pronouns} onChange={(e) => setF({ ...f, pronouns: e.target.value })} placeholder={t("editProfile.pronomes")} maxLength={40} />, "ep-pron")}
      {row("Bio", <Textarea id="ep-bio" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} maxLength={300} rows={3} />, "ep-bio")}
      {row("Links", <div className="grid gap-2">
        {f.links.map((l, i) => <div key={i} className="flex gap-2"><Input aria-label={t("editProfile.titulo_do_link", { value: i + 1 })} className="w-32" value={l.title} placeholder={t("scheme.title")} onChange={(e) => setF({ ...f, links: f.links.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)) })} /><Input aria-label={t("editProfile.endereco_do_link", { value: i + 1 })} value={l.url} placeholder="https://" onChange={(e) => setF({ ...f, links: f.links.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)) })} /><Button size="sm" variant="ghost" aria-label={t("editProfile.remover_link")} onClick={() => setF({ ...f, links: f.links.filter((_, k) => k !== i) })}>✕</Button></div>)}
        {f.links.length < 5 && <button type="button" className="justify-self-start type-body text-muted hover:underline" onClick={() => setF({ ...f, links: [...f.links, { title: "", url: "" }] })}>{t("editProfile.adicionar_links")}</button>}
      </div>)}
      {!brand && row("Gênero", <div role="radiogroup" aria-label={t("editProfile.genero_do_manequim")} className="flex gap-2 pt-1">{(["FEMININO", "MASCULINO"] as const).map((s) => <button key={s} type="button" role="radio" aria-checked={f.sex === s} className={`chip inline-flex items-center gap-1.5 ${f.sex === s ? "is-active" : ""}`} onClick={() => setF({ ...f, sex: s })}><MannequinGlyph sex={s} />{s === "FEMININO" ? t("editProfile.mulher") : t("editProfile.homem")}</button>)}<span className="self-center type-caption text-faint">{t("editProfile.define_o_manequim")}</span></div>)}
      <div className="mt-4 flex justify-end gap-2">{onDone && <Button onClick={onDone}>{t("common.cancel")}</Button>}<Button variant="primary" loading={busy} onClick={save} disabled={free?.available === false || f.displayName.trim().length < 2}>{t("common.save")}</Button></div>
      <Dialog open={photoMenu} onClose={() => setPhotoMenu(false)} title={t("editProfile.editar_foto_ou_avatar")}>
        <div className="grid gap-2">
          <Button onClick={() => file.current?.click()} loading={busy}>{t("editProfile.nova_foto_de_perfil")}</Button>
          {!brand && <Button onClick={() => { setPhotoMenu(false); setFaceOpen(true); }} disabled={!me.user.avatarUrl}>{t("editProfile.ajustar_o_rosto_do_manequim")}</Button>}
          {me.user.avatarUrl && <Button variant="danger" onClick={async () => { try { await api.patch("/api/me/profile", { avatarUrl: "" }); await refreshMe(); setPhotoMenu(false); toast.success(t("editProfile.foto_removida_o_manequim_volta")); } catch (e) { toast.fromError(e); } }}>{t("common.remover_foto")}</Button>}
          <p className="type-caption text-muted">{t("editProfile.a_foto_aparece_no_seu")}</p>
        </div>
      </Dialog>
      {faceOpen && <FaceFitDialog onClose={() => setFaceOpen(false)} />}
    </div>
  );
}

/** Rosto 3D do manequim (avatar): a foto de perfil projetada na cabeça, com ajuste de tamanho e posição. */
function FaceFitDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { me } = useAuth(); const toast = useToast();
  const [face, setFace] = useState<FaceFit>({ offsetX: 0, offsetY: 0, scale: 1 });
  const [base, setBase] = useState<Look3d | null>(null);
  useEffect(() => {
    // o manequim da própria pessoa, sem peças: vem do primeiro look dela; sem look, monta com os dados do perfil
    api.get<{ items: { id: string }[] }>("/api/me/schemes?size=1").then(async (p) => {
      if (p.items[0]) { const l = await api.get<Look3d>(`/api/schemes/${p.items[0].id}/look3d`); setBase({ ...l, pieces: [], title: t("editProfile.meu_manequim") }); if (l.mannequin.face) setFace((f) => ({ ...f, ...l.mannequin.face })); }
      else setBase({ title: t("editProfile.meu_manequim"), pieces: [], mannequin: { sex: me?.sex ?? "FEMININO", photoUrl: me?.user.avatarUrl ?? null, head: me?.user.avatarUrl ? "FOTO" : "PADRAO" } });
    }).catch(() => setBase({ title: t("editProfile.meu_manequim"), pieces: [], mannequin: { sex: me?.sex ?? "FEMININO", photoUrl: me?.user.avatarUrl ?? null, head: me?.user.avatarUrl ? "FOTO" : "PADRAO" } }));
  }, [me]);
  return (
    <Dialog open onClose={onClose} title={t("editProfile.rosto_do_manequim")} size="lg" footer={<Button variant="primary" onClick={async () => { try { await api.patch("/api/me/profile", { mannequinFace: face }); toast.success(t("editProfile.rosto_ajustado")); onClose(); } catch (e) { toast.fromError(e); } }}>{t("editProfile.salvar_ajuste")}</Button>}>
      <div className="grid gap-4 md:grid-cols-[1fr_240px]">
        <div className="h-[380px] overflow-hidden rounded-lg border border-line-soft">{base && <LookViewer look={{ ...base, mannequin: { ...base.mannequin, face } }} still framing="upper" background="#ECE7DE" />}</div>
        <div>
          {!me?.user.avatarUrl && <p className="type-body-sm text-muted">{t("editProfile.sem_foto_de_perfil_o")}</p>}
          {([["scale", "Tamanho", 0.6, 1.8, 0.02], ["offsetX", "Horizontal", -0.3, 0.3, 0.01], ["offsetY", "Vertical", -0.3, 0.3, 0.01]] as const).map(([k, lbl, min, max, step]) => (
            <label key={k} className="mt-2 block type-caption">{lbl}<input type="range" min={min} max={max} step={step} value={face[k] ?? (k === "scale" ? 1 : 0)} onChange={(e) => setFace((x) => ({ ...x, [k]: Number(e.target.value) }))} className="block w-full" /></label>
          ))}
          <p className="mt-3 type-caption text-faint">{t("editProfile.o_rosto_3d_tem_nariz")}</p>
        </div>
      </div>
    </Dialog>
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
