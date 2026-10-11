"use client";
import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { RequireAuth } from "@/components/app-shell";
import { api, mediaUrl } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { SLOT_LABELS, type CreatorBlock } from "@/components/room3d/wardrobe-creator";
import { Badge, Button, Dialog, EmptyState, ErrorState, Field, Input, PageHeader, Select, Skeleton, useToast } from "@/components/ui";

const ModelViewer = dynamic(() => import("@/components/room3d/piece-model-viewer"), { ssr: false, loading: () => <Skeleton className="h-80" /> });
interface Job { id: string; status: string; input: { command: { name: string; slotType: string; pricePoints: number }; referenceUrl: string }; result: { review: string; progress: number; sku?: string }; modelUrl?: string | null; errorCode?: string | null }
interface Assets { available: boolean; items: Job[]; blocks: CreatorBlock[]; levels: string[] }

export default function RoomAssetsPage() { return <RequireAuth admin><RoomAssets /></RequireAuth>; }
function RoomAssets() {
  const { t } = useI18n(); const toast = useToast();
  const query = useApi<Assets>((signal) => api.get("/api/admin/room-assets", { signal }), [], { refreshInterval: 5000 });
  const [name, setName] = useState(""); const [block, setBlock] = useState(""); const [price, setPrice] = useState("100");
  const [level, setLevel] = useState("ESTREIA"); const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false); const [preview, setPreview] = useState<Job | null>(null);
  // Keep the key after a failed HTTP response: retrying the same request must not queue another paid generation.
  const requestId = useRef<string | null>(null);
  const blocks = query.data?.blocks ?? []; const chosen = blocks.find((b) => b.moldId === block) ?? blocks[0];
  function changed() { requestId.current = null; }
  async function generate(e: React.FormEvent) {
    e.preventDefault(); if (!image || !chosen || busy) return;
    if (image.size > 8 * 1024 * 1024) { toast.error(t("roomAssets.imageLimit")); return; }
    setBusy(true); requestId.current ??= crypto.randomUUID();
    try {
      const form = new FormData(); form.append("image", image);
      form.append("command", JSON.stringify({ requestId: requestId.current, name: name.trim(),
        slotType: chosen.slotType, moldId: chosen.moldId, widthCm: chosen.widthCm, pricePoints: Number(price), requiredLevel: level }));
      await api.upload("/api/admin/room-assets", form); toast.success(t("roomAssets.queued"));
      requestId.current = null; setName(""); setImage(null); query.reload();
    } catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  async function act(job: Job, action: "approve" | "reject" | "publish") {
    if (busy) return; setBusy(true);
    try { await api.post(`/api/admin/room-assets/${job.id}/${action === "publish" ? "publish" : "review"}`, action === "publish" ? {} : { approve: action === "approve" }); query.reload(); }
    catch (e) { toast.fromError(e); } finally { setBusy(false); }
  }
  return <>
    <PageHeader title={t("roomAssets.title")} lead={t("roomAssets.subtitle")} />
    {query.error && <ErrorState error={query.error} onRetry={query.reload} />}
    <form onSubmit={generate} className="surface mb-4 grid gap-3 p-4 sm:grid-cols-2">
      <p className="type-body-sm text-muted sm:col-span-2">{t("roomAssets.credits")}</p>
      {query.data && !query.data.available && <p role="status" className="type-body-sm text-mark sm:col-span-2">{t("roomAssets.unavailable")}</p>}
      <Field label={t("common.nome")}><Input value={name} required maxLength={120} disabled={busy} onChange={(e) => { setName(e.target.value); changed(); }} /></Field>
      <Field label={t("roomAssets.block")}><Select value={chosen?.moldId ?? ""} disabled={busy} onChange={(e) => { setBlock(e.target.value); const b = blocks.find(b => b.moldId === e.target.value); if (b) setLevel(b.minLevel); changed(); }}>{blocks.map(b => <option key={b.moldId} value={b.moldId}>{SLOT_LABELS[b.slotType] ?? b.slotType} · {b.moldId}</option>)}</Select></Field>
      <Field label={t("roomAssets.price")}><Input type="number" value={price} min={1} max={1000000} required disabled={busy} onChange={(e) => { setPrice(e.target.value); changed(); }} /></Field>
      <Field label={t("roomAssets.level")}><Select value={level} disabled={busy} onChange={(e) => { setLevel(e.target.value); changed(); }}>{(query.data?.levels ?? []).map(l => <option key={l}>{l}</option>)}</Select></Field>
      <Field label={t("roomAssets.reference")}><Input type="file" accept="image/png,image/jpeg,image/webp" required disabled={busy} onChange={(e) => { setImage(e.target.files?.[0] ?? null); changed(); }} /></Field>
      <div className="flex items-end"><Button type="submit" variant="primary" disabled={busy || !query.data?.available || !image || !name.trim()}>{t("roomAssets.generate")}</Button></div>
    </form>
    {query.loading && !query.data ? <Skeleton className="h-40" /> : !query.data?.items.length ? <EmptyState title={t("roomAssets.empty")} /> : <ul className="grid gap-3 sm:grid-cols-2">{query.data.items.map(job => <li key={job.id} className="surface grid gap-2 p-4">
      <div className="flex gap-3"><img src={mediaUrl(job.input.referenceUrl) ?? undefined} alt="" className="h-20 w-20 rounded object-contain" /><div><h2 className="type-body font-semibold">{job.input.command.name}</h2><Badge>{t(`roomAssets.status.${job.status}`)} · {job.result.progress}%</Badge><p className="type-caption text-muted">{job.result.sku ?? job.errorCode ?? t(`roomAssets.review.${job.result.review}`)}</p></div></div>
      <div className="flex flex-wrap gap-2">{job.modelUrl && <Button size="sm" onClick={() => setPreview(job)}>{t("roomAssets.preview")}</Button>}
        {job.status === "COMPLETED" && !job.result.sku && <><Button size="sm" disabled={busy} onClick={() => act(job, "approve")}>{t("common.aprovar")}</Button><Button size="sm" disabled={busy} variant="danger" onClick={() => act(job, "reject")}>{t("common.rejeitar")}</Button><Button size="sm" variant="primary" disabled={busy || job.result.review !== "APPROVED"} onClick={() => act(job, "publish")}>{t("roomAssets.publish")}</Button></>}
      </div>
    </li>)}</ul>}
    <Dialog open={!!preview} onClose={() => setPreview(null)} title={preview?.input.command.name ?? t("roomAssets.preview")}><div className="h-96">{preview?.modelUrl && <ModelViewer url={mediaUrl(preview.modelUrl) ?? preview.modelUrl} name={preview.input.command.name} />}</div></Dialog>
  </>;
}
