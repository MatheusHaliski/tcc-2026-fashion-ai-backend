"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, qs } from "@/lib/api/client";
import type { Page, PieceView } from "@/lib/api/types";
import { useApi } from "@/lib/hooks/use-api";
import { useI18n } from "@/lib/i18n/i18n";
import { label, useTaxonomy } from "@/lib/api/taxonomy";
import { RequireAuth } from "@/components/app-shell";
import { Button, EmptyState, ErrorState, PageHeader, Pagination, SkeletonGrid, Tabs, useToast } from "@/components/ui";
import { FilterBar } from "@/components/filter-bar";
import { PieceCard } from "@/components/piece-card";
import { toSealBadges } from "@/components/scheme-card";
import { usePieceUpdates } from "@/lib/pieces/piece-events";
import { FaiIcon } from "@/components/fai-icon";
import { hypeLevelFilter, hypeSortOptions } from "@/components/hype";
import { InsightStrip } from "@/components/insights/insight-strip";

// valores iguais aos aceitos pelo backend (WardrobeService.stateMatches); "venda" = peças à venda (RF4.CA8); "doar" = para doar
const STATES = [["", "common.all"], ["favoritos", "common.favorite"], ["disponivel", "common.available"], ["indisponivel", "common.unavailable"], ["venda", "common.forSale"], ["doar", "common.forDonation"]] as const;
/**
 * Abas do guarda-roupa (docs/hype/01-AUDITORIA_E_PROPOSTA_IA.md §3.2): a família da peça muda o CONTEXTO (aba); estado,
 * cor, ocasião e Hype só restringem (filtros). Só as quatro categorias do formulário — peça única não existe mais (RF4).
 */
const CATEGORY_TABS = ["", "upper_piece", "lower_piece", "shoes_piece", "accessory_piece"] as const;
type CategoryTab = (typeof CATEGORY_TABS)[number];
// ?category= (ou ?tab=) na URL: o link para uma categoria abre direto na aba certa
const parseTab = (v: string | null): CategoryTab => (CATEGORY_TABS as readonly string[]).includes(v ?? "") ? ((v ?? "") as CategoryTab) : "";
/**
 * RF53 — "Com selo": peças com Selo de Hype FashionAI, com selo de marca/celebridade aprovado ou qualquer um dos dois
 * (`seal=hype|brand|any` em GET /api/me/closet). Fica na URL (?seal=) como a aba, para o link abrir já filtrado.
 */
const SEAL_FILTERS = ["hype", "brand", "any"] as const;
type SealFilter = (typeof SEAL_FILTERS)[number] | "";
const parseSeal = (v: string | null): SealFilter => (SEAL_FILTERS as readonly string[]).includes(v ?? "") ? ((v ?? "") as SealFilter) : "";
const closetHref = (category: string, seal: string) => `/closet${qs({ category, seal })}`;
type SealBadgeSource = NonNullable<Parameters<typeof toSealBadges>[0]>[number];

