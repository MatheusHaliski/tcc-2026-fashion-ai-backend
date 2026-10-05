"use client";
import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/i18n";
import { hypeViewState, levelTone } from "@/lib/hype/model";
import { useHypeSummary } from "@/lib/hype/use-hype";
import type { HypeSummary } from "@/lib/hype/types";
import { Spinner, cn } from "@/components/ui";
import { HypeBadge } from "./hype-badge";
import { LookScores, type LookScoreValues } from "./look-scores";

/**
 * RF53 · Lote 2 — Hype no editor de look (P1-08) e Hype das peças de um look (anatomia Hype Focus, P1-09). O Hype das
 * peças vem do mesmo cache em lote dos cards (`useHypeSummary`); a prévia do look vem de `POST /api/schemes/scores`,
 * que só LÊ o estado gravado: nada é salvo e nenhum sinal de Hype é emitido.
 */

/** Hype v2 de uma peça como o cache o entrega (resumo, carregando, erro). */
export interface PieceHype { summary?: HypeSummary; loading: boolean; error: boolean }

/** Assina o Hype de UMA peça e avisa quem pediu — sem render. Evita hooks em laço quando a lista de peças muda. */
function PieceHypeProbe({ id, onChange }: { id: string; onChange: (id: string, h: PieceHype) => void }) {
  const h = useHypeSummary("PIECE", id);
  useEffect(() => { onChange(id, { summary: h.summary, loading: h.loading, error: h.error }); }, [id, h.summary, h.loading, h.error, onChange]);
  return null;
}

/**
 * Hype v2 de várias peças (lote): devolve o mapa por id e os `probes`, que quem chama precisa renderizar. Cada peça
 * assina só a própria chave do cache; com o cache já cheio (primeHype, cards na mesma tela) não sai requisição nova.
 * Peça ainda sem resposta não aparece no mapa (= carregando).
 */
export function usePiecesHype(ids: string[], enabled = true): { byId: Record<string, PieceHype>; probes: ReactNode } {
  const [byId, setById] = useState<Record<string, PieceHype>>({});
  const onChange = useCallback((id: string, h: PieceHype) => setById((m) => {
    const old = m[id];
    return old && old.summary === h.summary && old.loading === h.loading && old.error === h.error ? m : { ...m, [id]: h };
  }), []);
  const unique = [...new Set(ids)];
  return { byId, probes: enabled ? <>{unique.map((id) => <PieceHypeProbe key={id} id={id} onChange={onChange} />)}</> : null };
}

/**
 * Hype de uma peça escolhida no editor (slots e revisão): o badge do card ("🔥 72 ↑") e a faixa em texto ao lado. É o
 * Hype PESSOAL do dono (a peça é dele, privada ou não). Sem dados: "🔥 —", nunca 0.
 */
export function PieceHypeTag({ id, className }: { id: string; className?: string }) {
  const { t } = useI18n();
  const h = useHypeSummary("PIECE", id);
  const state = hypeViewState(h.summary, h);
  return (
    <span className={cn("look-hype-tag", className)}>
      <HypeBadge state={state} summary={h.summary} />
      {state.kind === "available" && <span className={cn("hype-level-chip", levelTone(state.level))}>{t(`hype.level.${state.level}`)}</span>}
    </span>
  );
}

/** Resposta de POST /api/schemes/scores. */
export interface LookPreview {
  scores: LookScoreValues;
  /** base do número de Hype: média do v2 das peças com dados (withData de total) */
  hype?: { basis: "PIECES_AVERAGE"; withData: number; total: number } | null;
  persisted?: boolean;
}

/** Espera depois da última mudança (peça, ocasião, estilo) antes de pedir a prévia de novo. */
export const PREVIEW_DEBOUNCE_MS = 400;

/**
 * "Prévia do look" no editor: os seis números de RecommendationScoring (compatibilidade com o DNA · Hype · novidade ·
 * reutilização · uso · sustentabilidade), lado a lado e nunca somados numa nota. O Hype aqui é a média das peças — o
 * Hype do próprio look só nasce dos sinais dele depois de salvo, e a tela diz isso. `schemeId` = look em edição (os
 * pares dele não contam como "já combinados").
 */
export function LookHypePreview({ pieceIds, occasion = [], style = [], schemeId }: { pieceIds: string[]; occasion?: string[]; style?: string[]; schemeId?: string | null }) {
  const { t } = useI18n();
  const titleId = useId();
  const key = JSON.stringify([[...pieceIds].sort(), [...occasion].sort(), [...style].sort(), schemeId ?? null]);
  const [state, setState] = useState<{ loading: boolean; data: LookPreview | null; failed: boolean }>({ loading: false, data: null, failed: false });
  useEffect(() => {
    if (!pieceIds.length) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true, failed: false }));   // mantém os números anteriores enquanto recalcula
    const h = setTimeout(() => {
      api.post<LookPreview>("/api/schemes/scores", { pieceIds, occasion, style, schemeId: schemeId ?? null })
        .then((r) => { if (alive) setState({ loading: false, data: r, failed: false }); })
        .catch(() => { if (alive) setState({ loading: false, data: null, failed: true }); });
    }, PREVIEW_DEBOUNCE_MS);
    return () => { alive = false; clearTimeout(h); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const basis = state.data?.hype;
  return (
    <section className="look-hype-preview" aria-labelledby={titleId} aria-busy={state.loading}>
      <p id={titleId} className="label mb-0">{t("hypeBuilder.preview_title")}</p>
      {!pieceIds.length ? <p className="type-caption text-muted">{t("hypeBuilder.preview_empty")}</p>
        : state.failed ? <p className="type-caption text-muted" role="status">{t("hypeBuilder.preview_error")}</p>
        : !state.data ? <p className="flex items-center gap-2 type-caption text-muted" role="status"><Spinner size={14} />{t("hypeBuilder.preview_loading")}</p>
        : (
          <>
            <LookScores scores={state.data.scores} />
            {basis && <p className="type-caption text-muted">{basis.withData > 0 ? t("hypeBuilder.preview_basis", { withData: basis.withData, total: basis.total }) : t("hypeBuilder.preview_basis_none")}</p>}
            <p className="type-caption text-faint">{t("hypeBuilder.preview_note")}</p>
          </>
        )}
    </section>
  );
}
