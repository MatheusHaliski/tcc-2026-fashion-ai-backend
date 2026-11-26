/**
 * Pintor de uma cena numa largura de tela. O que não se mexe (fundo, túneis, enfeites) é pintado uma vez em camadas,
 * uma por nível de profundidade; a cada quadro o pintor só empilha as camadas e, entre elas, carimba os pulsos de luz,
 * os elementos que giram e o elenco. Com isso um quadro custa poucas cópias de imagem, mesmo com a cena cheia.
 */
import { tracarTrecho } from "@/lib/flair/cenas/caminho";
import { ARTE_A, ARTE_L, pintarEnfeite, pintarFundo } from "@/lib/flair/cenas/enfeites";
import { alfa, mistura, type Forma } from "@/lib/flair/cenas/formas";
import { girosEm, pulsosEm, viajantesEm, type CenaPronta } from "@/lib/flair/cenas/motor";
import { criarCarimbos, type Carimbos, type CriarTela, type Tela } from "@/lib/flair/cenas/sprites";
import { pintarAceso, pintarSob, pintarSobre } from "@/lib/flair/cenas/tubos";
import type { Ctx } from "@/lib/flair/cenas/tipos";

export interface Pintor {
  largura: number;
  altura: number;
  /** Pinta em `ctx` (em pixels, a partir de 0, 0) o quadro do instante t; `brilho` (0 a 1) acende os túneis. */
  quadro(ctx: Ctx, t: number, brilho?: number): void;
}

/** Camadas paradas: a 0 é o fundo com a demão de baixo do nível 0; a k fecha o nível k-1 e abre o nível k. */
function montarCamadas(p: CenaPronta, formas: Record<string, Forma>, criar: CriarTela, largura: number, altura: number): Tela[] | null {
  const s = largura / ARTE_L;
  const camadas: Tela[] = [];
  for (let k = 0; k <= p.niveis; k++) {
    const tela = criar(largura, altura);
    if (!tela) return null;
    const { ctx } = tela;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    if (k === 0) pintarFundo(ctx, p.cena, formas);
    for (const t of p.cena.trilhos) {
      const a = p.amostras.get(t.id);
      if (a && k > 0) pintarSobre(ctx, t, a, k - 1);
    }
    for (const t of p.cena.trilhos) {
      const a = p.amostras.get(t.id);
      if (a && k < p.niveis) pintarSob(ctx, t, a, k, p.cena.paleta.fundo[1]);
    }
    if (k === p.niveis) {
      for (const e of p.cena.frente ?? []) pintarEnfeite(ctx, e, formas);
    }
    camadas.push(tela);
  }
  return camadas;
}

function montarAceso(p: CenaPronta, criar: CriarTela, largura: number, altura: number): Tela | null {
  const tela = criar(largura, altura);
  if (!tela) return null;
  tela.ctx.setTransform(largura / ARTE_L, 0, 0, largura / ARTE_L, 0, 0);
  for (const t of p.cena.trilhos) {
    const a = p.amostras.get(t.id);
    if (a) pintarAceso(tela.ctx, t, a);
  }
  return tela;
}

function carimbar(ctx: Ctx, tela: Tela, x: number, y: number, giro: number, espelho: boolean, opacidade: number): void {
  const [c, sn] = [Math.cos(giro), Math.sin(giro)];
  const lado = espelho ? -1 : 1;
  ctx.setTransform(c * lado, sn * lado, -sn, c, x, y);
  ctx.globalAlpha = opacidade;
  ctx.drawImage(tela.canvas, -tela.canvas.width / 2, -tela.canvas.height / 2);
}

function pintarPulsos(ctx: Ctx, p: CenaPronta, t: number, nivel: number, s: number): void {
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (const pulso of pulsosEm(p, t)) {
    const a = p.amostras.get(pulso.trilho);
    const trilho = p.trilhos.get(pulso.trilho);
    if (!a || !trilho || pulso.z !== nivel) continue;
    const fino = trilho.tubo ? 0.7 : (trilho.fio?.largura ?? 0.4) * 1.8;
    ctx.beginPath();
    tracarTrecho(ctx, a, pulso.de, pulso.ate);
    ctx.strokeStyle = alfa(pulso.cor, 0.22);
    ctx.lineWidth = fino * 3.6;
    ctx.stroke();
    ctx.strokeStyle = alfa(mistura(pulso.cor, "#ffffff", 0.55), 0.9);
    ctx.lineWidth = fino;
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
}

/** Pintor da cena para telas de `largura` pixels (a altura segue a proporção 16:10). Sem canvas, null. */
export function criarPintor(p: CenaPronta, formas: Record<string, Forma>, criar: CriarTela, largura: number, aoCarregar: () => void = () => {}): Pintor | null {
  const altura = Math.round((largura * ARTE_A) / ARTE_L);
  const s = largura / ARTE_L;
  const camadas = montarCamadas(p, formas, criar, largura, altura);
  const aceso = montarAceso(p, criar, largura, altura);
  if (!camadas || !aceso) return null;
  const carimbos: Carimbos = criarCarimbos(formas, criar, s, aoCarregar);
  const giros = p.cena.giros ?? [];

  function quadro(ctx: Ctx, t: number, brilho = 0): void {
    const elenco = viajantesEm(p, t);
    const angulos = girosEm(p, t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(camadas![0].canvas, 0, 0);
    for (let k = 0; k < p.niveis; k++) {
      pintarPulsos(ctx, p, t, k, s);
      giros.forEach((g, i) => {
        const tela = (g.z ?? 0) === k ? carimbos(g.forma, g.cor, g.escala) : null;
        if (tela) carimbar(ctx, tela, g.x * s, g.y * s, angulos[i], false, 1);
      });
      for (const v of elenco) {
        const tela = v.z === k && v.alfa > 0.01 ? carimbos(v.forma, v.cor, v.escala) : null;
        if (tela) carimbar(ctx, tela, v.x * s, v.y * s, v.giro, v.espelho, v.alfa);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.drawImage(camadas![k + 1].canvas, 0, 0);
    }
    if (brilho > 0.01) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.min(1, brilho);
      ctx.drawImage(aceso!.canvas, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }
  }

  return { largura, altura, quadro };
}