function Closet() {
  const { t } = useI18n(); const tax = useTaxonomy(); const toast = useToast();
  const sp = useSearchParams(); const router = useRouter();
  const urlTab = parseTab(sp.get("category") ?? sp.get("tab"));
  const urlSeal = parseSeal(sp.get("seal"));
  const [f, setF] = useState({ category: urlTab as string, color: "", season: "", occasion: "", style: "", state: "", hypeLevel: "", seal: urlSeal as string, q: "", sort: "recent", page: 0, size: 24 });
  const { data, loading, error, reload, setData } = useApi<Page<PieceView>>((signal) => api.get(`/api/me/closet${qs(f)}`, { signal }), [JSON.stringify(f)]);
  const set = (k: keyof typeof f, v: string | number) => setF((o) => ({ ...o, [k]: v, page: k === "page" ? (v as number) : 0 }));
  // voltar/avançar do navegador (ou um link com outra ?category=) troca a aba; os filtros ficam
  useEffect(() => { setF((o) => (o.category === urlTab ? o : { ...o, category: urlTab, page: 0 })); }, [urlTab]);
  useEffect(() => { setF((o) => (o.seal === urlSeal ? o : { ...o, seal: urlSeal, page: 0 })); }, [urlSeal]);
  const changeTab = (next: CategoryTab) => { set("category", next); router.replace(closetHref(next, f.seal), { scroll: false }); };
  const changeSeal = (next: SealFilter) => { set("seal", next); router.replace(closetHref(f.category, next), { scroll: false }); };
  // selos de marca/celebridade aprovados nas peças da página: UM pedido por página (até 60 ids); falha = cards sem selo
  const ids = (data?.items ?? []).slice(0, 60).map((p) => p.id).join(",");
  const pieceSeals = useApi<{ items?: Record<string, SealBadgeSource[]> }>((signal) => api.get(`/api/pieces/seals?ids=${ids}`, { signal }), [ids], { enabled: !!ids });
  const sealsOf = (id: string) => toSealBadges(pieceSeals.data?.items?.[id]);
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
      <Tabs label={t("common.category")} value={parseTab(f.category)} onChange={changeTab}
        tabs={CATEGORY_TABS.map((c) => ({ id: c, label: c ? label(c) : t("closet.tab.all") }))} />
      {/* insights do guarda-roupa (RF53): fechados por padrão para não disputar espaço com a grade */}
      <InsightStrip context="CLOSET" params={{ category: f.category }} collapsible className="mb-3" />
      <FilterBar search={f.q} onSearch={(v) => set("q", v)} searchLabel={t("closet.searchLabel")}
        quick={{ key: "state", label: t("closet.state"), options: STATES.map(([v, k]) => ({ value: v, label: t(k) })) }}
        filters={[
          { key: "color", label: t("common.color"), options: Object.entries(tax?.colors ?? {}).map(([c, hex]) => ({ value: c, label: label(c), swatch: /^#[0-9a-f]{3,8}$/i.test(hex) ? hex : undefined })) },
          { key: "occasion", label: t("common.occasion"), options: (tax?.occasions ?? []).map((c) => ({ value: c, label: label(c) })) },
          // Hype é filtro (faixa mínima), nunca aba
          hypeLevelFilter(),
        ]}
        values={{ state: f.state, color: f.color, occasion: f.occasion, hypeLevel: f.hypeLevel }} onChange={(k, v) => set(k as keyof typeof f, v)}
        // valores canônicos de WardrobeService.closet (antes iam "mais_usadas"/"nome"/"preco" e a ordenação era ignorada)
        sort={{ value: f.sort, onChange: (v) => set("sort", v), options: [
          { value: "recent", label: t("common.mais_recentes") }, ...hypeSortOptions(),
          { value: "name", label: t("closet.nome_a_z") }, { value: "price", label: t("common.price") },
        ] }}
        resultCount={data?.total}
        extra={
          <div className="seal-filter" role="group" aria-label={t("closet.seal.label")}>
            <span className="seal-filter-label" aria-hidden>{t("closet.seal.label")}</span>
            {SEAL_FILTERS.map((v) => <button key={v} type="button" className="chip" aria-pressed={f.seal === v} onClick={() => changeSeal(f.seal === v ? "" : v)}>{t(`closet.seal.${v}`)}</button>)}
          </div>
        } />
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && <SkeletonGrid n={8} />}
      {!loading && data && data.items.length === 0 && <EmptyState title={t("closet.empty")} hint={t("closet.emptyHint")} action={<Link href="/pieces/new" className="btn btn-primary">{t("closet.addPiece")}</Link>} />}
      {data && data.items.length > 0 && (
        <>
          <div className="grid-cards">{data.items.map((p) => <PieceCard key={p.id} piece={p} seals={sealsOf(p.id)} />)}</div>
          <Pagination page={data.page} hasMore={data.hasMore} total={data.total} size={data.size} onPage={(p) => set("page", p)} />
        </>
      )}
      <p className="mt-6 type-caption text-muted">{t("nav.explorer")}: <Link className="underline" href="/search?tab=PECAS">{t("closet.addToWardrobe")}</Link></p>
    </>
  );
}
// a aba vem da URL (useSearchParams): o Suspense deixa o `next build` pré-renderizar a casca da página
export default function ClosetPage() { return <RequireAuth><Suspense><Closet /></Suspense></RequireAuth>; }
