"use client";
import { useState } from "react";
import { api, qs } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { Chip, EmptyState, ErrorState, Input, PageHeader, SkeletonGrid, Tabs } from "@/components/ui";
import { InstitutionalProfileCard } from "@/components/institutional-profile-card";
import type { InstitutionalFeed } from "@/lib/api/institutional";

const ORDER_LABEL: Record<string, string> = { AFINIDADE: "brands.afinidade", RECENTES: "brands.recentes", EM_ALTA: "hypeBrands.order_hot" };

export default function BrandsPage() {
  const { t } = useI18n(); const { user } = useAuth();
  const [tab, setTab] = useState<"brands" | "celebrities">("brands"); const [term, setTerm] = useState(""); const [order, setOrder] = useState("");
  const { data, loading, error, reload } = useApi<InstitutionalFeed>((signal) => api.get(`/api/${tab}${qs({ term, order })}`, { signal, anonymous: !user }), [tab, term, order, !!user]);
  const list = (tab === "brands" ? data?.brands : data?.celebrities) ?? [];
  return (
    <>
      <PageHeader title={t("nav.brands")} kicker={t("brands.rf14_rf22")} lead={t("brands.marcas_e_celebridades_validadas_ordene")} />
      <Tabs tabs={[{ id: "brands", label: t("nav.brands") }, { id: "celebrities", label: t("common.celebridades") }]} value={tab} onChange={setTab} />
      <div className="mb-4 flex flex-wrap gap-2"><Input aria-label={t("common.search")} placeholder={t("common.search") + "…"} value={term} onChange={(e) => setTerm(e.target.value)} className="max-w-xs" />{(data?.orders ?? ["AFINIDADE", "RECENTES", "EM_ALTA"]).map((o) => <Chip key={o} active={(order || data?.order) === o} onClick={() => setOrder(o)} title={o === "EM_ALTA" ? t("hypeBrands.order_hot_hint") : undefined}>{t(ORDER_LABEL[o] ?? "brands.recentes")}</Chip>)}</div>
      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && <SkeletonGrid n={6} h="h-40" />}
      {!loading && !error && list.length === 0 && <EmptyState title={data?.empty ?? t("common.empty")} />}
      {!loading && !error && list.length > 0 && (
        <ul className="institutional-profile-feed" aria-label={t(tab === "brands" ? "nav.brands" : "common.celebridades")}>
          {list.map((profile, index) => (
            <li key={profile.slug ?? profile.userId ?? profile.user?.username ?? profile.id ?? index}>
              <InstitutionalProfileCard profile={profile} kind={tab} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
