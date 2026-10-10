"use client";
import { useEffect, useRef, useState } from "react";
import { ApiError, api, mediaUrl } from "@/lib/api/client";
import type { PieceView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { CATEGORY_LABEL, label, useTaxonomy, type Taxonomy, subcategoryLabel } from "@/lib/api/taxonomy";
import { keepAllowed } from "@/lib/pieces/tags";
import { Button, ChipMultiSelect, Dialog, Field, Input, Select, cn } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { CaptureGuideDialog } from "@/components/capture/capture-guide-dialog";
import { guideFor, type CaptureCategory } from "@/lib/capture/capture-guides";
import { useCaptureTutorialPrefs } from "@/lib/capture/tutorial-prefs";
import { EMPTY_PIECE, PIECE_CATEGORIES, PIECE_MAX_TAGS, toPayload, validatePieceForm, type PieceFormValue } from "@/components/piece-form";

/** Caixa da peça em % (0–100) da largura e da altura da foto: x/y = canto superior esquerdo. */
export interface MultiBox { x: number; y: number; width: number; height: number }
export interface DetectedPiece { index: number; name?: string | null; category?: string | null; subcategory?: string | null; color?: string | null; material?: string | null; sex?: string | null; style?: string[]; occasion?: string[]; box: MultiBox; confidence: number }
/** POST /api/pieces/analysis/multi — source "local" = sem IA de visão (uma peça cobrindo a foto inteira). */
export interface MultiDetection { draftId: string; originalUrl: string; width: number; height: number; pieces: DetectedPiece[]; source: "ia" | "local"; aiMessage?: string | null }

interface Row {
  /** posição na detecção; -1 = foto inteira que a pessoa adicionou (sem pré-preenchimento no servidor) */
  index: number; box: MultiBox; confidence: number; include: boolean; value: PieceFormValue;
  thumb?: string; crop?: File; status: "idle" | "saving" | "saved" | "error"; error?: string; errors?: Record<string, string>;
  /** cópia da peça recriada por IA (a prévia já vem com o selo); useAi = salvar com ela no lugar da foto */
  ai?: { id: string; url: string }; useAi?: boolean; aiBusy?: boolean; aiError?: string;
}

const FULL: MultiBox = { x: 0, y: 0, width: 100, height: 100 };
/** Folga em volta da caixa no recorte (fração do lado da caixa): a IA devolve a caixa justa e a borda da peça não pode sumir. */
const CROP_PAD = 0.08;

/**
 * Recorta a caixa (em %) da foto original no navegador. createImageBitmap aplica a orientação EXIF, como o backend faz
 * na análise: as porcentagens valem para a foto na posição em que foi tirada.
 */
async function cropBox(file: File, box: MultiBox, maxSide?: number): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  try {
    const px = (box.width * CROP_PAD) / 100, py = (box.height * CROP_PAD) / 100;
    const x0 = Math.max(0, box.x / 100 - px), y0 = Math.max(0, box.y / 100 - py);
    const x1 = Math.min(1, (box.x + box.width) / 100 + px), y1 = Math.min(1, (box.y + box.height) / 100 + py);
    const sx = Math.round(x0 * bmp.width), sy = Math.round(y0 * bmp.height);
    const sw = Math.max(1, Math.round((x1 - x0) * bmp.width)), sh = Math.max(1, Math.round((y1 - y0) * bmp.height));
    const scale = maxSide ? Math.min(1, maxSide / Math.max(sw, sh)) : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sw * scale)); canvas.height = Math.max(1, Math.round(sh * scale));
    canvas.getContext("2d")!.drawImage(bmp, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("crop"))), type, 0.92));
  } finally { bmp.close(); }
}

/** Dados da detecção → formulário completo, com o mesmo preenchimento padrão da análise de uma peça. */
function initialValue(p: Pick<DetectedPiece, "name" | "category" | "subcategory" | "color" | "material" | "sex" | "style" | "occasion">, tax: Taxonomy | null, fallbackName: string): PieceFormValue {
  const cat = p.category && tax?.subcategories?.[p.category] ? p.category : "upper_piece";
  const allowedOccasions = tax?.allowedOccasionsByCategory?.[cat] ?? tax?.occasions;
  const occasion = keepAllowed(p.occasion, allowedOccasions); const style = keepAllowed(p.style, tax?.styles);
  return { ...EMPTY_PIECE, useDefaultImage: false, name: p.name || fallbackName, category: cat,
    subcategory: p.subcategory && tax?.subcategories?.[cat]?.includes(p.subcategory) ? p.subcategory : tax?.subcategories?.[cat]?.[0] ?? "",
    color: p.color ?? "black", material: p.material ?? "COTTON", sex: p.sex ?? "UNISSEX", size: "m", price: "0",
    occasion: occasion.length ? occasion : [allowedOccasions?.[0] ?? "casual"], style: style.length ? style : ["basic"] };
}

