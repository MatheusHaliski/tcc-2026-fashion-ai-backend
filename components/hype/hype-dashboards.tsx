"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";
import { ARROW, displayScore, levelTone } from "@/lib/hype/model";
import type { HypeDirection, HypeLevel } from "@/lib/hype/types";
import { Card, cn } from "@/components/ui";
import { DataTable, SERIES } from "@/components/charts";

/**
 * RF53 · Lote 7 — HypeScore v2 nos painéis: bloco "Hype dos looks vinculados" do emissor (P2-20), widget de faixas do
 * admin (P2-21) e estado do job em Admin › Sistema (P3-14). Tudo lê o que o backend já agregou a partir do estado gravado
 * pelo job (GET nunca recalcula). Regras: só agregados públicos; "sem dados" nunca vira 0 (mostra "Dados insuficientes"
 * ou "—"); a faixa sempre aparece em texto; relevância, nunca juízo de qualidade.
 */

/** Look vinculado no top do emissor (sempre público e com Hype disponível). */
export interface IssuerHypeTop { schemeId: string; title?: string | null; owner?: string | null; coverUrl?: string | null; score: number; level: HypeLevel; deltaPoints?: number | null; direction?: HypeDirection | null }
/** `GET /api/me/issuer-dashboard` → `hype` (DashboardService.issuerHype). */
export interface IssuerHype {
  algorithmVersion: string; deltaWindowDays: number; bondedLooks: number; withHype: number; insufficient: number; notPublic: number;
  avgScore: number | null; level: HypeLevel | null; deltaPoints: number | null; direction: HypeDirection | null; calculatedAt?: string | null; top: IssuerHypeTop[];
}
export interface HypeCoverageRow { entityType: "PIECE" | "SCHEME"; total: number; available: number; insufficient: number; notCalculated: number; publicEligible: number }
/** Estado do último cálculo v2 (DashboardService.hypeJob; em Admin › Sistema também agenda, ao vivo e cobertura). */
export interface HypeJobState {
  algorithmVersion: string; lastCalculatedAt: string | null; lastSnapshotDate: string | null; rows: number; staleAfterHours: number; stale: boolean | null;
  cron?: string; live?: { enabled: boolean; intervalSeconds: number; pending: boolean }; coverage?: HypeCoverageRow[];
}
/** `GET /api/admin/dashboard` → `hypeV2` (DashboardService.hypeV2Block). */
export interface AdminHypeV2 {
  algorithmVersion: string; levels: { level: HypeLevel; pieces: number; looks: number }[]; levelTotals: { pieces: number; looks: number };
  coverage: HypeCoverageRow[]; job: HypeJobState;
}

/** Variação em pontos numa janela (↑ +3 pts · ↓ −2 pts · → estável); sem base, diz que não há base — nunca "0". */
export function HypeDeltaText({ points, direction, days, compact }: { points?: number | null; direction?: HypeDirection | null; days: number; compact?: boolean }) {
  const { t, fmtNumber } = useI18n();
  if (direction == null || points == null) return compact ? null : <span className="type-caption text-muted">{t("hypeDashboard.sem_base")}</span>;
  const n = Math.abs(Math.round(points * 10) / 10);
  const said = direction === "STABLE" ? t("hype.trend.stable") : t(`hype.trend.${direction === "UP" ? "up" : "down"}_points`, { value: n, days });
  const shown = direction === "STABLE" ? t("hype.trend.stable") : t("hypeDashboard.delta_pts", { sign: direction === "UP" ? "+" : "−", value: fmtNumber(n) });
  return (
    <span className={cn("hype-trend", `is-${direction.toLowerCase()}`)}>
      <span aria-hidden>{`${ARROW[direction]} ${shown}`}</span><span className="sr-only">{said}</span>
    </span>
  );
}

/** Faixa v2 sempre em texto (o tom do chip só acompanha o rótulo). */
function LevelChip({ level }: { level: HypeLevel }) {
  const { t } = useI18n();
  return <span className={cn("hype-level-chip", levelTone(level))}>{t(`hype.level.${level}`)}</span>;
}

// ------------------------------------------------------------------ P2-20 painel do emissor

