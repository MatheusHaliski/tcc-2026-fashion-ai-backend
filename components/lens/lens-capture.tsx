"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/i18n";
import { ApiError } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { lensApi } from "@/lib/lens/api";
import { redactFaces, type RedactResult } from "@/lib/lens/redact";
import type { LensSource } from "@/lib/lens/types";
import { FaiIcon } from "@/components/fai-icon";
import { Button, Chip, EmptyState, ErrorState, PageHeader, Pagination, SegmentPicker, SkeletonGrid, cn } from "@/components/ui";
import { LensScanCard } from "./lens-scan-card";

type View = "camera" | "gallery" | "recent";
const VIEWS: View[] = ["camera", "gallery", "recent"];
const parseView = (v: string | null): View => ((VIEWS as string[]).includes(v ?? "") ? (v as View) : "camera");

const objectUrl = (b: Blob) => (typeof URL.createObjectURL === "function" ? URL.createObjectURL(b) : null);
const revoke = (u: string | null) => { if (u && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(u); };

/** Entrada de arquivo com cara de botão grande (o input fica acessível e testável; o rótulo é o alvo de toque). */
function PickButton({ camera, onFile, disabled }: { camera?: boolean; onFile: (f: File) => void; disabled?: boolean }) {
  const { t } = useI18n();
  const name = camera ? t("lens.capture.camera") : t("lens.capture.gallery");
  return (
    <label className={cn("lens-capture-btn", disabled && "is-disabled")}>
      <input type="file" accept="image/*" capture={camera ? "environment" : undefined} className="sr-only" aria-label={name} disabled={disabled}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      <span className="lens-capture-icon" aria-hidden><FaiIcon id={camera ? "ACT-08" : "ACT-07"} size={32} decorative /></span>
      <span className="lens-capture-text">
        <b>{name}</b>
        <span>{camera ? t("lens.capture.camera_hint") : t("lens.capture.gallery_hint")}</span>
      </span>
    </label>
  );
}

/** Mensagem do erro do envio em texto: cota do dia, consentimento, moderação, tamanho ou a do backend. */
function sendProblem(e: unknown, t: (k: string) => string): string {
  if (!(e instanceof ApiError)) return t("lens.capture.error");
  if (e.status === 429 || /QUOTA|COTA/i.test(e.code)) return t("lens.state.quota_hint");
  if (/CONSENT/i.test(e.code)) return t("lens.state.consent_hint");
  if (e.status === 413) return t("lens.capture.too_large");
  if (e.status === 0) return t("lens.capture.offline");
  return e.message || t("lens.capture.error");
}

/**
 * Prévia + proteção + "Analisar": a foto já vem com os rostos borrados no aparelho. Sem detector (faces = -1), o
 * envio exige a confirmação explícita da pessoa.
 */
function Review({ file, source, onReset }: { file: File; source: LensSource; onReset: () => void }) {
  const { t } = useI18n(); const router = useRouter(); const checkId = useId();
  const [result, setResult] = useState<RedactResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    let alive = true; let made: string | null = null;
    setResult(null); setConfirmed(false); setProblem(null);
    redactFaces(file).then((r) => {
      if (!alive) return;
      made = objectUrl(r.blob); setPreview(made); setResult(r);
    }).catch(() => { if (alive) setResult({ blob: file, faces: -1, width: 0, height: 0 }); });
    return () => { alive = false; revoke(made); };
  }, [file]);

  const unknown = !!result && result.faces < 0;
  const ready = !!result && (!unknown || confirmed);
  async function analyze() {
    if (!result || !ready) return;
    setSending(true); setProblem(null);
    try {
      // redactionConfirmed: o borrão rodou aqui (faces ≥ 0) ou a pessoa confirmou que não há rostos — sem isso o servidor
      // faz só a leitura local e a foto não vai à IA online
      const scan = await lensApi.create({ image: result.blob, source, intent: "IDENTIFY", facesRedacted: Math.max(0, result.faces), redactionConfirmed: !unknown || confirmed });
      router.push(`/lens/${encodeURIComponent(scan.id)}`);
    } catch (e) { setProblem(sendProblem(e, t)); setSending(false); }
  }
  return (
    <section className="surface lens-review" aria-label={t("lens.capture.review")}>
      <div className="lens-review-media">
        {preview ? <img src={preview} alt={t("lens.capture.preview_alt")} className="lens-review-img" />
          : <div className="lens-review-img is-empty" role="img" aria-label={t("lens.capture.preview_alt")} />}
      </div>
      <div className="lens-review-body">
        {!result ? <p className="lens-redaction" role="status" aria-live="polite">{t("lens.redaction.running")}</p>
          : result.faces > 0 ? <p className="lens-redaction is-done" role="status">{t("lens.redaction.blurred", { n: result.faces })}</p>
          : result.faces === 0 ? <p className="lens-redaction is-done" role="status">{t("lens.redaction.none")}</p>
          : (
            <div className="lens-redaction is-warn" role="status">
              <p>{t("lens.redaction.unavailable")}</p>
              <label htmlFor={checkId} className="lens-confirm">
                <input id={checkId} type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                <span>{t("lens.redaction.confirm")}</span>
              </label>
            </div>
          )}
        <p className="type-caption text-muted">{t("lens.capture.privacy")}</p>
        {problem && <p className="error-text" role="alert">{problem}</p>}
        <div className="lens-review-actions">
          <Button variant="primary" onClick={analyze} loading={sending} disabled={!ready}>{sending ? t("lens.capture.sending") : t("lens.capture.analyze")}</Button>
          <Button variant="ghost" onClick={onReset} disabled={sending}>{t("lens.capture.change")}</Button>
        </div>
        {unknown && !confirmed && <p className="type-caption text-muted">{t("lens.redaction.confirm_needed")}</p>}
      </div>
    </section>
  );
}

