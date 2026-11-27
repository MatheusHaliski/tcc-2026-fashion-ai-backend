/**
 * Fundo e enfeites parados das cenas (pintados uma vez por tamanho de tela): degradê, halos de luz, grades finas,
 * anéis, traços e poeira de pontos. Tudo em unidades da arte (160 × 100); o chamador já aplicou a escala.
 */
import { amostrar, tracarTrecho } from "@/lib/flair/cenas/caminho";
import { alfa, desenharForma, type Forma } from "@/lib/flair/cenas/formas";
import type { Cena, Ctx, Enfeite } from "@/lib/flair/cenas/tipos";

export const ARTE_L = 160;
export const ARTE_A = 100;

/** Gerador determinístico (a poeira de uma cena é sempre a mesma). */
function sorteio(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function grade(ctx: Ctx, e: Extract<Enfeite, { k: "grade" }>): void {
  ctx.fillStyle = alfa(e.cor, e.a);
  ctx.strokeStyle = alfa(e.cor, e.a);
  ctx.lineWidth = 0.12;
  if (e.tipo === "pontos") {
    for (let y = e.passo / 2; y < ARTE_A; y += e.passo) {
      for (let x = e.passo / 2; x < ARTE_L; x += e.passo) {
        ctx.fillRect(x - 0.14, y - 0.14, 0.28, 0.28);
      }
    }
    return;
  }
  ctx.beginPath();
  if (e.tipo === "linhas") {
    for (let x = e.passo; x < ARTE_L; x += e.passo) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ARTE_A);
    }
    for (let y = e.passo; y < ARTE_A; y += e.passo) {
      ctx.moveTo(0, y);
      ctx.lineTo(ARTE_L, y);
    }
  } else {
    for (let x = -ARTE_A; x < ARTE_L; x += e.passo) {
      ctx.moveTo(x, ARTE_A);
      ctx.lineTo(x + ARTE_A, 0);
    }
  }
  ctx.stroke();
}

function halo(ctx: Ctx, e: Extract<Enfeite, { k: "halo" }>): void {
  const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r);
  g.addColorStop(0, alfa(e.cor, e.a));
  g.addColorStop(0.5, alfa(e.cor, e.a * 0.35));
  g.addColorStop(1, alfa(e.cor, 0));
  ctx.fillStyle = g;
  ctx.fillRect(e.x - e.r, e.y - e.r, e.r * 2, e.r * 2);
}

function traco(ctx: Ctx, e: Extract<Enfeite, { k: "traco" }>): void {
  const a = amostrar(e.d);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (e.brilho) {
    ctx.beginPath();
    tracarTrecho(ctx, a);
    ctx.strokeStyle = alfa(e.cor, e.a * 0.18);
    ctx.lineWidth = e.largura * 5;
    ctx.stroke();
  }
  ctx.beginPath();
  tracarTrecho(ctx, a);
  ctx.setLineDash(e.tracejado ?? []);
  ctx.strokeStyle = alfa(e.cor, e.a);
  ctx.lineWidth = e.largura;
  ctx.stroke();
  ctx.setLineDash([]);
}

function poeira(ctx: Ctx, e: Extract<Enfeite, { k: "poeira" }>): void {
  const r = sorteio(e.semente);
  for (let i = 0; i < e.n; i++) {
    const [x, y, k] = [r() * ARTE_L, r() * ARTE_A, r()];
    ctx.fillStyle = alfa(e.cor, e.a * (0.35 + 0.65 * k));
    ctx.beginPath();
    ctx.arc(x, y, e.r * (0.4 + 0.6 * k), 0, Math.PI * 2);
    ctx.fill();
  }
}

export function pintarEnfeite(ctx: Ctx, e: Enfeite, formas: Record<string, Forma>): void {
  if (e.k === "halo") halo(ctx, e);
  else if (e.k === "grade") grade(ctx, e);
  else if (e.k === "traco") traco(ctx, e);
  else if (e.k === "poeira") poeira(ctx, e);
  else if (e.k === "aneis") {
    ctx.lineWidth = 0.14;
    for (let i = 0; i < e.n; i++) {
      ctx.strokeStyle = alfa(e.cor, e.a * (1 - i / (e.n + 1)));
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r0 + i * e.dr, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (formas[e.forma]) {
    ctx.save();
    ctx.globalAlpha = e.a ?? 1;
    ctx.translate(e.x, e.y);
    ctx.rotate(((e.giro ?? 0) * Math.PI) / 180);
    ctx.scale(e.escala, e.escala);
    desenharForma(ctx, formas[e.forma], e.cor);
    ctx.restore();
  }
}

/** Fundo da cena: degradê de cima para baixo, os enfeites do fundo e a vinheta que escurece as bordas. */
export function pintarFundo(ctx: Ctx, cena: Cena, formas: Record<string, Forma>): void {
  const g = ctx.createLinearGradient(0, 0, 0, ARTE_A);
  g.addColorStop(0, cena.paleta.fundo[0]);
  g.addColorStop(1, cena.paleta.fundo[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ARTE_L, ARTE_A);
  for (const e of cena.fundo) pintarEnfeite(ctx, e, formas);
  const v = ctx.createRadialGradient(ARTE_L / 2, ARTE_A / 2, ARTE_A * 0.45, ARTE_L / 2, ARTE_A / 2, ARTE_L * 0.68);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, ARTE_L, ARTE_A);
}