export function IssuerHypeBlock({ data }: { data?: IssuerHype | null }) {
  const { t, fmtDateTime } = useI18n();
  if (!data) return null;
  const has = data.avgScore != null && data.level != null;
  const out = data.insufficient + data.notPublic;
  return (
    <Card className="mt-4">
      <section aria-labelledby="issuer-hype-title">
        <h2 id="issuer-hype-title" className="type-h3">{t("hypeDashboard.titulo")}</h2>
        <p className="mb-3 type-body-sm text-muted">{t("hypeDashboard.lead", { version: data.algorithmVersion })}</p>
        <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_1fr]">
          <div>
            <p className="label">{t("hypeDashboard.media")}</p>
            {has ? (
              <>
                <p className="hero-number text-3xl tabular" role="img" aria-label={t("hypeDashboard.media_aria", { score: displayScore(data.avgScore!), level: t(`hype.level.${data.level}`) })}>
                  <span aria-hidden>{`🔥 ${displayScore(data.avgScore!)}`}</span>
                </p>
                <LevelChip level={data.level!} />
                <p className="mt-2 type-caption">{t("hypeDashboard.variacao", { days: data.deltaWindowDays })}{": "}<HypeDeltaText points={data.deltaPoints} direction={data.direction} days={data.deltaWindowDays} /></p>
              </>
            ) : (
              <>
                <p className="hero-number text-3xl" aria-hidden>🔥 —</p>
                <p className="type-body-sm font-semibold">{t("hype.state.insufficient")}</p>
                <p className="type-caption text-muted">{t("hypeDashboard.sem_dados_hint")}</p>
              </>
            )}
            <p className="mt-2 type-caption text-muted">{t("hypeDashboard.cobertura", { withHype: data.withHype, total: data.bondedLooks })}</p>
            {out > 0 && <p className="type-caption text-muted">{t("hypeDashboard.fora", { insufficient: data.insufficient, notPublic: data.notPublic })}</p>}
            {data.calculatedAt && <p className="type-caption text-muted">{t("hypeDashboard.calculado_em", { when: fmtDateTime(data.calculatedAt) })}</p>}
          </div>
          <div>
            <h3 className="mb-1 type-label">{t("hypeDashboard.top")}</h3>
            {data.top.length === 0 ? <p className="type-body-sm text-muted">{t("hypeDashboard.top_vazio")}</p> : (
              <ol className="fai-list">{data.top.map((x, i) => (
                <li key={x.schemeId} className="flex items-center gap-2 py-1.5">
                  <span className="tabular text-muted" aria-hidden>{i + 1}</span>
                  <Link href={`/schemes/${x.schemeId}`} className="min-w-0 flex-1 hover:underline"
                    aria-label={t("hypeDashboard.item_aria", { title: x.title ?? "—", score: displayScore(x.score), level: t(`hype.level.${x.level}`) })}>
                    <span className="block truncate type-body-sm font-semibold">{x.title ?? "—"}</span>
                    {x.owner && <span className="block truncate type-caption text-muted">{t("hypeDashboard.de", { owner: x.owner })}</span>}
                  </Link>
                  <span className="tabular type-body-sm" aria-hidden>{`🔥 ${displayScore(x.score)}`}</span>
                  <LevelChip level={x.level} />
                  <HypeDeltaText points={x.deltaPoints} direction={x.direction} days={data.deltaWindowDays} compact />
                </li>))}</ol>
            )}
          </div>
        </div>
      </section>
    </Card>
  );
}

// ------------------------------------------------------------------ P2-21 widget do admin

/** Cobertura do cálculo por tipo: disponível · dados insuficientes · não calculado (só contagens). */
export function HypeCoverageTable({ rows }: { rows: HypeCoverageRow[] }) {
  const { t, fmtNumber } = useI18n();
  const cols = ["available", "insufficient", "notCalculated", "publicEligible", "total"] as const;
  return (
    <div className="overflow-x-auto">
      <table className="w-full type-caption">
        <caption className="sr-only">{t("hypeAdmin.cobertura_titulo")}</caption>
        <thead><tr className="text-left text-muted"><th scope="col">{t("hypeAdmin.tipo")}</th>{cols.map((c) => <th key={c} scope="col" className="text-right">{t(`hypeAdmin.cov.${c}`)}</th>)}</tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.entityType} className="border-t border-line-soft">
            <th scope="row" className="text-left font-normal">{t(`hypeAdmin.tipo.${r.entityType}`)}</th>
            {cols.map((c) => <td key={c} className="text-right tabular">{fmtNumber(r[c])}</td>)}
          </tr>))}</tbody>
      </table>
    </div>
  );
}

