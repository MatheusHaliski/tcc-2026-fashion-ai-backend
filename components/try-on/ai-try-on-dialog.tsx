"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Dialog, FileButton, Select, Switch } from "@/components/ui";
import { api, ApiError, mediaUrl } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import type { FittingItem } from "@/lib/tryon/fitting-room";

/** O que o FASHN veste (services/anatomical_vton/fashn_runtime.py · CATEGORIES): parte de cima, de baixo e peça inteira. */
const AI_CATEGORIES = new Set(["upper_piece", "lower_piece", "full_body_piece"]);
/** Limite do servidor da GPU: lados maiores voltam INVALID_VTON_IMAGE (o backend também reduz; aqui só poupa o envio). */
const MAX_SIDE = 1536;

/** Peças do provador que a prova com IA aceita: só do próprio guarda-roupa (a rota exige pieceId da pessoa). */
export function aiCandidates(items: FittingItem[]): FittingItem[] {
  return items.filter((i) => i.source === "wardrobe" && !!i.pieceId && AI_CATEGORIES.has(i.category));
}

interface Photo { url: string; preview: string }
interface Render { status?: string; url?: string; diagnostics?: { gpuName?: string; latencyMs?: number } }

/** Reduz a foto no navegador para no máximo 1536 px; sem canvas (ou se falhar), envia o arquivo original. */
async function fitted(file: File): Promise<Blob> {
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

/**
 * Prova com IA (FASHN VTON na GPU da Vertex, via worker): a peça do guarda-roupa vestida na foto da própria pessoa.
 * Fluxo: escolher a peça · enviar a foto (POST /api/try-on/person-photos) · consentir · gerar
 * (POST /api/try-on/anatomical-renders). O resultado é uma imagem 2D gerada: não certifica caimento nem tamanho.
 */
export function AiTryOnDialog({ open, onClose, items, onPickFromWardrobe }: {
  open: boolean; onClose: () => void; items: FittingItem[]; onPickFromWardrobe: () => void;
}) {
  const { t } = useI18n();
  const candidates = useMemo(() => aiCandidates(items), [items]);
  const [pieceId, setPieceId] = useState("");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<"upload" | "render" | null>(null);
  const [result, setResult] = useState<Render | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const piece = candidates.find((c) => c.pieceId === pieceId) ?? candidates[0] ?? null;
  useEffect(() => () => { abort.current?.abort(); if (photo) URL.revokeObjectURL(photo.preview); }, [photo]);

  function message(e: unknown): string {
    if (!(e instanceof ApiError)) return t("tryOn.ia_erro_indisponivel");
    if (e.code === "VTON_NOT_CONFIGURED") return t("tryOn.ia_erro_gpu_desligada");
    if (e.code === "VTON_IMAGE_SMALL") return t("tryOn.ia_erro_foto_pequena");
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
    if (!piece?.pieceId || !photo || !consent) return;
    abort.current?.abort();
    const controller = new AbortController(); abort.current = controller;
    setBusy("render"); setError(null); setResult(null);
    try {
      const r = await api.post<Render>("/api/try-on/anatomical-renders",
        { pieceId: piece.pieceId, personMediaUrl: photo.url, processingConsent: true, mirror: false }, { signal: controller.signal });
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
  return (
    <Dialog open={open} onClose={close} title={t("tryOn.ia_titulo")} size="lg"
      footer={(
        <>
          <Button onClick={close}>{busy === "render" ? t("common.cancel") : t("common.close")}</Button>
          <Button variant="primary" loading={busy === "render"} disabled={!piece || !photo || !consent || busy !== null} onClick={generate}>
            {t("tryOn.ia_gerar")}
          </Button>
        </>
      )}>
      <div className="grid gap-4 md:grid-cols-[minmax(220px,320px)_1fr]">
        <div className="ai-tryon-preview surface grid place-items-center overflow-hidden rounded-lg" aria-live="polite">
          {result?.url
            ? <img src={mediaUrl(result.url)} alt={t("tryOn.ia_resultado_alt", { name: piece?.name ?? "" })} className="w-full" />
            : photo
              ? <img src={photo.preview} alt={t("tryOn.ia_foto")} className="w-full opacity-80" />
              : <p className="type-body-sm text-muted p-6 text-center">{t("tryOn.ia_foto_dica")}</p>}
        </div>
        <div className="grid content-start gap-3">
          <p className="type-body-sm text-muted">{t("tryOn.ia_lead")}</p>
          {candidates.length === 0 ? (
            <div className="grid gap-2">
              <p className="type-body">{t("tryOn.ia_sem_peca")}</p>
              <Button size="sm" onClick={() => { close(); onPickFromWardrobe(); }}>{t("tryOn.ia_ir_guarda_roupa")}</Button>
            </div>
          ) : (
            <label className="grid gap-1">
              <span className="label">{t("tryOn.ia_peca")}</span>
              <Select value={piece?.pieceId ?? ""} onChange={(e) => { setPieceId(e.target.value); setResult(null); }} disabled={busy !== null}>
                {candidates.map((c) => <option key={c.key} value={c.pieceId}>{c.name}</option>)}
              </Select>
            </label>
          )}
          <div className="grid gap-1">
            <span className="label">{t("tryOn.ia_foto")}</span>
            <FileButton accept="image/jpeg,image/png,image/webp" onFiles={(files) => upload(files[0])} loading={busy === "upload"} disabled={busy !== null}>
              {photo ? t("tryOn.ia_nova_foto") : t("tryOn.ia_escolher_foto")}
            </FileButton>
            <p className="type-caption text-muted">{t("tryOn.ia_foto_dica")}</p>
          </div>
          <Switch checked={consent} onChange={setConsent} label={t("tryOn.ia_consentimento")} disabled={busy !== null} />
          {busy === "render" && <p className="type-body-sm" role="status">{t("tryOn.ia_gerando")}</p>}
          {error && <p className="type-body-sm text-danger" role="alert">{error}</p>}
          {result && seconds && <p className="type-caption text-muted">{t("tryOn.ia_diagnostico", { seconds, gpu: result.diagnostics?.gpuName ?? "—" })}</p>}
        </div>
      </div>
    </Dialog>
  );
}
