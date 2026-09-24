"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { api, mediaUrl } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { Button, Dialog, Input, Textarea, useToast } from "@/components/ui";
import { MannequinGlyph } from "@/components/photo-picker";
import type { FaceFit, Look3d } from "@/components/three/common";

const LookViewer = dynamic(() => import("@/components/three/look-viewer"), { ssr: false, loading: () => <div className="grid h-full place-items-center type-caption text-muted">montando o rosto…</div> });

/**
 * RF23 · Editar perfil no formato do Instagram: foto de perfil + "avatar" (o rosto 3D do manequim feito da foto),
 * e as linhas Nome, Nome de usuário (o @ único), Pronomes, Bio, Links e Gênero (o manequim da Passarela/foto com
 * manequim). A mesma tela abre nas Configurações, no próprio perfil e no Lookbook.
 */
export function EditProfileForm({ onDone }: { onDone?: () => void }) {
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
    try { const fd = new FormData(); fd.append("file", fl); await api.upload("/api/me/avatar", fd); await refreshMe(); toast.success("Foto de perfil atualizada"); } catch (e) { toast.fromError(e); } finally { setBusy(false); setPhotoMenu(false); }
  }
  async function save() {
    setBusy(true);
    try {
      if (f.username !== me!.user.username) await api.put("/api/me/username", { username: f.username });
      await api.patch("/api/me/profile", { displayName: f.displayName, pronouns: f.pronouns, bio: f.bio, links: f.links.filter((l) => l.url.trim()), ...(f.sex ? { sex: f.sex } : {}) });
      await refreshMe(); toast.success("Perfil salvo"); onDone?.();
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
          <span className="h-24 w-24 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line-soft">{me.user.avatarUrl ? <img src={mediaUrl(me.user.avatarUrl)} alt="Sua foto de perfil" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-3xl text-muted">{me.user.displayName?.[0] ?? "?"}</span>}</span>
          {!brand && <button type="button" onClick={() => setFaceOpen(true)} className="flex h-24 w-24 items-center justify-center rounded-full border border-line-soft bg-surface hover:bg-surface-2" aria-label="ver e ajustar o rosto do manequim" title="Rosto do manequim (avatar 3D)"><MannequinGlyph sex={f.sex ?? "FEMININO"} size={40} /></button>}
        </div>
        <button type="button" className="type-body font-semibold text-[#3B5BDB] hover:underline" onClick={() => setPhotoMenu(true)} disabled={busy}>Editar foto ou avatar</button>
        <input ref={file} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {row("Nome", <Input id="ep-name" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} maxLength={80} />, "ep-name")}
      {row("Nome de usuário", <><Input id="ep-user" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase() })} maxLength={30} error={free?.available === false} />{free && <p className={`mt-1 type-caption ${free.available ? "text-muted" : "error-text"}`}>{free.available ? "✓ disponível" : `✗ em uso${free.suggestions?.length ? ` — sugestões: ${free.suggestions.join(", ")}` : ""}`}</p>}<p className="mt-1 type-caption text-faint">O @ é único e aparece no link do perfil; trocas limitadas por período.</p></>, "ep-user")}
      {row("Pronomes", <Input id="ep-pron" value={f.pronouns} onChange={(e) => setF({ ...f, pronouns: e.target.value })} placeholder="Pronomes" maxLength={40} />, "ep-pron")}
      {row("Bio", <Textarea id="ep-bio" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} maxLength={300} rows={3} />, "ep-bio")}
      {row("Links", <div className="grid gap-2">
        {f.links.map((l, i) => <div key={i} className="flex gap-2"><Input aria-label={`título do link ${i + 1}`} className="w-32" value={l.title} placeholder="Título" onChange={(e) => setF({ ...f, links: f.links.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)) })} /><Input aria-label={`endereço do link ${i + 1}`} value={l.url} placeholder="https://" onChange={(e) => setF({ ...f, links: f.links.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)) })} /><Button size="sm" variant="ghost" aria-label="remover link" onClick={() => setF({ ...f, links: f.links.filter((_, k) => k !== i) })}>✕</Button></div>)}
        {f.links.length < 5 && <button type="button" className="justify-self-start type-body text-muted hover:underline" onClick={() => setF({ ...f, links: [...f.links, { title: "", url: "" }] })}>Adicionar links ›</button>}
      </div>)}
      {!brand && row("Gênero", <div role="radiogroup" aria-label="gênero do manequim" className="flex gap-2 pt-1">{(["FEMININO", "MASCULINO"] as const).map((s) => <button key={s} type="button" role="radio" aria-checked={f.sex === s} className={`chip inline-flex items-center gap-1.5 ${f.sex === s ? "is-active" : ""}`} onClick={() => setF({ ...f, sex: s })}><MannequinGlyph sex={s} />{s === "FEMININO" ? "Mulher" : "Homem"}</button>)}<span className="self-center type-caption text-faint">define o manequim</span></div>)}
      <div className="mt-4 flex justify-end gap-2">{onDone && <Button onClick={onDone}>Cancelar</Button>}<Button variant="primary" loading={busy} onClick={save} disabled={free?.available === false || f.displayName.trim().length < 2}>Salvar</Button></div>
      <Dialog open={photoMenu} onClose={() => setPhotoMenu(false)} title="Editar foto ou avatar">
        <div className="grid gap-2">
          <Button onClick={() => file.current?.click()} loading={busy}>Nova foto de perfil</Button>
          {!brand && <Button onClick={() => { setPhotoMenu(false); setFaceOpen(true); }} disabled={!me.user.avatarUrl}>Ajustar o rosto do manequim (avatar 3D)</Button>}
          {me.user.avatarUrl && <Button variant="danger" onClick={async () => { try { await api.patch("/api/me/profile", { avatarUrl: "" }); await refreshMe(); setPhotoMenu(false); toast.success("Foto removida — o manequim volta ao padrão"); } catch (e) { toast.fromError(e); } }}>Remover foto</Button>}
          <p className="type-caption text-muted">A foto aparece no seu perfil, nas Configurações e vira o rosto 3D do seu manequim (Passarela e Foto com meu manequim).</p>
        </div>
      </Dialog>
      {faceOpen && <FaceFitDialog onClose={() => setFaceOpen(false)} />}
    </div>
  );
}

