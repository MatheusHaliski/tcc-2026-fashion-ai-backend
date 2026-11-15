/**
 * Níveis de detalhe das pessoas de cena (docs/flair/flair-3d/BASE_NUCLEOS.md, "Pessoas de cena"). Ninguém vira pino:
 *
 * - COMPLETO: o corpo humano inteiro (pele, olhos, cabelo, roupa com acabamentos), sombra e animação a cada quadro.
 *   Vale perto da câmera e para quem está na jogada, a qualquer distância.
 * - LEVE: o mesmo corpo, sem os acabamentos de poucos pixels (costuras, cadarço, córnea), sem sombra e animado a cada
 *   dois quadros.
 * - LONGE: o corpo leve (components/flair/nucleos/gente/corpo-leve.ts): o humano leve da torcida com as cores da roupa,
 *   da pele e do cabelo da pessoa e a altura dela. Continua gente, sem o custo do corpo completo.
 * - TORCIDA: multidão de arquibancada ou plateia, em humanos leves instanciados (cabeça, cabelo, tronco, braços e
 *   pernas), com a cor da roupa e da pele de cada um. Poucas chamadas de desenho para centenas de pessoas.
 *
 * Puro.
 */
export type NivelDeDetalhe = "COMPLETO" | "LEVE" | "LONGE";

/** Até onde (metros da câmera) vale cada nível. */
export const DISTANCIA_COMPLETO = 16;
export const DISTANCIA_LEVE = 26;

export function nivelDeDetalhe(distancia: number, naJogada = false): NivelDeDetalhe {
  if (naJogada || distancia < DISTANCIA_COMPLETO) return "COMPLETO";
  return distancia < DISTANCIA_LEVE ? "LEVE" : "LONGE";
}

/** De quantos em quantos quadros a pessoa é animada. */
export const QUADROS_POR_NIVEL: Record<NivelDeDetalhe, number> = { COMPLETO: 1, LEVE: 2, LONGE: 4 };

/**
 * Triângulos por pessoa (docs/flair/flair-3d/BASE_NUCLEOS.md, "Pessoas de cena"): o corpo humano vestido foi medido na
 * transmissão do Fashion Sports (renderer.info: de 6 para 10 jogadores na cena, +162 mil triângulos por quadro, com a
 * passada de sombra); a pessoa da torcida é contada na geometria (torcida-3d.tsx, conferido por teste).
 */
export const TRIANGULOS_POR_PESSOA = { humano: 40000, torcida: 364 } as const;

/** Orçamento de triângulos de uma cena com gente: o cenário, os humanos e a torcida. */
export function triangulosComGente(cenario: number, humanos: number, torcida: number): number {
  return cenario + humanos * TRIANGULOS_POR_PESSOA.humano + torcida * TRIANGULOS_POR_PESSOA.torcida;
}
