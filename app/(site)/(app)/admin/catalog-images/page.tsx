"use client";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { catalogApi, type CatalogCardImage, type CatalogProductImage, type NormRect } from "@/lib/api/catalog";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { RequireAuth } from "@/components/app-shell";
import { Badge, Button, EmptyState, PageHeader, Skeleton, useToast } from "@/components/ui";
import { CatalogPhoto, photoAspect } from "@/components/catalog/catalog-photo";

interface Debug { bbox?: NormRect; focus?: NormRect; finalCrop?: NormRect; critical?: { name: string; rect: NormRect }[]; distractors?: NormRect[]; candidates?: { crop: NormRect; score: number }[] }
interface ReviewItem {
  id: string; productId: string; sourceUrl: string; processedUrl?: string | null; viewType?: string; viewRole?: string | null; canonical: boolean;
  processingStatus: string; reviewStatus: string; qualityScore?: number | null; reasons: string[]; width?: number; height?: number;
  crop?: { aspect?: string; crop?: NormRect; background?: string; focus?: { name: string; rect: NormRect } } | null;
  metrics?: (Record<string, number | string | boolean | unknown> & { debug?: Debug }) | null; assets?: Record<string, string> | null;
}
interface Metrics { pipelineVersion: string; enabled: boolean; byStatus: Record<string, number>; canonical: number; reviewPending: number; averageQuality?: number | null; topRejectionReasons: { reasons: string; count: number }[] }
const SHOWN = ["segmentationConfidence", "productVisibility", "occupancyScore", "focusScore", "cropScore", "edgeQuality", "humanResidueScore", "objectResidueScore", "sourceQuality"];

/** Retângulo normalizado → SVG (viewBox 0–1 esticado sobre a foto, traço sem escala). */
function Box({ r, color, dash, width = 2 }: { r?: NormRect; color: string; dash?: string; width?: number }) {
  if (!r) return null;
  return <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke={color} strokeWidth={width} strokeDasharray={dash} vectorEffect="non-scaling-stroke" />;
}

/** Antes: foto original com bbox (azul), distratores (vermelho), foco (verde), regiões críticas (laranja), candidatos e recorte final (preto). */
function DebugOverlay({ item }: { item: ReviewItem }) {
  const d = item.metrics?.debug ?? {};
  return (
    <figure className="cip-stage">
      <img src={item.sourceUrl} alt="" loading="lazy" />
      <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
        {(d.candidates ?? []).slice(1).map((c, i) => <Box key={i} r={c.crop} color="rgba(120,120,120,.6)" dash="2 3" width={1} />)}
        <Box r={d.bbox} color="#2563eb" />
        {(d.distractors ?? []).map((r, i) => <Box key={i} r={r} color="#dc2626" />)}
        {(d.critical ?? []).map((c) => <Box key={c.name} r={c.rect} color="#ea580c" dash="4 3" />)}
        <Box r={d.focus} color="#16a34a" width={3} />
        <Box r={d.finalCrop} color="#111" width={3} />
      </svg>
    </figure>
  );
}

