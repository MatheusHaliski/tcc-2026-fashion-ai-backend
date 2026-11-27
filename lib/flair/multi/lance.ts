/** Regras puras do lance por turnos na tela (o servidor confere de novo: Flair3dSalaTurnos.conferir). */
import type { Lado, Turnos } from "@/lib/flair/multi/types";

const CARTA = "CARTA";

/** A vaga do lance para a carta: a única (CARTA) nos jogos de uma carta; senão a posição dela (vestido vai em SUP). */
export function vagaDaCarta(posicao: string, vagas: string[]): string | null {
  if (vagas.length === 1 && vagas[0] === CARTA) return CARTA;
  if (vagas.includes(posicao)) return posicao;
  return posicao === "VES" && vagas.includes("SUP") ? "SUP" : null;
}

/** O lance tem o mínimo de cartas que o jogo pede? */
export function lanceCompleto(lance: Record<string, string>, minimo: number): boolean {
  return Object.values(lance).filter(Boolean).length >= minimo;
}

/** As cartas que a pessoa lançou no turno anterior (já julgado), para marcar as cansadas da Batalha. */
export function cartasDoTurnoAnterior(turnos: Turnos, voce: Lado): string[] {
  const ultimo = turnos.julgados[turnos.julgados.length - 1];
  if (!ultimo) return [];
  const lado = (voce === "DE" ? ultimo.de : ultimo.para) as { cartas?: Record<string, string>; carta?: string | null };
  if (lado.cartas) return Object.values(lado.cartas);
  return lado.carta ? [lado.carta] : [];
}

/** Meus pontos e os da outra pessoa (soma da Batalha, vida do Dress Fighter, gols do Sports). */
export function placarDeQuemLe(turnos: Turnos, voce: Lado): { meu: number; outro: number } {
  return voce === "DE" ? { meu: turnos.pontos.de, outro: turnos.pontos.para } : { meu: turnos.pontos.para, outro: turnos.pontos.de };
}
