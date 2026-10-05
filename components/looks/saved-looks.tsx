"use client";
import { useState } from "react";
import { api, qs } from "@/lib/api/client";
import type { Page, SchemeView } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { Button, EmptyState, ErrorState, Pagination, SkeletonGrid, useToast } from "@/components/ui";
import { SchemeCard } from "@/components/scheme-card";
import { FaiIcon } from "@/components/fai-icon";
import { OccasionFilter } from "@/components/looks/my-looks";

/**
 * Looks salvos (RF6.CA09–CA13) — só esquemas salvos de outras pessoas; os próprios ficam em "Meus looks". Uma
 * implementação só, usada na aba Salvos do Lookbook e na aba Salvos de /looks.
 */
export function SavedLooks() {
  const { t } = useI18n(); const toast = useToast(); const [page, setPage] = useState(0); const [occasion, setOccasion] = useState("");
  const { data, loading, error, reload } = useApi<Page<{ scheme: SchemeView; favorite?: boolean; origin?: string; originLabel?: string; savedAt?: string }>>((signal) => api.get(`/api/me/saved-looks${qs({ page, size: 24, occasion })}`, { signal }), [page, occasion]);
  const list = (data?.items ?? []).filter((x) => x.origin !== "PROPRIO");
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2"><OccasionFilter value={occasion} onChange={(v) => { setOccasion(v); setPage(0); }} /></div>
      {error ? <ErrorState error={error} onRetry={reload} /> : loading ? <SkeletonGrid /> : list.length === 0 ? <EmptyState title={t("lookbookTabs.nenhum_look_salvo")} hint={t("lookbookTabs.use_o_botao_salvar_em")} /> : <div className="grid-looks">{list.map((x) => <SchemeCard key={x.scheme.id} scheme={x.scheme} extra={<><span className="caption">{x.originLabel}</span><Button size="sm" aria-pressed={x.favorite} onClick={async () => { try { await api.put(`/api/me/saved-looks/${x.scheme.id}/favorite`, { favorite: !x.favorite }); reload(); } catch (e) { toast.fromError(e); } }}><FaiIcon id="SOC-06" size={24} active={x.favorite} decorative />{t("common.favorite")}</Button><Button size="sm" onClick={async () => { try { await api.delete(`/api/me/saved-looks/${x.scheme.id}`); reload(); } catch (e) { toast.fromError(e); } }}>{t("common.remove")}</Button></>} />)}</div>}
      {data && data.total > data.size && <Pagination page={data.page} hasMore={data.hasMore} total={data.total} size={data.size} onPage={setPage} />}
    </>
  );
}
