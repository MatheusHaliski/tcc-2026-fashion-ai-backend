"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n";
import { levelAtLeast, levelTone } from "@/lib/hype/model";
import type { HypeGroupSummary, HypeRankGroup } from "@/lib/hype/types";
import { useHypeGroup } from "@/lib/hype/use-hype-group";
import { cn } from "@/components/ui";

/**
 * Lote A1 (P2-02, P2-03, P2-06, P2-10) — Hype agregado de um criador (CREATOR, chave = id) ou de uma marca (BRAND,
 * chave = nome). Média dos 5 itens PÚBLICOS mais relevantes, com o mínimo de 3 itens públicos; grupo insuficiente,
 * bloqueado, carregando ou com erro = nada na tela (nunca "0"). A faixa aparece sempre em texto.
 *
 * - `variant="chip"` (busca, /brands): só a partir da faixa "Em alta" — "Criador em alta" / "Marca em alta" com o número
 *   (e a faixa quando passa de "Em alta"). Abaixo disso, nada: o chip sinaliza relevância do momento, não classifica
 *   pessoas nem marcas. Nunca ordena a lista: a ordem da busca continua a do backend.
 * - `variant="header"` (cabeçalho do perfil): o agregado inteiro — "Hype do criador/da marca", faixa, número, base de
 *   itens públicos e a posição no ranking — com link para Explorador › Em alta.
 *
 * `group` (já veio na resposta, ex.: feed de /brands) evita a requisição; sem ele, o chip pede em lote (`useHypeGroup`).
 */
export function HypeGroupBadge({ type, groupKey, group: given, variant = "chip", className }: {
  type: HypeRankGroup; groupKey?: string | null; group?: HypeGroupSummary | null; variant?: "chip" | "header"; className?: string;
}) {
  const { t } = useI18n();
  const fetched = useHypeGroup(type, given === undefined ? groupKey : null, given === undefined);
  const g = given === undefined ? fetched.group : given;
  if (!g || !g.sufficient || g.value == null || !g.level) return null;
  const value = Math.round(g.value);
  const level = t(`hype.level.${g.level}`);
  const meaning = t("hypeGroups.aria", { kind: t(type === "BRAND" ? "hypeGroups.kind_brand" : "hypeGroups.kind_creator"), value, level, items: g.items });
  if (variant === "chip") {
    if (!levelAtLeast(g.level, "HOT")) return null;
    return (
      <span className={cn("hype-group-badge", levelTone(g.level), className)} title={meaning} data-hype-group={type}>
        <span aria-hidden>🔥</span>
        <span className="hype-group-badge-label">{t(type === "BRAND" ? "hypeGroups.brand_hot" : "hypeGroups.creator_hot")}</span>
        {g.level !== "HOT" && <span className={cn("hype-level-chip", levelTone(g.level))}>{level}</span>}
        <b className="tabular" aria-hidden>{value}</b>
        <span className="sr-only">{meaning}</span>
      </span>
    );
  }
  return (
    <Link href={`/explorer?tab=trending&type=${type}`} className={cn("hype-group-header", className)} title={t("hypeGroups.header_hint")} data-hype-group={type}>
      <span className="hype-group-header-label">{t(type === "BRAND" ? "hypeGroups.header_brand" : "hypeGroups.header_creator")}</span>
      <span className={cn("hype-level-chip", levelTone(g.level))}>{level}</span>
      <span className="hype-group-header-value" aria-hidden>🔥 <b className="tabular">{value}</b></span>
      <span className="hype-group-header-base">{t("hypeGroups.base", { items: g.items })}{g.rank ? ` · ${t("hypeGroups.rank", { n: g.rank })}` : ""}</span>
      <span className="sr-only">{meaning}</span>
    </Link>
  );
}
