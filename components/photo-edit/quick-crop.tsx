"use client";
import { useEffect, useRef, useState } from "react";
import { api, ApiError, mediaUrl } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { Button, Chip, useToast } from "@/components/ui";
import { centeredCrop, clampToCanonical, fromRecipe, geometryOps, moveCrop, scaleCrop, toRecipe, type Op, type Rect } from "@/lib/photo-edit/recipe";

interface Session { originalUrl: string; width: number; height: number; currentRecipe?: { target?: string; ops?: Op[] } | null }

/** Escalas fixas do Enquadramento: 1× é o maior quadro 4:5 que cabe na foto; as outras aproximam mantendo o centro. */
export const ZOOMS = [1, 1.25, 1.5, 2] as const;
const MIN_SIDE = 0.05;
const r4 = (v: number) => Math.round(v * 10000) / 10000;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Quadro 4:5 na escala {@code zoom}, centrado em (cx, cy) e sem sair da foto. */
export function zoomCrop(zoom: number, imgW: number, imgH: number, cx = 0.5, cy = 0.5): Rect {
  const base = centeredCrop(imgW, imgH);
  const c = scaleCrop(base, 1 / zoom, imgW, imgH);
  return moveCrop(c, cx - (c.x + c.w / 2), cy - (c.y + c.h / 2));
}
/** Escala fixa mais próxima de um quadro salvo (para abrir o diálogo com o chip certo marcado). */
export function nearestZoom(c: Rect, imgW: number, imgH: number): number {
  const z = centeredCrop(imgW, imgH).w / c.w;
  return ZOOMS.reduce((a, b) => (Math.abs(b - z) < Math.abs(a - z) ? b : a), ZOOMS[0]);
}
/** Janela livre a partir de dois cantos (normalizados), dentro da foto. */
export function windowFrom(a: [number, number], b: [number, number]): Rect {
  const x0 = clamp01(Math.min(a[0], b[0])), y0 = clamp01(Math.min(a[1], b[1]));
  const x1 = clamp01(Math.max(a[0], b[0])), y1 = clamp01(Math.max(a[1], b[1]));
  return { x: r4(x0), y: r4(y0), w: r4(x1 - x0), h: r4(y1 - y0) };
}

type Handle = "nw" | "ne" | "sw" | "se";
type Drag = { kind: "move"; start: [number, number]; rect: Rect } | { kind: "draw"; start: [number, number] } | { kind: "resize"; anchor: [number, number] };

/**
 * "Editar imagem" › Enquadramento e Recorte, salvos como versão canônica do editor de foto (RF15, receita não
 * destrutiva sobre a original). Enquadramento: quadro 4:5 em escalas fixas (1×, 1,25×, 1,5×, 2×), arrastando para
 * posicionar. Recorte: a pessoa marca a janela retangular da região da captura (arrasta para desenhar, arrasta dentro
 * para mover, cantos para redimensionar); a foto da peça passa a ser exatamente essa janela.
 */