/** Data de calendário (AAAA-MM-DD) sem escorregar de dia pelo fuso. */
const calendarDate = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00Z` : d);

/** Último cálculo v2: data, estado em texto (em dia · desatualizado · nunca) e, no detalhado, agenda e recálculo ao vivo. */
export function HypeJobStatus({ job, detailed }: { job: HypeJobState; detailed?: boolean }) {
  const { t, fmtDate, fmtDateTime, fmtNumber } = useI18n();
  const state = job.lastCalculatedAt == null ? "never" : job.stale ? "stale" : "ok";
  const stateText = state === "never" ? t("hypeAdmin.nunca") : state === "stale" ? t("hypeAdmin.desatualizado", { hours: job.staleAfterHours }) : t("hypeAdmin.em_dia");
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 type-caption">
      <dt className="text-muted">{t("hypeAdmin.versao")}</dt><dd className="tabular">{job.algorithmVersion}</dd>
      <dt className="text-muted">{t("hypeAdmin.ultimo_calculo")}</dt>
      <dd><span className={`status-dot ${state === "ok" ? "good" : "warning"}`} aria-hidden />{job.lastCalculatedAt ? `${fmtDateTime(job.lastCalculatedAt)} · ${stateText}` : stateText}</dd>
      <dt className="text-muted">{t("hypeAdmin.snapshot")}</dt><dd>{job.lastSnapshotDate ? fmtDate(calendarDate(job.lastSnapshotDate)) : "—"}</dd>
      {detailed && <>
        <dt className="text-muted">{t("hypeAdmin.cobertura_titulo")}</dt><dd>{t("hypeAdmin.registros", { n: job.rows })}</dd>
        {job.cron && <><dt className="text-muted">{t("hypeAdmin.agenda")}</dt><dd><code>{job.cron}</code></dd></>}
        {job.live && <><dt className="text-muted">{t("hypeAdmin.ao_vivo")}</dt>
          <dd>{job.live.enabled ? t("hypeAdmin.ao_vivo_on", { seconds: fmtNumber(job.live.intervalSeconds) }) : t("hypeAdmin.ao_vivo_off")}{" · "}{job.live.pending ? t("hypeAdmin.pendente") : t("hypeAdmin.sem_pendencia")}</dd></>}
      </>}
    </dl>
  );
}

/**
 * Widget `hype_bands` (P2-21): duas pequenas múltiplas (peças · looks), uma barra por faixa na ordem da régua, todas no
 * mesmo tom (o comprimento é a grandeza; a faixa vem escrita), com contagem e percentual em texto, tabela de dados,
 * cobertura e o último cálculo.
 */
export function AdminHypeLevels({ data }: { data?: AdminHypeV2 | null }) {
  const { t, fmtNumber } = useI18n();
  if (!data) return <p className="type-body text-muted">{t("hypeAdmin.indisponivel")}</p>;
  const panels = [
    { key: "pieces" as const, kind: t("hypeAdmin.tipo.PIECE"), total: data.levelTotals.pieces },
    { key: "looks" as const, kind: t("hypeAdmin.tipo.SCHEME"), total: data.levelTotals.looks },
  ];
  const any = panels.some((p) => p.total > 0);
  return (
    <div className="grid gap-3">
      <p className="type-caption text-muted">{t("hypeAdmin.lead", { version: data.algorithmVersion })}</p>
      {!any ? <p className="type-body text-muted">{t("hypeAdmin.sem_itens")}</p> : (
        <div className="grid gap-4 sm:grid-cols-2">{panels.map((p) => (
          <section key={p.key} aria-label={t("hypeAdmin.multiplo", { kind: p.kind, total: fmtNumber(p.total) })}>
            <h3 className="mb-1 type-label">{t("hypeAdmin.multiplo", { kind: p.kind, total: fmtNumber(p.total) })}</h3>
            <ol className="grid gap-1">{data.levels.map((r) => {
              const v = r[p.key]; const pct = p.total ? Math.round((v / p.total) * 100) : 0; const name = t(`hype.level.${r.level}`);
              const said = t("hypeAdmin.barra_aria", { level: name, count: fmtNumber(v), pct, kind: p.kind.toLowerCase() });
              return (
                <li key={r.level} className="grid grid-cols-[92px_minmax(0,1fr)_auto] items-center gap-2 type-caption" title={said}>
                  <span>{name}</span>
                  <span className="h-2.5 rounded bg-surface-2" aria-hidden><span className="block h-full rounded" style={{ width: `${pct}%`, background: SERIES[0] }} /></span>
                  <span className="whitespace-nowrap text-right tabular" aria-hidden>{`${fmtNumber(v)} · ${pct}%`}</span>
                  <span className="sr-only">{said}</span>
                </li>);
            })}</ol>
          </section>))}
        </div>
      )}
      {any && <p className="dash-note">{t("hypeAdmin.barras_nota")}</p>}
      <DataTable columns={[{ key: "name", label: t("adminDash.faixa") }, { key: "pieces", label: t("hypeAdmin.tipo.PIECE"), align: "right" }, { key: "looks", label: t("hypeAdmin.tipo.SCHEME"), align: "right" }]}
        rows={data.levels.map((r) => ({ name: t(`hype.level.${r.level}`), pieces: r.pieces, looks: r.looks }))} />
      <h3 className="type-label">{t("hypeAdmin.cobertura_titulo")}</h3>
      <HypeCoverageTable rows={data.coverage} />
      <HypeJobStatus job={data.job} />
    </div>
  );
}
