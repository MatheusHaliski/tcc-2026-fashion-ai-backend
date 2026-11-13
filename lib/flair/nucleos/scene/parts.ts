/**
 * Partes das salas: construtores curtos das primitivas, a conta de triângulos de cada forma (a mesma geometria que o
 * construtor 3D gera) e a colocação das partes de um móvel no lugar dele (posição e giro em y).
 */
import type { V3 } from "@/lib/flair/nucleos/types";
import type { Movel, Parte, ZonaNome } from "@/lib/flair/nucleos/scene/types";

const SEG_CILINDRO = 12;
const SEG_ESFERA = 12;
const SEG_TORO = 24;
/** lados do tubo do toro */
export const TORO_TUBO = 6;

export const caixa = (mat: string, tam: V3, pos: V3, rot?: V3): Parte => ({ forma: "caixa", tam, pos, rot, mat });

/** Caixa com os cantos chanfrados (o chanfro é proporcional ao menor lado). */
export const chanfrada = (mat: string, tam: V3, pos: V3, rot?: V3): Parte => ({ forma: "chanfrada", tam, pos, rot, mat });

export function cilindro(mat: string, raio: number | [number, number], altura: number, pos: V3, rot?: V3, seg = SEG_CILINDRO): Parte {
  const [topo, base] = typeof raio === "number" ? [raio, raio] : raio;
  return { forma: "cilindro", tam: [topo, altura, base], pos, rot, mat, seg };
}

export function esfera(mat: string, raio: number | V3, pos: V3, seg = SEG_ESFERA): Parte {
  const tam: V3 = typeof raio === "number" ? [raio, raio, raio] : raio;
  return { forma: "esfera", tam, pos, mat, seg };
}

export const plano = (mat: string, tam: [number, number], pos: V3, rot?: V3): Parte => ({ forma: "plano", tam: [tam[0], tam[1], 0], pos, rot, mat });

export function extrusao(mat: string, perfil: [number, number][], profundidade: number, pos: V3, rot?: V3): Parte {
  return { forma: "extrusao", tam: [1, 1, profundidade], pos, rot, mat, perfil };
}

export function toro(mat: string, raio: number, tubo: number, pos: V3, rot?: V3, seg = SEG_TORO): Parte {
  return { forma: "toro", tam: [raio, tubo, 0], pos, rot, mat, seg };
}

/** Triângulos que a geometria da parte tem (components/flair/nucleos/scene/part-geometry.ts gera exatamente isto). */
export function triangulosDaParte(p: Parte): number {
  switch (p.forma) {
    case "caixa":
      return 12;
    case "chanfrada":
      return 44;
    case "plano":
      return 2;
    case "cilindro": {
      const seg = p.seg ?? SEG_CILINDRO;
      return 2 * seg + (p.tam[0] > 0 ? seg : 0) + (p.tam[2] > 0 ? seg : 0);
    }
    case "esfera": {
      const seg = p.seg ?? SEG_ESFERA;
      return 2 * seg * (aneisDaEsfera(seg) - 1);
    }
    case "toro":
      return 2 * TORO_TUBO * (p.seg ?? SEG_TORO);
    case "extrusao": {
      const n = p.perfil?.length ?? 0;
      return n < 3 ? 0 : 4 * n - 4;
    }
  }
}

/** Anéis da esfera para um número de gomos. */
export function aneisDaEsfera(seg: number): number {
  return Math.max(4, Math.round(seg / 2));
}

export interface Em {
  pos: V3;
  giro?: number;
  zona?: ZonaNome;
  id?: string;
}

export function movel(tipo: string, em: Em, partes: Parte[]): Movel {
  return { tipo, pos: em.pos, giro: em.giro ?? 0, zona: em.zona ?? "decoracao", partes, id: em.id };
}

const RAD = Math.PI / 180;

/** Ponto do espaço do móvel no espaço da sala. */
export function noLugar(p: V3, pos: V3, giro: number): V3 {
  const c = Math.cos(giro * RAD);
  const s = Math.sin(giro * RAD);
  return [pos[0] + p[0] * c + p[2] * s, pos[1] + p[1], pos[2] - p[0] * s + p[2] * c];
}

/** Partes do móvel no espaço da sala. */
export function partesNoLugar(m: Movel): Parte[] {
  return m.partes.map((p) => {
    const rot: V3 = [p.rot?.[0] ?? 0, (p.rot?.[1] ?? 0) + m.giro, p.rot?.[2] ?? 0];
    return { ...p, pos: noLugar(p.pos, m.pos, m.giro), rot };
  });
}

/** Meia medida da parte no piso (raio de um círculo que a contém), a base e o topo, para as contas de zona. */
export function volumeDaParte(p: Parte): { raio: number; base: number; topo: number } {
  const [a, b, c] = p.tam;
  const y = p.pos[1];
  const inclinada = !!p.rot && (p.rot[0] !== 0 || p.rot[2] !== 0);
  if (p.forma === "cilindro") {
    const r = Math.max(a, c);
    const meia = inclinada ? Math.max(r, b / 2) : b / 2;
    return { raio: inclinada ? meia : r, base: y - meia, topo: y + meia };
  }
  if (p.forma === "esfera") return { raio: Math.max(a, c), base: y - b, topo: y + b };
  if (p.forma === "toro") return { raio: a + b, base: y - (inclinada ? b : a + b), topo: y + (inclinada ? b : a + b) };
  if (p.forma === "extrusao") {
    const pontos = p.perfil ?? [];
    const r = Math.max(0, ...pontos.map((q) => Math.hypot(q[0], q[1])));
    return { raio: r, base: y, topo: y + (inclinada ? c : r) };
  }
  const meia = (inclinada ? Math.max(a, b, c) : b) / 2;
  return { raio: Math.hypot(a, inclinada ? Math.max(b, c) : c) / 2, base: y - meia, topo: y + meia };
}