/** Teto de fotos por envio: cada foto passa pela IA de visão e por uma revisão, então o lote fica revisável. */
export const MAX_PHOTOS = 10;

/**
 * Peça detectada escolhida para seguir pelo criador em etapas (sem modal): o recorte (ou a foto inteira), o rascunho da
 * análise e os dados que a IA leu, para conferir em Dados → Mais detalhes → Arte → Revisar.
 */
export interface PhotoPick { key: string; file: File; preview: string; draftId: string; index: number; value: PieceFormValue; photo: number; piece: number }

interface PhotoItem {
  id: string; file: File; preview: string;
  status: "idle" | "analyzing" | "ready" | "error" | "done";
  detection?: MultiDetection; error?: string; saved?: number;
}

/**
 * Foto opcional do RF4: a pessoa escolhe uma ou várias fotos (cada foto pode ter várias peças), pede a análise e o
 * sistema detecta as peças de cada foto. A revisão abre foto por foto ("Foto 2 de 3") e cada peça confirmada vira uma
 * peça no guarda-roupa. Fotos com erro podem ser analisadas de novo sem refazer as outras.
 */
export function MultiPieceUpload({ onSaved, category, subcategory, onCategory, onPick, picked, savedKeys, onAvailable }: {
  onSaved?: (count: number) => void;
  /** criador em etapas: a peça escolhida segue pelo botão Avançar (como na busca catalogada), sem abrir a revisão em modal */
  onPick?: (p: PhotoPick) => void; picked?: string | null; savedKeys?: string[];
  /** chaves de todas as peças detectadas (para o criador saber se ainda há peças da foto por cadastrar) */
  onAvailable?: (keys: string[]) => void;
  /** tipo escolhido na página: o guia "Como fotografar" abre direto na orientação dessa categoria */
  category?: string | null; subcategory?: string | null;
  /** categoria escolhida dentro do guia (sincroniza a página) */
  onCategory?: (category: CaptureCategory, subcategory?: string) => void;
}) {
  const { t } = useI18n(); const inputRef = useRef<HTMLInputElement>(null);
  const prefs = useCaptureTutorialPrefs();
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideCat, setGuideCat] = useState<{ category?: string | null; subcategory?: string | null }>({});
  useEffect(() => { setGuideCat({ category, subcategory }); }, [category, subcategory]);
  /**
   * Antes de escolher as fotos, o guia "Como fotografar" da categoria (RF4/RF47), salvo se a pessoa marcou "Não
   * mostrar novamente" para esse guia; sem categoria escolhida, o guia começa perguntando o que ela vai adicionar.
   */
  function pickPhotos() {
    const guide = guideFor(guideCat.category, guideCat.subcategory);
    if (guide && prefs.isHidden(guide.id)) { inputRef.current?.click(); return; }
    setGuideOpen(true);
  }
  const [items, setItems] = useState<PhotoItem[]>([]);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [limitHit, setLimitHit] = useState(false);
  const itemsRef = useRef(items); itemsRef.current = items;
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview)), []);

  const patch = (id: string, p: Partial<PhotoItem>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));

  function choose(files: FileList | null) {
    const picked = Array.from(files ?? []).filter((f) => f.type.startsWith("image/") || f.type === "");
    if (inputRef.current) inputRef.current.value = "";
    if (!picked.length) return;
    const room = MAX_PHOTOS - itemsRef.current.length;
    setLimitHit(picked.length > room);
    const add = picked.slice(0, Math.max(0, room)).map((file, i) => ({ id: `${Date.now()}-${i}-${file.name}`, file, preview: URL.createObjectURL(file), status: "idle" as const }));
    setItems((xs) => [...xs, ...add]);
  }
  function remove(id: string) {
    setItems((xs) => { const gone = xs.find((x) => x.id === id); if (gone) URL.revokeObjectURL(gone.preview); return xs.filter((x) => x.id !== id); });
    setLimitHit(false);
  }

  /** Analisa em sequência as fotos ainda não analisadas (uma de cada vez: a IA de visão tem cota por pessoa). */
  async function analyzeAll() {
    const queue = itemsRef.current.filter((i) => i.status === "idle" || i.status === "error");
    if (!queue.length) return;
    setAnalyzing(true);
    let first: string | null = null;
    for (const it of queue) {
      patch(it.id, { status: "analyzing", error: undefined });
      try {
        const fd = new FormData(); fd.append("file", it.file);
        const d = await api.upload<MultiDetection>("/api/pieces/analysis/multi", fd);
        patch(it.id, { status: "ready", detection: d });
        first ??= it.id;
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError(0, "ERRO", String(e));
        patch(it.id, { status: "error", error: err.status === 0 || err.status === 413 ? t("piece.err_upload") : err.status >= 500 ? t("piece.err_analise") : err.message });
      }
    }
    setAnalyzing(false);
    if (first && !reviewing && !onPick) setReviewing(first);
  }

  /** Depois de salvar uma foto, abre a próxima pronta; sem mais nenhuma, avisa o total cadastrado. */
  function savedOne(id: string, count: number) {
    const next = itemsRef.current.map((x) => (x.id === id ? { ...x, status: "done" as const, saved: count } : x));
    setItems(next);
    const pending = next.find((x) => x.status === "ready");
    if (pending) { setReviewing(pending.id); return; }
    setReviewing(null);
    if (!next.some((x) => x.status === "idle" || x.status === "analyzing" || x.status === "error")) onSaved?.(next.reduce((n, x) => n + (x.saved ?? 0), 0));
  }

  const current = items.find((i) => i.id === reviewing && i.detection);
  const toAnalyze = items.filter((i) => i.status === "idle" || i.status === "error").length;
  const order = items.filter((i) => i.detection).map((i) => i.id);
  const statusText = (i: PhotoItem) => i.status === "analyzing" ? t("multiPiece.analisando")
    : i.status === "ready" ? t("multiPiece.encontradas_curto", { count: i.detection?.pieces.length ?? 0 })
    : i.status === "done" ? t("multiPiece.salvas", { count: i.saved ?? 0 })
    : i.status === "error" ? i.error : t("multiPiece.aguardando");

  return (
    <div className="grid gap-2 rounded-md border border-line-soft bg-surface-2 p-3">
      <p className="font-medium">{t("multiPiece.entrada")}</p>
      <p className="type-caption text-muted">{t("multiPiece.entrada_ajuda")}</p>
      <input ref={inputRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => choose(e.target.files)} aria-label={t("multiPiece.escolher_foto")} />
      {items.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label={t("multiPiece.fotos_escolhidas", { count: items.length })}>
          {items.map((i, n) => (
            <li key={i.id} className="flex items-center gap-2 rounded border border-line-soft bg-surface p-2">
              <img src={i.preview} alt={t("multiPiece.foto_n", { n: n + 1 })} className="h-14 w-14 shrink-0 rounded object-cover" />
              <div className="min-w-0 flex-1">
                <p className="type-body-sm font-medium">{t("multiPiece.foto_n", { n: n + 1 })}</p>
                <p className={cn("type-caption", i.status === "error" ? "error-text" : "text-muted")} role={i.status === "error" ? "alert" : undefined}>{statusText(i)}</p>
              </div>
              {i.status === "ready" && !onPick && <Button size="sm" onClick={() => setReviewing(i.id)}>{t("multiPiece.revisar")}</Button>}
              {(i.status === "idle" || i.status === "error") && <Button size="sm" variant="ghost" onClick={() => remove(i.id)} disabled={analyzing} aria-label={t("multiPiece.remover_foto", { n: n + 1 })}>✕</Button>}
            </li>
          ))}
        </ul>
      )}
      {limitHit && <p role="note" className="type-caption text-muted">{t("multiPiece.limite_fotos", { max: MAX_PHOTOS })}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={pickPhotos} disabled={analyzing || items.length >= MAX_PHOTOS}>{items.length ? t("multiPiece.adicionar_fotos") : t("multiPiece.escolher_foto")}</Button>
        {toAnalyze > 0 && <Button size="sm" variant="primary" onClick={analyzeAll} loading={analyzing}><FaiIcon id="ACT-07" size={20} decorative />{analyzing ? t("multiPiece.analisando") : t("multiPiece.analisar")}</Button>}
      </div>
      <CaptureGuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} category={guideCat.category} subcategory={guideCat.subcategory} prefs={prefs}
        onCategory={(c, sub) => { setGuideCat({ category: c, subcategory: sub ?? null }); onCategory?.(c, sub); }}
        onConfirm={() => { setGuideOpen(false); inputRef.current?.click(); }} />
      {onPick && items.some((i) => i.detection) && (
        <DetectedPieces items={items} onPick={onPick} picked={picked ?? null} savedKeys={savedKeys ?? []} onAvailable={onAvailable} />
      )}
      {!onPick && current && current.detection && (
        <MultiPieceReview key={current.id} file={current.file} detection={current.detection}
          subtitle={order.length > 1 ? t("multiPiece.foto_de", { n: order.indexOf(current.id) + 1, total: order.length }) : undefined}
          onClose={() => setReviewing(null)} onSaved={(count) => savedOne(current.id, count)} />
      )}
    </div>
  );
}

