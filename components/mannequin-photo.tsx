"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { api, mediaUrl } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { Button, Dialog, Skeleton, Switch, useToast } from "@/components/ui";
import { useWebGL, type FaceFit, type Look3d } from "@/components/three/common";
import { Cube3dIcon } from "@/components/generate-3d";

const LookViewer = dynamic(() => import("@/components/three/look-viewer"), { ssr: false, loading: () => <div className="grid h-full place-items-center type-caption text-muted">vestindo o manequim…</div> });

/** Peças que ganham a foto com manequim sozinhas (RF4). Inferior, calçado e acessório aparecem na foto do look (RF5). */
export const MANNEQUIN_PHOTO_CATEGORIES = new Set(["upper_piece", "full_body_piece"]);

/**
 * Foto com meu manequim (card Trello · RF4/RF5): a peça superior/de corpo inteiro — ou o look inteiro — vestindo o
 * manequim da pessoa, com o rosto 3D feito da foto de perfil. Sem foto de perfil, veste o manequim padrão masc./fem.
 * (nunca um manequim fantasma). A imagem é renderizada aqui (Three.js) e guardada no servidor.
 */
export function MannequinPhotoButton({ kind, id, title, current, onSaved }: { kind: "piece" | "scheme"; id: string; title: string; current?: string | null; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Cube3dIcon />{current ? "Refazer foto com meu manequim" : "Foto com meu manequim"}</Button>
      {open && <MannequinPhotoDialog kind={kind} id={id} title={title} current={current} onClose={(saved) => { setOpen(false); if (saved) onSaved(); }} />}
    </>
  );
}

export function MannequinPhotoDialog({ kind, id, title, current, onClose }: { kind: "piece" | "scheme"; id: string; title: string; current?: string | null; onClose: (saved: boolean) => void }) {
  const { me, refreshMe } = useAuth(); const toast = useToast(); const webgl = useWebGL();
  const [look, setLook] = useState<Look3d | null>(null); const [err, setErr] = useState<string | null>(null);
  const [face, setFace] = useState<FaceFit>({ offsetX: 0, offsetY: 0, scale: 1 }); const [asCover, setAsCover] = useState(kind === "scheme");
  const [busy, setBusy] = useState(false); const [preview, setPreview] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let alive = true;
    api.get<Look3d>(kind === "scheme" ? `/api/schemes/${id}/look3d` : `/api/pieces/${id}/look3d`).then((l) => { if (!alive) return; setLook(l); if (l.mannequin.face) setFace({ offsetX: 0, offsetY: 0, scale: 1, ...l.mannequin.face }); }).catch((e) => alive && setErr(e?.message ?? "Não foi possível montar o manequim."));
    return () => { alive = false; };
  }, [kind, id]);
  const lookWithFace = look ? { ...look, mannequin: { ...look.mannequin, face } } : null;
  async function shoot() {
    const c = canvas.current; if (!c) return;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));   // o quadro atual já com o ajuste do rosto
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.93));
    if (!blob) { toast.error("Não foi possível capturar a imagem."); return; }
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", blob, "manequim.jpg");
      const r = await api.upload<{ url: string; face: string }>(kind === "scheme" ? `/api/schemes/${id}/mannequin-photo?asCover=${asCover}` : `/api/pieces/${id}/mannequin-photo`, fd);
      if (look?.mannequin.head === "FOTO") await api.patch("/api/me/profile", { mannequinFace: face }).catch(() => undefined);
      setPreview(r.url); toast.success(kind === "scheme" && asCover ? "Foto com manequim salva e usada como foto do post" : "Foto com manequim salva");
      refreshMe().catch(() => undefined);
    } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  const m = look?.mannequin;
  return (
    <Dialog open onClose={() => onClose(!!preview)} size="lg" title={`Foto com meu manequim · ${title}`}>
      {err && <p className="type-body text-muted" role="alert">{err}</p>}
      {!look && !err && <Skeleton className="h-[440px]" />}
      {lookWithFace && (
        <div className="grid gap-4 md:grid-cols-[1fr_270px]">
          <div className="h-[460px] overflow-hidden rounded-lg border border-line-soft">
            {webgl === false ? <p className="grid h-full place-items-center p-4 text-center type-body text-muted">Este navegador não tem WebGL: a foto com manequim precisa do 3D.</p>
              : preview ? <img src={mediaUrl(preview)} alt={`${title} no manequim`} className="h-full w-full object-contain bg-surface-2" />
              : <LookViewer look={lookWithFace} still background="#ECE7DE" framing={kind === "piece" && lookWithFace.pieces.every((x) => x.slot === "upper" || x.slot === "outer_layer") ? "upper" : "full"} onCanvas={(c) => { canvas.current = c; }} />}
          </div>
          <div className="min-w-0">
            <p className="label">Manequim</p>
            <p className="type-body-sm">{m?.sex === "MASCULINO" ? "Masculino" : "Feminino"} · {m?.head === "FOTO" ? "rosto 3D da sua foto de perfil" : "padrão (sem foto de perfil)"}</p>
            {m?.head !== "FOTO" && me?.user.profileType !== "MARCA" && <p className="mt-1 type-caption text-muted">Envie uma foto de perfil (Configurações) para o manequim ganhar o seu rosto.</p>}
            {m?.head === "FOTO" && !preview && (
              <fieldset className="mt-3">
                <legend className="label">Ajustar o rosto</legend>
                {([["scale", "Tamanho", 0.6, 1.8, 0.02], ["offsetX", "Horizontal", -0.3, 0.3, 0.01], ["offsetY", "Vertical", -0.3, 0.3, 0.01]] as const).map(([k, lbl, min, max, step]) => (
                  <label key={k} className="mt-1 block type-caption">{lbl}<input type="range" min={min} max={max} step={step} value={face[k] ?? (k === "scale" ? 1 : 0)} onChange={(e) => setFace((f) => ({ ...f, [k]: Number(e.target.value) }))} className="block w-full" /></label>
                ))}
              </fieldset>
            )}
            {kind === "scheme" && !preview && <div className="mt-3"><Switch checked={asCover} onChange={setAsCover} label="Usar como foto do post (RF5)" /></div>}
            <p className="mt-3 type-caption text-muted">{kind === "scheme" ? "O manequim veste todas as peças do look." : "Peças inferiores, calçados e acessórios aparecem vestidos na foto do look (RF5)."} Arraste para girar antes de gerar.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {!preview ? <Button variant="primary" loading={busy} disabled={webgl === false} onClick={shoot}>Gerar foto</Button> : <Button onClick={() => setPreview(null)}>Gerar de novo</Button>}
              {(current || preview) && <Button variant="ghost" onClick={async () => { try { await api.delete(kind === "scheme" ? `/api/schemes/${id}/mannequin-photo` : `/api/pieces/${id}/mannequin-photo`); setPreview(null); toast.success("Foto removida"); onClose(true); } catch (e) { toast.fromError(e); } }}>Remover foto</Button>}
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
