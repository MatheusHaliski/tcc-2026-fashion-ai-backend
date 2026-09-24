"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { api, mediaUrl } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { Button, Dialog, Skeleton, useToast } from "@/components/ui";
import { useWebGL, type Look3d } from "@/components/three/common";

const LookViewer = dynamic(() => import("@/components/three/look-viewer"), { ssr: false, loading: () => <div className="grid h-full place-items-center type-caption text-muted">montando o manequim em 3D…</div> });

export type Target3d = { kind: "scheme" | "piece"; id: string; title: string };

/** Ícone do botão "Gerar 3D" (cubo em perspectiva) — mesmo tamanho dos ícones sociais do rodapé do card. */
export function Cube3dIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 2.8 20 7.2v9.6L12 21.2 4 16.8V7.2z" /><path d="M4 7.2 12 11.6l8-4.4M12 11.6v9.6" />
    </svg>
  );
}

/**
 * Botão "Gerar 3D" das anatomias (junto das interações sociais). Vale para toda tipologia de card: esquema (o look
 * no manequim), peça (a peça no manequim ou o modelo do RF16) e DNA (cada esquema referenciado, um de cada vez).
 */
export function Generate3DButton({ targets, compact = true, className = "" }: { targets: Target3d[]; compact?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!targets.length) return null;
  return (
    <>
      <button type="button" className={`btn btn-ghost btn-sm gen3d-btn ${className}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        aria-haspopup="dialog" title="Gerar 3D: ver no manequim em 3D" aria-label={`Gerar 3D de ${targets[0].title}`}>
        <Cube3dIcon /><span>{compact ? "3D" : "Gerar 3D"}</span>
      </button>
      {open && <Generate3DDialog targets={targets} onClose={() => setOpen(false)} />}
    </>
  );
}

const SLOT: Record<string, string> = { upper: "Superior", outer_layer: "Camada externa", dress: "Corpo inteiro", lower: "Inferior", shoes: "Calçado", accessory: "Acessório" };

export function Generate3DDialog({ targets, onClose }: { targets: Target3d[]; onClose: () => void }) {
  const { user } = useAuth(); const toast = useToast(); const webgl = useWebGL();
  const [i, setI] = useState(0); const [look, setLook] = useState<Look3d | null>(null); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const t = targets[i];
  const path = t.kind === "scheme" ? `/api/schemes/${t.id}/look3d` : `/api/pieces/${t.id}/look3d`;
  useEffect(() => {
    let alive = true; setLook(null); setErr(null);
    api.get<Look3d>(path, { anonymous: !user }).then((l) => alive && setLook(l)).catch((e) => alive && setErr(e?.message ?? "Não foi possível montar o 3D."));
    return () => { alive = false; };
  }, [path, user]);
  // enquanto houver peça na fila do RF16, atualiza a cada 5 s
  const pending = look?.pieces.some((p) => p.model3dStatus === "QUEUED" || p.model3dStatus === "PROCESSING");
  useEffect(() => {
    if (!pending) return;
    const h = setInterval(() => api.get<Look3d>(path, { anonymous: !user }).then(setLook).catch(() => undefined), 5000);
    return () => clearInterval(h);
  }, [pending, path, user]);
  async function requestModels() {
    setBusy(true);
    try {
      if (t.kind === "scheme") {
        const r = await api.post<{ requested: number; skipped: { name: string; reason: string }[]; look: Look3d }>(`/api/schemes/${t.id}/model3d`);
        setLook(r.look);
        toast.success(r.requested ? `${r.requested} peça(s) na fila do 3D (RF16)` : "Nenhuma peça nova para gerar.");
        r.skipped.slice(0, 2).forEach((s) => toast.info(`${s.name}: ${s.reason}`));
      } else {
        await api.post(`/api/pieces/${t.id}/model3d`); toast.success("Peça na fila do 3D (RF16)");
        setLook(await api.get<Look3d>(path));
      }
    } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  const m = look?.mannequin;
  return (
    <Dialog open onClose={onClose} title={`Gerar 3D · ${t.title}`} size="lg">
      {targets.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="esquemas do DNA">
          {targets.map((x, k) => <button key={x.id} type="button" role="tab" aria-selected={k === i} className={`chip ${k === i ? "is-active" : ""}`} onClick={() => setI(k)}>{x.title}</button>)}
        </div>
      )}
      {err && <p className="type-body text-muted" role="alert">{err}</p>}
      {!look && !err && <Skeleton className="h-[420px]" />}
      {look && (
        <div className="grid gap-4 md:grid-cols-[1fr_260px]">
          <div className="h-[440px] overflow-hidden rounded-lg border border-line-soft">
            {webgl === false ? <PaperDoll look={look} /> : <LookViewer look={look} />}
          </div>
          <div className="min-w-0">
            <p className="label">Manequim</p>
            <p className="type-body-sm">{m?.sex === "MASCULINO" ? "Masculino" : "Feminino"} <span className="text-muted">({m?.sexSource === "cadastro" ? "sexo do cadastro" : m?.sexSource === "provador" ? "preferência do provador" : m?.sexSource === "pecas" ? "pelas peças" : "padrão"})</span></p>
            <p className="type-caption text-muted">{m?.head === "FOTO" ? "Rosto: foto de perfil de @" + (look.owner?.username ?? "") : "Rosto: manequim padrão (sem foto de perfil)"}</p>
            <p className="label mt-3">Peças ({look.pieces.length})</p>
            <ul className="mt-1 space-y-1.5">
              {look.pieces.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <span className="h-9 w-9 shrink-0 overflow-hidden rounded bg-surface-2">{(p.studioUrl ?? p.imageUrl) && <img src={mediaUrl(p.studioUrl ?? p.imageUrl)} alt="" className="h-full w-full object-cover" />}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate type-body-sm">{p.name}</span><span className="block type-caption text-muted">{SLOT[p.slot] ?? p.slot} · {p.model3dUrl ? "modelo 3D (RF16)" : p.model3dStatus === "QUEUED" || p.model3dStatus === "PROCESSING" ? "gerando o modelo…" : "foto aplicada no manequim"}</span></span>
                </li>
              ))}
            </ul>
            {look.canRequest && <Button className="mt-3 w-full" variant="primary" loading={busy} onClick={requestModels}>Gerar modelos 3D das peças</Button>}
            {!look.canRequest && (look.missing3d ?? 0) > 0 && <p className="mt-3 type-caption text-muted">As peças sem modelo 3D aparecem com a foto aplicada no manequim. {user ? "Só o dono pede o modelo 3D (RF16) das peças." : ""}</p>}
            <p className="mt-3 type-caption text-faint">Arraste para girar · role para aproximar{webgl === false ? " · sem WebGL: versão 2D" : ""}</p>
          </div>
        </div>
      )}
    </Dialog>
  );
}

/** Sem WebGL: as peças empilhadas na silhueta do manequim (mesma ordem de camadas do 3D). */
function PaperDoll({ look }: { look: Look3d }) {
  const order = ["shoes", "lower", "dress", "upper", "outer_layer", "accessory"];
  const top: Record<string, string> = { upper: "14%", outer_layer: "13%", dress: "14%", lower: "44%", shoes: "88%", accessory: "50%" };
  return (
    <div className="relative mx-auto h-full w-[260px]" aria-label="look no manequim (2D)">
      <svg viewBox="0 0 100 260" className="absolute inset-0 h-full w-full text-surface-3" aria-hidden><circle cx="50" cy="18" r="11" fill="currentColor" /><path d="M36 32h28l6 60-8 4 4 140H34l4-140-8-4z" fill="currentColor" /></svg>
      {look.mannequin.photoUrl && <img src={mediaUrl(look.mannequin.photoUrl)} alt="" className="absolute left-1/2 top-[3%] h-[9%] -translate-x-1/2 rounded-full object-cover" style={{ aspectRatio: "1" }} />}
      {order.flatMap((slot) => look.pieces.filter((p) => p.slot === slot)).map((p) => (
        <img key={p.id} src={mediaUrl(p.imageUrl)} alt={p.name} className="absolute left-1/2 w-[70%] -translate-x-1/2 object-contain" style={{ top: top[p.slot] ?? "50%", maxHeight: p.slot === "lower" ? "46%" : "36%" }} />
      ))}
    </div>
  );
}
