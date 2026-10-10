"use client";
import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
import { ApiError, api, mediaUrl } from "@/lib/api/client";
import type { PieceView, UserCard } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { CATEGORY_LABEL, label, useTaxonomy, type Taxonomy, subcategoryLabel } from "@/lib/api/taxonomy";
import { keepAllowed } from "@/lib/pieces/tags";
import { Button, ChipMultiSelect, Field, Input, Select, cn } from "@/components/ui";
import { FaiIcon } from "@/components/fai-icon";
import { CaptureGuideDialog } from "@/components/capture/capture-guide-dialog";
import { guideFor, type CaptureCategory } from "@/lib/capture/capture-guides";
import { useCaptureTutorialPrefs } from "@/lib/capture/tutorial-prefs";
import { EMPTY_PIECE, PIECE_CATEGORIES, PIECE_MAX_TAGS, PieceMoreDetails, toPayload, validatePieceForm, type PieceFormValue } from "@/components/piece-form";
import { PieceCreationSteps, type PieceCreationStep } from "@/components/piece-creation-steps";
import { PieceArtEditor } from "@/components/piece-art-editor";
import { PieceCard } from "@/components/piece-card";
import { BrandAutocomplete } from "@/components/catalog/brand-autocomplete";
import { useAuth } from "@/lib/auth/session";

