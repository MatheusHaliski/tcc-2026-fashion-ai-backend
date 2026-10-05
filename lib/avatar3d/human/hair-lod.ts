/*
 * Avatar 3D (RF40) — níveis de detalhe do cabelo (plano docs/avatar3d/plano-cabelo-realista-e-acabamentos.md, A3.4).
 *
 *   0  fios         desktop forte (alta)    muitas fitas finas (≈3× o nível 1) + fios soltos
 *   1  fios leves   padrão (desktop e       fitas de mecha (o desenho da primeira versão)
 *                   celular intermediário)
 *   2  cards        celular fraco / GLB     uma fita larga por guia, ≤ 8 mil triângulos
 *   3  casca        reserva                 só a calota/cortina de hair-geometry.ts
 *
 * A escolha inicial vem do aparelho; durante a exibição, se o tempo de quadro passar do orçamento, o nível desce um
 * degrau (nunca sobe sozinho, para não ficar alternando). O GLB exportado sempre leva o nível 2.
 */

export type HairLod = 0 | 1 | 2 | 3;

export interface HairLodSpec {
  /** fração das guias do penteado usada no nível */
  guideFraction: number;
  /** fitas por guia (multiplica o padrão da textura; no nível 2 é sempre 1) */
  strandsPerGuide: number;
  /** largura da fita em relação ao nível 1 */
  width: number;
  /** pontos por fita, no máximo (menos pontos = menos triângulos) */
  maxPoints: number;
  /** fração de fios soltos na borda */
  stray: number;
  /** teto de triângulos das fitas (só os cards têm teto rígido) */
  maxTriangles?: number;
}

export const HAIR_LODS: Record<0 | 1 | 2, HairLodSpec> = {
  0: { guideFraction: 1, strandsPerGuide: 3, width: 0.5, maxPoints: 19, stray: 0.04 },
  1: { guideFraction: 1, strandsPerGuide: 1, width: 1, maxPoints: 19, stray: 0.03 },
  2: { guideFraction: 0.85, strandsPerGuide: 1, width: 4.2, maxPoints: 7, stray: 0, maxTriangles: 8000 },
};

/** Nível usado no arquivo GLB (funciona em qualquer visualizador de glTF, sem o sombreamento próprio dos fios). */
export const GLB_HAIR_LOD: HairLod = 2;

export interface DeviceInfo { mobile: boolean; webgl2: boolean; cores?: number; memoryGb?: number }

/** Lê o aparelho no navegador (sem navegador: desktop com WebGL2). */
export function deviceInfo(): DeviceInfo {
  if (typeof navigator === "undefined") return { mobile: false, webgl2: true };
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    mobile: /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent),
    webgl2: typeof WebGL2RenderingContext !== "undefined",
    cores: nav.hardwareConcurrency, memoryGb: nav.deviceMemory,
  };
}

/**
 * Nível inicial. `forced`: "0".."3" força o nível (testes, NEXT_PUBLIC_AVATAR_HAIR_LOD); "off" ou "0" em
 * NEXT_PUBLIC_AVATAR_HAIR_STRANDS desliga os fios (nível 3).
 */
export function chooseHairLod(d: DeviceInfo, forced?: string | null, strands?: string | null): HairLod {
  if (strands === "0" || strands === "off") return 3;
  if (forced && /^[0-3]$/.test(forced)) return Number(forced) as HairLod;
  if (!d.webgl2) return 2;
  if (d.mobile) return (d.memoryGb ?? 4) >= 4 && (d.cores ?? 4) >= 6 ? 1 : 2;
  // o padrão não usa dezenas de milhares de fios: o nível 0 só em máquina comprovadamente forte
  return (d.cores ?? 0) >= 8 && (d.memoryGb ?? 0) >= 8 ? 0 : 1;
}

/**
 * Vigia do tempo de quadro: média móvel de `window` quadros; acima do orçamento do nível, pede o nível seguinte.
 * Os primeiros quadros (montagem e compilação dos shaders) não contam.
 */
export class HairFrameBudget {
  private n = 0; private sum = 0; private skip: number;
  constructor(private readonly window = 90, warmup = 45) { this.skip = warmup; }
  /** Orçamento de quadro (ms) por nível: abaixo de ~45 qps no nível 0 e ~30 qps no nível 1, desce. */
  static budgetMs(l: HairLod): number { return l === 0 ? 22 : l === 1 ? 33 : Infinity; }
  /** `dtMs` do quadro; devolve o nível novo quando deve descer, senão null. */
  push(dtMs: number, current: HairLod): HairLod | null {
    if (current >= 2) return null;
    if (this.skip > 0) { this.skip--; return null; }
    this.n++; this.sum += Math.min(dtMs, 250);
    if (this.n < this.window) return null;
    const mean = this.sum / this.n; this.n = 0; this.sum = 0;
    if (mean > HairFrameBudget.budgetMs(current)) { this.skip = 45; return (current + 1) as HairLod; }
    return null;
  }
}
