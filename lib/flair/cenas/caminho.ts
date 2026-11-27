/**
 * Geometria dos trilhos, pura: lê um caminho SVG (M, L, H, V, C, Q, Z absolutos), amostra em pontos com o comprimento
 * acumulado e devolve a posição e a direção em qualquer fração u (0 a 1) do comprimento. Também monta caminhos:
 * curva suave por pontos, linha quebrada de cantos arredondados e laço fechado.
 */
import type { Ctx } from "@/lib/flair/cenas/tipos";

export interface Amostra {
  /** x0, y0, x1, y1, ... */
  pontos: Float32Array;
  /** comprimento acumulado até cada ponto */
  acumulado: Float32Array;
  total: number;
  fechado: boolean;
}

export interface Ponto {
  x: number;
  y: number;
  /** direção do movimento, em radianos */
  angulo: number;
}

const PASSO = 1.1;

function numeros(texto: string): number[] {
  return (texto.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
}

/** Pontos da curva de Bézier cúbica (sem o primeiro). */
function cubica(p: number[], sai: number[]): void {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = p;
  const corda = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2);
  const n = Math.max(4, Math.ceil(corda / PASSO));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const m = 1 - t;
    sai.push(m * m * m * x0 + 3 * m * m * t * x1 + 3 * m * t * t * x2 + t * t * t * x3);
    sai.push(m * m * m * y0 + 3 * m * m * t * y1 + 3 * m * t * t * y2 + t * t * t * y3);
  }
}

function reta(x0: number, y0: number, x1: number, y1: number, sai: number[]): void {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (PASSO * 3)));
  for (let i = 1; i <= n; i++) {
    sai.push(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n);
  }
}

/** Um comando do caminho: devolve o novo ponto corrente. */
function comando(cmd: string, n: number[], x: number, y: number, sai: number[]): [number, number] {
  if (cmd === "M") {
    sai.push(n[0], n[1]);
    return [n[0], n[1]];
  }
  if (cmd === "H" || cmd === "V") {
    const [nx, ny] = cmd === "H" ? [n[0], y] : [x, n[0]];
    reta(x, y, nx, ny, sai);
    return [nx, ny];
  }
  const passo = cmd === "L" ? 2 : cmd === "Q" ? 4 : 6;
  for (let i = 0; i + passo - 1 < n.length; i += passo) {
    const p = n.slice(i, i + passo);
    const [ex, ey] = [p[passo - 2], p[passo - 1]];
    if (cmd === "L") reta(x, y, ex, ey, sai);
    else if (cmd === "C") cubica([x, y, ...p], sai);
    else cubica([x, y, x + ((p[0] - x) * 2) / 3, y + ((p[1] - y) * 2) / 3, ex + ((p[0] - ex) * 2) / 3, ey + ((p[1] - ey) * 2) / 3, ex, ey], sai);
    [x, y] = [ex, ey];
  }
  return [x, y];
}

/** Amostra o caminho `d` em pontos próximos (cerca de 1 unidade da arte entre eles nas curvas). */
export function amostrar(d: string): Amostra {
  const sai: number[] = [];
  let x = 0;
  let y = 0;
  let fechado = false;
  for (const parte of d.match(/[MLHVCQZ][^MLHVCQZ]*/gi) ?? []) {
    const cmd = parte[0].toUpperCase();
    if (cmd === "Z") {
      reta(x, y, sai[0], sai[1], sai);
      fechado = true;
    } else {
      [x, y] = comando(cmd, numeros(parte.slice(1)), x, y, sai);
    }
  }
  const pontos = Float32Array.from(sai);
  const acumulado = new Float32Array(pontos.length / 2);
  for (let i = 1; i < acumulado.length; i++) {
    acumulado[i] = acumulado[i - 1] + Math.hypot(pontos[i * 2] - pontos[i * 2 - 2], pontos[i * 2 + 1] - pontos[i * 2 - 1]);
  }
  return { pontos, acumulado, total: acumulado[acumulado.length - 1] ?? 0, fechado };
}

