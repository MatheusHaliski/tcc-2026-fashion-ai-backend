"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Dialog, FileButton, SegmentPicker, Select, Switch } from "@/components/ui";
import { api, ApiError, mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import type { Page, PieceView } from "@/lib/api/types";

/** O que o FASHN veste (services/anatomical_vton/fashn_runtime.py · CATEGORIES): parte de cima, de baixo e peça inteira. */
export const GPU_CATEGORIES = ["full_body_piece", "lower_piece", "upper_piece"] as const;
export type GpuCategory = (typeof GPU_CATEGORIES)[number];
/** Limite do servidor da GPU: lados maiores voltam INVALID_VTON_IMAGE (o backend também reduz; aqui só poupa o envio). */
const MAX_SIDE = 1536;

/** Peça do próprio guarda-roupa que a prova na GPU pode vestir (a rota exige o id da peça da pessoa). */
export interface GpuPiece { pieceId: string; name: string; category: string }

export const isGpuCategory = (category?: string | null): category is GpuCategory => (GPU_CATEGORIES as readonly string[]).includes(category ?? "");

/** O look que vai para a GPU: uma peça por tipo (a primeira de cada), como o servidor faz; o resto não entra. */
export function gpuLook(pieces: GpuPiece[]): GpuPiece[] {
  const byCategory = new Map<string, GpuPiece>();
  for (const p of pieces) if (isGpuCategory(p.category) && !byCategory.has(p.category)) byCategory.set(p.category, p);
  return GPU_CATEGORIES.flatMap((c) => byCategory.get(c) ?? []);
}

/**
 * Motivo da recusa (código curto que a GPU devolve em details.reason) → o que a pessoa corrige. Códigos desconhecidos
 * caem na mensagem geral; o texto do servidor nunca aparece cru.
 */
export function refusalKey(reason?: unknown): string | null {
  switch (typeof reason === "string" ? reason : "") {
    case "EXACTLY_ONE_PERSON_WITH_POSE_REQUIRED": case "INVALID_PERSON_DETECTION": return "tryOn.ia_motivo.pessoa";
    case "INSUFFICIENT_SHARED_BODY_LANDMARKS": case "NONFINITE_DWPOSE": return "tryOn.ia_motivo.corpo";
    case "VISIBLE_LANDMARK_OUTSIDE_IMAGE": return "tryOn.ia_motivo.fora";
    case "INVALID_VTON_IMAGE": case "INVALID_PREDICTION_INPUT": return "tryOn.ia_motivo.foto";
    case "GENERATED_POSE_DRIFT_REJECTED": case "DEGENERATE_GENERATED_IMAGE": case "ONE_GENERATED_IMAGE_REQUIRED": return "tryOn.ia_motivo.resultado";
    case "INVALID_GARMENT_POSE": case "MULTIPLE_GARMENT_MODELS_REJECTED": return "tryOn.ia_motivo.peca";
    case "FASHN_CATEGORY_NOT_SUPPORTED": case "TASK_NOT_SUPPORTED_BY_MODEL": return "tryOn.ia_motivo.categoria";
    case "GPU_BUSY_RETRY_LATER": case "GPU_MEMORY_EXHAUSTED_REDUCE_WORKLOAD": case "GPU_PREDICTION_FAILED": case "MODEL_NOT_READY": return "tryOn.ia_motivo.gpu";
    default: return null;
  }
}

interface Photo { url: string; preview: string }
interface Render {
  status?: string; url?: string; diagnostics?: { gpuName?: string; latencyMs?: number };
  steps?: { pieceId: string; category: string; url: string }[]; skipped?: string[];
}

/** Reduz a foto no navegador para no máximo 1536 px; sem canvas (ou se falhar), envia o arquivo original. */
export async function fitted(file: File): Promise<Blob> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.type === "image/jpeg") { bitmap.close?.(); return file; }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.9));
  } catch {
    return file;
  }
}

type Zone = GpuCategory;
const ZONE_LABEL: Record<Zone, string> = { full_body_piece: "tryOn.ia_zona.full", lower_piece: "tryOn.ia_zona.lower", upper_piece: "tryOn.ia_zona.upper" };

/**
 * Foto realista na GPU (FASHN VTON na Vertex, via worker): as peças do guarda-roupa vestidas na foto da própria pessoa.
 * Um componente para o Avatar 3D, o Provador e o espelho do Meu Quarto:
 *  - `pieces` dado (Provador, espelho): o look que está sendo provado — "Look inteiro" (uma peça por tipo, vestidas em
 *    sequência: inteira → baixo → cima, POST /api/try-on/look-renders) ou "Uma peça" (POST /api/try-on/anatomical-renders);
 *  - sem `pieces` (Avatar 3D): a pessoa monta o look aqui, escolhendo do guarda-roupa uma peça por tipo.
 * A foto vai para /api/try-on/person-photos e só é processada com o consentimento. O resultado é uma imagem 2D gerada:
 * não certifica caimento nem tamanho. Calçados e acessórios o modelo não veste (ficam de fora, avisado).
 */
