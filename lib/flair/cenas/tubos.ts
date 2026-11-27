/**
 * Túneis de vidro e fios de luz dos trilhos, em duas demãos por nível: a de baixo (brilho em volta, as duas bordas
 * finas e o interior escuro) fica atrás do elenco; a de cima (o vidro, o reflexo e as mangas opacas) fica na frente.
 * É o que faz o viajante passar por dentro do túnel, por trás das mangas e por baixo das pontes.
 */
import { tracarTrecho, type Amostra } from "@/lib/flair/cenas/caminho";
import { alfa, mistura } from "@/lib/flair/cenas/formas";
import { nivelEm } from "@/lib/flair/cenas/motor";
import type { Ctx, Trilho } from "@/lib/flair/cenas/tipos";

/** Trechos [de, até] do trilho que ficam no nível dado: as pontes no nível de cima, o resto no nível do trilho. */
export function trechosNoNivel(t: Trilho, nivel: number): [number, number][] {
  const base = t.z ?? 0;
  const pontes = [...(t.pontes ?? [])].sort((a, b) => a[0] - b[0]);
  if (nivel === base + 1) return pontes;
  if (nivel !== base) return [];
  const sai: [number, number][] = [];
  let de = 0;
  for (const [a, b] of pontes) {
    if (a > de) sai.push([de, a]);
    de = b;
  }
  if (de < 1) sai.push([de, 1]);
  return sai;
}

function riscar(ctx: Ctx, a: Amostra, trechos: [number, number][], cor: string, largura: number): void {
  ctx.strokeStyle = cor;
  ctx.lineWidth = largura;
  for (const [de, ate] of trechos) {
    ctx.beginPath();
    tracarTrecho(ctx, a, de, ate);
    ctx.stroke();
  }
}

/** Demão de baixo do trilho no nível dado. `fundo` é a cor do fundo da cena (o interior do túnel a escurece). */
export function pintarSob(ctx: Ctx, t: Trilho, a: Amostra, nivel: number, fundo: string): void {
  const trechos = trechosNoNivel(t, nivel);
  if (!trechos.length) return;
  ctx.lineJoin = "round";
  ctx.lineCap = "butt";
  if (t.tubo) {
    const { largura, cor } = t.tubo;
    const dentro = mistura(mistura(fundo, "#000000", 0.35), cor, t.tubo.vidro ?? 0.08);
    if (nivel === (t.z ?? 0)) {
      // o brilho em volta é do trilho inteiro (também sob as pontes), para não haver emenda onde a ponte começa
      riscar(ctx, a, [[0, 1]], alfa(cor, 0.07), largura + 5);
      riscar(ctx, a, [[0, 1]], alfa(cor, 0.13), largura + 2);
    }
    riscar(ctx, a, trechos, mistura(cor, "#ffffff", 0.25), largura);
    riscar(ctx, a, trechos, dentro, largura - 0.7);
    // a segunda linha, por dentro, dá a espessura do vidro
    riscar(ctx, a, trechos, mistura(dentro, cor, 0.3), largura - 2.3);
    riscar(ctx, a, trechos, dentro, largura - 2.75);
  }
  if (t.fio) {
    ctx.setLineDash(t.fio.tracejado ?? []);
    riscar(ctx, a, trechos, alfa(t.fio.cor, (t.fio.a ?? 1) * 0.14), t.fio.largura * 5);
    riscar(ctx, a, trechos, alfa(t.fio.cor, t.fio.a ?? 1), t.fio.largura);
    ctx.setLineDash([]);
  }
}

/** Demão de cima: o vidro por cima do viajante, o reflexo de luz e as mangas opacas. */
export function pintarSobre(ctx: Ctx, t: Trilho, a: Amostra, nivel: number): void {
  const trechos = trechosNoNivel(t, nivel);
  if (!t.tubo || !trechos.length) return;
  const { largura, cor } = t.tubo;
  ctx.lineJoin = "round";
  ctx.lineCap = "butt";
  riscar(ctx, a, trechos, alfa(cor, 0.06), largura - 0.7);
  for (const m of t.mangas ?? []) {
    if (nivelEm(t, (m.de + m.ate) / 2) !== nivel) continue;
    const borda = Math.min((m.ate - m.de) / 4, 0.5 / a.total);
    riscar(ctx, a, [[m.de, m.ate]], mistura(m.cor, "#000000", 0.5), largura + 2.2);
    riscar(ctx, a, [[m.de, m.ate]], m.cor, largura + 1.2);
    riscar(ctx, a, [[m.de, m.de + borda], [m.ate - borda, m.ate]], mistura(cor, "#ffffff", 0.3), largura + 2.2);
    riscar(ctx, a, [[m.de + borda, m.ate - borda]], "rgba(255,255,255,0.1)", largura * 0.5);
  }
}

/** Todas as linhas do trilho acesas (a tela de brilho do floreio, somada por cima da cena). */
export function pintarAceso(ctx: Ctx, t: Trilho, a: Amostra): void {
  const cor = t.tubo?.cor ?? t.fio?.cor;
  if (!cor) return;
  const largura = t.tubo?.largura ?? t.fio?.largura ?? 1;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const inteiro: [number, number][] = [[0, 1]];
  riscar(ctx, a, inteiro, alfa(cor, 0.16), largura + 4);
  riscar(ctx, a, inteiro, alfa(mistura(cor, "#ffffff", 0.4), 0.5), t.tubo ? largura : largura * 2);
}
