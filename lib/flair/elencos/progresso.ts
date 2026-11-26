/**
 * Progresso do quebra-cabeça do elenco, puro. Cada vaga é uma peça: vazia sem carta; conferindo enquanto o servidor
 * não julgou a carta que está nela (o /conferir não voltou ou voltou para outra carta); encaixada quando o servidor diz
 * que a carta cumpre o que a vaga pede; fora quando não cumpre. A tela nunca encaixa uma peça que o servidor não julgou.
 * `cartaCumpre` só ordena a bandeja (as cartas que combinam primeiro): quem julga é o servidor.
 */
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import type { ElencoConferencia, ElencoVaga } from "@/lib/flair/elencos/types";

export type EstadoPeca = "vazia" | "conferindo" | "encaixada" | "fora";

export function estadosDasPecas(vagas: ElencoVaga[], cartas: Record<string, string>, conf: ElencoConferencia | null,
  conferidas: Record<string, string>): Record<string, EstadoPeca> {
  return Object.fromEntries(vagas.map((v) => {
    if (!cartas[v.chave]) return [v.chave, "vazia"];
    if (!conf || conferidas[v.chave] !== cartas[v.chave]) return [v.chave, "conferindo"];
    return [v.chave, conf.pecas?.[v.chave] ? "encaixada" : "fora"];
  }));
}

export function encaixadas(estados: Record<string, EstadoPeca>): number {
  return Object.values(estados).filter((e) => e === "encaixada").length;
}

/** Cores da taxonomia por família (as que os elencos pedem): "crimson" vale como vermelha, "navy" como azul. */
const FAMILIAS: Record<string, string[]> = {
  red: ["red", "crimson", "burgundy", "maroon", "rust"],
  green: ["green", "olive", "military_green", "forest_green", "mint", "sage", "emerald"],
  blue: ["blue", "navy", "light_blue", "sky_blue", "cobalt", "denim", "teal"],
  orange: ["orange", "terracotta", "amber", "apricot"],
  black: ["black", "charcoal", "washed_black"],
  pink: ["pink", "hot_pink", "rose", "coral", "salmon"],
  purple: ["purple", "violet", "lilac", "lavender", "plum"],
};

const CAMPO: Record<string, "colors" | "styles" | "occasions"> = { color: "colors", style: "styles", occasion: "occasions" };

/** A carta parece cumprir o que a vaga pede (vaga sem pedido aceita qualquer carta). */
export function cartaCumpre(card: Pick<FlairCollectionCard, "tags">, pede: Record<string, string[]> | undefined): boolean {
  return Object.entries(pede ?? {}).every(([campo, valores]) => {
    const tem = (card.tags?.[CAMPO[campo]] ?? []).map((x) => x.toLowerCase());
    return valores.some((v) => (campo === "color" ? FAMILIAS[v] ?? [v] : [v]).some((x) => tem.includes(x)));
  });
}
