/**
 * Quadro da tela de jogo (docs/flair/flair-3d/DESENHO_DA_TELA.md, seção 1): porte do aparelho, proporção do quadro,
 * divisão palco/deck, zona da roupa e o tamanho das cartas (5 por 7) em cada porte. Puro: a tela só lê o viewport.
 */
import type { CSSProperties } from "react";

export type Porte = "celular" | "tablet" | "computador";
/** retrato: largura inteira e altura da tela menos a barra do app; paisagem: até 1280 px, centralizado, 16:10 */
export type Quadro = "retrato" | "paisagem";

/** menor lado abaixo disto = celular */
export const LADO_TABLET = 600;
/** largura a partir da qual é computador */
export const LARGURA_COMPUTADOR = 1100;
/** largura mínima do quadro deitado (computador e tablet deitado) */
export const LARGURA_PAISAGEM = 900;
export const LARGURA_MAX_QUADRO = 1280;

export type Medida = readonly [largura: number, altura: number];

export interface Tamanhos {
  carta: Medida;
  espaco: number;
  /** cartas visíveis sem rolar */
  visiveis: number;
  miniatura: Medida;
  ampliada: Medida;
}

export const TAMANHOS: Record<Porte, Tamanhos> = {
  celular: { carta: [76, 106], espaco: 8, visiveis: 4, miniatura: [44, 62], ampliada: [240, 336] },
  tablet: { carta: [92, 129], espaco: 10, visiveis: 6, miniatura: [52, 73], ampliada: [280, 392] },
  computador: { carta: [108, 151], espaco: 12, visiveis: 8, miniatura: [60, 84], ampliada: [300, 420] },
};

/** Parte da altura do quadro que é do palco 3D; o resto é do deck e dos recursos. */
export const PALCO: Record<Quadro, number> = { retrato: 56, paisagem: 62 };

/** Zona da roupa: faixa central do palco (40% da largura) que nenhum painel, efeito ou texto invade. */
export const ZONA_ROUPA = { esquerda: 30, largura: 40 } as const;

/** Área de toque mínima, em px. */
export const TOQUE_MIN = 44;

export interface QuadroLayout {
  porte: Porte;
  quadro: Quadro;
  palco: number;
  deck: number;
  tamanhos: Tamanhos;
}

export function porteDoViewport(largura: number, altura: number): Porte {
  if (Math.min(largura, altura) < LADO_TABLET) return "celular";
  return largura >= LARGURA_COMPUTADOR ? "computador" : "tablet";
}

export function quadroDoViewport(largura: number, altura: number): QuadroLayout {
  const porte = porteDoViewport(largura, altura);
  const deitado = largura > altura && largura >= LARGURA_PAISAGEM && porte !== "celular";
  const quadro: Quadro = deitado ? "paisagem" : "retrato";
  return { porte, quadro, palco: PALCO[quadro], deck: 100 - PALCO[quadro], tamanhos: TAMANHOS[porte] };
}

/** Classes do quadro: `is-celular | is-tablet | is-computador` e `is-retrato | is-paisagem`. */
export function classesDoQuadro(layout: QuadroLayout): string {
  return `n3d-frame is-${layout.porte} is-${layout.quadro}`;
}

/** Medidas do porte como variáveis de CSS (as folhas de estilo só leem estas variáveis). */
export function estiloDoQuadro(layout: QuadroLayout): CSSProperties {
  const t = layout.tamanhos;
  const vars: Record<string, string> = {
    "--n3d-palco": `${layout.palco}fr`,
    "--n3d-deck": `${layout.deck}fr`,
    "--n3d-card-w": `${t.carta[0]}px`,
    "--n3d-card-h": `${t.carta[1]}px`,
    "--n3d-gap": `${t.espaco}px`,
    "--n3d-thumb-w": `${t.miniatura[0]}px`,
    "--n3d-thumb-h": `${t.miniatura[1]}px`,
    "--n3d-big-w": `${t.ampliada[0]}px`,
    "--n3d-big-h": `${t.ampliada[1]}px`,
    "--n3d-zona-x": `${ZONA_ROUPA.esquerda}%`,
    "--n3d-zona-w": `${ZONA_ROUPA.largura}%`,
  };
  return vars as CSSProperties;
}

/** Largura da fileira com as cartas visíveis sem rolar (confere com a tabela do desenho). */
export function larguraDaFileira(t: Tamanhos): number {
  return t.visiveis * t.carta[0] + (t.visiveis - 1) * t.espaco;
}
