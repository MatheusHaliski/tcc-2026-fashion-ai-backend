"use client";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ApiError, api, mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { rangeFill } from "@/lib/range-fill";
import { Badge, Button, Card, EmptyState, PageHeader, SegmentPicker, Skeleton, useToast, cn } from "@/components/ui";
import {
  CANONICAL_LIMITS, EMPTY_EDIT, canonicalProblems, centeredCrop, clampToCanonical, fromRecipe, geometryOps, moveCrop, scaleCrop, toRecipe,
  type EditState, type Op, type Target,
} from "@/lib/photo-edit/recipe";

type Step = "frame" | "background" | "light" | "details" | "review";
const STEPS: Step[] = ["frame", "background", "light", "details", "review"];
type Tool = "none" | "brush" | "eyedropper" | "heal";
interface Session { originalUrl: string; width: number; height: number; category?: string; currentRecipe?: { target?: string; ops?: Op[] } | null }
interface Quality { sharpness?: number; exposure?: number; occupancy?: number; colorDeltaE?: number; touchesEdge?: boolean; width?: number; height?: number }
interface Preview { png: string; quality: Quality; warnings: string[] }
interface Version { id: string; target: Target; url: string; current: boolean; createdAt: string; recipe?: { target?: string; ops?: Op[] }; warnings?: string[]; syntheticShadow?: boolean }

/** Histórico de estados: desfazer/refazer infinito e "voltar à original" (receita vazia) — RF15.CA03/CA07. */
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

/**
 * RF15 · Editor de fotografia da peça (docs/novos-rf/RF15_Editor_Fotografia_Pecas.md): página própria, edição não
 * destrutiva por receita, 5 passos (Enquadrar, Fundo, Luz & Cor, Detalhes, Revisar) e o atalho Automático. A prévia é
 * renderizada pelo servidor com o mesmo código do salvamento: o que a pessoa vê é o que será salvo.
 */