function ReviewCard({ item, onDone }: { item: ReviewItem; onDone: () => void }) {
  const { t } = useI18n(); const toast = useToast();
  const [alternates, setAlternates] = useState<CatalogProductImage[] | null>(null);
  const after: CatalogCardImage | null = item.assets?.card ? { url: item.assets.card, mode: "PROCESSED", aspect: item.crop?.aspect }
    : item.crop?.crop ? { url: item.sourceUrl, mode: "SEMANTIC_CROP", crop: item.crop.crop, background: item.crop.background, aspect: item.crop.aspect } : null;
  async function decide(action: string, alternateImageId?: string) {
    try { await api.post(`/api/admin/catalog-images/${item.id}/review`, { action, alternateImageId }); toast.success(t("admin.catalogImages.decidido")); onDone(); } catch (e) { toast.fromError(e); }
  }
  async function loadAlternates() {
    try { const p = await catalogApi.product(item.productId); setAlternates((p.images ?? []).filter((i) => i.id !== item.id)); } catch (e) { toast.fromError(e); }
  }
  return (
    <li className="surface grid gap-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="mark">{item.processingStatus}</Badge>{item.viewType && <Badge>{item.viewType}</Badge>}
        {item.qualityScore != null && <Badge tone="thread">{t("admin.catalogImages.qualidade", { pct: Math.round(Number(item.qualityScore) * 100) })}</Badge>}
        {item.reasons.map((r) => <Badge key={r} tone="chalk">{r}</Badge>)}
      </div>
      <div className="cip-compare">
        <div><p className="type-caption text-muted">{t("admin.catalogImages.antes")}</p><DebugOverlay item={item} /></div>
        <div><p className="type-caption text-muted">{t("admin.catalogImages.depois")}</p><div className="cip-frame" style={{ aspectRatio: photoAspect(after?.aspect) }}>{after ? <CatalogPhoto image={after} alt="" /> : <EmptyState title={t("admin.catalogImages.sem_recorte")} />}</div></div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {SHOWN.filter((k) => typeof item.metrics?.[k] === "number").map((k) => <div key={k} className="flex justify-between gap-2"><dt className="type-caption text-muted">{k}</dt><dd className="type-data">{Math.round(Number(item.metrics![k]) * 100)}%</dd></div>)}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={() => decide("APPROVE")}>{t("common.aprovar")}</Button>
        <Button size="sm" onClick={() => decide("REPROCESS")}>{t("admin.catalogImages.reprocessar")}</Button>
        <Button size="sm" onClick={loadAlternates}>{t("admin.catalogImages.escolher_outra")}</Button>
        <Button size="sm" variant="danger" onClick={() => decide("REJECT")}>{t("common.rejeitar")}</Button>
      </div>
      {alternates && (alternates.length === 0 ? <p className="type-body-sm text-muted">{t("admin.catalogImages.sem_alternativas")}</p> : (
        <ul className="flex flex-wrap gap-2">{alternates.map((a) => (
          <li key={a.id}><button type="button" className="grid gap-1 text-left" onClick={() => decide("SELECT_ALTERNATE_IMAGE", a.id)}>
            <span className="cip-frame block w-28"><CatalogPhoto fallbackUrl={a.processedUrl ?? a.url} alt="" /></span>
            <span className="type-caption text-muted">{a.viewType ?? a.type} · {a.processingStatus ?? "—"}</span>
          </button></li>))}
        </ul>))}
    </li>
  );
}

function CatalogImages() {
  const { t } = useI18n();
  const metrics = useApi<Metrics>((signal) => api.get("/api/admin/catalog-images/metrics", { signal }), []);
  const queue = useApi<{ items: ReviewItem[]; pending: number }>((signal) => api.get("/api/admin/catalog-images/review?limit=30", { signal }), []);
  const m = metrics.data;
  const reload = () => { queue.reload(); metrics.reload(); };
  return (
    <>
      <PageHeader title={t("admin.catalogImages.titulo")} kicker={t("admin.catalogImages.kicker")} lead={t("admin.catalogImages.lead")} />
      {m && (
        <section className="surface mb-4 grid gap-2 p-3" aria-label={t("admin.catalogImages.painel")}>
          <p className="type-body-sm">{m.pipelineVersion} · {m.enabled ? t("admin.catalogImages.worker_ligado") : t("admin.catalogImages.worker_desligado")}</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(m.byStatus).map(([k, v]) => <Badge key={k}>{k}: {v}</Badge>)}
            <Badge tone="thread">{t("admin.catalogImages.canonicas", { n: m.canonical })}</Badge>
            <Badge tone="mark">{t("admin.catalogImages.na_fila", { n: m.reviewPending })}</Badge>
            {m.averageQuality != null && <Badge>{t("admin.catalogImages.qualidade", { pct: Math.round(m.averageQuality * 100) })}</Badge>}
          </div>
          {m.topRejectionReasons.length > 0 && <p className="type-caption text-muted">{t("admin.catalogImages.motivos")}: {m.topRejectionReasons.map((r) => `${r.reasons} (${r.count})`).join(" · ")}</p>}
        </section>
      )}
      {queue.loading ? <Skeleton className="h-40" /> : (queue.data?.items ?? []).length === 0 ? <EmptyState title={t("admin.catalogImages.fila_vazia")} />
        : <ul className="grid gap-3">{queue.data!.items.map((i) => <ReviewCard key={i.id} item={i} onDone={reload} />)}</ul>}
    </>
  );
}
export default function CatalogImagesPage() { return <RequireAuth admin><CatalogImages /></RequireAuth>; }
