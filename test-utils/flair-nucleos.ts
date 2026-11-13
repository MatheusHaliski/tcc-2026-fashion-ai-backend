/** Dados dos testes da tela de jogo: cartas da pessoa, definições de núcleo e resultados do servidor. */
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { definicaoLocal } from "@/lib/flair/nucleos/registry";
import type { NucleoCodigo, NucleoDefinicao, NucleoResultado } from "@/lib/flair/nucleos/types";

export function carta(id: string, name: string, position: string, over: Partial<FlairCollectionCard> = {}): FlairCollectionCard {
  return {
    id,
    originType: "PIECE",
    originId: `p-${id}`,
    season: "SPRING",
    tier: "PRATA",
    ovr: 70,
    rare: false,
    position,
    name,
    brandName: "Atelier Lumi",
    imageUrl: null,
    hype: null,
    priceVerified: true,
    state: "AVAILABLE",
    tradeable: true,
    acquiredVia: "GENERATED",
    ...over,
  };
}

/** c1 pontua (ouro, Hype alto), c2 não pontua, c3 pontua (calçado), c5 é outra parte de cima sem efeito. */
export const CARTAS: FlairCollectionCard[] = [
  carta("c1", "Camisa verde", "SUP", { tier: "OURO", hype: { HYP: 91 } }),
  carta("c5", "Regata cinza", "SUP"),
  carta("c2", "Calça linho", "INF"),
  carta("c3", "Tênis azul", "CAL", { tier: "ESPECIAL" }),
];

export const EFEITOS = {
  efeitos: [
    { cardId: "c1", itens: [{ codigo: "MARCA_BR", valor: 10 }] },
    { cardId: "c3", itens: [{ codigo: "MARCA_BR", valor: 10 }] },
  ],
};

export function definicao(codigo: NucleoCodigo): NucleoDefinicao {
  return definicaoLocal(codigo);
}

export const RESULTADO_PASSARELA: NucleoResultado = {
  pontos: 80,
  estrelas: 2,
  resultado: "APROVADO",
  regras: [{ codigo: "MARCA_BR", ok: true, pontos: 20 }, { codigo: "TODAS_BR", ok: false, pontos: 0 }],
  eventos: [],
};

export const RESULTADO_LUTA: NucleoResultado = {
  pontos: 100,
  estrelas: 3,
  resultado: "VITORIA",
  regras: [{ codigo: "VITORIA", ok: true, pontos: 100 }, { codigo: "UM_ROUND", ok: false, pontos: 0 }],
  eventos: [
    { codigo: "ROUND", valor: { round: 1, atributo: "VELOCIDADE", voce: 52, oponente: 40, venceu: true } },
    { codigo: "ROUND", valor: { round: 2, atributo: "ATAQUE", voce: 31, oponente: 40, venceu: false } },
    { codigo: "ROUND", valor: { round: 3, atributo: "DEFESA", voce: 60, oponente: 40, venceu: true } },
  ],
};

/** Viewport do jsdom (a tela lê innerWidth/innerHeight para o porte e a proporção do quadro). */
export function viewport(largura: number, altura: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: largura });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: altura });
}
