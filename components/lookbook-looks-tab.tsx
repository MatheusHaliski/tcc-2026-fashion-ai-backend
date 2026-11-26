"use client";
import { useState } from "react";
import Link from "next/link";
import { api, qs } from "@/lib/api/client";
import type { SchemeView } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { label } from "@/lib/api/taxonomy";
import { Dropdown, EmptyState, ErrorState, SegmentPicker, SkeletonGrid } from "@/components/ui";
import { SchemeCard } from "@/components/scheme-card";

/** Ordenação da aba Looks (P3-02): é ordenação, não aba nem filtro. Valores aceitos por GET /api/profiles/{id}?sort=. */
type LookSort = "recent" | "hype_desc" | "growth";
/** Filtro de estação (exercício 06): os códigos gravados (enum Season), "Sem estação" para os looks legados e "Todas". */
export const SEASON_FILTERS = ["", "SPRING", "SUMMER", "AUTUMN", "WINTER", "NONE"] as const;
export type SeasonFilter = (typeof SEASON_FILTERS)[number];

/** O look entra no filtro pela estação que o GET devolveu (scheme.season) — nunca pela estação do calendário de hoje. */
export function matchesSeason(scheme: Pick<SchemeView, "season">, filter: SeasonFilter): boolean {
  if (filter === "") return true;
  return filter === "NONE" ? !scheme.season : scheme.season === filter;
}

/**
 * Looks: a vitrine — os looks publicados, os mesmos para o dono e para quem visita. Filtros de gestão, rascunhos e
 * arquivados ficam em /looks; o dono tem o atalho discreto "Gerenciar meus looks". Ordenar por Hype (P3-02): o dono
 * ordena pelo próprio Hype pessoal; quem visita, só pelo Hype público — look sem Hype fica no fim (nunca vale 0).
 * Estação (exercício 06): filtra a lista que o GET já trouxe (no máximo 60 looks, os mais recentes) pela estação
 * gravada em cada look; o padrão é "Todas", e look legado sem estação aparece em "Sem estação". Extraído de lookbook-tabs.tsx.
 */
export function LooksTab({ ownerId, self }: { ownerId: string; self: boolean }) {
  const { t } = useI18n(); const { user } = useAuth(); const [sort, setSort] = useState<LookSort>("recent");
  const [season, setSeason] = useState<SeasonFilter>("");
  // "Recentes" é a rota de sempre; as outras ordens mandam ?sort= (o backend respeita a privacidade do Hype)
  const { data, loading, error, reload } = useApi<{ schemes: SchemeView[] }>((signal) => api.get(`/api/profiles/${ownerId}${qs({ sort: sort === "recent" ? undefined : sort })}`, { signal, anonymous: !user }), [ownerId, !!user, sort]);
  const all = data?.schemes ?? [];
  const list = all.filter((s) => matchesSeason(s, season));
  const seasonName = (f: SeasonFilter) => (f === "" ? t("lookbook.season.all") : f === "NONE" ? t("lookbook.season.none") : label(f.toLowerCase()));
  return (
    <>
      <div className="lookbook-sort">
        <Dropdown label={t("hypeLookbook.ordenar")} prefix={t("hypeLookbook.ordenar_prefixo")} value={sort} onChange={setSort}
          options={[{ id: "recent", label: t("hypeLookbook.ordem.recent") }, { id: "hype_desc", label: t("hypeLookbook.ordem.hype_desc") }, { id: "growth", label: t("hypeLookbook.ordem.growth") }]} />
        {sort !== "recent" && <span className="type-caption text-muted">{self ? t("hypeLookbook.ordem_pessoal") : t("hypeLookbook.ordem_publica")}</span>}
        {self && <p className="lookbook-manage"><Link href="/looks" className="lookbook-manage-link">{t("lookbook.manageLooks")} →</Link></p>}
      </div>
      {all.length > 0 && <div className="mb-3"><SegmentPicker label={t("lookbook.season.label")} value={season} onChange={setSeason} options={SEASON_FILTERS.map((f) => ({ id: f, label: seasonName(f), count: f === "" ? undefined : all.filter((s) => matchesSeason(s, f)).length }))} /></div>}
      {error ? <ErrorState error={error} onRetry={reload} /> : loading ? <SkeletonGrid />
        : all.length === 0 ? <EmptyState title={t("lookbook.noPublishedLooks")} action={self ? <Link href="/schemes/new" className="btn btn-primary">{t("scheme.create")}</Link> : undefined} />
        : list.length === 0 ? <EmptyState title={season === "NONE" ? t("lookbook.season.emptyNone") : t("lookbook.season.empty", { season: seasonName(season) })} action={<button type="button" className="btn" onClick={() => setSeason("")}>{t("lookbook.season.showAll")}</button>} />
        : <div className="grid-looks social-card-grid">{list.map((s) => <SchemeCard key={s.id} scheme={s} />)}</div>}
    </>
  );
}
