"use client";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api, mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { rangeFill } from "@/lib/range-fill";
import { Badge, Button, Card, Dialog, EmptyState, SegmentPicker, Skeleton, useToast, cn } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import {
  ASPECT_RATIO, CANONICAL_LIMITS, DEFAULT_FEATHER, EMPTY_EDIT, canonicalProblems, clampToCanonical, fromRecipe, geometryOps, moveCrop, scaleCrop, toRecipe, withAspect,
  type CropAspect, type EditState, type Op, type Target,
} from "@/lib/photo-edit/recipe";

/** Ferramentas (abas livres, como no Fotos da Apple): Ajustar, Recortar, Recorte da peça, Apresentação, Revisão. */
type Tool = "adjust" | "crop" | "cutout" | "present" | "review";
const TOOLS: Tool[] = ["adjust", "crop", "cutout", "present", "review"];
const ASPECTS: CropAspect[] = ["FREE", "4:5", "1:1", "3:4", "16:9"];
type Pointer = "none" | "brush" | "eyedropper" | "heal";
interface Session { originalUrl: string; width: number; height: number; category?: string; currentRecipe?: { target?: string; ops?: Op[] } | null }
interface Quality { sharpness?: number; exposure?: number; occupancy?: number; colorDeltaE?: number; touchesEdge?: boolean; cutConfidence?: number; width?: number; height?: number }
interface Preview { png: string; quality: Quality; warnings: string[] }
interface Version { id: string; target: Target; url: string; current: boolean; createdAt: string; recipe?: { target?: string; ops?: Op[] }; warnings?: string[]; syntheticShadow?: boolean }

/** Histórico de estados: desfazer/refazer e "redefinir" (receita vazia) — RF15.CA03/CA07. */
function useHistory(initial: EditState) {
  const [h, setH] = useState({ past: [] as EditState[], present: initial, future: [] as EditState[] });
  const set = useCallback((next: EditState | ((s: EditState) => EditState), merge = false) => setH((x) => {
    const value = typeof next === "function" ? next(x.present) : next;
    if (JSON.stringify(value) === JSON.stringify(x.present)) return x;
    return { past: merge ? x.past : [...x.past, x.present].slice(-100), present: value, future: [] };
  }), []);
  const undo = useCallback(() => setH((x) => (x.past.length ? { past: x.past.slice(0, -1), present: x.past[x.past.length - 1], future: [x.present, ...x.future] } : x)), []);
  const redo = useCallback(() => setH((x) => (x.future.length ? { past: [...x.past, x.present], present: x.future[0], future: x.future.slice(1) } : x)), []);
  const reset = useCallback((s: EditState) => setH({ past: [], present: s, future: [] }), []);
  return { state: h.present, set, undo, redo, reset, canUndo: h.past.length > 0, canRedo: h.future.length > 0 };
}