/** Recentes: os scans da pessoa (privados), com o filtro "Salvos" (restringe a lista; não é aba). */
function Recent() {
  const { t } = useI18n();
  const [saved, setSaved] = useState(false); const [page, setPage] = useState(0);
  const list = useApi((signal) => lensApi.list({ saved, page, size: 12 }, signal), [saved, page]);
  const items = list.data?.items ?? [];
  return (
    <section aria-label={t("lens.capture.recent")}>
      <div className="lens-tab-tools">
        <Chip active={saved} onClick={() => { setSaved((v) => !v); setPage(0); }}>{t("lens.recent.saved_only")}</Chip>
      </div>
      {list.loading ? <><span className="sr-only">{t("lens.recent.loading")}</span><SkeletonGrid n={6} h="h-40" /></>
        : list.error ? <ErrorState error={list.error} onRetry={list.reload} />
        : items.length ? (
          <>
            <div className="grid-cards lens-scan-grid">{items.map((s) => <LensScanCard key={s.id} scan={s} />)}</div>
            {(list.data!.hasMore || page > 0) && <Pagination page={page} hasMore={list.data!.hasMore} onPage={setPage} total={list.data!.total} size={list.data!.size} />}
          </>
        ) : <EmptyState title={saved ? t("lens.recent.empty_saved") : t("lens.recent.empty")} hint={t("lens.recent.empty_hint")} />}
    </section>
  );
}

/**
 * /lens — captura (RF54 §6.1): Câmera · Galeria · Recentes. Câmera = input com capture="environment" (sem
 * getUserMedia no MVP); Galeria = arquivo normal. Depois: prévia com os rostos borrados → Analisar → /lens/{id}.
 */
export function LensCapture() {
  const { t } = useI18n(); const sp = useSearchParams(); const router = useRouter();
  const [view, setView] = useState<View>(() => parseView(sp.get("view")));
  const [picked, setPicked] = useState<{ file: File; source: LensSource; n: number } | null>(null);
  const counter = useRef(0);
  useEffect(() => { setView(parseView(sp.get("view"))); }, [sp]);
  const changeView = (v: View) => { setView(v); router.replace(v === "camera" ? "/lens" : `/lens?view=${v}`, { scroll: false }); };
  const choose = (source: LensSource) => (file: File) => setPicked({ file, source, n: ++counter.current });
  return (
    <>
      <PageHeader title={t("lens.title")} lead={t("lens.lead")} />
      <SegmentPicker label={t("lens.capture.label")} value={view} onChange={changeView} className="lens-segments"
        options={[{ id: "camera", label: t("lens.capture.tab_camera") }, { id: "gallery", label: t("lens.capture.tab_gallery") }, { id: "recent", label: t("lens.capture.tab_recent") }]} />
      <div className="lens-capture">
        {view === "recent" ? <Recent /> : (
          <>
            {!picked && <PickButton camera={view === "camera"} onFile={choose(view === "camera" ? "CAMERA" : "GALLERY")} />}
            {picked && <Review key={picked.n} file={picked.file} source={picked.source} onReset={() => setPicked(null)} />}
            <ul className="lens-tips">
              <li>{t("lens.tips.frame")}</li><li>{t("lens.tips.light")}</li><li>{t("lens.tips.private")}</li>
            </ul>
          </>
        )}
      </div>
    </>
  );
}