/** Caixa da peça em % (0–100) da largura e da altura da foto: x/y = canto superior esquerdo. */
export interface MultiBox { x: number; y: number; width: number; height: number }
export interface DetectedPiece { index: number; name?: string | null; brandName?: string | null; category?: string | null; subcategory?: string | null; color?: string | null; material?: string | null; sex?: string | null; style?: string[]; occasion?: string[]; box: MultiBox; confidence: number }
/** POST /api/pieces/analysis/multi — source "local" = regiões estimadas localmente, a conferir. */
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
const CROP_PAD = 0.02;

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
function initialValue(p: Pick<DetectedPiece, "name" | "brandName" | "category" | "subcategory" | "color" | "material" | "sex" | "style" | "occasion">, tax: Taxonomy | null, fallbackName: string): PieceFormValue {
  const cat = p.category && tax?.subcategories?.[p.category] ? p.category : "upper_piece";
  const allowedOccasions = tax?.allowedOccasionsByCategory?.[cat] ?? tax?.occasions;
  const occasion = keepAllowed(p.occasion, allowedOccasions); const style = keepAllowed(p.style, tax?.styles);
  return { ...EMPTY_PIECE, useDefaultImage: false, name: p.name || fallbackName, brandName: p.brandName ?? "", category: cat,
    subcategory: p.subcategory && tax?.subcategories?.[cat]?.includes(p.subcategory) ? p.subcategory : tax?.subcategories?.[cat]?.[0] ?? "",
    color: p.color ?? "black", material: p.material ?? "COTTON", sex: p.sex ?? "UNISSEX", size: "m", price: "0",
    occasion: occasion.length ? occasion : [allowedOccasions?.[0] ?? "casual"], style: style.length ? style : ["basic"], background: { skin: "atelier" } };
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
export function MultiPieceUpload({ onSaved, category, subcategory, onCategory, captureControls, onPick, picked, savedKeys, onAvailable }: {
  onSaved?: (count: number) => void;
  /** criador em etapas: a peça escolhida segue pelo botão Avançar (como na busca catalogada), sem abrir a revisão em modal */
  onPick?: (p: PhotoPick) => void; picked?: string | null; savedKeys?: string[];
  /** chaves de todas as peças detectadas (para o criador saber se ainda há peças da foto por cadastrar) */
  onAvailable?: (keys: string[]) => void;
  /** tipo escolhido na página: o guia "Como fotografar" abre direto na orientação dessa categoria */
  category?: string | null; subcategory?: string | null;
  /** categoria escolhida dentro do guia (sincroniza a página) */
  onCategory?: (category: CaptureCategory, subcategory?: string) => void;
  captureControls?: ReactNode;
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
  const [step, setStep] = useState<PieceCreationStep>("piece");
  const reviews = useRef(new Map<string, MultiPieceReviewHandle>());
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const analysisLock = useRef(false);
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
    if (analysisLock.current) return;
    const queue = itemsRef.current.filter((i) => i.status === "idle" || i.status === "error");
    if (!queue.length) return;
    analysisLock.current = true; setAnalyzing(true);
    let first: string | null = null;
    for (const it of queue) {
      patch(it.id, { status: "analyzing", error: undefined });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25_000);
      try {
        // A visão recebe uma imagem leve; recortes finais continuam usando o arquivo original.
        const reduced = await cropBox(it.file, FULL, 1568).catch(() => it.file);
        const fd = new FormData(); fd.append("file", reduced, it.file.name);
        const d = await api.upload<MultiDetection>("/api/pieces/analysis/multi", fd, "POST", { signal: controller.signal });
        patch(it.id, { status: "ready", detection: d });
        if (!first && !onPick) { setReviewing(it.id); setStep("more"); }
        first ??= it.id;
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError(0, "ERRO", String(e));
        patch(it.id, { status: "error", error: controller.signal.aborted ? t("multiPiece.tempo_esgotado") : err.status === 0 || err.status === 413 ? t("piece.err_upload") : err.status >= 500 ? t("piece.err_analise") : err.message });
      } finally { clearTimeout(timeout); }
    }
    analysisLock.current = false; setAnalyzing(false);
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
  function go(next: PieceCreationStep) {
    if ([...reviews.current.values()].some((review) => review.isBusy())) return;
    if (next !== "piece" && !items.some((item) => item.detection)) return;
    if (next === "art" || next === "review") {
      if (items.some((item) => item.status === "idle" || item.status === "analyzing" || item.status === "error")) { setStep("piece"); return; }
      for (const item of items) {
        if (item.status === "ready" && !reviews.current.get(item.id)?.validate()) { setReviewing(item.id); setStep("more"); return; }
      }
    }
    if (next !== "piece" && !current) setReviewing(items.find((item) => item.status === "ready")?.id ?? null);
    setStep(next);
  }
  const toAnalyze = items.filter((i) => i.status === "idle" || i.status === "error").length;
  const order = items.map((i) => i.id);
  const statusText = (i: PhotoItem) => i.status === "analyzing" ? t("multiPiece.analisando")
    : i.status === "ready" ? t("multiPiece.encontradas_curto", { count: i.detection?.pieces.length ?? 0 })
    : i.status === "done" ? t("multiPiece.salvas", { count: i.saved ?? 0 })
    : i.status === "error" ? i.error : t("multiPiece.aguardando");

  return (
    <div className="grid gap-2">
      {!onPick && <PieceCreationSteps value={step} onChange={go} />}
      {step === "piece" && captureControls}
      {step === "piece" && <><p className="font-medium">{t("multiPiece.entrada")}</p>
      <p className="type-caption text-muted">{t("multiPiece.entrada_ajuda")}</p></>}
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
              {i.status === "ready" && !onPick && <Button size="sm" aria-pressed={current?.id === i.id && step !== "piece"} onClick={() => { if ([...reviews.current.values()].some((review) => review.isBusy())) return; setReviewing(i.id); if (step === "piece") setStep("more"); }}>{t("multiPiece.revisar")}</Button>}
              {(i.status === "idle" || i.status === "error") && <Button size="sm" variant="ghost" onClick={() => remove(i.id)} disabled={analyzing} aria-label={t("multiPiece.remover_foto", { n: n + 1 })}>✕</Button>}
            </li>
          ))}
        </ul>
      )}
      {limitHit && <p role="note" className="type-caption text-muted">{t("multiPiece.limite_fotos", { max: MAX_PHOTOS })}</p>}
      {step === "piece" && <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={pickPhotos} disabled={analyzing || items.length >= MAX_PHOTOS}>{items.length ? t("multiPiece.adicionar_fotos") : t("multiPiece.escolher_foto")}</Button>
        {toAnalyze > 0 && <Button size="sm" variant="primary" onClick={analyzeAll} loading={analyzing}><FaiIcon id="ACT-07" size={20} decorative />{analyzing ? t("multiPiece.analisando") : t("multiPiece.analisar")}</Button>}
      </div>}
      <CaptureGuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} category={guideCat.category} subcategory={guideCat.subcategory} prefs={prefs}
        onCategory={(c, sub) => { setGuideCat({ category: c, subcategory: sub ?? null }); onCategory?.(c, sub); }}
        onConfirm={() => { setGuideOpen(false); inputRef.current?.click(); }} />
      {onPick && items.some((i) => i.detection) && (
        <DetectedPieces items={items} onPick={onPick} picked={picked ?? null} savedKeys={savedKeys ?? []} onAvailable={onAvailable} />
      )}
      {/* Mantém os rascunhos montados: trocar de foto não descarta edições nem recortes. */}
      {!onPick && items.filter((item) => item.detection).map((item) => (
        <div key={item.id} hidden={step === "piece" || current?.id !== item.id}>
          <MultiPieceReview file={item.file} detection={item.detection!}
            step={step} onStepChange={go} controlRef={(handle) => { if (handle) reviews.current.set(item.id, handle); else reviews.current.delete(item.id); }}
            subtitle={order.length > 1 ? t("multiPiece.foto_de", { n: order.indexOf(item.id) + 1, total: order.length }) : undefined}
            onClose={() => setStep("piece")} onSaved={(count) => savedOne(item.id, count)} />
        </div>
      ))}
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
interface MultiPieceReviewHandle { validate: () => boolean; isBusy: () => boolean }
function photoPreview(row: Row, user: UserCard | null, tax: Taxonomy | null): PieceView {
  const v = row.value, image = row.useAi && row.ai ? row.ai.url : row.thumb ?? null;
  return {
    id: `photo-preview-${row.index}`, owner: user ?? { id: "", username: "", displayName: "", profileType: "PESSOAL", verified: false, privateAccount: false },
    name: v.name, category: v.category, subcategory: v.subcategory, sex: v.sex, brandName: v.brandName || null,
    brandLogoUrl: v.brandLogoUrl ?? null,
    color: v.color, colorHex: tax?.colors[v.color] ?? null, material: v.material, size: v.size, style: v.style, occasion: v.occasion,
    seals: v.seals, price: v.price === "" ? null : Number(v.price), imageUrl: image, thumbnailUrl: image,
    studioImageUrl: null, studioThumbUrl: null, studioFeedUrl: null, defaultImage: false, visibility: v.visibility,
    disponivel: true, availabilityStatus: "AVAILABLE", favorite: false, forSale: v.forSale, wearCount: 0, tags: [],
    background: v.background ?? undefined, counters: { likes: 0, comments: 0, shares: 0, remixes: 0, views: 0, saves: 0, reactions: {} },
    viewer: { liked: false, reactions: [], saved: false, canEdit: true, following: false }, notAvailableAnymore: false,
    createdAt: "", updatedAt: "",
  };
}
export function MultiPieceReview({ file, detection, subtitle, onClose, onSaved, step, onStepChange, controlRef }: { file: File; detection: MultiDetection; subtitle?: string; onClose: () => void; onSaved: (count: number) => void; step?: PieceCreationStep; onStepChange?: (step: PieceCreationStep) => void; controlRef?: Ref<MultiPieceReviewHandle> }) {
  const { t } = useI18n(); const tax = useTaxonomy();
  const { user } = useAuth();
  const [ownStep, setOwnStep] = useState<PieceCreationStep>("more");
  const currentStep = step ?? ownStep;
  const go = (next: PieceCreationStep) => { if (saveLock.current) return; if ((next === "art" || next === "review") && !validate()) return; if (onStepChange) onStepChange(next); else setOwnStep(next); };
  const [photo] = useState(() => URL.createObjectURL(file));
  const [rows, setRows] = useState<Row[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [saving, setSaving] = useState(false); const [progress, setProgress] = useState<{ n: number; total: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const initialized = useRef(false);
  const saveLock = useRef(false);
  const urls = useRef<string[]>([]);
  const track = (u: string) => { urls.current.push(u); return u; };
  useEffect(() => () => { URL.revokeObjectURL(photo); urls.current.forEach((u) => URL.revokeObjectURL(u)); }, [photo]);

  // linhas a partir da detecção (depois de a taxonomia chegar: os padrões dependem dela) + miniatura recortada de cada peça
  useEffect(() => {
    if (!tax || initialized.current) return;
    initialized.current = true;
    const initial: Row[] = detection.pieces.map((p, i) => ({ index: p.index, box: p.box, confidence: p.confidence, include: true, status: "idle",
      value: initialValue(p, tax, t("multiPiece.peca_n", { n: i + 1 })) }));
    setRows(initial);
    setActive(initial[0]?.index ?? null);
    initial.forEach((r) => { cropBox(file, r.box, 240).then((b) => { const u = track(URL.createObjectURL(b)); setRows((rs) => rs.map((x) => (x.index === r.index && x.box === r.box ? { ...x, thumb: u } : x))); }).catch(() => undefined); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tax, detection, file]);

  const update = (index: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.index === index ? { ...r, ...patch } : r)));
  const setValue = (index: number, value: PieceFormValue) => update(index, { value, errors: undefined });

  function addWholePhoto() {
    const index = Math.min(0, ...rows.map((r) => r.index)) - 1;
    setRows((rs) => [...rs, { index, box: FULL, confidence: 0, include: true, status: "idle", thumb: photo, value: initialValue({}, tax, t("multiPiece.peca_n", { n: rs.length + 1 })) }]);
    setActive(index);
  }
  function changeBox(r: Row, box: MultiBox) {
    update(r.index, { box, crop: undefined, ai: undefined, useAi: false, errors: undefined, error: undefined });
    cropBox(file, box, 240).then((blob) => {
      const thumb = track(URL.createObjectURL(blob));
      setRows((rs) => rs.map((row) => row.index === r.index && row.box === box ? { ...row, thumb } : row));
    }).catch(() => update(r.index, { error: t("piece.err_upload") }));
  }
  async function crop(r: Row) {
    try {
      const blob = await cropBox(file, r.box);
      const ext = blob.type === "image/png" ? "png" : "jpg";
      const f = new File([blob], `peca-${r.index + 1}.${ext}`, { type: blob.type });
      const thumb = track(URL.createObjectURL(blob));
      setRows((rs) => rs.map((row) => row.index === r.index && row.box === r.box ? { ...row, crop: f, thumb } : row));
    } catch { update(r.index, { error: t("piece.err_upload") }); }
  }

  /**
   * Cópia por IA: parte do recorte da peça (sem recorte, recorta pela caixa só para a IA — a foto inteira tem várias
   * peças) e manda o que a pessoa já conferiu (nome, tipo, cor) para a IA recriar a peça certa.
   */
  async function makeAi(r: Row) {
    update(r.index, { aiBusy: true, aiError: undefined });
    try {
      const blob = r.crop ?? await cropBox(file, r.box);
      const source = r.crop ?? new File([blob], `peca-${r.index + 1}.${blob.type === "image/png" ? "png" : "jpg"}`, { type: blob.type });
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
  function validate() {
    setProblem(null);
    // valida tudo antes de enviar: nenhuma peça vai ao servidor se outra ainda tem campo a corrigir
    let invalid = false;
    const checked = rows.map((r) => {
      if (!r.include || r.status === "saved") return r;
      const errors = validatePieceForm(r.value, tax);
      if (rows.length > 1 && r.box.width === 100 && r.box.height === 100) errors.box = t("multiPiece.recorte_obrigatorio");
      if (Object.keys(errors).length) { invalid = true; return { ...r, errors }; }
      return { ...r, errors: undefined };
    });
    setRows(checked);
    if (invalid) { setActive(checked.find((r) => r.errors && Object.keys(r.errors).length)?.index ?? active); setProblem(t("multiPiece.corrija")); return false; }
    return !!tax && checked.some((row) => row.include);
  }
  useImperativeHandle(controlRef, () => ({ validate, isBusy: () => saveLock.current }));
  async function saveAll() {
    if (saveLock.current || currentStep !== "review" || !validate()) return;
    const checked = rows;
    const queue = checked.filter((r) => r.include && r.status !== "saved");
    saveLock.current = true; setSaving(true); let saved = 0; let failed = 0;
    let firstFailed: number | null = null;
    for (const [i, r] of queue.entries()) {
      setProgress({ n: i + 1, total: queue.length }); update(r.index, { status: "saving", error: undefined });
      try {
        let draft: { draftId: string };
        if (r.useAi && r.ai) {
          // a cópia por IA já está no servidor: o rascunho parte dela e grava o selo em todas as versões
          draft = await api.post<{ draftId: string }>(`/api/pieces/analysis/multi/${detection.draftId}/ai-images/${r.ai.id}/piece`);
        } else {
          // A miniatura e a imagem cadastrada devem representar a mesma peça, mesmo sem clicar em Recortar.
          const blob = r.crop ?? await cropBox(file, r.box);
          const source = r.crop ?? new File([blob], `peca-${r.index}.${blob.type === "image/png" ? "png" : "jpg"}`, { type: blob.type });
          const fd = new FormData(); fd.append("file", source, source.name);
          const q = r.index >= 0 ? `?index=${r.index}` : "";
          draft = await api.upload<{ draftId: string }>(`/api/pieces/analysis/multi/${detection.draftId}/pieces${q}`, fd);
        }
        await api.post<PieceView>("/api/pieces", toPayload({ ...r.value, draftId: draft.draftId, useDefaultImage: false }));
        update(r.index, { status: "saved" }); saved++;
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError(0, "ERRO", String(e));
        const msg = err.status === 0 ? t("piece.err_rede") : err.status >= 500 ? t("piece.err_servidor", { ref: err.correlationId ? err.correlationId.slice(0, 8) : "—" }) : err.message;
        update(r.index, { status: "error", error: msg, errors: Object.keys(err.fields).length ? err.fields : undefined }); failed++;
        firstFailed ??= r.index;
      }
    }
    saveLock.current = false; setSaving(false); setProgress(null);
    if (failed) { setActive(firstFailed); setProblem(t("multiPiece.algumas_falharam")); }
    else onSaved(saved + rows.filter((r) => r.status === "saved").length);
  }

  const footer = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {progress && <span className="type-caption text-muted" aria-live="polite">{t("multiPiece.salvando", progress)}</span>}
      <Button onClick={() => currentStep === "more" ? onClose() : go(currentStep === "review" ? "art" : "more")} disabled={saving}>{t("common.back")}</Button>
      {currentStep === "review" ? <Button variant="primary" onClick={saveAll} loading={saving} disabled={!pending.length || cropping || rows.some((r) => r.aiBusy)}>{t("multiPiece.salvar", { count: pending.length })}</Button>
        : <Button variant="primary" onClick={() => go(currentStep === "more" ? "art" : "review")} disabled={saving || cropping || !rows.some((r) => r.include) || rows.some((r) => r.aiBusy)}>{t("common.next")}</Button>}
    </div>
  );
  return (
    <section aria-label={subtitle ? `${t("pieceForm.moreDetails")} · ${subtitle}` : t("pieceForm.moreDetails")} className="grid gap-4">
      {step === undefined && <PieceCreationSteps value={currentStep} onChange={go} />}
      <h2 className="type-h3">{currentStep === "art" ? t("pieces.new.etapa_arte") : currentStep === "review" ? t("builder.step.review") : t("pieceForm.moreDetails")}{subtitle ? ` · ${subtitle}` : ""}</h2>
      <div role="group" aria-label={t("multiPiece.slots")} className="flex flex-wrap gap-2">
        {rows.map((r, i) => <Button key={r.index} size="sm" aria-pressed={active === r.index} disabled={saving} onClick={() => setActive(r.index)}>
          {t("multiPiece.peca_n", { n: i + 1 })} · {r.value.name}{r.status === "saved" ? " ✓" : r.status === "error" || r.errors ? " !" : ""}
        </Button>)}
        {currentStep === "more" && <Button size="sm" onClick={addWholePhoto} disabled={!tax || saving || rows.length >= 12}>{t("multiPiece.adicionar_slot")}</Button>}
      </div>
      <div className={currentStep === "art" ? "grid gap-5" : "grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]"}>
        <div className="grid min-w-0 content-start gap-3">
          {currentStep === "more" && <>
          {detection.source === "local" ? <p role="note" className="rounded-md bg-thread-soft p-3 type-body-sm">{t("multiPiece.revisao_local")}</p>
            : rows.length > 0 && <p role="note" className="type-body-sm">{t("multiPiece.encontradas", { count: rows.length })}</p>}
          {detection.aiMessage && <p className="type-caption text-muted">{detection.aiMessage}</p>}
          <details className="rounded-md border border-line-soft p-3">
            <summary className="cursor-pointer font-medium">{t("multiPiece.marcacoes")}</summary>
            <div className="mt-3 max-w-md">
              <PhotoRegionMap source={photo} rows={rows} active={active} disabled={saving} onSelect={setActive} />
            </div>
          </details>
          {currentStep === "more" && rows.some((r) => r.index >= 0 && r.status !== "saved") && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={cropAll} loading={cropping} disabled={saving || !uncropped.length}>{t("multiPiece.recortar_todas", { count: uncropped.length })}</Button>
              {!uncropped.length && <span className="type-caption text-muted">{t("multiPiece.todas_recortadas")}</span>}
            </div>
          )}
          {tax && rows.length === 0 && detection.pieces.length === 0 && (
            <div className="grid gap-2"><p>{t("multiPiece.nenhuma")}</p><Button onClick={addWholePhoto}>{t("multiPiece.usar_foto_inteira")}</Button></div>
          )}
          </>}
          {currentStep === "more" && rows.filter((r) => r.index === active).map((r) => (
            <PieceRow key={r.index} id={`multi-piece-${detection.draftId}-${r.index}`} n={rows.indexOf(r) + 1} row={r} tax={tax} active disabled={saving}
              onInclude={(include) => update(r.index, { include })} onChange={(v) => setValue(r.index, v)}
              onBox={(box) => changeBox(r, box)}
              onCrop={() => crop(r)} onUncrop={() => update(r.index, { crop: undefined })}
              onMakeAi={() => makeAi(r)} onUseAi={(useAi) => update(r.index, { useAi })} />
          ))}
          {currentStep === "art" && rows.filter((r) => r.index === active).map((r) => <fieldset key={r.index} disabled={saving || r.status === "saved" || !r.include}>
            <PieceArtEditor value={r.value.background ?? { skin: "atelier" }} onChange={(background) => setValue(r.index, { ...r.value, background })}
              piece={photoPreview(r, user, tax)} styles={r.value.style} occasions={r.value.occasion} />
          </fieldset>)}
          {currentStep === "review" && <ul className="grid gap-3" aria-label={t("builder.step.review")}>
            {rows.map((r, i) => <li key={r.index} className={cn("flex items-center gap-3 rounded-md border border-line-soft p-3", !r.include && "opacity-60")}>
              <input type="checkbox" aria-label={t("multiPiece.peca_n", { n: i + 1 })} checked={r.include} disabled={saving || r.status === "saved"} onChange={(event) => update(r.index, { include: event.target.checked })} />
              <img src={r.useAi && r.ai ? r.ai.url : r.thumb ?? photo} alt="" className="h-16 w-16 rounded object-contain" />
              <div className="min-w-0 flex-1"><p className="font-medium">{r.value.name}{r.status === "saved" ? " ✓" : ""}</p><p className="type-caption text-muted">{r.value.brandName ? `${r.value.brandName} · ` : ""}{subcategoryLabel(r.value.subcategory)} · {label(r.value.color)}</p>{r.error && <p role="alert" className="error-text">{r.error}</p>}</div>
              <Button size="sm" onClick={() => { setActive(r.index); go("more"); }} disabled={saving}>{t("common.edit")}</Button>
            </li>)}
          </ul>}
          {problem && <p role="alert" className="error-text">{problem}</p>}
        </div>
        {currentStep !== "art" && rows.filter((r) => r.index === active).map((r) => <aside key={r.index} aria-label={t("common.pre_visualizacao")} className="card-preview lg:sticky lg:top-16 lg:self-start">
          <p className="label">{t("scheme.card")}</p><PieceCard piece={photoPreview(r, user, tax)} href="#" />
        </aside>)}
      </div>
      {footer}
    </section>
  );
}

function PhotoRegionMap({ source, rows, active, disabled, onSelect }: {
  source: string; rows: readonly Row[]; active: number | null; disabled: boolean; onSelect: (index: number) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="relative overflow-hidden rounded-md border border-line-soft" role="group" aria-label={t("multiPiece.marcacoes")}>
      <img src={source} alt="" className="block h-auto w-full" />
      {rows.map((r, i) => (
        <button key={r.index} type="button" aria-label={t("multiPiece.peca_n", { n: i + 1 })}
          aria-pressed={active === r.index} disabled={disabled} onClick={() => onSelect(r.index)}
          className={cn("absolute rounded-sm border-2", r.include ? "border-solid" : "border-dashed opacity-50", active === r.index && "ring-2 ring-offset-1")}
          style={{ left: `${r.box.x}%`, top: `${r.box.y}%`, width: `${r.box.width}%`, height: `${r.box.height}%`, borderColor: "var(--mark, #e4572e)" }}>
          <span className="absolute left-0 top-0 min-w-5 rounded-br-sm px-1 type-caption font-medium text-white" style={{ background: "var(--mark, #e4572e)" }}>{i + 1}</span>
        </button>
      ))}
    </div>
  );
}

function PieceRow({ id, n, row, tax, active, disabled, onInclude, onChange, onBox, onCrop, onUncrop, onMakeAi, onUseAi }: {
  id: string; n: number; row: Row; tax: Taxonomy | null; active: boolean; disabled: boolean;
  onInclude: (v: boolean) => void; onChange: (v: PieceFormValue) => void; onCrop: () => void; onUncrop: () => void;
  onMakeAi: () => void; onUseAi: (v: boolean) => void;
  onBox: (box: MultiBox) => void;
}) {
  const { t } = useI18n(); const v = row.value; const err = row.errors ?? {};
  const set = <K extends keyof PieceFormValue>(k: K, x: PieceFormValue[K]) => onChange({ ...v, [k]: x });
  const allowedOccasions = (c: string) => tax?.allowedOccasionsByCategory?.[c] ?? tax?.occasions ?? [];
  const categories = Object.keys(tax?.subcategories ?? {}).filter((c) => PIECE_CATEGORIES.includes(c) || c === v.category);
  const saved = row.status === "saved"; const locked = disabled || saved || !!row.aiBusy;
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
        {row.confidence > 0 && <p className="type-caption text-muted">{t("multiPiece.confianca_recorte", { pct: Math.round(row.confidence * 100) })}</p>}
        {!saved && <fieldset disabled={locked || row.aiBusy} className="grid grid-cols-2 gap-1">
          <legend className="type-caption">{t("multiPiece.ajustar_caixa")}</legend>
          {(["x", "y", "width", "height"] as const).map((key) => <Field key={key} label={t(`multiPiece.box_${key}`)} id={fid(key)}>
            <Input id={fid(key)} type="number" step="any" min={key === "width" || key === "height" ? 3 : 0} max={100} value={row.box[key]} onChange={(e) => {
              const v = Number(e.target.value); if (!Number.isFinite(v)) return;
              const box = { ...row.box, [key]: Math.max(key === "width" || key === "height" ? 3 : 0, Math.min(100, v)) };
              box.width = Math.min(box.width, 100); box.height = Math.min(box.height, 100);
              box.x = Math.min(box.x, 100 - box.width); box.y = Math.min(box.y, 100 - box.height);
              onBox(box);
            }} />
          </Field>)}
        </fieldset>}
        {!saved && (row.crop
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
        <Field label={t("common.brand")} id={fid("brand")} error={err.brandName} className="sm:col-span-2">
          <BrandAutocomplete id={fid("brand")} value={v.brandName} maxLength={60} onChange={(brandName, brand) => onChange({ ...v,
            brandName, brandId: brand?.id ?? null, brandLogoUrl: brand?.logoUrl ?? null,
            brandLogoWideUrl: null, brandDomain: null, brandEdgePx: null,
            brandSource: brand ? "CATALOGO" : null, brandRef: brand?.id ?? null,
          })} />
        </Field>
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
      <fieldset disabled={locked || !row.include} className="sm:col-span-2"><PieceMoreDetails idPrefix={`${id}-`} value={v} onChange={onChange} /></fieldset>
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
