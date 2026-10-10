"use client";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api, mediaUrl } from "@/lib/api/client";
import type { SchemeItemView, SchemeView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { rangeFill } from "@/lib/range-fill";
import { Button, Card, Dialog, EmptyState, SegmentPicker, Skeleton, useToast, cn } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";

/**
 * RF15 · Composição do look por camadas (o lado "look" do editor de imagem): cada peça do look é uma camada com
 * posição (centro, 0–1 do container do card), escala, rotação, opacidade e ordem — os mesmos campos que o card usa
 * (`SchemeItem`), então o que se arruma aqui é o que o card e o compartilhamento mostram. Nada de cor, filtro ou
 * reconstrução: a peça entra com a sua foto canônica (as edições do RF15 da peça acompanham). Só o dono edita.
 */
export interface Layer { wardrobeItemId: string; slot: string; name: string; imageUrl: string | null; x: number | null; y: number | null; scale: number; rotation: number; opacity: number; z: number }
export interface LookEditState { layers: Layer[] }

/** Lugar padrão por slot (x, y, largura, altura relativas ao container) — igual ao `SchemeCardRenderer.defaultPosition`. */
export function defaultPosition(slot: string, n: number): [number, number, number, number] {
  switch (slot) {
    case "TOP": return [0.4, 0.26, 0.62, 0.36];
    case "OUTERWEAR": return [0.62, 0.3, 0.55, 0.42];
    case "BOTTOM": return [0.42, 0.62, 0.5, 0.42];
    case "FULL_BODY": return [0.42, 0.45, 0.62, 0.78];
    case "SHOES": return [0.72, 0.86, 0.36, 0.2];
    default: return [0.8, 0.14 + 0.2 * (n % 4), 0.26, 0.18];
  }
}

export function layersOf(items: SchemeItemView[]): Layer[] {
  return [...items].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((i, n) => ({
    wardrobeItemId: i.wardrobeItemId, slot: String(i.slot ?? "ACCESSORY"), name: i.piece?.name ?? i.name ?? "", imageUrl: i.piece?.imageUrl ?? i.imageUrl ?? null,
    x: i.positionX == null ? null : Number(i.positionX), y: i.positionY == null ? null : Number(i.positionY),
    scale: i.scale == null ? 1 : Number(i.scale), rotation: i.rotation == null ? 0 : Number(i.rotation), opacity: i.opacity == null ? 1 : Number(i.opacity), z: i.zIndex ?? n,
  }));
}

/** Corpo enviado ao servidor (`ItemForm` por peça): só o layout; nada de adicionar ou tirar peças por aqui. */
export function toLayout(layers: Layer[]) {
  return layers.map((l, i) => ({ wardrobeItemId: l.wardrobeItemId, zIndex: l.z, sortOrder: i, positionX: l.x, positionY: l.y, scale: r4(l.scale), rotation: r4(l.rotation), opacity: r4(l.opacity) }));
}
const r4 = (v: number) => Math.round(v * 10000) / 10000;

function useHistory(initial: LookEditState) {
  const [h, setH] = useState({ past: [] as LookEditState[], present: initial, future: [] as LookEditState[] });
  const set = useCallback((next: LookEditState | ((s: LookEditState) => LookEditState), merge = false) => setH((x) => {
    const value = typeof next === "function" ? next(x.present) : next;
    if (JSON.stringify(value) === JSON.stringify(x.present)) return x;
    return { past: merge ? x.past : [...x.past, x.present].slice(-100), present: value, future: [] };
  }), []);
  const undo = useCallback(() => setH((x) => (x.past.length ? { past: x.past.slice(0, -1), present: x.past[x.past.length - 1], future: [x.present, ...x.future] } : x)), []);
  const redo = useCallback(() => setH((x) => (x.future.length ? { past: [...x.past, x.present], present: x.future[0], future: x.future.slice(1) } : x)), []);
  const reset = useCallback((s: LookEditState) => setH({ past: [], present: s, future: [] }), []);
  return { state: h.present, set, undo, redo, reset, canUndo: h.past.length > 0, canRedo: h.future.length > 0 };
}

function Slider({ id, label, value, min, max, step, onChange, format }: { id: string; label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <label htmlFor={id} className="grid gap-1">
      <span className="flex justify-between type-body-sm"><span>{label}</span><span className="type-data">{format ? format(value) : value}</span></span>
      <input id={id} type="range" min={min} max={max} step={step} value={value} style={rangeFill(value, min, max) as React.CSSProperties} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

type Tool = "layers" | "review";

export function LookCompositionEditor({ schemeId }: { schemeId: string }) {
  const { t } = useI18n(); const toast = useToast(); const router = useRouter();
  const [scheme, setScheme] = useState<SchemeView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hist = useHistory({ layers: [] });
  const s = hist.state;
  const [saved, setSaved] = useState<LookEditState>({ layers: [] });
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("layers");
  const [preview, setPreview] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [savedCard, setSavedCard] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [discard, setDiscard] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; start: [number, number]; from: [number, number] } | null>(null);

  const loadSavedCard = useCallback(() => api.blobUrl(`/api/schemes/${schemeId}/card.png?expanded=true`).then(setSavedCard).catch(() => setSavedCard(null)), [schemeId]);
  useEffect(() => {
    let alive = true;
    api.get<{ scheme: SchemeView }>(`/api/schemes/${schemeId}`).then((r) => {
      if (!alive) return;
      setScheme(r.scheme);
      const initial = { layers: layersOf(r.scheme.items ?? []) };
      hist.reset(initial); setSaved(initial); setSelected(initial.layers[0]?.wardrobeItemId ?? null);
    }).catch((e) => alive && setLoadError(e instanceof ApiError ? e.message : String(e)));
    loadSavedCard();
    return () => { alive = false; };
  }, [schemeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = JSON.stringify(s) !== JSON.stringify(saved);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // prévia do servidor (o mesmo render do card) na aba Revisão — o que a pessoa vê é o que o card mostrará
  const layoutKey = JSON.stringify(toLayout(s.layers));
  useEffect(() => {
    if (!scheme || tool !== "review") return;
    let alive = true;
    const timer = setTimeout(() => {
      setPreviewBusy(true);
      api.post<Blob>(`/api/schemes/${schemeId}/layout/preview`, toLayout(s.layers), { headers: { Accept: "image/png" } })
        .then((b) => { if (alive) setPreview(URL.createObjectURL(b)); })
        .catch((e) => { if (alive) toast.fromError(e); })
        .finally(() => { if (alive) setPreviewBusy(false); });
    }, 300);
    return () => { alive = false; clearTimeout(timer); };
  }, [layoutKey, scheme, tool, schemeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const point = (e: React.PointerEvent): [number, number] | null => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return null;
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  const box = (l: Layer, n: number) => {
    const d = defaultPosition(l.slot, n);
    return { x: l.x ?? d[0], y: l.y ?? d[1], w: d[2] * l.scale, h: d[3] * l.scale };
  };
  const update = (id: string, patch: Partial<Layer>, merge = false) => hist.set((x) => ({ layers: x.layers.map((l) => (l.wardrobeItemId === id ? { ...l, ...patch } : l)) }), merge);
  function onLayerDown(e: React.PointerEvent, l: Layer, n: number) {
    const p = point(e); if (!p) return;
    setSelected(l.wardrobeItemId);
    const b = box(l, n);
    drag.current = { id: l.wardrobeItemId, start: p, from: [b.x, b.y] };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current; if (!d) return;
    const p = point(e); if (!p) return;
    update(d.id, { x: r4(Math.max(0, Math.min(1, d.from[0] + p[0] - d.start[0]))), y: r4(Math.max(0, Math.min(1, d.from[1] + p[1] - d.start[1]))) }, true);
  }
  const onPointerUp = () => { drag.current = null; };
  /** Teclado: setas movem a camada selecionada (Shift: passos maiores); [ e ] mudam a ordem. */
  function onStageKey(e: React.KeyboardEvent) {
    const l = s.layers.find((x) => x.wardrobeItemId === selected); if (!l) return;
    const n = slotIndex(l);
    const b = box(l, n); const step = e.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) { e.preventDefault(); update(l.wardrobeItemId, { x: r4(Math.max(0, Math.min(1, b.x + moves[e.key][0]))), y: r4(Math.max(0, Math.min(1, b.y + moves[e.key][1]))) }); }
    else if (e.key === "]") { e.preventDefault(); reorder(l.wardrobeItemId, 1); }
    else if (e.key === "[") { e.preventDefault(); reorder(l.wardrobeItemId, -1); }
  }
  const slotIndex = (l: Layer) => s.layers.filter((x) => x.slot === l.slot).findIndex((x) => x.wardrobeItemId === l.wardrobeItemId);
  /** Troca a ordem com a camada vizinha (+1 = para a frente) e renumera z. */
  function reorder(id: string, dir: 1 | -1) {
    hist.set((x) => {
      const sorted = [...x.layers].sort((a, b) => a.z - b.z);
      const i = sorted.findIndex((l) => l.wardrobeItemId === id); const j = i + dir;
      if (i < 0 || j < 0 || j >= sorted.length) return x;
      [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
      return { layers: sorted.map((l, z) => ({ ...l, z })) };
    });
  }
  const autoArrange = () => hist.set((x) => ({ layers: x.layers.map((l, z) => ({ ...l, x: null, y: null, scale: 1, rotation: 0, opacity: 1, z })) }));
  async function save() {
    setBusy(true);
    try {
      const v = await api.put<SchemeView>(`/api/schemes/${schemeId}/layout`, toLayout(s.layers));
      setScheme(v); setSaved(s); toast.success(t("lookEdit.salvo")); loadSavedCard();
    } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  const leave = () => router.push(`/schemes/${schemeId}`);
  const cancel = () => { if (dirty) setDiscard(true); else leave(); };

  if (loadError) return <EmptyState title={t("lookEdit.sem_look")} hint={loadError} action={<Link href="/schemes" className="btn">{t("nav.schemes")}</Link>} />;
  if (!scheme) return <Skeleton className="h-96" />;
  const sel = s.layers.find((l) => l.wardrobeItemId === selected) ?? null;
  const ordered = [...s.layers].sort((a, b) => a.z - b.z);

  return (
    <div className="photo-edit look-compose">
      <header className="photo-edit-topbar" aria-label={t("photoEdit.barra")}>
        <Button variant="ghost" onClick={cancel}>{t("photoEdit.cancelar")}</Button>
        <div className="photo-edit-topbar-mid">
          <Button size="sm" onClick={hist.undo} disabled={!hist.canUndo}><FaiIcon id="ACT-21" size={20} decorative />{t("photoEdit.desfazer")}</Button>
          <Button size="sm" onClick={hist.redo} disabled={!hist.canRedo}>{t("photoEdit.refazer")}</Button>
          <Button size="sm" aria-pressed={compare} onPointerDown={() => setCompare(true)} onPointerUp={() => setCompare(false)} onPointerLeave={() => setCompare(false)}
            onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); setCompare((c) => !c); } }}>{t("photoEdit.comparar")}</Button>
        </div>
        <Button variant="primary" onClick={save} loading={busy} disabled={!dirty}>{t("photoEdit.salvar")}</Button>
      </header>
      <p className="mb-3 flex flex-wrap items-center gap-2 type-body-sm text-muted">
        <span className="type-h3 text-ink">{t("lookEdit.titulo", { title: scheme.title })}</span>
        {dirty && <span>{t("photoEdit.alteracoes_nao_salvas")}</span>}
      </p>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          {compare && savedCard ? (
            <div className="look-compose-stage is-preview" role="img" aria-label={t("lookEdit.card_salvo")}><img src={savedCard} alt={t("lookEdit.card_salvo")} /></div>
          ) : tool === "review" ? (
            <div className="look-compose-stage is-preview" role="img" aria-label={t("photoEdit.previa")}>
              {preview ? <img src={preview} alt={t("photoEdit.previa")} /> : <Skeleton className="h-80 w-full" />}
              {previewBusy && <span className="photo-edit-busy" aria-live="polite">{t("photoEdit.gerando_previa")}</span>}
            </div>
          ) : (
            <div ref={stageRef} className="look-compose-stage" role="group" aria-label={t("lookEdit.camadas")} tabIndex={0} onKeyDown={onStageKey}
              onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
              {ordered.map((l) => {
                const n = slotIndex(l); const b = box(l, n);
                return (
                  <button key={l.wardrobeItemId} type="button" className={cn("look-compose-layer", selected === l.wardrobeItemId && "is-selected")} aria-pressed={selected === l.wardrobeItemId}
                    aria-label={t("lookEdit.camada", { name: l.name })} onPointerDown={(e) => onLayerDown(e, l, n)} onFocus={() => setSelected(l.wardrobeItemId)}
                    style={{ left: `${(b.x - b.w / 2) * 100}%`, top: `${(b.y - b.h / 2) * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%`, transform: `rotate(${l.rotation}deg)`, opacity: l.opacity, zIndex: l.z + 1 }}>
                    {l.imageUrl && <img src={mediaUrl(l.imageUrl)} alt="" draggable={false} />}
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={autoArrange}><FaiIcon id="ACT-07" size={20} decorative />{t("lookEdit.arrumar")}</Button>
            <span className="type-caption text-muted">{t("lookEdit.teclado")}</span>
          </div>
        </Card>
        <Card>
          <SegmentPicker className="mb-3" label={t("photoEdit.ferramentas")} value={tool} onChange={setTool} options={[{ id: "layers", label: t("lookEdit.camadas") }, { id: "review", label: t("photoEdit.tool.revisao") }]} />
          {tool === "layers" && (
            <div className="grid gap-3">
              <p className="type-body-sm text-muted">{t("lookEdit.ajuda")}</p>
              <ul className="grid gap-1" aria-label={t("lookEdit.camadas")}>
                {[...ordered].reverse().map((l) => (
                  <li key={l.wardrobeItemId} className={cn("flex items-center gap-2 rounded-md border p-2", selected === l.wardrobeItemId ? "border-ink" : "border-line-soft")}>
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setSelected(l.wardrobeItemId)} aria-pressed={selected === l.wardrobeItemId}>
                      <span className="fitting-slot-thumb is-small">{l.imageUrl && <img src={mediaUrl(l.imageUrl)} alt="" />}</span>
                      <span className="min-w-0 flex-1 truncate type-body-sm">{l.name}</span>
                    </button>
                    <Button size="sm" variant="ghost" onClick={() => reorder(l.wardrobeItemId, 1)} aria-label={t("lookEdit.para_frente", { name: l.name })}>▲</Button>
                    <Button size="sm" variant="ghost" onClick={() => reorder(l.wardrobeItemId, -1)} aria-label={t("lookEdit.para_tras", { name: l.name })}>▼</Button>
                  </li>
                ))}
              </ul>
              {sel && (
                <section className="grid gap-2 border-t border-line-soft pt-3" aria-label={t("lookEdit.camada", { name: sel.name })}>
                  <h3 className="label">{sel.name}</h3>
                  <Slider id="lc-scale" label={t("lookEdit.tamanho")} value={sel.scale} min={0.2} max={3} step={0.05} onChange={(v) => update(sel.wardrobeItemId, { scale: v }, true)} format={(v) => `${Math.round(v * 100)}%`} />
                  <Slider id="lc-rot" label={t("lookEdit.rotacao")} value={sel.rotation} min={-45} max={45} step={1} onChange={(v) => update(sel.wardrobeItemId, { rotation: v }, true)} format={(v) => `${v}°`} />
                  <Slider id="lc-op" label={t("lookEdit.opacidade")} value={sel.opacity} min={0.2} max={1} step={0.05} onChange={(v) => update(sel.wardrobeItemId, { opacity: v }, true)} format={(v) => `${Math.round(v * 100)}%`} />
                  <Button size="sm" variant="ghost" onClick={() => update(sel.wardrobeItemId, { x: null, y: null, scale: 1, rotation: 0, opacity: 1 })}>{t("lookEdit.posicao_padrao")}</Button>
                </section>
              )}
            </div>
          )}
          {tool === "review" && (
            <div className="grid gap-3">
              <p className="type-body-sm text-muted">{t("lookEdit.revisao_ajuda")}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => hist.set(saved)} disabled={!dirty}>{t("lookEdit.voltar_ao_salvo")}</Button>
                <Link href={`/schemes/${schemeId}`} className="btn btn-sm">{t("lookEdit.ver_look")}</Link>
              </div>
            </div>
          )}
        </Card>
      </div>
      <Dialog open={discard} onClose={() => setDiscard(false)} title={t("photoEdit.descartar_titulo")} role="alertdialog"
        footer={<><Button onClick={() => setDiscard(false)}>{t("photoEdit.continuar_editando")}</Button><Button variant="danger" onClick={leave}>{t("photoEdit.descartar")}</Button></>}>
        <p className="type-body">{t("lookEdit.descartar_corpo")}</p>
      </Dialog>
    </div>
  );
}
