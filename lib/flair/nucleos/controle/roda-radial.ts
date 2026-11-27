/**
 * A geometria da roda radial de recursos e armas (padrão de console): os itens em volta de um círculo, o primeiro no
 * alto e os outros no sentido do relógio; a fatia apontada por um vetor (mouse, setas ou analógico) e o giro passo a
 * passo. Puro.
 */

/** Abaixo disto (0 a 1) o vetor não escolhe fatia: a roda fica no item que estava. */
export const ZONA_MORTA_DA_RODA = 0.35;

/** Onde o item i de n fica na roda, em px a partir do centro (x para a direita, y para baixo). */
export function posicaoNaRoda(i: number, n: number, raio: number): { x: number; y: number } {
  const a = (2 * Math.PI * i) / Math.max(1, n);
  return { x: Math.round(Math.sin(a) * raio * 100) / 100, y: Math.round(-Math.cos(a) * raio * 100) / 100 };
}

/**
 * A fatia para onde o vetor aponta, em coordenadas de tela (dx para a direita, dy para baixo), ou nula dentro da zona
 * morta. `raio` normaliza o vetor (1 para setas e analógico; o raio da roda em px para o mouse).
 */
export function fatiaDoVetor(dx: number, dy: number, n: number, raio = 1, zonaMorta = ZONA_MORTA_DA_RODA): number | null {
  if (n <= 0 || Math.hypot(dx, dy) / Math.max(1e-6, raio) < zonaMorta) return null;
  const angulo = Math.atan2(dx, -dy);
  const passo = (2 * Math.PI) / n;
  return ((Math.round(angulo / passo) % n) + n) % n;
}

/** Gira o foco `passo` casas (negativo = contra o relógio). */
export function girarFoco(i: number, passo: number, n: number): number {
  if (n <= 0) return 0;
  return (((i + passo) % n) + n) % n;
}
