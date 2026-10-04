"use client";
import { useState } from "react";
import Link from "next/link";
import { api, qs } from "@/lib/api/client";
import type { Page, PieceView } from "@/lib/api/types";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { CATEGORY_LABEL, label, useTaxonomy } from "@/lib/api/taxonomy";
import { RequireAuth } from "@/components/app-shell";
import { Button, EmptyState, ErrorState, PageHeader, Pagination, SkeletonGrid, useToast } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { PieceCard } from "@/components/piece-card";
import { usePieceUpdates } from "@/lib/pieces/piece-events";
import { FaiIcon } from "@/components/fai-icon";
import { hypeLevelFilter, hypeSortOptions } from "@/components/hype";

// valores iguais aos aceitos pelo backend (WardrobeService.stateMatches); "venda" = peças à venda (RF4.CA8)
const STATES = [["", "common.all"], ["favoritos", "common.favorite"], ["disponivel", "common.available"], ["indisponivel", "common.unavailable"], ["venda", "common.forSale"]] as const;

function Closet() {
  const { t } = useI18n(); const tax = useTaxonomy(); const toast = useToast();
  const [f, setF] = useState({ category: "", color: "", season: "", occasion: "", style: "", state: "", hypeLevel: "", q: "", sort: "recent", page: 0, size: 24 });
  const { data, loading, error, reload, setData } = useApi<Page<PieceView>>((signal) => api.get(`/api/me/closet${qs(f)}`, { signal }), [JSON.stringify(f)]);
  const set = (k: keyof typeof f, v: string | number) => setF((o) => ({ ...o, [k]: v, page: k === "page" ? (v as number) : 0 }));
  // favorita/disponível agora se marcam no detalhe da peça ("Mais opções"): a grade acompanha a mudança
  usePieceUpdates((p) => setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === p.id ? p : x)) } : d)));
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
      <FilterBar search={f.q} onSearch={(v) => set("q", v)} searchLabel={t("closet.searchLabel")}
        quick={{ key: "state", label: t("closet.state"), options: STATES.map(([v, k]) => ({ value: v, label: t(k) })) }}
        filters={[
          { key: "category", label: t("common.category"), options: Object.keys(tax?.subcategories ?? {}).map((c) => ({ value: c, label: CATEGORY_LABEL[c] ?? c })) },
          { key: "color", label: t("common.color"), options: Object.entries(tax?.colors ?? {}).map(([c, hex]) => ({ value: c, label: label(c), swatch: /^#[0-9a-f]{3,8}$/i.test(hex) ? hex : undefined })) },
          { key: "occasion", label: t("common.occasion"), options: (tax?.occasions ?? []).map((c) => ({ value: c, label: label(c) })) },
          // Hype é filtro (faixa mínima), nunca aba
          hypeLevelFilter(),
        ]}
        values={{ state: f.state, category: f.category, color: f.color, occasion: f.occasion, hypeLevel: f.hypeLevel }} onChange={(k, v) => set(k as keyof typeof f, v)}
        // valores canônicos de WardrobeService.closet (antes iam "mais_usadas"/"nome"/"preco" e a ordenação era ignorada)
        sort={{ value: f.sort, onChange: (v) => set("sort", v), options: [
          { value: "recent", label: t("common.mais_recentes") }, ...hypeSortOptions(),
          { value: "name", label: t("closet.nome_a_z") }, { value: "price", label: t("common.price") },
        ] }}
        resultCount={data?.total} />
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && <SkeletonGrid n={8} />}
      {!loading && data && data.items.length === 0 && <EmptyState title={t("closet.empty")} hint={t("closet.emptyHint")} action={<Link href="/pieces/new" className="btn btn-primary">{t("closet.addPiece")}</Link>} />}
      {data && data.items.length > 0 && (
        <>
          <div className="grid-cards">{data.items.map((p) => <PieceCard key={p.id} piece={p} />)}</div>
          <Pagination page={data.page} hasMore={data.hasMore} total={data.total} size={data.size} onPage={(p) => set("page", p)} />
        </>
      )}
      <p className="mt-6 type-caption text-muted">{t("nav.explorer")}: <Link className="underline" href="/search?tab=PECAS">{t("closet.addToWardrobe")}</Link></p>
    </>
  );
}
export default function ClosetPage() { return <RequireAuth><Closet /></RequireAuth>; }
