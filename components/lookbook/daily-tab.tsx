"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import type { SchemeView } from "@/lib/api/types";
import type { DailyLookContextView } from "@/lib/daily-look/types";
import { useI18n } from "@/lib/i18n/i18n";
import { useApi } from "@/lib/hooks/use-api";
import { HypeBadge } from "@/components/hype/hype-badge";
import { HypeBreakdown } from "@/components/hype/hype-breakdown";
import { HypeInline } from "@/components/hype/hype-inline";
import { HypeStateNotice } from "@/components/hype/hype-state-notice";
import { HypeTrendIndicator } from "@/components/hype/hype-trend-indicator";
import { InsightStrip } from "@/components/insights/insight-strip";
import { Button, Card, Dropdown, EmptyState, Input, Skeleton, useToast } from "@/components/ui";
import { SchemeCard } from "@/components/scheme-card";
import { LookExports } from "@/components/look-exports";
import { DailyLookContextChips } from "@/components/daily-look/context-chips";
import { LivingToday, OnThisDay, TomorrowInvite } from "@/components/lookbook/daily-tab-extras";
import { PhasesPanel } from "@/components/lookbook/daily-phases";
export { PublishedPhases } from "@/components/lookbook/daily-phases";   // lookbook-tabs.tsx (congelado) importa daqui
import { DIMENSION_ORDER, displayScore, hypeViewState, levelTone } from "@/lib/hype/model";
import { primeHype, useHypeSummary } from "@/lib/hype/use-hype";
import type { HypeLevel, HypeSummary } from "@/lib/hype/types";

/**
 * Painel do Look do Dia (HypeScoreService.panel): `v2` = HypeScore v2 do look (P2-13, Hype pessoal do dono — o Look do
 * Dia é sempre dele), `magazineCover` = capa liberada pela faixa v2 e `tip` = dica pela dimensão v2 mais fraca (local ou
 * da IA). O v1 do RF6 saiu do painel na limpeza do v1 (P3-16).
 */
interface DailyPanel { v2?: HypeSummary | null; magazineCover?: { unlocked: boolean; minLevel: HypeLevel } | null; tip?: string | null; aiExplanation?: unknown }
/** Linha do histórico (DailyLookService.view): `schemeId` é a chave do Hype v2 (P1-06). */
interface DailyHistoryRow { date: string; schemeId?: string; title?: string; scheme?: SchemeView; feedback?: string | null; context?: DailyLookContextView | null; outcomeNote?: string | null }
interface DailyTabData { panelVersion: string; panelVersions: { code: string; name: string; emphasis?: string; hype?: string; bestFor?: string }[]; today?: { date?: string; feedback?: string | null; source?: string; context?: DailyLookContextView | null } | null; scheme?: SchemeView; panel?: DailyPanel; empty?: { message: string; actions?: { label: string; href: string }[] }; history?: DailyHistoryRow[]; feedbackReminder?: { show?: boolean; message?: string }; feedbackOptions?: string[] }

/** HypeBadge v2 de uma linha do histórico (lote: todas as linhas viram uma requisição a /api/hype/summaries). */
function DailyHistoryHype({ id }: { id?: string }) {
  const hype = useHypeSummary("SCHEME", id);
  if (!id) return null;
  return <HypeBadge state={hypeViewState(hype.summary, hype)} summary={hype.summary} />;
}

/**
 * Look do Dia (RF6): o número do painel é o HypeScore v2 do look em todas as 6 versões visuais (P2-13) — a versão muda
 * só a apresentação. Look do Dia Vivido F1: o Contexto do Dia de hoje fica sob o card e o de cada dia do histórico na linha.
 * Faixa sempre em texto; "sem dados" vira "Dados insuficientes"/"Hype ainda não calculado", nunca 0.
 * Ao lado, a análise completa do look (HypeInline) e, no histórico, o HypeBadge v2 de cada dia (P1-06).
 */
