/**
 * O Fashion Detective no perfil de controles console: o que fica na roda X (as seis cores de ação da mão, cada uma
 * como um recurso: chave, disfarce, distração, lupa, fôlego, moeda), o que E alcança (a ação do ponto mais perto do
 * avatar, com o lugar dela na sala), o que a mira (A) trava com o recurso equipado e que carta da mão vai ao servidor.
 * Nada é decidido aqui: o alvo e a carta vão pelo mesmo /acionar de sempre e o servidor confere tudo. Puro.
 */
import { acoesPossiveis, vizinhos, type AcaoDeCor, type AcaoPossivel } from "@/lib/flair/detetive/acoes";
import type { Retrato } from "@/lib/flair/detetive/types";

/** A ordem da roda (a primeira no alto). */
export const ARSENAL: readonly AcaoDeCor[] = ["ABRIR", "FURTIVIDADE", "DANO", "PISTA", "VIDA", "MOEDA"];

/** A que distância (m) do lugar da ação E funciona, e até onde a mira alcança. */
export const RAIO_DE_INTERACAO = 1.6;
export const ALCANCE_DA_MIRA = 4.5;

/** As ações que têm lugar na sala (as outras ficam no painel de ações). */
const COM_LUGAR = new Set(["PORTA", "AJUDA", "ABRIR", "ESCONDER", "BOLSO", "CONFRONTO"]);

export interface CartaComAcao {
  id: string;
  acao: AcaoDeCor | null;
}

export interface ItemDoArsenal {
  acao: AcaoDeCor;
  /** as cartas da mão dessa cor (a primeira é a que vai) */
  cartas: string[];
}

export interface Interacao {
  acao: AcaoPossivel;
  x: number;
  z: number;
}

export function arsenalDaMao(mao: readonly CartaComAcao[]): ItemDoArsenal[] {
  return ARSENAL.map((acao) => ({ acao, cartas: mao.filter((c) => c.acao === acao).map((c) => c.id) }));
}

/** As ações do ponto que têm lugar na sala: portas e armários no ponto, vigias onde estão. */
export function interacoesDaSala(r: Retrato): Interacao[] {
  const aqui = r.layout.pontos.find((p) => p.id === r.ponto);
  if (!aqui) return [];
  return acoesPossiveis(r)
    .filter((a) => COM_LUGAR.has(a.verbo))
    .map((a) => {
      const v = a.verbo === "BOLSO" || a.verbo === "CONFRONTO" ? r.layout.vigias.find((x) => x.id === a.assunto) : null;
      return { acao: a, x: v?.x ?? aqui.x, z: v?.z ?? aqui.z };
    });
}

/** A interação mais perto do avatar, até `raio` metros. */
export function maisProxima(lista: readonly Interacao[], pos: { x: number; z: number }, raio = RAIO_DE_INTERACAO): Interacao | null {
  let melhor: { i: Interacao; d: number } | null = null;
  for (const i of lista) {
    const d = Math.hypot(i.x - pos.x, i.z - pos.z);
    if (d <= raio && (!melhor || d < melhor.d)) melhor = { i, d };
  }
  return melhor?.i ?? null;
}

/**
 * O alvo da mira com o recurso equipado: a ação de lugar daquela cor mais perto (porta, armário, bolso, vigia); a lupa
 * mira a primeira pista rasgada e o fôlego mira a própria detetive. Nulo se nada vale.
 */
export function alvoDaMira(r: Retrato, pos: { x: number; z: number }, equipada: AcaoDeCor | null): Interacao | null {
  if (!equipada) return null;
  if (equipada === "PISTA" || equipada === "VIDA") {
    const a = acoesPossiveis(r).find((x) => x.cor === equipada);
    return a ? { acao: a, x: pos.x, z: pos.z } : null;
  }
  return maisProxima(interacoesDaSala(r).filter((i) => i.acao.cor === equipada), pos, ALCANCE_DA_MIRA);
}

/** A carta da mão que paga a ação: a da cor pedida (qualquer uma, para trocar). */
export function cartaPara(cor: AcaoPossivel["cor"], mao: readonly CartaComAcao[]): string | null {
  if (!cor) return null;
  return (cor === "QUALQUER" ? mao[0] : mao.find((c) => c.acao === cor))?.id ?? null;
}

/**
 * Na planta 2D (sem WebGL ou com "reduzir movimento"), a seta leva ao vizinho que fica naquela direção (para cima é o
 * fundo da sala, -z). Nulo se nenhum vizinho fica a menos de 60° da seta.
 */
export function vizinhoNaDirecao(r: Retrato, v: { x: number; y: number }): string | null {
  const aqui = r.layout.pontos.find((p) => p.id === r.ponto);
  if (!aqui || Math.hypot(v.x, v.y) < 0.5) return null;
  const quer = Math.atan2(v.x, -v.y);
  let melhor: { id: string; d: number } | null = null;
  for (const id of vizinhos(r)) {
    const p = r.layout.pontos.find((x) => x.id === id)!;
    const ang = Math.atan2(p.x - aqui.x, p.z - aqui.z);
    const d = Math.abs(((ang - quer + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    if (d <= Math.PI / 3 && (!melhor || d < melhor.d)) melhor = { id, d };
  }
  return melhor?.id ?? null;
}
