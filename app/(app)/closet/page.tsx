"use client";
import { useState } from "react";
import Link from "next/link";
import { api, qs } from "@/lib/api/client";
import type { Page, PieceView } from "@/lib/api/types";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { CATEGORY_LABEL, label, useTaxonomy } from "@/lib/api/taxonomy";
import { RequireAuth } from "@/components/app-shell";
import { Button, Chip, EmptyState, ErrorState, Input, PageHeader, Pagination, Select, SkeletonGrid, useToast } from "@/components/ui";
import { PieceCard } from "@/components/piece-card";
import { FaiIcon } from "@/components/fai-icon";

const STATES = [["", "common.all"], ["favoritos", "common.favorite"], ["disponiveis", "common.available"], ["indisponiveis", "common.unavailable"]] as const;

function Closet() {
  const { t } = useI18n(); const tax = useTaxonomy(); const toast = useToast();
  const [f, setF] = useState({ category: "", color: "", season: "", occasion: "", style: "", state: "", q: "", sort: "recentes", page: 0, size: 24 });
  const { data, loading, error, reload, setData } = useApi<Page<PieceView>>((signal) => api.get(`/api/me/closet${qs(f)}`, { signal }), [JSON.stringify(f)]);
  const set = (k: keyof typeof f, v: string | number) => setF((o) => ({ ...o, [k]: v, page: k === "page" ? (v as number) : 0 }));
  const patch = (p: PieceView) => setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === p.id ? p : x)) } : d));
  async function toggle(p: PieceView, field: "favorite" | "disponivel") {
    try { patch(await api.patch<PieceView>(`/api/pieces/${p.id}/flags`, { [field]: !p[field] })); } catch (e) { toast.fromError(e); }
  }
  // RF4 · Estúdio: leva ao estúdio as peças que ainda estão só com o recorte (até 40 por vez)
  const [studioBusy, setStudioBusy] = useState(false);
  async function studioAll() {
    setStudioBusy(true);
    try { const r = await api.post<{ generated: number; skipped: number }>("/api/me/pieces/studio"); toast.success(r.generated ? t("closet.foto_s_de_estudio_prontas", { generated: r.generated }) : t("closet.todas_as_pecas_com_foto")); reload(); }
    catch (e) { toast.fromError(e); } finally { setStudioBusy(false); }
  }
  const missingStudio = (data?.items ?? []).some((p) => !p.studioImageUrl && !p.defaultImage && p.photoProcessingStatus === "COMPLETED");
  return (
    <>
      <PageHeader title={t("closet.title")} kicker={t("closet.rf7_rf31")} lead={data ? `${data.total} ${t("common.pieces")}` : undefined}
        actions={<><Link href="/pieces/new" className="btn btn-primary"><FaiIcon id="ACT-06" size={24} decorative />{t("closet.addPiece")}</Link><Link href="/schemes/new" className="btn"><FaiIcon id="NAV-03" size={24} decorative />{t("scheme.create")}</Link>{missingStudio && <Button onClick={studioAll} loading={studioBusy} title={t("closet.gera_a_foto_de_produto")}><FaiIcon id="ACT-08" size={24} decorative />{t("closet.levar_pecas_ao_estudio")}</Button>}</>} />
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label={t("closet.state")}>
        {STATES.map(([v, k]) => <Chip key={v} active={f.state === v} onClick={() => set("state", v)}>{t(k)}</Chip>)}
      </div>
      <div className="mb-4 grid gap-2 sm:grid-cols-5">
        <Input aria-label={t("common.search")} placeholder={t("common.search") + "…"} value={f.q} onChange={(e) => set("q", e.target.value)} />
        <Select aria-label={t("common.category")} value={f.category} onChange={(e) => set("category", e.target.value)}><option value="">{t("common.category")}: {t("common.all")}</option>{Object.keys(tax?.subcategories ?? {}).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</option>)}</Select>
        <Select aria-label={t("common.color")} value={f.color} onChange={(e) => set("color", e.target.value)}><option value="">{t("common.color")}: {t("common.all")}</option>{Object.keys(tax?.colors ?? {}).map((c) => <option key={c} value={c}>{label(c)}</option>)}</Select>
        <Select aria-label={t("common.occasion")} value={f.occasion} onChange={(e) => set("occasion", e.target.value)}><option value="">{t("common.occasion")}: {t("common.all")}</option>{(tax?.occasions ?? []).map((c) => <option key={c} value={c}>{label(c)}</option>)}</Select>
        <Select aria-label={t("common.ordenar")} value={f.sort} onChange={(e) => set("sort", e.target.value)}><option value="recentes">{t("common.mais_recentes")}</option><option value="mais_usadas">{t("closet.mais_usadas")}</option><option value="menos_usadas">{t("closet.menos_usadas")}</option><option value="nome">{t("closet.nome_a_z")}</option><option value="preco">{t("common.price")}</option></Select>
      </div>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && <SkeletonGrid n={8} />}
      {!loading && data && data.items.length === 0 && <EmptyState title={t("closet.empty")} hint={t("closet.emptyHint")} action={<Link href="/pieces/new" className="btn btn-primary">{t("closet.addPiece")}</Link>} />}
      {data && data.items.length > 0 && (
        <>
          <div className="grid-cards">{data.items.map((p) => <PieceCard key={p.id} piece={p} onFavorite={(x) => toggle(x, "favorite")} onAvailability={(x) => toggle(x, "disponivel")} />)}</div>
          <Pagination page={data.page} hasMore={data.hasMore} total={data.total} size={data.size} onPage={(p) => set("page", p)} />
        </>
      )}
      <p className="mt-6 type-caption text-faint">{t("nav.explorer")}: <Link className="underline" href="/search?tab=PECAS">{t("closet.addToWardrobe")}</Link></p>
      <div className="hidden"><Button onClick={reload}>{t("common.retry")}</Button></div>
    </>
  );
}
export default function ClosetPage() { return <RequireAuth><Closet /></RequireAuth>; }
