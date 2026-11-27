/**
 * Mesa de montagem, pura: as cartas postas por vaga e o histórico para desfazer. Vale para os elencos e para os
 * Desafios de Montagem. Pôr uma carta que já está em outra vaga troca as duas de lugar (ou só move, se a vaga de
 * destino estava vazia); cada jogada guarda o estado anterior, e desfazer volta uma jogada.
 */

export type Cartas = Record<string, string>;

export interface Mesa {
  cartas: Cartas;
  /** estados anteriores, o mais recente por último */
  passado: Cartas[];
}

export const MESA_VAZIA: Mesa = { cartas: {}, passado: [] };

const LIMITE = 40;

function jogada(mesa: Mesa, cartas: Cartas): Mesa {
  return { cartas, passado: [...mesa.passado, mesa.cartas].slice(-LIMITE) };
}

/** Vaga em que a carta está, se estiver na mesa. */
export function vagaDaCarta(cartas: Cartas, cardId: string): string | null {
  return Object.keys(cartas).find((v) => cartas[v] === cardId) ?? null;
}

/**
 * Põe a carta na vaga. Se a carta vinha de outra vaga e a de destino tinha carta, as duas trocam de lugar quando
 * `podeTrocar` deixa (a carta deslocada cabe na vaga de origem); senão a deslocada sai da mesa.
 */
export function por(mesa: Mesa, vaga: string, cardId: string, podeTrocar: (cardId: string, vaga: string) => boolean = () => true): Mesa {
  if (mesa.cartas[vaga] === cardId) return mesa;
  const origem = vagaDaCarta(mesa.cartas, cardId);
  const deslocada = mesa.cartas[vaga];
  const cartas: Cartas = { ...mesa.cartas };
  if (origem) delete cartas[origem];
  cartas[vaga] = cardId;
  if (origem && deslocada && podeTrocar(deslocada, origem)) cartas[origem] = deslocada;
  return jogada(mesa, cartas);
}

export function tirar(mesa: Mesa, vaga: string): Mesa {
  if (!mesa.cartas[vaga]) return mesa;
  const cartas = { ...mesa.cartas };
  delete cartas[vaga];
  return jogada(mesa, cartas);
}

export function limpar(mesa: Mesa): Mesa {
  return Object.keys(mesa.cartas).length ? jogada(mesa, {}) : mesa;
}

export function desfazer(mesa: Mesa): Mesa {
  if (!mesa.passado.length) return mesa;
  return { cartas: mesa.passado[mesa.passado.length - 1], passado: mesa.passado.slice(0, -1) };
}

/** Próxima vaga vazia depois de `atual` na ordem dada (dá a volta); null se todas têm carta. */
export function proximaVazia(ordem: string[], cartas: Cartas, atual: string): string | null {
  const i = Math.max(0, ordem.indexOf(atual));
  for (let k = 1; k <= ordem.length; k++) {
    const vaga = ordem[(i + k) % ordem.length];
    if (!cartas[vaga]) return vaga;
  }
  return null;
}

const PREFIXO = "fai.flair.montagem.";

/** Lê a montagem guardada neste aparelho, só com vagas e cartas que ainda existem. */
export function lerGuardada(chave: string, vagas: string[], cartasValidas: Set<string>): Cartas {
  try {
    const bruto = JSON.parse(localStorage.getItem(PREFIXO + chave) ?? "{}") as unknown;
    if (!bruto || typeof bruto !== "object") return {};
    const sai: Cartas = {};
    const usadas = new Set<string>();
    for (const vaga of vagas) {
      const id = (bruto as Record<string, unknown>)[vaga];
      if (typeof id === "string" && cartasValidas.has(id) && !usadas.has(id)) {
        sai[vaga] = id;
        usadas.add(id);
      }
    }
    return sai;
  } catch {
    return {};
  }
}

/** Guarda a montagem neste aparelho (mesa vazia apaga a entrada). */
export function guardar(chave: string, cartas: Cartas): void {
  try {
    if (Object.keys(cartas).length) localStorage.setItem(PREFIXO + chave, JSON.stringify(cartas));
    else localStorage.removeItem(PREFIXO + chave);
  } catch {
    /* armazenamento indisponível: a montagem só não persiste */
  }
}
