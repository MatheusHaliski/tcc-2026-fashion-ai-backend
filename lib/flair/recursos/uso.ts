/**
 * O uso de uma peça na tela, antes de o servidor responder: o medidor já sobe com a quantidade que o próprio servidor
 * mandou no perfil da peça (a tela não inventa número) e, com a resposta, fica com o valor dele. Se ele recusar, volta.
 * Puro.
 */
import { COM_TETO, type PerfilDaPeca, type Recurso, type RecursosDaPartida } from "@/lib/flair/recursos/types";

export function somar(recurso: Recurso, atual: number, quantidade: number): number {
  const total = Math.max(0, atual + quantidade);
  return COM_TETO.includes(recurso) ? Math.min(100, total) : total;
}

/** O estado otimista depois de usar a carta. */
export function usoOtimista(estado: RecursosDaPartida, cardId: string, perfil: PerfilDaPeca): RecursosDaPartida {
  const antes = estado.recursos[perfil.recurso] ?? 0;
  const depois = somar(perfil.recurso, antes, perfil.quantidade);
  return {
    recursos: { ...estado.recursos, [perfil.recurso]: depois },
    usados: { ...estado.usados, [cardId]: (estado.usados[cardId] ?? 0) + 1 },
    uso: { carta: cardId, recurso: perfil.recurso, quantidade: perfil.quantidade, antes, depois },
  };
}

/** Quantos usos ainda restam à carta nesta partida (0 = gasta). */
export function usosRestantes(estado: RecursosDaPartida | null, cardId: string, perfil: PerfilDaPeca): number {
  return Math.max(0, perfil.usos - (estado?.usados[cardId] ?? 0));
}

/**
 * As cartas que dá para usar como recurso: as do deck; nos jogos sem deck (o Road to Glory veste do guarda-roupa
 * inteiro), só as vestidas na partida, como o servidor confere (Flair3dRecursoUso.usaveis).
 */
export function cartasUsaveis<T extends { id: string }>(cartas: T[], soVestidas?: Record<string, string>): T[] {
  if (!soVestidas) return cartas;
  const vestidas = new Set(Object.values(soVestidas));
  return cartas.filter((c) => vestidas.has(c.id));
}
