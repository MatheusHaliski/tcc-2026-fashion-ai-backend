/**
 * A rodada é cumprível com estas cartas? (auditoria dos jogos de 15/11, defeito 4: temas Brasil, Noite e Clássico da
 * Passarela, o pedido da Boutique e a marca brasileira do Rio não tinham carta na conta, e a pessoa só descobria no
 * resultado.) Lê os selos que o servidor já manda para cada carta (POST .../efeitos): uma carta pontua quando tem um
 * efeito que não é motivo; uma regra de peça (marca brasileira, cima leve, baixo leve, cor quente) fica sem carta quando
 * nenhuma carta tem o efeito dela. Sem a resposta do servidor, nada se afirma. Puro.
 */
import { pontua } from "@/lib/flair/nucleos/card-fx";
import type { EfeitoItem } from "@/lib/flair/nucleos/types";

/** Regras que uma peça cumpre sozinha e cujo efeito tem o mesmo código da regra. */
export const REGRAS_DE_PECA = new Set(["MARCA_BR", "CIMA_LEVE", "BAIXO_LEVE", "COR_QUENTE", "OCASIAO", "MATERIAL_LEVE", "CALCADO_FECHADO", "ACESSORIO"]);

export interface Viabilidade {
  /** nenhuma carta pontua nesta rodada: a nota sai 0 */
  semPontos: boolean;
  /** regras de peça que nenhuma carta cumpre (os pontos delas ficam de fora) */
  regrasSemCarta: string[];
}

/** Uma carta pontua aqui: efeito que não é motivo (a cor de cena não conta, a não ser que seja a própria regra). */
function cartaPontua(itens: EfeitoItem[], regras: Set<string>): boolean {
  return !!pontua(itens) || itens.some((i) => !i.motivo && regras.has(i.codigo));
}

/**
 * A viabilidade da rodada com estas cartas. `regras` são os códigos das regras da rodada; `efeitos`, os selos de cada
 * carta (undefined enquanto o servidor não respondeu). Nulo quando não há o que dizer (sem cartas ou sem resposta).
 * `outrosRecursos`: a nota não vem só das cartas (a maquiagem do Road to Glory vale metade): mesmo sem carta que pontue a
 * nota não sai 0, então o aviso é sempre o das regras de roupa que nenhuma carta cumpre.
 */
export function viabilidade(regras: string[], efeitos: (EfeitoItem[] | undefined)[], outrosRecursos = false): Viabilidade | null {
  if (efeitos.length === 0 || efeitos.some((e) => e === undefined)) return null;
  const lista = efeitos as EfeitoItem[][];
  const codigos = new Set(regras);
  // jogos de zonas e artísticos não mandam selo nenhum: ali não há o que avisar
  const comSelo = lista.filter((itens) => itens.length > 0);
  const semPontos = !outrosRecursos && comSelo.length > 0 && !comSelo.some((itens) => cartaPontua(itens, codigos));
  const temEfeito = (codigo: string) => lista.some((itens) => itens.some((i) => i.codigo === codigo && !i.motivo));
  const regrasSemCarta = semPontos ? [] : regras.filter((r) => REGRAS_DE_PECA.has(r) && !temEfeito(r));
  return semPontos || regrasSemCarta.length ? { semPontos, regrasSemCarta } : null;
}

/** Nas cartas escolhidas só vale avisar que nenhuma pontua (a regra sem carta já foi dita para a coleção). */
export function semPontosNoDeck(v: Viabilidade | null): Viabilidade | null {
  return v?.semPontos ? v : null;
}
