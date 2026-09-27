"use client";
import { useEffect, useState } from "react";
import { FaiIcon } from "@/components/fai-icon";
import dynamic from "next/dynamic";
import { retryImport } from "@/lib/chunk-recovery";
import { api, mediaUrl } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { Dialog, Skeleton } from "@/components/ui";
import { useWebGL, type Look3d } from "@/components/three/common";
import { tr, useI18n } from "@/lib/i18n/i18n";

const LookViewer = dynamic(() => retryImport(() => import("@/components/three/look-viewer")), { ssr: false, loading: () => <div className="grid h-full place-items-center type-caption text-muted">{tr("generate3d.montando_o_manequim_em_3d")}</div> });

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
export function Generate3DButton({ targets, compact = true, className = "", glyph }: { targets: Target3d[]; compact?: boolean; className?: string; glyph?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!targets.length) return null;
  // glyph: mesmo padrão dos botões do post (disco verde, ícone preto), sem texto
  if (glyph) return (
    <>
      <button type="button" className={`c-act ${className}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        aria-haspopup="dialog" title={t("generate3d.ver_no_manequim_3d")} aria-label={t("generate3d.ver_no_manequim_de", { title: targets[0].title })}>
        <FaiIcon id="ACT-20" size={20} variant="glyph" decorative />
      </button>
      {open && <Generate3DDialog targets={targets} onClose={() => setOpen(false)} />}
    </>
  );
  return (
    <>
      <button type="button" className={`btn btn-ghost btn-sm gen3d-btn ${className}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        aria-haspopup="dialog" title={t("generate3d.ver_no_manequim_3d")} aria-label={t("generate3d.ver_no_manequim_de", { title: targets[0].title })}>
        <Cube3dIcon /><span>{compact ? "3D" : t("generate3d.ver_no_manequim_3d")}</span>
      </button>
      {open && <Generate3DDialog targets={targets} onClose={() => setOpen(false)} />}
    </>
  );
}

const SLOT: Record<string, string> = { get upper() { return tr("common.superior"); }, get outer_layer() { return tr("common.camada_externa"); }, get dress() { return tr("generate3d.corpo_inteiro"); }, get lower() { return tr("common.inferior"); }, get shoes() { return tr("common.calcado"); }, get accessory() { return tr("common.acessorio"); } };

export function Generate3DDialog({ targets, onClose }: { targets: Target3d[]; onClose: () => void }) {
  const { user } = useAuth(); const webgl = useWebGL();
  const [i, setI] = useState(0); const [look, setLook] = useState<Look3d | null>(null); const [err, setErr] = useState<string | null>(null);
  const t = targets[i];
  const path = t.kind === "scheme" ? `/api/schemes/${t.id}/look3d` : `/api/pieces/${t.id}/look3d`;
  useEffect(() => {
    let alive = true; setLook(null); setErr(null);
    api.get<Look3d>(path, { anonymous: !user }).then((l) => alive && setLook(l)).catch((e) => alive && setErr(e?.message ?? tr("generate3d.nao_foi_possivel_montar_o")));
    return () => { alive = false; };
  }, [path, user]);
  // enquanto houver peça na fila do RF16, atualiza a cada 5 s
  const pending = look?.pieces.some((p) => p.model3dStatus === "QUEUED" || p.model3dStatus === "PROCESSING");
  useEffect(() => {
    if (!pending) return;
    const h = setInterval(() => api.get<Look3d>(path, { anonymous: !user }).then(setLook).catch(() => undefined), 5000);
    return () => clearInterval(h);
  }, [pending, path, user]);
  const m = look?.mannequin;
  return (
    <Dialog open onClose={onClose} title={tr("generate3d.manequim_3d_titulo", { title: t.title })} size="lg">
      {targets.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label={tr("common.esquemas_do_dna")}>
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
            <p className="label">{tr("common.manequim")}</p>
            <p className="type-body-sm">{m?.sex === "MASCULINO" ? tr("common.masculino") : tr("common.feminino")} <span className="text-muted">({m?.sexSource === "cadastro" ? tr("generate3d.sexo_do_cadastro") : m?.sexSource === "provador" ? tr("generate3d.preferencia_do_provador") : m?.sexSource === "pecas" ? tr("generate3d.pelas_pecas") : tr("common.padrao")})</span></p>
            <p className="type-caption text-muted">{m?.head === "AVATAR" ? tr("generate3d.rosto_avatar_de", { value: (look.owner?.username ?? "") }) : tr("generate3d.rosto_cabeca_neutra")}</p>
            <p className="label mt-3">{tr("common.pecas_2", { piecesCount: look.pieces.length })}</p>
            <ul className="fai-list mt-1">
              {look.pieces.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <span className="h-9 w-9 shrink-0 overflow-hidden rounded bg-surface-2">{(p.studioUrl ?? p.imageUrl) && <img src={mediaUrl(p.studioUrl ?? p.imageUrl)} alt="" className="h-full w-full object-cover" />}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate type-body-sm">{p.name}</span><span className="block type-caption text-muted">{SLOT[p.slot] ?? p.slot} · {p.model3dUrl ? tr("generate3d.modelo_3d_rf16") : p.model3dStatus === "QUEUED" || p.model3dStatus === "PROCESSING" ? tr("generate3d.gerando_o_modelo") : tr("generate3d.foto_aplicada_no_manequim")}</span></span>
                </li>
              ))}
            </ul>
            {(look.missing3d ?? 0) > 0 && <p className="mt-3 type-caption text-muted">{tr("generate3d.pecas_sem_modelo_foto")}</p>}
            <p className="mt-3 type-caption text-faint">{tr("generate3d.arraste_para_girar_role_para", { value: webgl === false ? tr("generate3d.sem_webgl_versao_2d") : "" })}</p>
          </div>
        </div>
      )}
    </Dialog>
  );
}

/** Sem WebGL: as peças empilhadas na silhueta do manequim (mesma ordem de camadas do 3D). */
function PaperDoll({ look }: { look: Look3d }) {
  const { t } = useI18n();
  const order = ["shoes", "lower", "dress", "upper", "outer_layer", "accessory"];
  const top: Record<string, string> = { upper: "14%", outer_layer: "13%", dress: "14%", lower: "44%", shoes: "88%", accessory: "50%" };
  return (
    <div className="relative mx-auto h-full w-[260px]" aria-label={t("generate3d.look_no_manequim_2d")}>
      <svg viewBox="0 0 100 260" className="absolute inset-0 h-full w-full text-surface-3" aria-hidden><circle cx="50" cy="18" r="11" fill="currentColor" /><path d="M36 32h28l6 60-8 4 4 140H34l4-140-8-4z" fill="currentColor" /></svg>
      {look.mannequin.photoUrl && <img src={mediaUrl(look.mannequin.photoUrl)} alt="" className="absolute left-1/2 top-[3%] h-[9%] -translate-x-1/2 rounded-full object-cover" style={{ aspectRatio: "1" }} />}
      {order.flatMap((slot) => look.pieces.filter((p) => p.slot === slot)).map((p) => (
        <img key={p.id} src={mediaUrl(p.imageUrl)} alt={p.name} className="absolute left-1/2 w-[70%] -translate-x-1/2 object-contain" style={{ top: top[p.slot] ?? "50%", maxHeight: p.slot === "lower" ? "46%" : "36%" }} />
      ))}
    </div>
  );
}
