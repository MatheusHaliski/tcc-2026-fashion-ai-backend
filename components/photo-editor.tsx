"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, mediaUrl } from "@/lib/api/client";
import { Button, Dialog, Spinner, useToast } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { useI18n } from "@/lib/i18n/i18n";

type Rect = { x: number; y: number; w: number; h: number };
/** Um passo do histórico: fonte (original ou recorte sem fundo), giro, recorte normalizado e ajustes de luz. */
interface Step { src: string; rotation: 0 | 90 | 180 | 270; crop: Rect | null; brightness: number; contrast: number; label: string; }

const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 };
/** Girar 90° no sentido horário leva o ponto (x, y) para (1 − y, x); o retângulo acompanha. */
const rotateRect = (r: Rect): Rect => ({ x: 1 - (r.y + r.h), y: r.x, w: r.h, h: r.w });

function useImage(src: string | undefined) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) return; let alive = true; const i = new Image();
    i.onload = () => alive && setImg(i); i.src = src;
    return () => { alive = false; };
  }, [src]);
  return img;
}

/** Desenha o passo num canvas: gira, aplica brilho/contraste e recorta. */
function draw(img: HTMLImageElement, s: Step, out: HTMLCanvasElement) {
  const rot = s.rotation % 180 !== 0; const W = rot ? img.naturalHeight : img.naturalWidth; const H = rot ? img.naturalWidth : img.naturalHeight;
  const full = document.createElement("canvas"); full.width = W; full.height = H;
  const c = full.getContext("2d")!; c.filter = `brightness(${s.brightness}%) contrast(${s.contrast}%)`;
  c.translate(W / 2, H / 2); c.rotate((s.rotation * Math.PI) / 180); c.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  const r = s.crop ?? FULL; const sx = Math.round(r.x * W), sy = Math.round(r.y * H), sw = Math.max(1, Math.round(r.w * W)), sh = Math.max(1, Math.round(r.h * H));
  out.width = sw; out.height = sh; out.getContext("2d")!.drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh);
}

/**
 * RF12.CA02 → RF15 — Editor Canvas 2D: recorte, rotação, brilho/contraste, remoção de fundo e desfazer/refazer até a
 * original (CA01/CA03). Salvar troca a imagem da peça e preserva a original em Minhas Fotos (CA02); a falha da remoção de
 * fundo é avisada sem travar as outras ferramentas (CA04); sair com edições pendentes pede confirmação (CA05).
 */