export function PiecePhotoEditor({ pieceId }: { pieceId: string }) {
  const { t } = useI18n(); const toast = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hist = useHistory(EMPTY_EDIT);
  const s = hist.state;
  const [saved, setSaved] = useState<EditState>(EMPTY_EDIT);
  const [step, setStep] = useState<Step>("frame");
  const [tool, setTool] = useState<Tool>("none");
  const [brush, setBrush] = useState<{ mode: "add" | "remove"; r: number }>({ mode: "add", r: 0.03 });
  const [healR, setHealR] = useState(0.006);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [busy, setBusy] = useState<"auto" | "save" | null>(null);
  const [compare, setCompare] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const drawing = useRef<{ kind: "stroke" | "crop"; start?: [number, number]; crop?: EditState["crop"] } | null>(null);

  const loadVersions = useCallback(() => api.get<Version[]>(`/api/pieces/${pieceId}/photo-edits`).then(setVersions).catch(() => undefined), [pieceId]);
  useEffect(() => {
    let alive = true;
    api.get<Session>(`/api/pieces/${pieceId}/photo-edits/session`).then((r) => {
      if (!alive) return; setSession(r);
      const initial = fromRecipe(r.currentRecipe);
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

  // prévia: no Enquadrar só a geometria (o quadro 4:5 é desenhado por cima); nos demais passos, a receita inteira.
  // Enviada como PRESENTATION: os limites da canônica são conferidos aqui (canonicalProblems) e de novo ao salvar.
  const previewOps = step === "frame" ? geometryOps(s) : toRecipe({ ...s, target: s.target }).ops;
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
    if (step === "frame" && s.crop) {
      const c = s.crop;
      if (p[0] >= c.x && p[0] <= c.x + c.w && p[1] >= c.y && p[1] <= c.y + c.h) { drawing.current = { kind: "crop", start: p, crop: c }; (e.target as Element).setPointerCapture?.(e.pointerId); }
      return;
    }
    if (tool === "brush") {
      drawing.current = { kind: "stroke" };
      hist.set((x) => ({ ...x, background: { ...x.background, strokes: [...x.background.strokes, { mode: brush.mode, r: brush.r, pts: [p] }] } }));
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } else if (tool === "eyedropper") {
      hist.set((x) => ({ ...x, whiteBalance: p })); setTool("none");
    } else if (tool === "heal") {
      hist.set((x) => ({ ...x, heal: [...x.heal, { x: p[0], y: p[1], r: healR }] }));
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drawing.current; if (!d) return;
    const p = point(e); if (!p) return;
    if (d.kind === "crop" && d.start && d.crop) {
      const c = moveCrop(d.crop, p[0] - d.start[0], p[1] - d.start[1]);
      hist.set((x) => ({ ...x, crop: c }), true);
    } else if (d.kind === "stroke") {
      hist.set((x) => {
        const strokes = [...x.background.strokes]; const last = strokes[strokes.length - 1];
        strokes[strokes.length - 1] = { ...last, pts: [...last.pts, p] };
        return { ...x, background: { ...x.background, strokes } };
      }, true);
    }
  }
  const onPointerUp = () => { drawing.current = null; };

  async function auto() {
    setBusy("auto");
    try {
      const r = await api.post<{ recipe: { target?: string; ops?: Op[] } }>(`/api/pieces/${pieceId}/photo-edits/auto`);
      hist.set(fromRecipe(r.recipe)); setStep("review"); toast.success(t("photoEdit.auto_aplicado"));
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
    try { await api.post(`/api/pieces/${pieceId}/photo-edits/${v.id}/restore`); const st = fromRecipe(v.recipe); hist.set(st); setSaved(st); loadVersions(); toast.success(t("photoEdit.versao_restaurada")); }
    catch (e) { toast.fromError(e); }
  }

  if (loadError) return <EmptyState title={t("photoEdit.sem_foto")} hint={loadError} action={<Link href={`/pieces/${pieceId}`} className="btn">{t("photoEdit.voltar_peca")}</Link>} />;
  if (!session) return <Skeleton className="h-96" />;

  const canonical = s.target === "CANONICAL";
  const problems = canonicalProblems(s, imgSize ? imgSize.h / imgSize.w : 1.25);
  const satMax = canonical ? CANONICAL_LIMITS.saturation : 100, conMax = canonical ? CANONICAL_LIMITS.contrast : 100, sharpMax = canonical ? CANONICAL_LIMITS.sharpen : 1;
  const stepLabel: Record<Step, string> = { frame: t("photoEdit.passo.enquadrar"), background: t("photoEdit.passo.fundo"), light: t("photoEdit.passo.luz"), details: t("photoEdit.passo.detalhes"), review: t("photoEdit.passo.revisar") };
  const q = preview?.quality ?? {};
  const setTone = (k: keyof EditState["tone"], v: number) => hist.set((x) => ({ ...x, tone: { ...x.tone, [k]: v } }), true);
  const src = preview ? `data:image/png;base64,${preview.png}` : mediaUrl(session.originalUrl);
  const pct = (v?: number) => (v == null ? "—" : `${Math.round(v * 100)}%`);

  return (
    <>
      <PageHeader title={t("photoEdit.titulo")} kicker="RF15" lead={t("photoEdit.lead")} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={auto} loading={busy === "auto"}>{t("photoEdit.automatico")}</Button>
        <Button onClick={hist.undo} disabled={!hist.canUndo}>{t("photoEdit.desfazer")}</Button>
        <Button onClick={hist.redo} disabled={!hist.canRedo}>{t("photoEdit.refazer")}</Button>
        <Button variant="ghost" onClick={() => hist.set({ ...EMPTY_EDIT, target: s.target })}>{t("photoEdit.voltar_original")}</Button>
        <span className="ml-auto flex items-center gap-2">
          <Badge tone={canonical ? "thread" : "mark"}>{canonical ? t("photoEdit.alvo.canonica") : t("photoEdit.alvo.apresentacao")}</Badge>
          {dirty && <span className="type-caption text-muted">{t("photoEdit.alteracoes_nao_salvas")}</span>}
        </span>
      </div>
      <SegmentPicker className="mb-4" label={t("photoEdit.passos")} value={step} onChange={(v) => { setStep(v); setTool("none"); }} options={STEPS.map((x, i) => ({ id: x, label: `${i + 1} · ${stepLabel[x]}` }))} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <div ref={stageRef} className={cn("photo-edit-stage", tool !== "none" && "is-tool")} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
            role="img" aria-label={t("photoEdit.previa")}>
            <div className="photo-edit-frame">
              {compare && step === "review"
                ? <img src={mediaUrl(session.originalUrl)} alt={t("photoEdit.original")} draggable={false} />
                : src && <img src={src} alt={t("photoEdit.previa")} draggable={false} onLoad={(e) => setImgSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />}
              {step === "frame" && s.crop && (
                <div className="photo-edit-crop" style={{ left: `${s.crop.x * 100}%`, top: `${s.crop.y * 100}%`, width: `${s.crop.w * 100}%`, height: `${s.crop.h * 100}%` }} aria-hidden>
                  <span className="photo-edit-crop-thirds" />
                </div>
              )}
              {previewBusy && <span className="photo-edit-busy" aria-live="polite">{t("photoEdit.gerando_previa")}</span>}
            </div>
          </div>
          {previewError && <p role="alert" className="error-text mt-2">{previewError}</p>}
          {step === "review" && <Button size="sm" className="mt-2" onPointerDown={() => setCompare(true)} onPointerUp={() => setCompare(false)} onPointerLeave={() => setCompare(false)}>{t("photoEdit.segure_para_comparar")}</Button>}
        </Card>
        <Card>
          {step === "frame" && (
            <div className="grid gap-3">
              <p className="type-body-sm text-muted">{t("photoEdit.enquadrar_ajuda")}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => hist.set((x) => ({ ...x, turns: (((x.turns + 1) % 4) as EditState["turns"]), crop: null }))}>{t("photoEdit.girar_90")}</Button>
                {!s.crop
                  ? <Button size="sm" variant="primary" onClick={() => imgSize && hist.set((x) => ({ ...x, crop: centeredCrop(imgSize.w, imgSize.h) }))} disabled={!imgSize}>{t("photoEdit.quadro_45")}</Button>
                  : <Button size="sm" variant="ghost" onClick={() => hist.set((x) => ({ ...x, crop: null }))}>{t("photoEdit.tirar_quadro")}</Button>}
              </div>
              <Slider id="pe-straighten" label={t("photoEdit.endireitar")} value={s.straighten} min={-CANONICAL_LIMITS.straighten} max={CANONICAL_LIMITS.straighten} step={0.1}
                onChange={(v) => hist.set((x) => ({ ...x, straighten: v }), true)} format={(v) => `${v.toFixed(1)}°`} />
              {s.crop && imgSize && <Slider id="pe-zoom" label={t("photoEdit.tamanho_quadro")} value={Math.round(s.crop.w * 100)} min={10} max={100} step={1}
                onChange={(v) => hist.set((x) => ({ ...x, crop: x.crop && scaleCrop(x.crop, v / 100 / x.crop.w, imgSize.w, imgSize.h) }), true)} format={(v) => `${v}%`} />}
              {s.crop && <p className="type-caption text-muted">{t("photoEdit.arraste_quadro")}</p>}
            </div>
          )}
          {step === "background" && (
            <div className="grid gap-3">
              <label className="flex items-center gap-2"><input type="checkbox" checked={s.background.on} onChange={(e) => hist.set((x) => ({ ...x, background: { ...x.background, on: e.target.checked } }))} />{t("photoEdit.remover_fundo")}</label>
              {s.background.on && (<>
                <SegmentPicker label={t("photoEdit.cor_fundo")} value={s.background.kind} onChange={(k) => hist.set((x) => ({ ...x, background: { ...x.background, kind: k } }))}
                  options={[{ id: "WHITE", label: t("photoEdit.fundo.branco") }, { id: "NEUTRAL", label: t("photoEdit.fundo.neutro") }, { id: "TRANSPARENT", label: t("photoEdit.fundo.transparente") }]} />
                <label className="flex items-center gap-2 type-body-sm"><input type="checkbox" checked={s.background.shadow} onChange={(e) => hist.set((x) => ({ ...x, background: { ...x.background, shadow: e.target.checked } }))} />{t("photoEdit.sombra_suave")}</label>
                <p className="type-caption text-muted">{t("photoEdit.sombra_rotulada")}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant={tool === "brush" && brush.mode === "add" ? "primary" : undefined} aria-pressed={tool === "brush" && brush.mode === "add"} onClick={() => { setTool("brush"); setBrush((b) => ({ ...b, mode: "add" })); }}>{t("photoEdit.pincel_devolver")}</Button>
                  <Button size="sm" variant={tool === "brush" && brush.mode === "remove" ? "primary" : undefined} aria-pressed={tool === "brush" && brush.mode === "remove"} onClick={() => { setTool("brush"); setBrush((b) => ({ ...b, mode: "remove" })); }}>{t("photoEdit.pincel_apagar")}</Button>
                  {s.background.strokes.length > 0 && <Button size="sm" variant="ghost" onClick={() => hist.set((x) => ({ ...x, background: { ...x.background, strokes: x.background.strokes.slice(0, -1) } }))}>{t("photoEdit.desfazer_pincelada")}</Button>}
                </div>
                {tool === "brush" && <Slider id="pe-brush" label={t("photoEdit.tamanho_pincel")} value={Math.round(brush.r * 1000)} min={5} max={120} step={1} onChange={(v) => setBrush((b) => ({ ...b, r: v / 1000 }))} />}
              </>)}
            </div>
          )}
          {step === "light" && (
            <div className="grid gap-3">
              <Button size="sm" variant={tool === "eyedropper" ? "primary" : undefined} aria-pressed={tool === "eyedropper"} onClick={() => setTool(tool === "eyedropper" ? "none" : "eyedropper")}>{t("photoEdit.conta_gotas")}</Button>
              <p className="type-caption text-muted">{s.whiteBalance ? t("photoEdit.balanco_aplicado") : t("photoEdit.conta_gotas_ajuda")}</p>
              {s.whiteBalance && <Button size="sm" variant="ghost" onClick={() => hist.set((x) => ({ ...x, whiteBalance: null }))}>{t("photoEdit.tirar_balanco")}</Button>}
              <Slider id="pe-exp" label={t("photoEdit.exposicao")} value={s.tone.exposureEv} min={-2} max={2} step={0.1} onChange={(v) => setTone("exposureEv", v)} format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} EV`} />
              <Slider id="pe-hl" label={t("photoEdit.realces")} value={s.tone.highlights} min={-100} max={100} step={1} onChange={(v) => setTone("highlights", v)} />
              <Slider id="pe-sh" label={t("photoEdit.sombras")} value={s.tone.shadows} min={-100} max={100} step={1} onChange={(v) => setTone("shadows", v)} />
              <Slider id="pe-ct" label={t("photoEdit.contraste")} value={s.tone.contrast} min={-conMax} max={conMax} step={1} onChange={(v) => setTone("contrast", v)} />
              <Slider id="pe-sat" label={t("photoEdit.saturacao")} value={s.tone.saturation} min={-satMax} max={satMax} step={1} onChange={(v) => setTone("saturation", v)} />
              <p className={cn("type-body-sm", (q.colorDeltaE ?? 0) > 5 ? "error-text" : "text-muted")} role="status">
                {t("photoEdit.fidelidade_cor", { de: (q.colorDeltaE ?? 0).toFixed(1) })} {(q.colorDeltaE ?? 0) > 5 && t("photoEdit.cor_diferente")}
              </p>
            </div>
          )}
          {step === "details" && (
            <div className="grid gap-3">
              <Button size="sm" variant={tool === "heal" ? "primary" : undefined} aria-pressed={tool === "heal"} onClick={() => setTool(tool === "heal" ? "none" : "heal")}>{t("photoEdit.remover_fiapo")}</Button>
              <p className="type-caption text-muted">{t("photoEdit.fiapo_ajuda", { n: s.heal.length })}</p>
              {tool === "heal" && <Slider id="pe-heal" label={t("photoEdit.tamanho_retoque")} value={Math.round(healR * 1000)} min={2} max={30} step={1} onChange={(v) => setHealR(v / 1000)} />}
              {s.heal.length > 0 && <Button size="sm" variant="ghost" onClick={() => hist.set((x) => ({ ...x, heal: x.heal.slice(0, -1) }))}>{t("photoEdit.desfazer_retoque")}</Button>}
              <Slider id="pe-sharp" label={t("photoEdit.nitidez")} value={s.sharpen} min={0} max={sharpMax} step={0.05} onChange={(v) => hist.set((x) => ({ ...x, sharpen: v }), true)} format={(v) => v.toFixed(2)} />
            </div>
          )}
          {step === "review" && (
            <div className="grid gap-3">
              <SegmentPicker label={t("photoEdit.salvar_como")} value={s.target} onChange={(v) => hist.set((x) => (v === "CANONICAL" ? clampToCanonical(x) : { ...x, target: "PRESENTATION" }))}
                options={[{ id: "CANONICAL", label: t("photoEdit.alvo.canonica") }, { id: "PRESENTATION", label: t("photoEdit.alvo.apresentacao") }]} />
              <p className="type-caption text-muted">{canonical ? t("photoEdit.canonica_ajuda") : t("photoEdit.apresentacao_ajuda")}</p>
              {!canonical && (
                <div className="grid gap-2">
                  <SegmentPicker label={t("photoEdit.filtro")} value={s.filter?.style ?? "NONE"} onChange={(v) => hist.set((x) => ({ ...x, filter: v === "NONE" ? null : { style: v as NonNullable<EditState["filter"]>["style"], strength: x.filter?.strength ?? 0.6 } }))}
                    options={[{ id: "NONE", label: t("photoEdit.filtro.nenhum") }, { id: "WARM", label: t("photoEdit.filtro.quente") }, { id: "COOL", label: t("photoEdit.filtro.frio") }, { id: "MONO", label: t("photoEdit.filtro.pb") }, { id: "VINTAGE", label: t("photoEdit.filtro.vintage") }]} />
                  {s.filter && <Slider id="pe-filter" label={t("photoEdit.intensidade")} value={s.filter.strength} min={0} max={1} step={0.05} onChange={(v) => hist.set((x) => ({ ...x, filter: x.filter && { ...x.filter, strength: v } }), true)} format={(v) => `${Math.round(v * 100)}%`} />}
                </div>
              )}
              <dl className="photo-edit-quality" aria-label={t("photoEdit.qualidade")}>
                <div><dt>{t("photoEdit.q.nitidez")}</dt><dd>{pct(q.sharpness)}</dd></div>
                <div><dt>{t("photoEdit.q.exposicao")}</dt><dd>{pct(q.exposure)}</dd></div>
                <div><dt>{t("photoEdit.q.ocupacao")}</dt><dd>{pct(q.occupancy)}</dd></div>
                <div><dt>{t("photoEdit.q.cor")}</dt><dd>ΔE {(q.colorDeltaE ?? 0).toFixed(1)}</dd></div>
              </dl>
              {[...problems, ...(preview?.warnings ?? [])].map((w) => <p key={w} role="note" className="type-body-sm text-critical">{t(`photoEdit.aviso.${w}`)}</p>)}
              <Button variant="primary" onClick={save} loading={busy === "save"} disabled={problems.length > 0 || !dirty}>{canonical ? t("photoEdit.salvar_canonica") : t("photoEdit.salvar_apresentacao")}</Button>
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
          <div className="mt-4 flex justify-between gap-2">
            <Button onClick={() => setStep(STEPS[Math.max(0, STEPS.indexOf(step) - 1)])} disabled={step === "frame"}>{t("common.back")}</Button>
            {step !== "review" && <Button variant="primary" onClick={() => { setStep(STEPS[STEPS.indexOf(step) + 1]); setTool("none"); }}>{t("common.next")}</Button>}
          </div>
        </Card>
      </div>
      <p className="mt-4 type-caption text-faint"><Link className="underline" href={`/pieces/${pieceId}`}>← {t("photoEdit.voltar_peca")}</Link></p>
    </>
  );
}