/** Índice do segmento que contém o comprimento s (busca binária). */
function segmento(a: Amostra, s: number): number {
  let lo = 0;
  let hi = a.acumulado.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (a.acumulado[mid] <= s) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Posição e direção na fração u do comprimento; em caminho fechado u dá a volta, em aberto fica entre as pontas. */
export function pontoEm(a: Amostra, u: number): Ponto {
  const f = a.fechado ? u - Math.floor(u) : Math.min(1, Math.max(0, u));
  const s = f * a.total;
  const i = segmento(a, s);
  const j = Math.min(i + 1, a.acumulado.length - 1);
  const vao = a.acumulado[j] - a.acumulado[i];
  const k = vao > 0 ? (s - a.acumulado[i]) / vao : 0;
  const [x0, y0, x1, y1] = [a.pontos[i * 2], a.pontos[i * 2 + 1], a.pontos[j * 2], a.pontos[j * 2 + 1]];
  return { x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, angulo: Math.atan2(y1 - y0, x1 - x0) };
}

/** Direção suavizada (média de dois pontos próximos): o viajante não treme na emenda dos segmentos. */
export function direcaoEm(a: Amostra, u: number): number {
  const passo = Math.min(0.02, 2.4 / Math.max(1, a.total));
  const p = pontoEm(a, a.fechado ? u - passo : Math.max(0, u - passo));
  const q = pontoEm(a, a.fechado ? u + passo : Math.min(1, u + passo));
  return Math.atan2(q.y - p.y, q.x - p.x);
}

/** Traça no contexto o trecho [u0, u1] do caminho (sem pintar). */
export function tracarTrecho(ctx: Ctx, a: Amostra, u0 = 0, u1 = 1): void {
  const s0 = u0 * a.total;
  const s1 = u1 * a.total;
  const ini = pontoEm(a, u0);
  ctx.moveTo(ini.x, ini.y);
  for (let i = segmento(a, s0) + 1; i < a.acumulado.length && a.acumulado[i] < s1; i++) {
    ctx.lineTo(a.pontos[i * 2], a.pontos[i * 2 + 1]);
  }
  const fim = pontoEm(a, u1 >= 1 && a.fechado ? 0.999999 : u1);
  ctx.lineTo(fim.x, fim.y);
}

/** Frações u do caminho `a` em que ele cruza o caminho `b`. */
export function cruzamentos(a: Amostra, b: Amostra): number[] {
  const sai: number[] = [];
  for (let i = 0; i + 1 < a.acumulado.length; i++) {
    const [x1, y1, x2, y2] = [a.pontos[i * 2], a.pontos[i * 2 + 1], a.pontos[i * 2 + 2], a.pontos[i * 2 + 3]];
    for (let j = 0; j + 1 < b.acumulado.length; j++) {
      const [x3, y3, x4, y4] = [b.pontos[j * 2], b.pontos[j * 2 + 1], b.pontos[j * 2 + 2], b.pontos[j * 2 + 3]];
      const den = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
      if (Math.abs(den) < 1e-9) continue;
      const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / den;
      const k = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / den;
      if (t >= 0 && t < 1 && k >= 0 && k < 1) sai.push((a.acumulado[i] + t * (a.acumulado[i + 1] - a.acumulado[i])) / a.total);
    }
  }
  return sai;
}

const n2 = (v: number) => Math.round(v * 100) / 100;

/** Curva suave que passa pelos pontos (Catmull-Rom em Bézier); fechada, volta ao primeiro sem quina. */
export function suave(p: [number, number][], fechado = false): string {
  const n = p.length;
  const em = (i: number) => (fechado ? p[((i % n) + n) % n] : p[Math.min(n - 1, Math.max(0, i))]);
  let d = `M${n2(p[0][0])} ${n2(p[0][1])}`;
  for (let i = 0; i < (fechado ? n : n - 1); i++) {
    const [a, b, c, e] = [em(i - 1), em(i), em(i + 1), em(i + 2)];
    d += `C${n2(b[0] + (c[0] - a[0]) / 6)} ${n2(b[1] + (c[1] - a[1]) / 6)} ${n2(c[0] - (e[0] - b[0]) / 6)} ${n2(c[1] - (e[1] - b[1]) / 6)} ${n2(c[0])} ${n2(c[1])}`;
  }
  return fechado ? `${d}Z` : d;
}

/** Linha quebrada com os cantos arredondados no raio dado (zigue-zague, mapa de trilhos). */
export function quebrada(p: [number, number][], raio: number): string {
  let d = `M${n2(p[0][0])} ${n2(p[0][1])}`;
  for (let i = 1; i < p.length - 1; i++) {
    const [a, b, c] = [p[i - 1], p[i], p[i + 1]];
    const la = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const lc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const r = Math.min(raio, la / 2, lc / 2);
    d += `L${n2(b[0] + ((a[0] - b[0]) * r) / la)} ${n2(b[1] + ((a[1] - b[1]) * r) / la)}`;
    d += `Q${n2(b[0])} ${n2(b[1])} ${n2(b[0] + ((c[0] - b[0]) * r) / lc)} ${n2(b[1] + ((c[1] - b[1]) * r) / lc)}`;
  }
  const u = p[p.length - 1];
  return `${d}L${n2(u[0])} ${n2(u[1])}`;
}

/** Elipse fechada (quatro Béziers), começando no ponto mais à direita. */
export function laco(cx: number, cy: number, rx: number, ry: number): string {
  const k = 0.5523;
  const [ox, oy] = [rx * k, ry * k];
  return (
    `M${n2(cx + rx)} ${n2(cy)}` +
    `C${n2(cx + rx)} ${n2(cy + oy)} ${n2(cx + ox)} ${n2(cy + ry)} ${n2(cx)} ${n2(cy + ry)}` +
    `C${n2(cx - ox)} ${n2(cy + ry)} ${n2(cx - rx)} ${n2(cy + oy)} ${n2(cx - rx)} ${n2(cy)}` +
    `C${n2(cx - rx)} ${n2(cy - oy)} ${n2(cx - ox)} ${n2(cy - ry)} ${n2(cx)} ${n2(cy - ry)}` +
    `C${n2(cx + ox)} ${n2(cy - ry)} ${n2(cx + rx)} ${n2(cy - oy)} ${n2(cx + rx)} ${n2(cy)}Z`
  );
}