function Slider({ id, label, value, min, max, step, onChange, format }: { id: string; label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <label htmlFor={id} className="grid gap-1">
      <span className="flex justify-between type-body-sm"><span>{label}</span><span className="type-data">{format ? format(value) : value}</span></span>
      <input id={id} type="range" min={min} max={max} step={step} value={value} style={rangeFill(value, min, max) as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="grid gap-2 border-t border-line-soft pt-3 first:border-t-0 first:pt-0" aria-label={title}><h3 className="label">{title}</h3>{children}</section>;
}

/**
 * RF15 · Editor de fotografia da peça (Canvas 2D interativo, referência Fotos da Apple): barra Cancelar · Desfazer ·
 * Refazer · Comparar · Salvar; ferramentas em abas livres (Ajustar, Recortar, Recorte da peça, Apresentação, Revisão);
 * edição não destrutiva por receita — a foto original nunca muda; a prévia é renderizada pelo servidor com o mesmo
 * código do salvamento (o que a pessoa vê é o que será salvo). Nada é reconstruído: golas, mangas, botões e logos
 * ficam como a foto mostra; espelhar é conferido pelo servidor (texto/logo); recorte incerto vira aviso.
 */
export function PiecePhotoEditor({ pieceId }: { pieceId: string }) {
  const { t } = useI18n(); const toast = useToast(); const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hist = useHistory(EMPTY_EDIT);
  const s = hist.state;
  const [saved, setSaved] = useState<EditState>(EMPTY_EDIT);
  const [tool, setTool] = useState<Tool>("adjust");
  const [pointer, setPointer] = useState<Pointer>("none");
  const [brush, setBrush] = useState<{ mode: "add" | "remove"; r: number }>({ mode: "add", r: 0.03 });
  const [healR, setHealR] = useState(0.006);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [busy, setBusy] = useState<"auto" | "save" | null>(null);
  const [compare, setCompare] = useState(false);
  const [discard, setDiscard] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const drawing = useRef<{ kind: "stroke" | "crop"; start?: [number, number]; crop?: EditState["crop"] } | null>(null);

  const loadVersions = useCallback(() => api.get<Version[]>(`/api/pieces/${pieceId}/photo-edits`).then(setVersions).catch(() => undefined), [pieceId]);
  useEffect(() => {
    let alive = true;
    api.get<Session>(`/api/pieces/${pieceId}/photo-edits/session`).then((r) => {
      if (!alive) return; setSession(r);
      const initial = fromRecipe(r.currentRecipe, { w: r.width, h: r.height });
      hist.reset(initial); setSaved(initial);
    }).catch((e) => alive && setLoadError(e instanceof ApiError ? e.message : String(e)));
    loadVersions();
    return () => { alive = false; };
  }, [pieceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = JSON.stringify(s) !== JSON.stringify(saved);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // prévia: em Recortar só a geometria (o quadro é desenhado por cima); nas demais abas a receita inteira. Enviada
  // como PRESENTATION: os limites da canônica são conferidos aqui (canonicalProblems) e de novo ao salvar.
  const previewOps = tool === "crop" ? geometryOps(s) : toRecipe({ ...s, target: s.target }).ops;
  const previewKey = JSON.stringify(previewOps);
  useEffect(() => {
    if (!session) return;
    let alive = true;
    const timer = setTimeout(() => {
      setPreviewBusy(true); setPreviewError(null);
      api.post<Preview>(`/api/pieces/${pieceId}/photo-edits/preview`, { version: 1, target: "PRESENTATION", ops: previewOps })
        .then((p) => { if (alive) setPreview(p); })
        .catch((e) => { if (alive) setPreviewError(e instanceof ApiError ? e.message : String(e)); })
        .finally(() => { if (alive) setPreviewBusy(false); });
    }, 350);
    return () => { alive = false; clearTimeout(timer); };
  }, [previewKey, session, pieceId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Ponto do ponteiro em coordenadas normalizadas da imagem da prévia. */
  const point = (e: React.PointerEvent): [number, number] | null => {
    const img = stageRef.current?.querySelector("img");
    if (!img) return null;
    const r = img.getBoundingClientRect();
    return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))];
  };
  function onPointerDown(e: React.PointerEvent) {
    const p = point(e); if (!p) return;
    if (tool === "crop" && s.crop) {
      const c = s.crop;
      if (p[0] >= c.x && p[0] <= c.x + c.w && p[1] >= c.y && p[1] <= c.y + c.h) { drawing.current = { kind: "crop", start: p, crop: c }; (e.target as Element).setPointerCapture?.(e.pointerId); }
      return;
    }
    if (pointer === "brush") {
      drawing.current = { kind: "stroke" };
      hist.set((x) => ({ ...x, background: { ...x.background, strokes: [...x.background.strokes, { mode: brush.mode, r: brush.r, pts: [p] }] } }));
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } else if (pointer === "eyedropper") {
      hist.set((x) => ({ ...x, whiteBalance: p })); setPointer("none");
    } else if (pointer === "heal") {
      hist.set((x) => ({ ...x, heal: [...x.heal, { x: p[0], y: p[1], r: healR }] }));
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drawing.current; if (!d) return;
    const p = point(e); if (!p) return;
    if (d.kind === "crop" && d.start && d.crop) {
      hist.set((x) => ({ ...x, crop: moveCrop(d.crop!, p[0] - d.start![0], p[1] - d.start![1]) }), true);
    } else if (d.kind === "stroke") {
      hist.set((x) => {
        const strokes = [...x.background.strokes]; const last = strokes[strokes.length - 1];
        strokes[strokes.length - 1] = { ...last, pts: [...last.pts, p] };
        return { ...x, background: { ...x.background, strokes } };
      }, true);
    }
  }
  const onPointerUp = () => { drawing.current = null; };
  /** Recorte pelo teclado (WCAG 2.5.7): setas movem (Shift: passos maiores); + e − mudam o tamanho. */
  function onStageKey(e: React.KeyboardEvent) {
    if (tool !== "crop" || !s.crop || !imgSize) return;
    const step = e.shiftKey ? 0.05 : 0.01;
    const ratio = ASPECT_RATIO[s.cropAspect];
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) { e.preventDefault(); const [dx, dy] = moves[e.key]; hist.set((x) => ({ ...x, crop: x.crop && moveCrop(x.crop, dx, dy) })); }
    else if (e.key === "+" || e.key === "=") { e.preventDefault(); hist.set((x) => ({ ...x, crop: x.crop && scaleCrop(x.crop, 1.05, imgSize.w, imgSize.h, ratio) })); }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); hist.set((x) => ({ ...x, crop: x.crop && scaleCrop(x.crop, 1 / 1.05, imgSize.w, imgSize.h, ratio) })); }
  }

  async function auto() {
    setBusy("auto");
    try {
      const r = await api.post<{ recipe: { target?: string; ops?: Op[] } }>(`/api/pieces/${pieceId}/photo-edits/auto`);
      hist.set(fromRecipe(r.recipe, session ? { w: session.width, h: session.height } : undefined)); setTool("review"); toast.success(t("photoEdit.auto_aplicado"));
    } catch (e) { toast.fromError(e); } finally { setBusy(null); }
  }
  async function save() {
    setBusy("save");
    try {
      await api.post(`/api/pieces/${pieceId}/photo-edits`, toRecipe(s));
      setSaved(s); toast.success(s.target === "CANONICAL" ? t("photoEdit.salva_canonica") : t("photoEdit.salva_apresentacao")); loadVersions();
    } catch (e) { toast.fromError(e); } finally { setBusy(null); }
  }
  async function restore(v: Version) {
    try { await api.post(`/api/pieces/${pieceId}/photo-edits/${v.id}/restore`); const st = fromRecipe(v.recipe, session ? { w: session.width, h: session.height } : undefined); hist.set(st); setSaved(st); loadVersions(); toast.success(t("photoEdit.versao_restaurada")); }
    catch (e) { toast.fromError(e); }
  }
  const leave = () => router.push(`/pieces/${pieceId}`);
  const cancel = () => { if (dirty) setDiscard(true); else leave(); };

  if (loadError) return <EmptyState title={t("photoEdit.sem_foto")} hint={loadError} action={<Link href={`/pieces/${pieceId}`} className="btn">{t("photoEdit.voltar_peca")}</Link>} />;
  if (!session) return <Skeleton className="h-96" />;

  const canonical = s.target === "CANONICAL";
  const problems = canonicalProblems(s, imgSize ? imgSize.h / imgSize.w : 1.25);
  const satMax = canonical ? CANONICAL_LIMITS.saturation : 100, conMax = canonical ? CANONICAL_LIMITS.contrast : 100, sharpMax = canonical ? CANONICAL_LIMITS.sharpen : 1;
  const blackMax = canonical ? CANONICAL_LIMITS.black : 0.5, whiteMin = canonical ? CANONICAL_LIMITS.white : 0.5;
  const gammaRange = canonical ? CANONICAL_LIMITS.gamma : ([0.3, 3] as const);
  const toolLabel: Record<Tool, string> = { adjust: t("photoEdit.tool.ajustar"), crop: t("photoEdit.tool.recortar"), cutout: t("photoEdit.tool.recorte_peca"), present: t("photoEdit.tool.apresentacao"), review: t("photoEdit.tool.revisao") };
  const q = preview?.quality ?? {};
  const setTone = (k: keyof EditState["tone"], v: number) => hist.set((x) => ({ ...x, tone: { ...x.tone, [k]: v } }), true);
  const setLevels = (k: keyof EditState["levels"], v: number) => hist.set((x) => ({ ...x, levels: { ...x.levels, [k]: v } }), true);
  const src = preview ? `data:image/png;base64,${preview.png}` : mediaUrl(session.originalUrl);
  const pct = (v?: number) => (v == null ? "—" : `${Math.round(v * 100)}%`);
  const warnings = [...problems, ...(preview?.warnings ?? [])];
  const pickTool = (v: Tool) => { setTool(v); setPointer("none"); };

  return (
    <div className="photo-edit">
      <header className="photo-edit-topbar" aria-label={t("photoEdit.barra")}>
        <Button variant="ghost" onClick={cancel}>{t("photoEdit.cancelar")}</Button>
        <div className="photo-edit-topbar-mid">
          <Button size="sm" onClick={hist.undo} disabled={!hist.canUndo}><FaiIcon id="ACT-21" size={20} decorative />{t("photoEdit.desfazer")}</Button>
          <Button size="sm" onClick={hist.redo} disabled={!hist.canRedo}>{t("photoEdit.refazer")}</Button>
          <Button size="sm" aria-pressed={compare} onPointerDown={() => setCompare(true)} onPointerUp={() => setCompare(false)} onPointerLeave={() => setCompare(false)}
            onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); setCompare((c) => !c); } }}>{t("photoEdit.comparar")}</Button>
        </div>
        <Button variant="primary" onClick={save} loading={busy === "save"} disabled={problems.length > 0 || !dirty}>{t("photoEdit.salvar")}</Button>
      </header>
      <p className="mb-3 flex flex-wrap items-center gap-2 type-body-sm text-muted">
        <span className="type-h3 text-ink">{t("photoEdit.titulo")}</span>
        <Badge tone={canonical ? "thread" : "mark"}>{canonical ? t("photoEdit.alvo.canonica") : t("photoEdit.alvo.apresentacao")}</Badge>
        {dirty && <span>{t("photoEdit.alteracoes_nao_salvas")}</span>}
      </p>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <div ref={stageRef} className={cn("photo-edit-stage", pointer !== "none" && "is-tool")} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
            onKeyDown={onStageKey} tabIndex={tool === "crop" && s.crop ? 0 : -1} role="img" aria-label={compare ? t("photoEdit.original") : t("photoEdit.previa")}>
            <div className="photo-edit-frame">
              {compare
                ? <img src={mediaUrl(session.originalUrl)} alt={t("photoEdit.original")} draggable={false} />
                : src && <img src={src} alt={t("photoEdit.previa")} draggable={false} onLoad={(e) => setImgSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />}
              {tool === "crop" && s.crop && !compare && (
                <div className="photo-edit-crop" style={{ left: `${s.crop.x * 100}%`, top: `${s.crop.y * 100}%`, width: `${s.crop.w * 100}%`, height: `${s.crop.h * 100}%` }} aria-hidden>
                  <span className="photo-edit-crop-thirds" />
                </div>
              )}
              {previewBusy && <span className="photo-edit-busy" aria-live="polite">{t("photoEdit.gerando_previa")}</span>}
            </div>
          </div>
          {previewError && <p role="alert" className="error-text mt-2">{previewError}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={auto} loading={busy === "auto"}><FaiIcon id="ACT-07" size={20} decorative />{t("photoEdit.automatico")}</Button>
            {tool === "crop" && s.crop && <span className="type-caption text-muted">{t("photoEdit.recorte_teclado")}</span>}
          </div>
        </Card>
        <Card>
          <SegmentPicker className="mb-3" label={t("photoEdit.ferramentas")} value={tool} onChange={pickTool} options={TOOLS.map((x) => ({ id: x, label: toolLabel[x] }))} />
          {tool === "adjust" && (
            <div className="grid gap-3">
              <Section title={t("photoEdit.secao.luz")}>
                <Slider id="pe-exp" label={t("photoEdit.exposicao")} value={s.tone.exposureEv} min={-2} max={2} step={0.1} onChange={(v) => setTone("exposureEv", v)} format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} EV`} />
                <Slider id="pe-hl" label={t("photoEdit.realces")} value={s.tone.highlights} min={-100} max={100} step={1} onChange={(v) => setTone("highlights", v)} />
                <Slider id="pe-sh" label={t("photoEdit.sombras")} value={s.tone.shadows} min={-100} max={100} step={1} onChange={(v) => setTone("shadows", v)} />
                <Slider id="pe-ct" label={t("photoEdit.contraste")} value={s.tone.contrast} min={-conMax} max={conMax} step={1} onChange={(v) => setTone("contrast", v)} />
              </Section>
              <Section title={t("photoEdit.secao.cor")}>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant={pointer === "eyedropper" ? "primary" : undefined} aria-pressed={pointer === "eyedropper"} onClick={() => setPointer(pointer === "eyedropper" ? "none" : "eyedropper")}>{t("photoEdit.conta_gotas")}</Button>
                  {s.whiteBalance && <Button size="sm" variant="ghost" onClick={() => hist.set((x) => ({ ...x, whiteBalance: null }))}>{t("photoEdit.tirar_balanco")}</Button>}
                </div>
                <p className="type-caption text-muted">{s.whiteBalance ? t("photoEdit.balanco_aplicado") : t("photoEdit.conta_gotas_ajuda")}</p>
                <Slider id="pe-sat" label={t("photoEdit.saturacao")} value={s.tone.saturation} min={-satMax} max={satMax} step={1} onChange={(v) => setTone("saturation", v)} />
                <p className={cn("type-body-sm", (q.colorDeltaE ?? 0) > 5 ? "error-text" : "text-muted")} role="status">
                  {t("photoEdit.fidelidade_cor", { de: (q.colorDeltaE ?? 0).toFixed(1) })} {(q.colorDeltaE ?? 0) > 5 && t("photoEdit.cor_diferente")}
                </p>
              </Section>
              <Section title={t("photoEdit.secao.niveis")}>
                <Slider id="pe-black" label={t("photoEdit.ponto_preto")} value={s.levels.black} min={0} max={blackMax} step={0.01} onChange={(v) => setLevels("black", v)} format={(v) => v.toFixed(2)} />
                <Slider id="pe-white" label={t("photoEdit.ponto_branco")} value={s.levels.white} min={whiteMin} max={1} step={0.01} onChange={(v) => setLevels("white", v)} format={(v) => v.toFixed(2)} />
                <Slider id="pe-gamma" label={t("photoEdit.gama")} value={s.levels.gamma} min={gammaRange[0]} max={gammaRange[1]} step={0.01} onChange={(v) => setLevels("gamma", v)} format={(v) => v.toFixed(2)} />
              </Section>
              <Section title={t("photoEdit.secao.detalhe")}>
                <Slider id="pe-sharp" label={t("photoEdit.nitidez")} value={s.sharpen} min={0} max={sharpMax} step={0.05} onChange={(v) => hist.set((x) => ({ ...x, sharpen: v }), true)} format={(v) => v.toFixed(2)} />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant={pointer === "heal" ? "primary" : undefined} aria-pressed={pointer === "heal"} onClick={() => setPointer(pointer === "heal" ? "none" : "heal")}>{t("photoEdit.remover_fiapo")}</Button>
                  {s.heal.length > 0 && <Button size="sm" variant="ghost" onClick={() => hist.set((x) => ({ ...x, heal: x.heal.slice(0, -1) }))}>{t("photoEdit.desfazer_retoque")}</Button>}
                </div>
                <p className="type-caption text-muted">{t("photoEdit.fiapo_ajuda", { n: s.heal.length })}</p>
                {pointer === "heal" && <Slider id="pe-heal" label={t("photoEdit.tamanho_retoque")} value={Math.round(healR * 1000)} min={2} max={30} step={1} onChange={(v) => setHealR(v / 1000)} />}
              </Section>
              <Section title={t("photoEdit.secao.filtros")}>
                {canonical ? <p className="type-caption text-muted">{t("photoEdit.filtros_so_apresentacao")}</p> : (
                  <div className="grid gap-2">
                    <SegmentPicker label={t("photoEdit.filtro")} value={s.filter?.style ?? "NONE"} onChange={(v) => hist.set((x) => ({ ...x, filter: v === "NONE" ? null : { style: v as NonNullable<EditState["filter"]>["style"], strength: x.filter?.strength ?? 0.6 } }))}
                      options={[{ id: "NONE", label: t("photoEdit.filtro.nenhum") }, { id: "WARM", label: t("photoEdit.filtro.quente") }, { id: "COOL", label: t("photoEdit.filtro.frio") }, { id: "MONO", label: t("photoEdit.filtro.pb") }, { id: "VINTAGE", label: t("photoEdit.filtro.vintage") }]} />
                    {s.filter && <Slider id="pe-filter" label={t("photoEdit.intensidade")} value={s.filter.strength} min={0} max={1} step={0.05} onChange={(v) => hist.set((x) => ({ ...x, filter: x.filter && { ...x.filter, strength: v } }), true)} format={(v) => `${Math.round(v * 100)}%`} />}
                  </div>
                )}
              </Section>
            </div>
          )}
          {tool === "crop" && (
            <div className="grid gap-3">
              <p className="type-body-sm text-muted">{t("photoEdit.enquadrar_ajuda")}</p>
              <SegmentPicker label={t("photoEdit.proporcao")} value={s.cropAspect} onChange={(a) => imgSize && hist.set((x) => ({ ...x, cropAspect: a, crop: withAspect(x.crop, a, imgSize.w, imgSize.h) }))}
                options={ASPECTS.map((a) => ({ id: a, label: a === "FREE" ? t("photoEdit.proporcao.livre") : a }))} />
              <div className="flex flex-wrap gap-2">
                {!s.crop
                  ? <Button size="sm" variant="primary" onClick={() => imgSize && hist.set((x) => ({ ...x, crop: withAspect(null, x.cropAspect, imgSize.w, imgSize.h) }))} disabled={!imgSize}>{t("photoEdit.recortar_em", { aspect: s.cropAspect === "FREE" ? t("photoEdit.proporcao.livre") : s.cropAspect })}</Button>
                  : <Button size="sm" variant="ghost" onClick={() => hist.set((x) => ({ ...x, crop: null }))}>{t("photoEdit.tirar_recorte")}</Button>}
                <Button size="sm" onClick={() => hist.set((x) => ({ ...x, turns: (((x.turns + 1) % 4) as EditState["turns"]), crop: null }))}>{t("photoEdit.girar_90")}</Button>
                <Button size="sm" aria-pressed={s.flip === "H"} onClick={() => hist.set((x) => ({ ...x, flip: x.flip === "H" ? null : "H" }))}>{s.flip === "H" ? t("photoEdit.desespelhar") : t("photoEdit.espelhar")}</Button>
              </div>
              {s.flip && <p role="note" className="type-body-sm text-muted">{t("photoEdit.espelhar_aviso")}</p>}
              <Slider id="pe-straighten" label={t("photoEdit.endireitar")} value={s.straighten} min={-CANONICAL_LIMITS.straighten} max={CANONICAL_LIMITS.straighten} step={0.1}
                onChange={(v) => hist.set((x) => ({ ...x, straighten: v }), true)} format={(v) => `${v.toFixed(1)}°`} />
              {s.crop && imgSize && <Slider id="pe-zoom" label={t("photoEdit.tamanho_quadro")} value={Math.round(s.crop.w * 100)} min={10} max={100} step={1}
                onChange={(v) => hist.set((x) => ({ ...x, crop: x.crop && scaleCrop(x.crop, v / 100 / x.crop.w, imgSize.w, imgSize.h, ASPECT_RATIO[x.cropAspect]) }), true)} format={(v) => `${v}%`} />}
              {s.crop && <p className="type-caption text-muted">{t("photoEdit.arraste_quadro")}</p>}
            </div>
          )}
          {tool === "cutout" && (
            <div className="grid gap-3">
              <p className="type-body-sm text-muted">{t("photoEdit.recorte_peca_ajuda")}</p>
              <label className="flex items-center gap-2"><input type="checkbox" checked={s.background.on} onChange={(e) => hist.set((x) => ({ ...x, background: { ...x.background, on: e.target.checked } }))} />{t("photoEdit.remover_fundo")}</label>
              {s.background.on && (<>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant={pointer === "brush" && brush.mode === "add" ? "primary" : undefined} aria-pressed={pointer === "brush" && brush.mode === "add"} onClick={() => { setPointer("brush"); setBrush((b) => ({ ...b, mode: "add" })); }}>{t("photoEdit.pincel_devolver")}</Button>
                  <Button size="sm" variant={pointer === "brush" && brush.mode === "remove" ? "primary" : undefined} aria-pressed={pointer === "brush" && brush.mode === "remove"} onClick={() => { setPointer("brush"); setBrush((b) => ({ ...b, mode: "remove" })); }}>{t("photoEdit.pincel_apagar")}</Button>
                  {s.background.strokes.length > 0 && <Button size="sm" variant="ghost" onClick={() => hist.set((x) => ({ ...x, background: { ...x.background, strokes: x.background.strokes.slice(0, -1) } }))}>{t("photoEdit.desfazer_pincelada")}</Button>}
                </div>
                {pointer === "brush" && <Slider id="pe-brush" label={t("photoEdit.tamanho_pincel")} value={Math.round(brush.r * 1000)} min={5} max={120} step={1} onChange={(v) => setBrush((b) => ({ ...b, r: v / 1000 }))} />}
                <Slider id="pe-feather" label={t("photoEdit.suavizar_borda")} value={s.background.feather} min={0} max={CANONICAL_LIMITS.feather} step={1} onChange={(v) => hist.set((x) => ({ ...x, background: { ...x.background, feather: v } }), true)} format={(v) => `${v} px`} />
                <p className="type-caption text-muted">{t("photoEdit.borda_ajuda")}</p>
                {(q.cutConfidence ?? 1) < 0.45 && <p role="note" className="type-body-sm text-critical">{t("photoEdit.aviso.RECORTE_INCERTO")}</p>}
              </>)}
            </div>
          )}
          {tool === "present" && (
            <div className="grid gap-3">
              {!s.background.on ? (<>
                <p className="type-body-sm text-muted">{t("photoEdit.apresentacao_ajuda_fundo")}</p>
                <Button size="sm" onClick={() => hist.set((x) => ({ ...x, background: { ...x.background, on: true } }))}>{t("photoEdit.ativar_recorte")}</Button>
              </>) : (<>
                <SegmentPicker label={t("photoEdit.cor_fundo")} value={s.background.kind} onChange={(k) => hist.set((x) => ({ ...x, background: { ...x.background, kind: k } }))}
                  options={[{ id: "WHITE", label: t("photoEdit.fundo.branco") }, { id: "NEUTRAL", label: t("photoEdit.fundo.neutro") }, { id: "TRANSPARENT", label: t("photoEdit.fundo.transparente") }]} />
                <label className="flex items-center gap-2 type-body-sm"><input type="checkbox" checked={s.background.shadow} onChange={(e) => hist.set((x) => ({ ...x, background: { ...x.background, shadow: e.target.checked } }))} />{t("photoEdit.sombra_suave")}</label>
                <p className="type-caption text-muted">{t("photoEdit.sombra_rotulada")}</p>
              </>)}
            </div>
          )}
          {tool === "review" && (
            <div className="grid gap-3">
              <SegmentPicker label={t("photoEdit.salvar_como")} value={s.target} onChange={(v) => hist.set((x) => (v === "CANONICAL" ? clampToCanonical(x) : { ...x, target: "PRESENTATION" }))}
                options={[{ id: "CANONICAL", label: t("photoEdit.alvo.canonica") }, { id: "PRESENTATION", label: t("photoEdit.alvo.apresentacao") }]} />
              <p className="type-caption text-muted">{canonical ? t("photoEdit.canonica_ajuda") : t("photoEdit.apresentacao_ajuda")}</p>
              <dl className="photo-edit-quality" aria-label={t("photoEdit.qualidade")}>
                <div><dt>{t("photoEdit.q.nitidez")}</dt><dd>{pct(q.sharpness)}</dd></div>
                <div><dt>{t("photoEdit.q.exposicao")}</dt><dd>{pct(q.exposure)}</dd></div>
                <div><dt>{t("photoEdit.q.ocupacao")}</dt><dd>{pct(q.occupancy)}</dd></div>
                <div><dt>{t("photoEdit.q.cor")}</dt><dd>ΔE {(q.colorDeltaE ?? 0).toFixed(1)}</dd></div>
              </dl>
              {warnings.map((w) => <p key={w} role="note" className="type-body-sm text-critical">{t(`photoEdit.aviso.${w}`)}</p>)}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => hist.set({ ...EMPTY_EDIT, target: s.target })}>{t("photoEdit.redefinir")}</Button>
                <Link href={`/pieces/${pieceId}`} className="btn btn-sm">{t("photoEdit.ver_peca")}</Link>
              </div>
              {versions.length > 0 && (
                <section aria-label={t("photoEdit.versoes")}>
                  <p className="label mt-2">{t("photoEdit.versoes")}</p>
                  <ul className="grid gap-2">
                    {versions.map((v) => (
                      <li key={v.id} className="flex items-center gap-2">
                        <img src={mediaUrl(v.url)} alt="" className="h-12 w-10 shrink-0 rounded object-cover" />
                        <span className="min-w-0 flex-1 type-caption">{v.target === "CANONICAL" ? t("photoEdit.alvo.canonica") : t("photoEdit.alvo.apresentacao")}{v.current && ` · ${t("photoEdit.vigente")}`}</span>
                        {v.target === "CANONICAL" && !v.current && <Button size="sm" variant="ghost" onClick={() => restore(v)}>{t("photoEdit.restaurar")}</Button>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </Card>
      </div>
      <Dialog open={discard} onClose={() => setDiscard(false)} title={t("photoEdit.descartar_titulo")} role="alertdialog"
        footer={<><Button onClick={() => setDiscard(false)}>{t("photoEdit.continuar_editando")}</Button><Button variant="danger" onClick={leave}>{t("photoEdit.descartar")}</Button></>}>
        <p className="type-body">{t("photoEdit.descartar_corpo")}</p>
      </Dialog>
    </div>
  );
}
