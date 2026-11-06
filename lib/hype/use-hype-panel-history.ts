"use client";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { dimensionDelta } from "./layout-data";
import { fashionMetric } from "./fashion-card";
import { hypeBaseline, type HypeLive, type HypeSignalDirection } from "./hype-signal-store";
import { prefersReducedMotion, useHypeSignal } from "./use-hype-signal";
import type { HypeDimension, HypeSummary } from "./types";

/**
 * Histórico do painel de score dinâmico (ranked-bars, extremes, momentum).
 * - Com a AURA Hype viva (`live.enabled`): deltas contra o que ESTA pessoa viu da última vez (memória por usuário, entre
 *   sessões); as dimensões que mudaram no evento ganham `up`/`down` enquanto o sinal está em exibição.
 * - Sem ela (prévias, FLAIR, AURA desligada): o comportamento anterior — só snapshots mais novos recebidos nesta tela.
 */
export function useHypePanelHistory(summary: HypeSummary | null | undefined, live?: HypeLive) {
  const [previous, setPrevious] = useState<HypeSummary | null>(null);
  const latest = useRef<HypeSummary | null>(null);
  useEffect(() => {
    const old = latest.current;
    if (summary?.calculatedAt && old?.calculatedAt && Date.parse(summary.calculatedAt) > Date.parse(old.calculatedAt)) setPrevious(old);
    if (summary) latest.current = summary;
  }, [summary]);
  const signal = useHypeSignal(live);
  const base = live?.enabled ? hypeBaseline(live.scope, live.key) : null;

  const delta = (dimension: HypeDimension): number | null => {
    if (!base) return dimensionDelta(summary, previous, dimension);
    if (summary?.status !== "AVAILABLE") return null;
    const now = fashionMetric(summary.dimensions?.[dimension]);
    const before = base.dims[dimension];
    return now === null || before === undefined ? null : now - before;
  };
  const change = (dimension: HypeDimension): HypeSignalDirection | undefined => {
    const now = signal?.dims[dimension];
    const before = signal?.from.dims[dimension];
    if (now === undefined || before === undefined || now === before) return undefined;
    return now > before ? "up" : "down";
  };
  return { delta, change, signal, sinceVisit: !!base, baseDims: base?.dims };
}

/**
 * Reordenação animada das barras (FLIP) quando o evento toca: cada linha sai da posição que tinha na referência
 * anterior e desliza até a atual. Movimento reduzido: sem animação.
 */
export function useRankReorder(list: RefObject<HTMLElement | null>, enabled: boolean, seq: number | undefined, order: (string)[], baseOrder: string[] | null) {
  useLayoutEffect(() => {
    if (!enabled || seq === undefined || !baseOrder || prefersReducedMotion()) return;
    const nodes = [...(list.current?.querySelectorAll<HTMLElement>("[data-dimension]") ?? [])];
    if (nodes.length < 2) return;
    const step = nodes[1].getBoundingClientRect().top - nodes[0].getBoundingClientRect().top || nodes[0].getBoundingClientRect().height;
    for (const node of nodes) {
      const key = node.dataset.dimension ?? "";
      const from = baseOrder.indexOf(key);
      const to = order.indexOf(key);
      if (from < 0 || to < 0 || from === to || !step) continue;
      node.animate?.([{ transform: `translateY(${(from - to) * step}px)` }, { transform: "translateY(0)" }], { duration: 600, easing: "ease-out" });
    }
  }, [seq]); // eslint-disable-line react-hooks/exhaustive-deps -- anima uma vez por evento
}
