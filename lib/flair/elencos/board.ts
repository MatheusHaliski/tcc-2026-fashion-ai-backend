/**
 * Estado das peças do quebra-cabeça das cenas dinâmicas (desafios de montagem, lib/flair/cenas) e a grade delas. Os
 * elencos em quebra-cabeça com imagens usam lib/flair/elencos/progresso.ts.
 */

export type PecaEstado = "verde" | "laranja" | "vermelha" | "chegando" | "coberta";

/** Grade do quebra-cabeça para n peças: colunas ≈ √(n·1,6) (imagem 16:10), fileiras para caber todas. */
export function gradeDoQuebraCabeca(n: number): { colunas: number; fileiras: number } {
  const colunas = Math.max(1, Math.round(Math.sqrt(n * 1.6)));
  return { colunas, fileiras: Math.max(1, Math.ceil(n / colunas)) };
}