/** Rosto 3D do manequim (avatar): a foto de perfil projetada na cabeça, com ajuste de tamanho e posição. */
function FaceFitDialog({ onClose }: { onClose: () => void }) {
  const { me } = useAuth(); const toast = useToast();
  const [face, setFace] = useState<FaceFit>({ offsetX: 0, offsetY: 0, scale: 1 });
  const [base, setBase] = useState<Look3d | null>(null);
  useEffect(() => {
    // o manequim da própria pessoa, sem peças: vem do primeiro look dela; sem look, monta com os dados do perfil
    api.get<{ items: { id: string }[] }>("/api/me/schemes?size=1").then(async (p) => {
      if (p.items[0]) { const l = await api.get<Look3d>(`/api/schemes/${p.items[0].id}/look3d`); setBase({ ...l, pieces: [], title: "Meu manequim" }); if (l.mannequin.face) setFace((f) => ({ ...f, ...l.mannequin.face })); }
      else setBase({ title: "Meu manequim", pieces: [], mannequin: { sex: me?.sex ?? "FEMININO", photoUrl: me?.user.avatarUrl ?? null, head: me?.user.avatarUrl ? "FOTO" : "PADRAO" } });
    }).catch(() => setBase({ title: "Meu manequim", pieces: [], mannequin: { sex: me?.sex ?? "FEMININO", photoUrl: me?.user.avatarUrl ?? null, head: me?.user.avatarUrl ? "FOTO" : "PADRAO" } }));
  }, [me]);
  return (
    <Dialog open onClose={onClose} title="Rosto do manequim" size="lg" footer={<Button variant="primary" onClick={async () => { try { await api.patch("/api/me/profile", { mannequinFace: face }); toast.success("Rosto ajustado"); onClose(); } catch (e) { toast.fromError(e); } }}>Salvar ajuste</Button>}>
      <div className="grid gap-4 md:grid-cols-[1fr_240px]">
        <div className="h-[380px] overflow-hidden rounded-lg border border-line-soft">{base && <LookViewer look={{ ...base, mannequin: { ...base.mannequin, face } }} still framing="upper" background="#ECE7DE" />}</div>
        <div>
          {!me?.user.avatarUrl && <p className="type-body-sm text-muted">Sem foto de perfil: o manequim usa o rosto padrão. Envie uma foto para ele ganhar o seu rosto.</p>}
          {([["scale", "Tamanho", 0.6, 1.8, 0.02], ["offsetX", "Horizontal", -0.3, 0.3, 0.01], ["offsetY", "Vertical", -0.3, 0.3, 0.01]] as const).map(([k, lbl, min, max, step]) => (
            <label key={k} className="mt-2 block type-caption">{lbl}<input type="range" min={min} max={max} step={step} value={face[k] ?? (k === "scale" ? 1 : 0)} onChange={(e) => setFace((x) => ({ ...x, [k]: Number(e.target.value) }))} className="block w-full" /></label>
          ))}
          <p className="mt-3 type-caption text-faint">O rosto 3D tem nariz, sobrancelhas, maçãs e queixo esculpidos; a foto é projetada de frente sobre eles. O mesmo rosto desfila na Passarela 3D.</p>
        </div>
      </div>
    </Dialog>
  );
}

export function EditProfileButton({ className = "btn btn-sm" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>Editar perfil</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Editar perfil" size="lg">{open && <EditProfileForm onDone={() => setOpen(false)} />}</Dialog>
    </>
  );
}