export function DailyTab() {
  const { t, fmtDate } = useI18n(); const toast = useToast(); const [withAi, setWithAi] = useState(false);
  const [outcomeNote, setOutcomeNote] = useState("");   // F2 §4.2: "deu certo?" em poucas palavras
  const { data, loading, reload } = useApi<DailyTabData>((signal) => api.get(`/api/me/daily-look-tab?withAi=${withAi}`, { signal }), [withAi]);
  // o painel já traz o resumo v2 do look: alimenta o cache para o card e a análise não pedirem de novo
  const primed = data?.scheme?.id && data.panel?.v2 ? { id: data.scheme.id, v2: data.panel.v2 } : null;
  useEffect(() => { if (primed) primeHype("SCHEME", { [primed.id]: primed.v2 }); }, [primed?.id, primed?.v2]); // eslint-disable-line react-hooks/exhaustive-deps
  // recarregar (depois de trocar a versão do painel) mantém a aba na tela: a lista não some e o foco fica nela
  if (!data) return <Skeleton className="h-64" />;
  const v2 = data.panel?.v2 ?? null;
  const state = hypeViewState(v2 ?? undefined, { loading: loading && !data.panel });
  const score = state.kind === "available" ? state.score : null;
  const level = state.kind === "available" ? state.level : null;
  const version = data.panelVersion;
  const bar = score != null ? <div className="hype-bar mt-2"><i style={{ width: `${Math.max(0, Math.min(100, score))}%`, background: "var(--thread)" }} /></div> : null;
  async function feedback(fb: string) { if (!data?.today?.date) return; try { await api.put(`/api/me/daily-looks/${data.today.date}/feedback`, { feedback: fb, outcomeNote: outcomeNote.trim() || null }); toast.success(t("lookbookTabs.obrigado_isso_melhora_suas_recomendacoes")); reload(); } catch (e) { toast.fromError(e); } }
  return (<>
    <InsightStrip context="HISTORY" collapsible className="mb-4" />
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <div>{data.scheme && <SchemeCard scheme={data.scheme} />}{data.scheme && data.today?.context && <section className="surface card-pad p-4 mt-3 daily-context" aria-labelledby="daily-context-title"><p id="daily-context-title" className="label mb-1">{t("dailyLookContext.today_context")}</p><DailyLookContextChips context={data.today.context} /></section>}{data.scheme && <LookExports scheme={data.scheme} score={score} level={level} date={data.today?.date} />}{!data.scheme && <EmptyState title={data.empty?.message ?? t("lookbookTabs.nenhum_look_do_dia")} action={(data.empty?.actions ?? []).map((a) => <Link key={a.href} href={a.href === "/add-piece" ? "/pieces/new" : a.href.startsWith("/create") ? "/schemes/new" : a.href.endsWith("?tab=looks") ? "/looks" : a.href} className="btn btn-primary">{a.label}</Link>)} />}</div>
      <div>
        <Card className="mb-4">
          <div className="mb-2 flex items-center justify-between gap-2"><h2 className="type-h3">{t("lookbook.hype")} · {t("lookbook.panel")}</h2>
            <Dropdown label={t("lookbookTabs.versao_do_painel")} value={data.panelVersion} onChange={async (v) => { try { await api.put("/api/me/hype-panel-version", { version: v }); reload(); } catch (err) { toast.fromError(err); } }} options={data.panelVersions.map((v) => ({ id: v.code, label: v.name }))} /></div>
          {data.scheme ? (
            <div className={`grid gap-3 ${version === "PASSARELA" ? "grid-cols-[80px_1fr]" : ""}`} data-panel-version={version}>
              {version === "PASSARELA" ? <div className="flex h-40 items-end rounded bg-surface-2 p-1" aria-hidden>{score != null && <div className="w-full rounded" style={{ height: `${Math.max(0, Math.min(100, score))}%`, background: "var(--thread)" }} />}</div> : null}
              <div>
                {score != null && level ? <>
                  <p className={`hero-number ${version === "EDITORIAL_MINIMAL" ? "text-3xl" : "text-5xl"}`} aria-label={t("hype.badge.aria", { score: displayScore(score), level: t(`hype.level.${level}`) })}>{displayScore(score)}</p>
                  <p className="lb-hype-line"><span className={`hype-level-chip ${levelTone(level)}`}>{t(`hype.level.${level}`)}</span><HypeTrendIndicator summary={v2} />{v2?.stale && <span className="type-caption text-faint">{t("hype.state.stale")}</span>}</p>
                </> : <HypeStateNotice state={state} />}
                {version !== "PASSARELA" && version !== "EDITORIAL_MINIMAL" && bar}
                {version === "RAIO_X_ESTILO" && score != null && <HypeBreakdown type="SCHEME" dimensions={v2?.dimensions} list={DIMENSION_ORDER} />}
                <p className="mt-2 type-caption text-muted">{t("hypeLookbook.painel_v2_dica")}</p>
                {typeof data.panel?.tip === "string" && <p className="mt-3 rounded bg-chalk-soft p-2 type-body-sm">💡 {data.panel.tip}</p>}
                <label className="mt-2 flex items-center gap-2 type-caption"><input type="checkbox" checked={withAi} onChange={(e) => setWithAi(e.target.checked)} />{" "}{t("lookbookTabs.dica_com_ia_style_advisor")}</label>
                <HypeInline type="SCHEME" id={data.scheme.id} name={data.scheme.title} />
              </div>
            </div>
          ) : <p className="type-body text-muted">{t("lookbookTabs.marque_um_look_como_look")}</p>}
        </Card>
        <TomorrowInvite />
        {data.today && (data.today.feedback == null) && <Card className="mb-4"><p className="type-body mb-2">{data.feedbackReminder?.message ?? t("lookbookTabs.como_foi_o_look_de")}</p><Input className="mb-2" value={outcomeNote} maxLength={140} placeholder={t("dailyLookContext.outcome_note")} aria-label={t("dailyLookContext.outcome_note")} onChange={(e) => setOutcomeNote(e.target.value)} /><div className="flex gap-2">{(data.feedbackOptions ?? ["ADOREI", "NAO_USEI", "NAO_GOSTEI"]).map((o) => <Button key={o} onClick={() => feedback(o)}>{o === "ADOREI" ? t("lookbookTabs.adorei") : o === "NAO_USEI" ? t("lookbookTabs.nao_usei") : t("lookbookTabs.nao_gostei")}</Button>)}</div></Card>}
        <LivingToday />
        <OnThisDay />
        <PhasesPanel />
        <Card><h2 className="type-h3 mb-2">{t("common.historico")}</h2>{(data.history ?? []).length === 0 ? <p className="type-body text-muted">{t("common.empty")}</p> : <ul className="fai-list">{(data.history ?? []).map((h) => <li key={h.date} className="py-2 type-body-sm"><div className="flex items-center justify-between gap-2"><span>{fmtDate(h.date)} · {h.title ?? h.scheme?.title ?? ""}</span><span className="flex items-center gap-2"><span className="type-data">{h.feedback ?? "—"}</span><DailyHistoryHype id={h.schemeId ?? h.scheme?.id} /></span></div>{h.outcomeNote && <p className="type-caption text-muted mt-1">✓ {h.outcomeNote}</p>}<DailyLookContextChips context={h.context} compact className="mt-1" /></li>)}</ul>}</Card>
      </div>
    </div>
  </>);
}