export function PhotoEditor({ photoId, pieceId, imageUrl, title, onClose, onSaved }: { photoId?: string; pieceId?: string; imageUrl?: string | null; title?: string; onClose: () => void; onSaved: (message: string) => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [steps, setSteps] = useState<Step[]>([]); const [at, setAt] = useState(0);
  const [draft, setDraft] = useState<Partial<Step>>({});
  const [cropping, setCropping] = useState(false); const [sel, setSel] = useState<Rect | null>(null); const start = useRef<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState<"bg" | "save" | null>(null); const [leaving, setLeaving] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let url = ""; let alive = true;
    // foto de Minhas Fotos (original do dono) ou a imagem atual da peça (RF15.CA01 a partir da página da peça)
    const source = photoId ? api.blobUrl(`/api/photos/${photoId}/file`)
      : fetch(mediaUrl(imageUrl ?? null) ?? "", { mode: "cors" }).then((r) => { if (!r.ok) throw new Error("imagem indisponível"); return r.blob(); }).then((b) => URL.createObjectURL(b));
    source.then((u) => { url = u; if (alive) { setSteps([{ src: u, rotation: 0, crop: null, brightness: 100, contrast: 100, label: t("common.original") }]); setAt(0); } })
      .catch((e) => { toast.fromError(e); onClose(); });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoId, imageUrl]);
  const cur: Step | undefined = steps[at] ? { ...steps[at], ...draft } : undefined;
  const img = useImage(cur?.src);
  useEffect(() => { if (img && cur && canvas.current) draw(img, cur, canvas.current); }, [img, cur?.rotation, cur?.crop, cur?.brightness, cur?.contrast, cur?.src]); // eslint-disable-line react-hooks/exhaustive-deps
  const push = useCallback((patch: Partial<Step>, label: string) => {
    setSteps((s) => { const base = { ...s[at], ...draft }; return [...s.slice(0, at + 1), { ...base, ...patch, label }]; });
    setAt((i) => i + 1); setDraft({});
  }, [at, draft]);
  const dirty = at > 0 || Object.keys(draft).length > 0;
  const undo = () => { setDraft({}); setAt((i) => Math.max(0, i - 1)); };
  const redo = () => { setDraft({}); setAt((i) => Math.min(steps.length - 1, i + 1)); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return; e.preventDefault(); if (e.shiftKey) redo(); else undo(); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  });
  function rotate() { if (!cur) return; push({ rotation: ((cur.rotation + 90) % 360) as Step["rotation"], crop: cur.crop ? rotateRect(cur.crop) : null }, t("photoEditor.girar_90_2")); }
  function point(e: React.PointerEvent) { const b = (e.currentTarget as HTMLElement).getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)) }; }
  function applyCrop() {
    if (!cur || !sel || sel.w < 0.03 || sel.h < 0.03) { setCropping(false); setSel(null); return; }
    const c = cur.crop ?? FULL; push({ crop: { x: c.x + sel.x * c.w, y: c.y + sel.y * c.h, w: sel.w * c.w, h: sel.h * c.h } }, t("photoEditor.recortar_2")); setCropping(false); setSel(null);
  }
  async function removeBg() {
    if (!cur) return; setBusy("bg");
    try {
      const blob = await (await fetch(cur.src)).blob(); const form = new FormData(); form.append("file", blob, "foto.png");
      const r = await api.upload<{ ok: boolean; png?: string; message?: string; provider?: string }>("/api/photos/background-removal", form);
      if (r.ok && r.png) { push({ src: `data:image/png;base64,${r.png}` }, t("photoEditor.remover_fundo")); toast.success(t("photoEditor.fundo_removido", { value: r.provider ?? "local" })); }
      else toast.info(r.message ?? t("photoEditor.nao_deu_para_remover_o"));
    } catch { toast.info(t("photoEditor.a_remocao_de_fundo_falhou")); } finally { setBusy(null); }
  }
  async function save() {
    if (!canvas.current) return; setBusy("save");
    try {
      const blob = await new Promise<Blob | null>((ok) => canvas.current!.toBlob(ok, "image/png")); if (!blob) throw new Error("canvas vazio");
      const form = new FormData(); form.append("file", blob, "edicao.png");
      if (photoId) { const r = await api.upload<{ message?: string }>(`/api/photos/${photoId}/edits`, form); onSaved(r.message ?? t("photoEditor.edicao_salva")); }
      else { await api.upload(`/api/pieces/${pieceId}/image`, form, "PUT"); onSaved(t("photoEditor.a_imagem_editada_agora_e")); }
    } catch (e) { toast.fromError(e); } finally { setBusy(null); }
  }
  const close = () => (dirty ? setLeaving(true) : onClose());
  return (
    <div className="editor-backdrop" role="dialog" aria-modal="true" aria-label={t("photoEditor.editor_de_foto")}>
      <div className="editor">
        <header className="flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-2">
          <h2 className="type-h3 mr-auto">{t("photoEditor.editor_canvas_2d", { value: title ? ` · ${title}` : "" })}</h2>
          <Button size="sm" onClick={undo} disabled={at === 0 && !Object.keys(draft).length} aria-label={t("photoEditor.desfazer_ctrl_z")}>{t("photoEditor.desfazer")}</Button>
          <Button size="sm" onClick={redo} disabled={at >= steps.length - 1} aria-label={t("photoEditor.refazer_ctrl_shift_z")}>{t("photoEditor.refazer")}</Button>
          <Button size="sm" variant="ghost" onClick={() => { setDraft({}); setAt(0); }} disabled={at === 0}>{t("photoEditor.voltar_a_original")}</Button>
          <Button size="sm" variant="ghost" onClick={close} aria-label={t("photoEditor.fechar_editor")}>✕</Button>
        </header>
        <div className="grid min-h-0 flex-1 gap-3 p-3 md:grid-cols-[1fr_260px]">
          <div className="editor-stage">
            {!cur ? <Spinner size={28} /> : (
              <div className="relative inline-block max-h-full max-w-full" style={{ touchAction: "none" }}
                onPointerDown={(e) => { if (!cropping) return; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); const p = point(e); start.current = p; setSel({ x: p.x, y: p.y, w: 0, h: 0 }); }}
                onPointerMove={(e) => { if (!cropping || !start.current) return; const p = point(e), s = start.current; setSel({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) }); }}
                onPointerUp={() => { start.current = null; }}>
                <canvas ref={canvas} className="editor-canvas" aria-label={t("photoEditor.imagem_em_edicao")} />
                {cropping && <div className="editor-crop-hint">{sel && sel.w > 0 ? "" : t("photoEditor.arraste_para_marcar_o_recorte")}</div>}
                {cropping && sel && sel.w > 0 && <div className="editor-crop" style={{ left: `${sel.x * 100}%`, top: `${sel.y * 100}%`, width: `${sel.w * 100}%`, height: `${sel.h * 100}%` }} />}
              </div>
            )}
          </div>
          <aside className="grid content-start gap-3">
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => { setCropping((c) => !c); setSel(null); }} variant={cropping ? "primary" : "default"} disabled={!cur}>{t("photoEditor.recortar")}</Button>
              <Button onClick={rotate} disabled={!cur}>{t("photoEditor.girar_90")}</Button>
              <Button onClick={removeBg} loading={busy === "bg"} disabled={!cur} className="col-span-2">{t("photoEditor.remover_fundo")}</Button>
            </div>
            {cropping && <div className="flex gap-2"><Button size="sm" variant="primary" onClick={applyCrop} disabled={!sel || sel.w < 0.03}>{t("photoEditor.aplicar_recorte")}</Button><Button size="sm" onClick={() => { setCropping(false); setSel(null); }}>{t("common.cancel")}</Button></div>}
            {(["brightness", "contrast"] as const).map((k) => (
              <label key={k} className="grid gap-1"><span className="label">{k === "brightness" ? t("common.brilho") : t("common.contraste")} · {cur?.[k] ?? 100}%</span>
                <input type="range" min={40} max={180} value={cur?.[k] ?? 100} disabled={!cur}
                  onChange={(e) => setDraft((d) => ({ ...d, [k]: Number(e.target.value) }))}
                  onPointerUp={() => draft[k] !== undefined && push({}, k === "brightness" ? t("common.brilho") : t("common.contraste"))}
                  onKeyUp={() => draft[k] !== undefined && push({}, k === "brightness" ? t("common.brilho") : t("common.contraste"))} />
              </label>
            ))}
            <div>
              <p className="label">{t("common.historico")}</p>
              <ol className="editor-history">{steps.map((s, i) => <li key={i}><button type="button" aria-current={i === at ? "step" : undefined} className={i === at ? "is-on" : i > at ? "is-future" : ""} onClick={() => { setDraft({}); setAt(i); }}>{i}. {s.label}</button></li>)}</ol>
            </div>
            <Button variant="primary" onClick={save} loading={busy === "save"} disabled={!cur || !dirty}><FaiIcon id="ACT-25" size={24} decorative />{t("photoEditor.salvar_edicao")}</Button>
            <p className="type-caption text-muted">{t("photoEditor.foto_de_peca_a_edicao")}</p>
          </aside>
        </div>
      </div>
      <Dialog open={leaving} onClose={() => setLeaving(false)} title={t("photoEditor.sair_sem_salvar")}
        footer={<><Button onClick={() => setLeaving(false)}>{t("photoEditor.continuar_editando")}</Button><Button variant="danger" onClick={onClose}>{t("photoEditor.descartar_edicoes")}</Button></>}>
        <p className="type-body">{t("photoEditor.as_edicao_oes_desta_sessao", { Math: Math.max(at, 1) })}</p>
      </Dialog>
    </div>
  );
}
