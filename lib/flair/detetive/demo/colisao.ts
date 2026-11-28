/**
 * Colisão simples da demonstração: o corpo é um círculo no chão; paredes, móveis e a porta fechada são caixas. Andar
 * tenta o passo inteiro e, se bate, escorrega por um eixo (anda rente à parede). A linha de visão (vigias, alfinetes)
 * é cortada por qualquer caixa. Puro.
 */
import { LIMITES } from "@/lib/flair/detetive/demo/mundo";
import type { Caixa, Ponto } from "@/lib/flair/detetive/demo/tipos";

function dentro(p: Ponto, c: Caixa, raio: number): boolean {
  return p.x > c.x0 - raio && p.x < c.x1 + raio && p.z > c.z0 - raio && p.z < c.z1 + raio;
}

/** O corpo (círculo de raio `raio`) cabe neste lugar: dentro da sala e fora de toda caixa. */
export function lugarLivre(p: Ponto, caixas: readonly Caixa[], raio: number): boolean {
  if (p.x < LIMITES.x0 + raio || p.x > LIMITES.x1 - raio || p.z < LIMITES.z0 + raio || p.z > LIMITES.z1 - raio) return false;
  return !caixas.some((c) => dentro(p, c, raio));
}

/** Um passo de `d` a partir de `p`: inteiro, ou só em x, ou só em z; se nada cabe, fica. */
export function moverComColisao(p: Ponto, d: Ponto, caixas: readonly Caixa[], raio: number): Ponto {
  if (Math.abs(d.x) < 1e-6 && Math.abs(d.z) < 1e-6) return p;
  for (const novo of [{ x: p.x + d.x, z: p.z + d.z }, { x: p.x + d.x, z: p.z }, { x: p.x, z: p.z + d.z }]) {
    if (lugarLivre(novo, caixas, raio)) return novo;
  }
  return p;
}

/** O segmento a–b cruza a caixa? (teste das faixas, no plano do chão) */
export function cruzaCaixa(a: Ponto, b: Ponto, c: Caixa): boolean {
  let t0 = 0;
  let t1 = 1;
  const d = { x: b.x - a.x, z: b.z - a.z };
  for (const [p, dp, lo, hi] of [[a.x, d.x, c.x0, c.x1], [a.z, d.z, c.z0, c.z1]] as const) {
    if (Math.abs(dp) < 1e-9) {
      if (p <= lo || p >= hi) return false;
      continue;
    }
    let ta = (lo - p) / dp;
    let tb = (hi - p) / dp;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

/** Nada entre a e b (visão do vigia, voo do alfinete). */
export function linhaLivre(a: Ponto, b: Ponto, caixas: readonly Caixa[]): boolean {
  return !caixas.some((c) => cruzaCaixa(a, b, c));
}

export function distancia(a: Ponto, b: Ponto): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** O giro (0 = +z) de quem está em a olhando para b. */
export function giroPara(a: Ponto, b: Ponto): number {
  return Math.atan2(b.x - a.x, b.z - a.z);
}

/** A menor diferença entre dois giros, em radianos (0 a π). */
export function diferencaDeGiro(a: number, b: number): number {
  const d = Math.abs((((a - b) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
  return d;
}
