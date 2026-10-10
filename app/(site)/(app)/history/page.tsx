"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/i18n";
import { RequireAuth } from "@/components/app-shell";
import { PageHeader, Tabs } from "@/components/ui";
import { HistoryTimeline } from "@/components/history/history-timeline";
import { HistoryStyle } from "@/components/history/history-style";
import { HistoryUsage } from "@/components/history/history-usage";
import { HistoryHype } from "@/components/history/history-hype";
import { HistoryInsights } from "@/components/history/history-insights";

const TABS = ["timeline", "style", "usage", "hype", "insights"] as const;
type Tab = (typeof TABS)[number];
const parse = (v: string | null): Tab => (TABS as readonly string[]).includes(v ?? "") ? (v as Tab) : "timeline";

/**
 * Histórico (novo): reúne o histórico que estava espalhado (looks do dia no Lookbook, linha do tempo das fotos, evolução
 * em Destaques) e acrescenta o Hype ao longo do tempo. Cada aba muda o CONTEXTO; filtros ficam dentro das abas.
 * A aba ativa fica na URL (?tab=), então o link do Copilot "Ver Hype no Histórico" abre direto na aba certa.
 */
function History() {
  const { t } = useI18n();
  const sp = useSearchParams(); const router = useRouter();
  const [tab, setTab] = useState<Tab>(() => parse(sp.get("tab")));
  useEffect(() => { setTab(parse(sp.get("tab"))); }, [sp]);
  const change = (next: Tab) => { setTab(next); router.replace(`/history?tab=${next}`, { scroll: false }); };
  return (
    <>
      <PageHeader title={t("history.title")} lead={t("history.lead")} />
      <Tabs label={t("history.title")} value={tab} onChange={change} tabs={[
        { id: "timeline", label: t("history.tab.timeline") }, { id: "style", label: t("history.tab.style") },
        { id: "usage", label: t("history.tab.usage") }, { id: "hype", label: t("history.tab.hype") }, { id: "insights", label: t("history.tab.insights") },
      ]} />
      {tab === "timeline" && <HistoryTimeline />}
      {tab === "style" && <HistoryStyle />}
      {tab === "usage" && <HistoryUsage />}
      {tab === "hype" && <HistoryHype />}
      {tab === "insights" && <HistoryInsights />}
    </>
  );
}
export default function HistoryPage() { return <RequireAuth><History /></RequireAuth>; }