export function GpuLookDialog({ open, onClose, pieces, onPickFromWardrobe, title, emptyText }: {
  open: boolean; onClose: () => void; pieces?: GpuPiece[]; onPickFromWardrobe?: () => void; title?: string; emptyText?: string;
}) {
  const { t } = useI18n();
  const fromWardrobe = pieces === undefined;
  const [closet, setCloset] = useState<GpuPiece[] | null>(null);
  const [zones, setZones] = useState<Partial<Record<Zone, string>>>({});
  const candidates = useMemo(() => (pieces ?? closet ?? []).filter((p) => isGpuCategory(p.category)), [pieces, closet]);
  const look = useMemo(() => fromWardrobe
    ? GPU_CATEGORIES.flatMap((z) => candidates.find((p) => p.pieceId === zones[z]) ?? [])
    : gpuLook(candidates), [fromWardrobe, candidates, zones]);
  const [mode, setMode] = useState<"look" | "piece">("look");
  const [pieceId, setPieceId] = useState("");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<"upload" | "render" | null>(null);
  const [result, setResult] = useState<Render | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  // Avatar 3D: o guarda-roupa da pessoa, só o que a GPU veste
  useEffect(() => {
    if (!open || !fromWardrobe || closet) return;
    const controller = new AbortController();
    // uma página por tipo (o closet devolve até 60 por página): calçados e acessórios não tiram lugar das peças que a GPU veste
    Promise.all(GPU_CATEGORIES.map((category) => api.get<Page<PieceView>>(`/api/me/closet?category=${category}&size=60`, { signal: controller.signal })))
      .then((pages) => setCloset(pages.flatMap((page) => page.items ?? []).map((p) => ({ pieceId: p.id, name: p.name, category: p.category }))))
      .catch(() => { if (!controller.signal.aborted) setCloset([]); });
    return () => controller.abort();
  }, [open, fromWardrobe, closet]);

  // com uma peça só não há o que escolher entre look e peça: vai direto para a peça
  const single = !fromWardrobe && look.length <= 1;
  const effectiveMode = fromWardrobe ? "look" : single ? "piece" : mode;
  const piece = candidates.find((c) => c.pieceId === pieceId) ?? candidates[0] ?? null;
  const ready = !!photo && consent && (effectiveMode === "look" ? look.length > 0 : !!piece);
  useEffect(() => () => { abort.current?.abort(); if (photo) URL.revokeObjectURL(photo.preview); }, [photo]);

  function message(e: unknown): string {
    if (!(e instanceof ApiError)) return t("tryOn.ia_erro_indisponivel");
    const reason = refusalKey(e.details?.reason);
    if (reason) return t(reason);
    if (e.code === "VTON_NOT_CONFIGURED") return t("tryOn.ia_erro_gpu_desligada");
    if (e.code === "VTON_IMAGE_SMALL") return t("tryOn.ia_erro_foto_pequena");
    if (e.code === "VTON_LOOK_WITHOUT_GARMENT") return t("tryOn.ia_motivo.categoria");
    if (e.status === 404) return t("tryOn.ia_erro_indisponivel");
    if (e.status === 422) return t("tryOn.ia_erro_recusada");
    return e.message || t("tryOn.ia_erro_indisponivel");
  }

  async function upload(file: File) {
    setBusy("upload"); setError(null); setResult(null);
    try {
      const form = new FormData();
      form.append("file", await fitted(file), "pessoa.jpg");
      const saved = await api.upload<{ url: string }>("/api/try-on/person-photos", form);
      setPhoto({ url: saved.url, preview: URL.createObjectURL(file) });  // a prévia anterior é revogada pelo efeito
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    if (!ready || !photo) return;
    abort.current?.abort();
    const controller = new AbortController(); abort.current = controller;
    setBusy("render"); setError(null); setResult(null);
    try {
      const r = effectiveMode === "look"
        ? await api.post<Render>("/api/try-on/look-renders",
          { pieceIds: look.map((p) => p.pieceId), personMediaUrl: photo.url, processingConsent: true }, { signal: controller.signal })
        : await api.post<Render>("/api/try-on/anatomical-renders",
          { pieceId: piece!.pieceId, personMediaUrl: photo.url, processingConsent: true, mirror: false }, { signal: controller.signal });
      if (r.status === "READY" && r.url) setResult(r);
      else setError(t("tryOn.ia_erro_recusada"));
    } catch (e) {
      if (!controller.signal.aborted) setError(message(e));
    } finally {
      if (abort.current === controller) { abort.current = null; setBusy(null); }
    }
  }

  function close() { abort.current?.abort(); onClose(); }

  const seconds = result?.diagnostics?.latencyMs ? Math.max(1, Math.round(result.diagnostics.latencyMs / 1000)) : null;
  const left = (pieces ?? []).filter((p) => !isGpuCategory(p.category));
  const resultAlt = effectiveMode === "look" ? t("tryOn.ia_resultado_look_alt") : t("tryOn.ia_resultado_alt", { name: piece?.name ?? "" });
  const empty = candidates.length === 0 && (!fromWardrobe || closet !== null);
  return (
    <Dialog open={open} onClose={close} title={title ?? t("tryOn.ia_titulo")} size="lg"
      footer={(
        <>
          <Button onClick={close}>{busy === "render" ? t("common.cancel") : t("common.close")}</Button>
          <Button variant="primary" loading={busy === "render"} disabled={!ready || busy !== null} onClick={generate}>
            {t("tryOn.ia_gerar")}
          </Button>
        </>
      )}>
      <div className="grid gap-4 md:grid-cols-[minmax(220px,320px)_1fr]">
        <div className="ai-tryon-preview surface grid place-items-center overflow-hidden rounded-lg" aria-live="polite">
          {result?.url
            ? <img src={mediaUrl(result.url)} alt={resultAlt} className="w-full" />
            : photo
              ? <img src={photo.preview} alt={t("tryOn.ia_foto")} className="w-full opacity-80" />
              : <p className="type-body-sm text-muted p-6 text-center">{t("tryOn.ia_foto_dica")}</p>}
        </div>
        <div className="grid content-start gap-3">
          <p className="type-body-sm text-muted">{t("tryOn.ia_lead")}</p>
          {fromWardrobe && closet === null && <p className="type-body-sm text-muted" role="status">{t("tryOn.ia_carregando_pecas")}</p>}
          {empty ? (
            <div className="grid gap-2">
              <p className="type-body">{emptyText ?? (fromWardrobe ? t("tryOn.ia_sem_peca_guarda_roupa") : t("tryOn.ia_sem_peca"))}</p>
              {onPickFromWardrobe && <Button size="sm" onClick={() => { close(); onPickFromWardrobe(); }}>{t("tryOn.ia_ir_guarda_roupa")}</Button>}
            </div>
          ) : fromWardrobe ? (
            <fieldset className="grid gap-2" disabled={busy !== null}>
              <legend className="label">{t("tryOn.ia_monte_look")}</legend>
              {GPU_CATEGORIES.map((zone) => {
                const options = candidates.filter((p) => p.category === zone);
                if (!options.length) return null;
                return (
                  <label key={zone} className="grid gap-1">
                    <span className="type-caption text-muted">{t(ZONE_LABEL[zone])}</span>
                    <Select aria-label={t(ZONE_LABEL[zone])} value={zones[zone] ?? ""} disabled={busy !== null}
                      onChange={(e) => { setZones((z) => ({ ...z, [zone]: e.target.value || undefined })); setResult(null); }}>
                      <option value="">{t("tryOn.ia_zona_nenhuma")}</option>
                      {options.map((p) => <option key={p.pieceId} value={p.pieceId}>{p.name}</option>)}
                    </Select>
                  </label>
                );
              })}
            </fieldset>
          ) : (
            <>
              {!single && (
                <SegmentPicker label={t("tryOn.ia_modo")} value={mode} onChange={(m) => { setMode(m); setResult(null); }}
                  options={[{ id: "look", label: t("tryOn.ia_modo_look", { n: look.length }) }, { id: "piece", label: t("tryOn.ia_modo_peca") }]} />
              )}
              {effectiveMode === "look"
                ? <p className="type-body-sm">{look.map((p) => p.name).join(" · ")}</p>
                : (
                  <label className="grid gap-1">
                    <span className="label">{t("tryOn.ia_peca")}</span>
                    <Select aria-label={t("tryOn.ia_peca")} value={piece?.pieceId ?? ""} onChange={(e) => { setPieceId(e.target.value); setResult(null); }} disabled={busy !== null}>
                      {candidates.map((c) => <option key={c.pieceId} value={c.pieceId}>{c.name}</option>)}
                    </Select>
                  </label>
                )}
              {effectiveMode === "look" && left.length > 0 && <p className="type-caption text-muted">{t("tryOn.ia_fora_da_foto", { names: left.map((p) => p.name).join(", ") })}</p>}
            </>
          )}
          <div className="grid gap-1">
            <span className="label">{t("tryOn.ia_foto")}</span>
            <FileButton accept="image/jpeg,image/png,image/webp" onFiles={(files) => upload(files[0])} loading={busy === "upload"} disabled={busy !== null}>
              {photo ? t("tryOn.ia_nova_foto") : t("tryOn.ia_escolher_foto")}
            </FileButton>
            <p className="type-caption text-muted">{t("tryOn.ia_foto_dica")}</p>
          </div>
          <Switch checked={consent} onChange={setConsent} label={t("tryOn.ia_consentimento")} disabled={busy !== null} />
          {busy === "render" && <p className="type-body-sm" role="status">{t(effectiveMode === "look" && look.length > 1 ? "tryOn.ia_gerando_look" : "tryOn.ia_gerando")}</p>}
          {error && <p className="type-body-sm text-danger" role="alert">{error}</p>}
          {result && seconds && <p className="type-caption text-muted">{t("tryOn.ia_diagnostico", { seconds, gpu: result.diagnostics?.gpuName ?? "—" })}</p>}
          {result?.steps && result.steps.length > 1 && <p className="type-caption text-muted">{t("tryOn.ia_etapas", { n: result.steps.length })}</p>}
        </div>
      </div>
    </Dialog>
  );
}
