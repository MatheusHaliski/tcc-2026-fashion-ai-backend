/**
 * Formas do elenco das cenas: cada forma é uma lista curta de operações geométricas (polígono, linha, círculo,
 * retângulo arredondado, arco) numa caixa de -1 a 1, pintadas a partir de uma cor base em tons mais claros e mais
 * escuros. O desenho é sempre geométrico e facetado: nada de traço infantil. As famílias ficam em formas-*.ts.
 */
import type { Ctx } from "@/lib/flair/cenas/tipos";

/** Tom: número de -1 (quase preto) a 1 (quase branco) sobre a cor base, ou uma tinta fixa ("w", "k", "m", "g"), com ":alfa". */
export type Tom = number | string;

export type Op =
  | ["p", Tom, number[]]
  | ["l", Tom, number, number[]]
  | ["c", Tom, number, number, number]
  | ["o", Tom, number, number, number, number]
  | ["r", Tom, number, number, number, number, number]
  | ["a", Tom, number, number, number, number, number, number];

export type Forma = Op[];

const TINTAS: Record<string, string> = { w: "#ffffff", k: "#0a0c12", m: "#c5cbd6", g: "#e7c98b" };

export function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const c = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

/** Cor com opacidade, em rgba(). */
export function alfa(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${Math.round(a * 1000) / 1000})`;
}

/** Mistura de duas cores (k = 0 dá a primeira, 1 dá a segunda). */
export function mistura(hexA: string, hexB: string, k: number): string {
  const a = rgb(hexA);
  const b = rgb(hexB);
  const canal = (i: number) => Math.round(a[i] + (b[i] - a[i]) * k).toString(16).padStart(2, "0");
  return `#${canal(0)}${canal(1)}${canal(2)}`;
}

/** Cor de um tom sobre a cor base. */
export function corDoTom(tom: Tom, base: string): string {
  if (typeof tom === "number") return tom >= 0 ? mistura(base, "#ffffff", tom) : mistura(base, "#05060a", -tom);
  const [nome, a] = tom.split(":");
  const cor = TINTAS[nome] ?? base;
  return a ? alfa(cor, Number(a)) : cor;
}

function poligono(ctx: Ctx, pts: number[], fechar: boolean): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i + 1 < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  if (fechar) ctx.closePath();
}

function retangulo(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

const GRAU = Math.PI / 180;

/** Desenha a forma na origem, na caixa de -1 a 1 (o chamador já aplicou posição, giro e escala). */
export function desenharForma(ctx: Ctx, forma: Forma, base: string): void {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const op of forma) {
    const cor = corDoTom(op[1], base);
    if (op[0] === "p") {
      poligono(ctx, op[2], true);
      ctx.fillStyle = cor;
      ctx.fill();
    } else if (op[0] === "l") {
      poligono(ctx, op[3], false);
      ctx.strokeStyle = cor;
      ctx.lineWidth = op[2];
      ctx.stroke();
    } else if (op[0] === "c") {
      ctx.beginPath();
      ctx.arc(op[2], op[3], op[4], 0, Math.PI * 2);
      ctx.fillStyle = cor;
      ctx.fill();
    } else if (op[0] === "o") {
      ctx.beginPath();
      ctx.arc(op[3], op[4], op[5], 0, Math.PI * 2);
      ctx.strokeStyle = cor;
      ctx.lineWidth = op[2];
      ctx.stroke();
    } else if (op[0] === "r") {
      retangulo(ctx, op[2], op[3], op[4], op[5], op[6]);
      ctx.fillStyle = cor;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(op[3], op[4], op[5], op[6] * GRAU, op[7] * GRAU);
      ctx.strokeStyle = cor;
      ctx.lineWidth = op[2];
      ctx.stroke();
    }
  }
}
