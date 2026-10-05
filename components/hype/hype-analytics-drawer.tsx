"use client";
import { createPortal } from "react-dom";
import Link from "next/link";
import { api, mediaUrl } from "@/lib/api/client";
import { useApi } from "@/lib/hooks/use-api";
import { useAuth } from "@/lib/auth/session";
import { useI18n } from "@/lib/i18n/i18n";
import { DIMENSION_ORDER, hypeViewState, levelTone } from "@/lib/hype/model";
import type { HypeDetail, HypeEntity, HypeHistory, HypePositions } from "@/lib/hype/types";
import { label as taxonomyLabel } from "@/lib/api/taxonomy";
import { Sheet, cn } from "@/components/ui";
import { HypeBreakdown } from "./hype-breakdown";
import { HypeExplanation } from "./hype-explanation";
import { HypeHistoryChart } from "./hype-history-chart";
import { HypeScoreGauge } from "./hype-score-gauge";
import { HypeStateNotice } from "./hype-state-notice";
import { HypeTrendIndicator } from "./hype-trend-indicator";
import { HypeVsStyle } from "./hype-vs-style";
import { HypeBadge } from "./hype-badge";
import { HypeSealProgressList } from "./hype-seals";

const path = (type: HypeEntity, id: string) => `/api/hype/${type === "PIECE" ? "pieces" : "looks"}/${id}`;

/** Tipo de sinal gravado (HypeSignalType) → rótulo humano já usado nas explicações (hype.signal.*). */
const SIGNAL_LABEL: Record<string, string> = {
  LIKE_CREATED: "LIKES", COMMENT_CREATED: "COMMENTS", SAVE_CREATED: "SAVES", SHARE_CREATED: "SHARES", FAVORITE_CREATED: "FAVORITES",
  LOOK_REMIXED: "REMIXES", PIECE_REMIXED: "REMIXES", LOOK_VIEWED: "VIEWS", PIECE_VIEWED: "VIEWS", PIECE_USED: "USES", PIECE_IN_LOOK: "LOOK_APPEARANCES", LOOK_WORN: "WEARS",
};

/** Soma as contagens por rótulo (remix de peça e de look viram "remixes"), mais ativos primeiro; só o que tem dado. */
export function signalRows(byType?: Record<string, { current: number; previous: number; total: number }>) {
  const acc = new Map<string, { current: number; previous: number; total: number }>();
  for (const [type, c] of Object.entries(byType ?? {})) {
    const key = SIGNAL_LABEL[type] ?? type;
    const a = acc.get(key) ?? { current: 0, previous: 0, total: 0 };
    acc.set(key, { current: a.current + (c.current ?? 0), previous: a.previous + (c.previous ?? 0), total: a.total + (c.total ?? 0) });
  }
  return [...acc.entries()].filter(([, c]) => c.total > 0).sort((a, b) => b[1].current - a[1].current || b[1].total - a[1].total);
}

/**
 * Análise completa do Hype (drawer lateral no desktop, folha inferior no celular): score atual, faixa, movimento,
 * gráfico temporal, todos os componentes com a definição, explicação humana e — à parte — a compatibilidade com o estilo
 * de quem vê. Só busca dados quando abre. Vai para o <body> num portal: aberto a partir do verso de um card, o
 * rotateY do card viraria o "containing block" do position:fixed e o painel ficaria preso dentro do card.
 */
export function HypeAnalyticsDrawer(props: { type: HypeEntity; id: string; name: string; open: boolean; onClose: () => void }) {
  if (typeof document === "undefined") return null;
  return createPortal(<DrawerContent {...props} />, document.body);
}