/**
 * Peças achadas em cada foto, na própria página do criador: miniatura recortada, nome lido e "Usar esta peça". A escolhida
 * segue pelas etapas do criador; as já salvas ficam marcadas e a pessoa volta aqui para a próxima.
 */
function DetectedPieces({ items, onPick, picked, savedKeys, onAvailable }: { items: PhotoItem[]; onPick: (p: PhotoPick) => void; picked: string | null; savedKeys: string[]; onAvailable?: (keys: string[]) => void }) {
  const { t } = useI18n(); const tax = useTaxonomy();
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  const ready = items.filter((i) => i.detection);
  const entries = ready.flatMap((it) => {
    const photo = items.indexOf(it) + 1;
    const pieces = it.detection!.pieces.length ? it.detection!.pieces : [{ index: -1, box: FULL, confidence: 0 } as DetectedPiece];
    return pieces.map((p, n) => ({ key: `${it.id}#${p.index}`, it, p, photo, piece: n + 1 }));
  });
  const keys = entries.map((e) => e.key).join("|");
  useEffect(() => { onAvailable?.(keys ? keys.split("|") : []); }, [keys]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    entries.forEach((e) => {
      if (thumbs[e.key]) return;
      (e.p.index < 0 ? Promise.resolve(e.it.file as Blob) : cropBox(e.it.file, e.p.box, 240))
        .then((b) => { const u = URL.createObjectURL(b); urls.current.push(u); setThumbs((m) => ({ ...m, [e.key]: u })); }).catch(() => undefined);
    });
  }, [keys]); // eslint-disable-line react-hooks/exhaustive-deps
  async function use(e: (typeof entries)[number]) {
    const blob = e.p.index < 0 ? e.it.file : await cropBox(e.it.file, e.p.box);
    const file = blob instanceof File ? blob : new File([blob], `peca-${e.photo}-${e.piece}.${blob.type === "image/png" ? "png" : "jpg"}`, { type: blob.type });
    const preview = URL.createObjectURL(file); urls.current.push(preview);
    onPick({ key: e.key, file, preview, draftId: e.it.detection!.draftId, index: e.p.index, photo: e.photo, piece: e.piece,
      value: initialValue(e.p, tax, t("multiPiece.peca_n", { n: e.piece })) });
  }
  return (
    <section className="grid gap-2" aria-label={t("multiPiece.pecas_detectadas")}>
      <p className="font-medium">{t("multiPiece.pecas_detectadas")}</p>
      <p className="type-caption text-muted">{t("multiPiece.escolha_e_avance")}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {entries.map((e) => {
          const saved = savedKeys.includes(e.key), active = picked === e.key;
          return (
            <li key={e.key} className={cn("flex items-center gap-2 rounded border bg-surface p-2", active ? "border-ink" : "border-line-soft")} data-testid="detected-piece">
              {thumbs[e.key] ? <img src={thumbs[e.key]} alt="" className="h-14 w-14 shrink-0 rounded object-contain bg-surface-2" /> : <span className="h-14 w-14 shrink-0 rounded bg-surface-2" />}
              <div className="min-w-0 flex-1">
                <p className="type-body-sm font-medium truncate">{e.p.name || t("multiPiece.peca_n", { n: e.piece })}</p>
                <p className="type-caption text-muted">{t("multiPiece.foto_n", { n: e.photo })}{e.p.category ? ` · ${CATEGORY_LABEL[e.p.category] ?? label(e.p.category)}` : ""}</p>
              </div>
              {saved ? <span className="type-caption font-medium">✓ {t("multiPiece.salva")}</span>
                : active ? <span className="type-caption font-medium">{t("multiPiece.em_edicao")}</span>
                : <Button size="sm" onClick={() => void use(e)}>{t("multiPiece.usar_esta_peca")}</Button>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Revisão das peças achadas: a foto original com a marcação de cada peça, a miniatura recortada e os dados editáveis
 * (nome, tipo, subtipo, cor, material, estilo e ocasião). Cada peça marcada é salva com o próprio recorte — ou com a foto
 * inteira, quando a pessoa não recortou —, passando pelo rascunho do servidor (Flat Lay + moderação) e pelo cadastro
 * normal da peça. Peças já salvas não são reenviadas numa nova tentativa.
 */
export function MultiPieceReview({ file, detection, subtitle, onClose, onSaved }: { file: File; detection: MultiDetection; subtitle?: string; onClose: () => void; onSaved: (count: number) => void }) {
  const { t } = useI18n(); const tax = useTaxonomy();
  const [photo] = useState(() => URL.createObjectURL(file));
  const [rows, setRows] = useState<Row[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [saving, setSaving] = useState(false); const [progress, setProgress] = useState<{ n: number; total: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const urls = useRef<string[]>([]);
  const track = (u: string) => { urls.current.push(u); return u; };
  useEffect(() => () => { URL.revokeObjectURL(photo); urls.current.forEach((u) => URL.revokeObjectURL(u)); }, [photo]);

  // linhas a partir da detecção (depois de a taxonomia chegar: os padrões dependem dela) + miniatura recortada de cada peça
  useEffect(() => {
    if (!tax) return;
    const initial: Row[] = detection.pieces.map((p, i) => ({ index: p.index, box: p.box, confidence: p.confidence, include: true, status: "idle",
      value: initialValue(p, tax, t("multiPiece.peca_n", { n: i + 1 })) }));
    setRows(initial);
    initial.forEach((r) => { cropBox(file, r.box, 240).then((b) => { const u = track(URL.createObjectURL(b)); setRows((rs) => rs.map((x) => (x.index === r.index ? { ...x, thumb: u } : x))); }).catch(() => undefined); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tax, detection, file]);

  const update = (index: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.index === index ? { ...r, ...patch } : r)));
  const setValue = (index: number, value: PieceFormValue) => update(index, { value, errors: undefined });

  function addWholePhoto() {
    setRows([{ index: -1, box: FULL, confidence: 0, include: true, status: "idle", thumb: photo, value: initialValue({}, tax, t("multiPiece.peca_n", { n: 1 })) }]);
  }
  async function crop(r: Row) {
    try {
      const blob = await cropBox(file, r.box);
      const ext = blob.type === "image/png" ? "png" : "jpg";
      const f = new File([blob], `peca-${r.index + 1}.${ext}`, { type: blob.type });
      update(r.index, { crop: f, thumb: track(URL.createObjectURL(blob)) });
    } catch { update(r.index, { error: t("piece.err_upload") }); }
  }

  /**
   * Cópia por IA: parte do recorte da peça (sem recorte, recorta pela caixa só para a IA — a foto inteira tem várias
   * peças) e manda o que a pessoa já conferiu (nome, tipo, cor) para a IA recriar a peça certa.
   */
  async function makeAi(r: Row) {
    update(r.index, { aiBusy: true, aiError: undefined });
    try {
      const source = r.crop ?? (r.index >= 0 ? new File([await cropBox(file, r.box)], `peca-${r.index + 1}.jpg`, { type: "image/jpeg" }) : file);
      const fd = new FormData(); fd.append("file", source, source.name);
      const qs = new URLSearchParams({ name: r.value.name, category: r.value.category, color: r.value.color });
      if (r.index >= 0) qs.set("index", String(r.index));
      const img = await api.upload<{ aiImageId: string; previewUrl: string }>(`/api/pieces/analysis/multi/${detection.draftId}/ai-image?${qs}`, fd);
      update(r.index, { ai: { id: img.aiImageId, url: mediaUrl(img.previewUrl) ?? img.previewUrl }, useAi: true, aiBusy: false });
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, "ERRO", String(e));
      update(r.index, { aiBusy: false, aiError: err.status === 0 ? t("piece.err_rede") : err.message });
    }
  }

  // peças marcadas que ainda não foram recortadas nem salvas (a foto inteira adicionada à mão não tem o que recortar)
  const uncropped = rows.filter((r) => r.index >= 0 && r.include && !r.crop && r.status !== "saved");
  const [cropping, setCropping] = useState(false);
  async function cropAll() {
    setCropping(true);
    try { await Promise.all(uncropped.map((r) => crop(r))); } finally { setCropping(false); }
  }
  const pending = rows.filter((r) => r.include && r.status !== "saved");
  async function saveAll() {
    setProblem(null);
    // valida tudo antes de enviar: nenhuma peça vai ao servidor se outra ainda tem campo a corrigir
    let invalid = false;
    const checked = rows.map((r) => {
      if (!r.include || r.status === "saved") return r;
      const errors = validatePieceForm(r.value, tax);
      if (Object.keys(errors).length) { invalid = true; return { ...r, errors }; }
      return { ...r, errors: undefined };
    });
    setRows(checked);
    if (invalid) { setProblem(t("multiPiece.corrija")); return; }
    const queue = checked.filter((r) => r.include && r.status !== "saved");
    setSaving(true); let saved = 0; let failed = 0;
    for (const [i, r] of queue.entries()) {
      setProgress({ n: i + 1, total: queue.length }); update(r.index, { status: "saving", error: undefined });
      try {
        let draft: { draftId: string };
        if (r.useAi && r.ai) {
          // a cópia por IA já está no servidor: o rascunho parte dela e grava o selo em todas as versões
          draft = await api.post<{ draftId: string }>(`/api/pieces/analysis/multi/${detection.draftId}/ai-images/${r.ai.id}/piece`);
        } else {
          const fd = new FormData(); fd.append("file", r.crop ?? file, r.crop?.name ?? file.name);
          const q = r.index >= 0 ? `?index=${r.index}` : "";
          draft = await api.upload<{ draftId: string }>(`/api/pieces/analysis/multi/${detection.draftId}/pieces${q}`, fd);
        }
        await api.post<PieceView>("/api/pieces", toPayload({ ...r.value, draftId: draft.draftId, useDefaultImage: false }));
        update(r.index, { status: "saved" }); saved++;
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError(0, "ERRO", String(e));
        const msg = err.status === 0 ? t("piece.err_rede") : err.status >= 500 ? t("piece.err_servidor", { ref: err.correlationId ? err.correlationId.slice(0, 8) : "—" }) : err.message;
        update(r.index, { status: "error", error: msg, errors: Object.keys(err.fields).length ? err.fields : undefined }); failed++;
      }
    }
    setSaving(false); setProgress(null);
    if (failed) setProblem(t("multiPiece.algumas_falharam"));
    else onSaved(saved + rows.filter((r) => r.status === "saved").length);
  }

  const footer = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {progress && <span className="type-caption text-muted" aria-live="polite">{t("multiPiece.salvando", progress)}</span>}
      <Button onClick={onClose} disabled={saving}>{t("common.cancel")}</Button>
      <Button variant="primary" onClick={saveAll} loading={saving} disabled={!pending.length}>{t("multiPiece.salvar", { count: pending.length })}</Button>
    </div>
  );
  return (
    <Dialog open onClose={() => { if (!saving) onClose(); }} title={subtitle ? `${t("multiPiece.titulo")} · ${subtitle}` : t("multiPiece.titulo")} size="xl" footer={footer}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="lg:sticky lg:top-0 lg:self-start">
          <div className="relative overflow-hidden rounded-md border border-line-soft" role="img" aria-label={t("multiPiece.marcacoes")}>
            <img src={photo} alt="" className="block h-auto w-full" />
            {rows.filter((r) => r.index >= 0).map((r, i) => (
              <button key={r.index} type="button" aria-label={t("multiPiece.peca_n", { n: i + 1 })}
                onClick={() => { setActive(r.index); document.getElementById(`multi-piece-${r.index}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }}
                className={cn("absolute rounded-sm border-2", r.include ? "border-solid" : "border-dashed opacity-50", active === r.index && "ring-2 ring-offset-1")}
                style={{ left: `${r.box.x}%`, top: `${r.box.y}%`, width: `${r.box.width}%`, height: `${r.box.height}%`, borderColor: "var(--mark, #e4572e)" }}>
                <span className="absolute left-0 top-0 min-w-5 rounded-br-sm px-1 type-caption font-medium text-white" style={{ background: "var(--mark, #e4572e)" }}>{i + 1}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid content-start gap-3">
          {detection.source === "local" ? <p role="note" className="rounded-md bg-thread-soft p-3 type-body-sm">{t("multiPiece.sem_ia")}</p>
            : rows.length > 0 && <p role="note" className="type-body-sm">{t("multiPiece.encontradas", { count: rows.length })}</p>}
          {detection.aiMessage && <p className="type-caption text-muted">{detection.aiMessage}</p>}
          {rows.some((r) => r.index >= 0 && r.status !== "saved") && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={cropAll} loading={cropping} disabled={saving || !uncropped.length}>{t("multiPiece.recortar_todas", { count: uncropped.length })}</Button>
              {!uncropped.length && <span className="type-caption text-muted">{t("multiPiece.todas_recortadas")}</span>}
            </div>
          )}
          {tax && rows.length === 0 && detection.pieces.length === 0 && (
            <div className="grid gap-2"><p>{t("multiPiece.nenhuma")}</p><Button onClick={addWholePhoto}>{t("multiPiece.usar_foto_inteira")}</Button></div>
          )}
          {rows.map((r, i) => (
            <PieceRow key={r.index} id={`multi-piece-${r.index}`} n={i + 1} row={r} tax={tax} active={active === r.index} disabled={saving}
              onInclude={(include) => update(r.index, { include })} onChange={(v) => setValue(r.index, v)}
              onCrop={() => crop(r)} onUncrop={() => update(r.index, { crop: undefined })}
              onMakeAi={() => makeAi(r)} onUseAi={(useAi) => update(r.index, { useAi })} />
          ))}
          {problem && <p role="alert" className="error-text">{problem}</p>}
        </div>
      </div>
    </Dialog>
  );
}

function PieceRow({ id, n, row, tax, active, disabled, onInclude, onChange, onCrop, onUncrop, onMakeAi, onUseAi }: {
  id: string; n: number; row: Row; tax: Taxonomy | null; active: boolean; disabled: boolean;
  onInclude: (v: boolean) => void; onChange: (v: PieceFormValue) => void; onCrop: () => void; onUncrop: () => void;
  onMakeAi: () => void; onUseAi: (v: boolean) => void;
}) {
  const { t } = useI18n(); const v = row.value; const err = row.errors ?? {};
  const set = <K extends keyof PieceFormValue>(k: K, x: PieceFormValue[K]) => onChange({ ...v, [k]: x });
  const allowedOccasions = (c: string) => tax?.allowedOccasionsByCategory?.[c] ?? tax?.occasions ?? [];
  const categories = Object.keys(tax?.subcategories ?? {}).filter((c) => PIECE_CATEGORIES.includes(c) || c === v.category);
  const saved = row.status === "saved"; const locked = disabled || saved;
  const fid = (f: string) => `${id}-${f}`;
  return (
    <section id={id} aria-label={t("multiPiece.peca_n", { n })} className={cn("grid gap-3 rounded-md border p-3 sm:grid-cols-[148px_1fr]", active ? "border-ink" : "border-line-soft", !row.include && "opacity-60")}>
      <div className="grid content-start gap-2">
        <label className="flex items-center gap-2 font-medium">
          <input type="checkbox" checked={row.include} disabled={locked} onChange={(e) => onInclude(e.target.checked)} />
          {t("multiPiece.peca_n", { n })}
        </label>
        <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded border border-line-soft bg-surface-2">
          {row.useAi && row.ai
            ? <img src={row.ai.url} alt={t("multiPiece.copia_ia_alt", { n })} className="h-full w-full object-contain" />
            : row.thumb && <img src={row.thumb} alt={t("multiPiece.miniatura", { n })} className="h-full w-full object-contain" />}
          {row.useAi && row.ai && <span className="badge absolute left-1 top-1" title={t("pieceCard.gerada_por_ia")}>{t("multiPiece.selo_ia_curto")}</span>}
        </div>
        {row.confidence > 0 && <p className="type-caption text-muted">{t("multiPiece.confianca", { pct: Math.round(row.confidence * 100) })}</p>}
        {row.index >= 0 && !saved && (row.crop
          ? <><p className="type-caption">{t("multiPiece.recortada")}</p><Button size="sm" variant="ghost" onClick={onUncrop} disabled={locked}>{t("multiPiece.desfazer_recorte")}</Button></>
          : <><Button size="sm" onClick={onCrop} disabled={locked || !row.include}>{t("multiPiece.recortar")}</Button><p className="type-caption text-muted">{t("multiPiece.sem_recorte")}</p></>)}
        {!saved && (row.ai ? (
          <div className="grid gap-1.5 border-t border-line-soft pt-2">
            {row.useAi
              ? <><p className="type-caption">{t("multiPiece.vai_com_ia")}</p><Button size="sm" variant="ghost" onClick={() => onUseAi(false)} disabled={locked}>{t("multiPiece.usar_foto_original")}</Button></>
              : <Button size="sm" onClick={() => onUseAi(true)} disabled={locked || !row.include}>{t("multiPiece.usar_copia_ia")}</Button>}
            <Button size="sm" variant="ghost" onClick={onMakeAi} loading={row.aiBusy} disabled={locked || !row.include}>{row.aiBusy ? t("multiPiece.criando_copia_ia") : t("multiPiece.gerar_outra")}</Button>
          </div>
        ) : (
          <div className="grid gap-1.5 border-t border-line-soft pt-2">
            <Button size="sm" onClick={onMakeAi} loading={row.aiBusy} disabled={locked || !row.include}>{row.aiBusy ? t("multiPiece.criando_copia_ia") : t("multiPiece.criar_copia_ia")}</Button>
            <p className="type-caption text-muted">{t("multiPiece.copia_ia_ajuda")}</p>
          </div>
        ))}
        {row.aiError && <p role="alert" className="error-text">{row.aiError}</p>}
      </div>
      <fieldset disabled={locked || !row.include} className="grid min-w-0 gap-x-3 sm:grid-cols-2">
        <Field label={t("common.nome")} id={fid("name")} required error={err.name} className="sm:col-span-2"><Input id={fid("name")} value={v.name} maxLength={80} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label={t("common.category")} id={fid("category")} required error={err.category}>
          <Select id={fid("category")} value={v.category} onChange={(e) => onChange({ ...v, category: e.target.value, subcategory: tax?.subcategories?.[e.target.value]?.[0] ?? "", occasion: keepAllowed(v.occasion, allowedOccasions(e.target.value)) })}>
            {categories.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c] ?? label(c)}</option>)}
          </Select>
        </Field>
        <Field label={t("common.subcategory")} id={fid("subcategory")} required error={err.subcategory}>
          <Select id={fid("subcategory")} value={v.subcategory} onChange={(e) => set("subcategory", e.target.value)}>{(tax?.subcategories?.[v.category] ?? []).map((s) => <option key={s} value={s}>{subcategoryLabel(s)}</option>)}</Select>
        </Field>
        <Field label={t("common.color")} id={fid("color")} required error={err.color}>
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-6 w-6 shrink-0 rounded-full border border-line-soft" style={{ background: tax?.colors?.[v.color] ?? "transparent" }} />
            <Select id={fid("color")} value={v.color} onChange={(e) => set("color", e.target.value)}>{Object.keys(tax?.colors ?? {}).map((k) => <option key={k} value={k}>{label(k)}</option>)}</Select>
          </div>
        </Field>
        <Field label={t("common.material")} id={fid("material")} required error={err.material}>
          <Select id={fid("material")} value={v.material} onChange={(e) => set("material", e.target.value)}>{(tax?.materials ?? []).map((m) => <option key={m} value={m}>{label(m.toLowerCase())}</option>)}</Select>
        </Field>
        <ChipMultiSelect className="sm:col-span-2" legend={t("common.style")} max={PIECE_MAX_TAGS} options={(tax?.styles ?? []).map((o) => ({ id: o, label: label(o) }))} value={v.style} onChange={(x) => set("style", x)}
          error={err.style} limitMessage={t("pieceForm.limite_estilos")} scroll />
        <ChipMultiSelect className="sm:col-span-2" legend={t("common.occasion")} max={PIECE_MAX_TAGS} options={allowedOccasions(v.category).map((o) => ({ id: o, label: label(o) }))} value={v.occasion} onChange={(x) => set("occasion", x)}
          error={err.occasion} limitMessage={t("pieceForm.limite_ocasioes")} scroll />
      </fieldset>
      {(saved || row.status === "saving" || row.error || Object.keys(err).some((k) => !["name", "category", "subcategory", "color", "material", "style", "occasion"].includes(k))) && (
        <div className="sm:col-span-2" aria-live="polite">
          {saved && <p className="type-body-sm font-medium">✓ {t("multiPiece.salva")}</p>}
          {row.error && <p role="alert" className="error-text">{t("multiPiece.erro_peca", { msg: row.error })}</p>}
          {Object.entries(err).filter(([k]) => !["name", "category", "subcategory", "color", "material", "style", "occasion"].includes(k)).map(([k, m]) => <p key={k} role="alert" className="error-text">{m}</p>)}
        </div>
      )}
    </section>
  );
}