export function QuickCrop({ pieceId, mode, onSaved, onReplace }: { pieceId: string; mode: "framing" | "window"; onSaved: (p: PieceView) => void; onReplace?: () => void }) {
  const { t } = useI18n(); const toast = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<{ code?: string; message: string } | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  useEffect(() => {
    let alive = true;
    setSession(null); setRect(null); setSize(null); setError(null);
    api.get<Session>(`/api/pieces/${pieceId}/photo-edits/session`).then(async (s) => {
      if (!alive) return;
      setSession(s);
      // giro/endireitar salvos mudam as coordenadas do recorte: o quadro é desenhado sobre a foto já girada
      const geo = geometryOps(fromRecipe(s.currentRecipe));
      if (!geo.length) { setSrc(mediaUrl(s.originalUrl) ?? null); return; }
      const p = await api.post<{ png: string }>(`/api/pieces/${pieceId}/photo-edits/preview`, { version: 1, target: "PRESENTATION", ops: geo });
      if (alive) setSrc(`data:image/png;base64,${p.png}`);
    }).catch((e) => alive && setError(e instanceof ApiError ? { code: e.code, message: e.message } : { message: String(e) }));
    return () => { alive = false; };
  }, [pieceId]);

  // quadro inicial: o recorte salvo, quando é do mesmo tipo; senão 1× centrado (Enquadramento) ou a foto toda (Recorte)
  useEffect(() => {
    if (!session || !size) return;
    const saved = (session.currentRecipe?.ops ?? []).find((o) => o.op === "crop");
    const aspect = saved?.aspect;
    const r = saved ? ((saved.rect ?? saved) as Rect) : null;
    if (mode === "framing") {
      if (r && aspect === "4:5") { setRect(r); setZoom(nearestZoom(r, size.w, size.h)); } else { setRect(zoomCrop(1, size.w, size.h)); setZoom(1); }
    } else setRect(r && aspect === "FREE" ? r : { x: 0, y: 0, w: 1, h: 1 });
  }, [session, size, mode]);

  const point = (e: React.PointerEvent): [number, number] | null => {
    const img = stage.current?.querySelector("img");
    if (!img) return null;
    const b = img.getBoundingClientRect();
    return [clamp01((e.clientX - b.left) / b.width), clamp01((e.clientY - b.top) / b.height)];
  };
  const inside = (p: [number, number], c: Rect) => p[0] >= c.x && p[0] <= c.x + c.w && p[1] >= c.y && p[1] <= c.y + c.h;

  function down(e: React.PointerEvent, handle?: Handle) {
    const p = point(e); if (!p || !rect) return;
    e.stopPropagation();
    if (handle) {
      const ax = handle.includes("w") ? rect.x + rect.w : rect.x, ay = handle.includes("n") ? rect.y + rect.h : rect.y;
      drag.current = { kind: "resize", anchor: [ax, ay] };
    } else if (inside(p, rect) && !(mode === "window" && rect.w >= 0.999 && rect.h >= 0.999)) drag.current = { kind: "move", start: p, rect };
    // janela = foto inteira (início) não tem para onde mover: arrastar já desenha a janela nova
    else if (mode === "window") drag.current = { kind: "draw", start: p };
    else return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    const d = drag.current; const p = point(e); if (!d || !p) return;
    if (d.kind === "move") setRect(moveCrop(d.rect, p[0] - d.start[0], p[1] - d.start[1]));
    else if (d.kind === "draw") setRect(windowFrom(d.start, p));
    else setRect(windowFrom(d.anchor, p));
  }
  function up() {
    const d = drag.current; drag.current = null;
    // clique solto (sem arrastar) não pode deixar uma janela vazia
    if (d && d.kind !== "move" && rect && (rect.w < MIN_SIDE || rect.h < MIN_SIDE)) setRect({ x: 0, y: 0, w: 1, h: 1 });
  }
  function pickZoom(z: number) {
    if (!size) return;
    const c = rect ?? zoomCrop(1, size.w, size.h);
    setZoom(z); setRect(zoomCrop(z, size.w, size.h, c.x + c.w / 2, c.y + c.h / 2));
  }

  async function save() {
    if (!rect || !session) return;
    setBusy(true);
    try {
      // mantém o resto da receita salva (luz, fundo, retoque…) e troca só o recorte; a versão é a canônica da peça
      const st = clampToCanonical({ ...fromRecipe(session.currentRecipe), crop: rect });
      const recipe = toRecipe(st);
      if (mode === "window") recipe.ops = recipe.ops.map((o) => (o.op === "crop" ? { ...o, aspect: "FREE" } : o));
      const r = await api.post<{ piece?: PieceView | null }>(`/api/pieces/${pieceId}/photo-edits`, recipe);
      setSession({ ...session, currentRecipe: recipe });
      if (r.piece) onSaved(r.piece);
      toast.success(t("common.saved"));
    } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }

  // peça do catálogo (imagem da marca, só referência) ou com a ilustração padrão: não há foto própria para recortar
  if (error?.code === "SEM_FOTO_PROPRIA") return (
    <div role="alert" className="grid gap-2 rounded-md border border-line-soft bg-surface-2 p-3 type-body-sm">
      <p>{t("editImage.sem_foto_propria")}</p>
      {onReplace && <div><Button size="sm" variant="primary" onClick={onReplace}>{t("closet.replaceImage")}</Button></div>}
    </div>
  );
  if (error) return <p role="alert" className="error-text">{error.message}</p>;
  if (!session || !src) return <p className="type-body-sm text-muted" aria-live="polite">{t("editImage.carregando_original")}</p>;
  const handles: Handle[] = mode === "window" ? ["nw", "ne", "sw", "se"] : [];
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div ref={stage} className={`qc-stage${mode === "window" ? " is-window" : ""}`} onPointerDown={(e) => down(e)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        role="img" aria-label={mode === "framing" ? t("editImage.alt_quadro") : t("editImage.alt_janela")}>
        <img src={src} alt="" draggable={false} onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
        {rect && (
          <div className="qc-rect" data-testid="qc-rect" style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }}>
            {handles.map((h) => <span key={h} className={`qc-handle is-${h}`} data-testid={`qc-${h}`} onPointerDown={(e) => down(e, h)} />)}
          </div>
        )}
      </div>
      <div className="grid content-start gap-3">
        {mode === "framing" ? (
          <>
            <p className="type-body-sm">{t("editImage.enquadramento_dica")}</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("editImage.escala")}>
              {ZOOMS.map((z) => <Chip key={z} role="radio" active={zoom === z} aria-checked={zoom === z} onClick={() => pickZoom(z)} disabled={!size}>{`${String(z).replace(".", ",")}×`}</Chip>)}
            </div>
          </>
        ) : (
          <>
            <p className="type-body-sm">{t("editImage.recorte_janela_dica")}</p>
            {rect && size && <p className="type-caption text-muted">{t("editImage.janela_px", { w: Math.round(rect.w * size.w), h: Math.round(rect.h * size.h) })}</p>}
            <div><Button size="sm" onClick={() => setRect({ x: 0, y: 0, w: 1, h: 1 })}>{t("editImage.foto_inteira")}</Button></div>
          </>
        )}
        <div><Button size="sm" variant="primary" onClick={save} loading={busy} disabled={!rect}>{mode === "framing" ? t("editImage.salvar_enquadramento") : t("editImage.salvar_recorte")}</Button></div>
      </div>
    </div>
  );
}