function DrawerContent({ type, id, name, open, onClose }: { type: HypeEntity; id: string; name: string; open: boolean; onClose: () => void }) {
  const { t, relative } = useI18n();
  const { user } = useAuth();
  const detail = useApi<HypeDetail>((signal) => api.get(path(type, id), { signal }), [type, id], { enabled: open });
  const history = useApi<HypeHistory>((signal) => api.get(`${path(type, id)}/history?days=90`, { signal }), [type, id], { enabled: open });
  // posição no ranking público (só para itens públicos elegíveis); falha aqui não esconde o resto da análise
  const positions = useApi<HypePositions>((signal) => api.get(`${path(type, id)}/positions`, { signal }), [type, id], { enabled: open });
  const d = detail.data;
  const state = hypeViewState(d, { loading: detail.loading, error: !!detail.error });
  const rows = signalRows(d?.signals?.byType);
  const windowDays = 7;
  return (
    <Sheet open={open} onClose={onClose} title={t("hype.drawer.title", { name })}>
      <div className="hype-drawer">
        {state.kind === "available" ? (
          <div className="hype-drawer-head">
            <HypeScoreGauge value={state.score} size={112} />
            <div className="min-w-0">
              <p className={cn("hype-level-chip", levelTone(state.level))}>{t(`hype.level.${state.level}`)}</p>
              <HypeTrendIndicator summary={d} />
              {d?.momentum && <p className="type-body-sm mt-1">{t("hype.card.trend_line", { momentum: t(`hype.momentum.${d.momentum}`) })}</p>}
              {d?.calculatedAt && <p className={cn("type-caption mt-1", state.stale ? "text-critical" : "text-muted")}>{state.stale ? t("hype.state.stale_hint", { when: relative(d.calculatedAt) }) : t("hype.card.updated", { when: relative(d.calculatedAt) })}</p>}
            </div>
          </div>
        ) : state.kind === "not_calculated" ? <p className="hype-state" role="status">{t("hype.drawer.calculating")}</p> : <HypeStateNotice state={state} onRetry={detail.reload} />}
        {positions.data?.eligible && positions.data.positions.length > 0 && (
          <section aria-label={t("hype.drawer.positions")}>
            <h3 className="type-h3 mb-2">{t("hype.drawer.positions")}</h3>
            <ul className="hype-positions">
              {positions.data.positions.map((p) => (
                <li key={`${p.scope}:${p.key ?? ""}`}><b className="tabular">#{p.rank}</b> <span>{t(`hype.position.${p.scope}`, { label: p.label ?? (p.key ? taxonomyLabel(p.key) : ""), total: p.total })}</span></li>
              ))}
            </ul>
            <Link className="type-caption underline" href={`/explorer?tab=ranking&type=${type === "PIECE" ? "PIECE" : "LOOK"}`}>{t("hype.drawer.see_ranking")}</Link>
          </section>
        )}
        {/* RF53: Selos de Hype conquistados e as próximas metas (some quando o detalhe não traz o progresso) */}
        {d?.sealProgress && <HypeSealProgressList progress={d.sealProgress} />}
        {d && <HypeVsStyle score={d.score} compatibility={d.compatibility} signedIn={!!user} />}
        <section aria-label={t("hype.history.title")}>
          <h3 className="type-h3 mb-2">{t("hype.history.title")}</h3>
          {history.loading ? <div className="skeleton h-40" aria-hidden /> : <HypeHistoryChart points={history.data?.points ?? []} />}
        </section>
        {d && d.status !== "NOT_CALCULATED" && (
          <section>
            <h3 className="type-h3 mb-2">{t("hype.drawer.breakdown")}</h3>
            {d.status === "INSUFFICIENT_DATA" && <p className="type-caption text-muted mb-2">{t("hype.drawer.structural_only")}</p>}
            <HypeBreakdown type={type} dimensions={d.dimensions} list={DIMENSION_ORDER} hints weights={d.weights} />
          </section>
        )}
        {d && d.status !== "NOT_CALCULATED" && (
          <section aria-label={t("hype.drawer.signals")}>
            <h3 className="type-h3 mb-1">{t("hype.drawer.signals")}</h3>
            <p className="type-caption text-muted mb-2">{t("hype.drawer.signals_hint", { days: windowDays })}</p>
            {rows.length === 0 ? <p className="type-body-sm text-muted">{t("hype.drawer.no_signals")}</p> : (
              <table className="hype-signals">
                <thead><tr><th scope="col">{t("hype.drawer.signal")}</th><th scope="col">{t("hype.drawer.current", { days: windowDays })}</th><th scope="col">{t("hype.drawer.previous", { days: windowDays })}</th><th scope="col">{t("hype.drawer.total")}</th></tr></thead>
                <tbody>{rows.map(([k, c]) => <tr key={k}><th scope="row">{t(`hype.signal.${k}`)}</th><td className="tabular">{c.current}</td><td className="tabular">{c.previous}</td><td className="tabular">{c.total}</td></tr>)}</tbody>
              </table>
            )}
            {type === "PIECE" && d.inLooks != null && <p className="type-body-sm mt-2">{t("hype.drawer.in_looks", { n: d.inLooks })}</p>}
          </section>
        )}
        {type === "SCHEME" && (d?.pieces?.length ?? 0) > 0 && (
          <section aria-label={t("hype.drawer.look_pieces")}>
            <h3 className="type-h3 mb-1">{t("hype.drawer.look_pieces")}</h3>
            <p className="type-caption text-muted mb-2">{t("hype.drawer.look_pieces_hint")}</p>
            <ul className="hype-look-pieces">
              {d!.pieces!.map((p) => (
                <li key={p.id}>
                  <span className="hype-look-piece-ph">{p.imageUrl && <img src={mediaUrl(p.imageUrl)} alt="" loading="lazy" />}</span>
                  <span className="min-w-0"><Link href={`/pieces/${p.id}`} className="hype-look-piece-name">{p.name}</Link><span className="type-caption text-muted">{[p.category, p.subcategory].filter(Boolean).map((k) => taxonomyLabel(k!)).join(" · ")}</span></span>
                  <HypeBadge state={hypeViewState(p.hype)} summary={p.hype} />
                </li>
              ))}
            </ul>
          </section>
        )}
        {d && d.status !== "NOT_CALCULATED" && <HypeExplanation type={type} score={d.score} momentum={d.momentum} reasons={d.reasons ?? []} />}
        {d && !d.publicEligible && d.status !== "NOT_CALCULATED" && <p className="type-caption text-muted">{t("hype.drawer.private")}</p>}
        {d?.algorithmVersion && <p className="type-caption text-faint">{t("hype.drawer.version", { version: d.algorithmVersion })}</p>}
      </div>
    </Sheet>
  );
}
