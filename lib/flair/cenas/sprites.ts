/**
 * Carimbos do elenco: cada combinação de forma, cor e tamanho é desenhada uma vez, com o brilho em volta, numa tela
 * pequena fora da página, e a cada quadro só é carimbada no lugar. É o que mantém o custo por quadro baixo no celular.
 * As marcas do FashionAI ("fai:soc-01") usam o disco do próprio ícone do app (public/icons/fai/glyph) num anel de luz.
 */
import { alfa, desenharForma, type Forma } from "@/lib/flair/cenas/formas";
import type { Ctx } from "@/lib/flair/cenas/tipos";

export interface Tela {
  canvas: HTMLCanvasElement;
  ctx: Ctx;
}

export type CriarTela = (largura: number, altura: number) => Tela | null;

/** Meio lado do carimbo, em múltiplos da escala do viajante (a forma ocupa 1; o resto é brilho). */
export const FOLGA_DO_CARIMBO = 1.7;

const imagens = new Map<string, HTMLImageElement>();

/** Imagem do ícone, quando já carregou; enquanto não, null (e `aoCarregar` é chamado quando chegar). */
function imagemPronta(url: string, aoCarregar: () => void): HTMLImageElement | null {
  let img = imagens.get(url);
  if (!img) {
    if (typeof Image === "undefined") return null;
    img = new Image();
    img.decoding = "async";
    img.src = url;
    imagens.set(url, img);
  }
  if (img.complete && img.naturalWidth > 0) return img;
  img.addEventListener("load", aoCarregar, { once: true });
  return null;
}

function halo(ctx: Ctx, cor: string, forca: number): void {
  const g = ctx.createRadialGradient(0, 0, 0.2, 0, 0, FOLGA_DO_CARIMBO);
  g.addColorStop(0, alfa(cor, 0.42 * forca));
  g.addColorStop(0.55, alfa(cor, 0.12 * forca));
  g.addColorStop(1, alfa(cor, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-FOLGA_DO_CARIMBO, -FOLGA_DO_CARIMBO, FOLGA_DO_CARIMBO * 2, FOLGA_DO_CARIMBO * 2);
}

/** Marca do app num anel de luz; sem a imagem ainda, só o anel. */
function desenharMarca(ctx: Ctx, cor: string, img: HTMLImageElement | null): void {
  ctx.beginPath();
  ctx.arc(0, 0, 0.9, 0, Math.PI * 2);
  ctx.fillStyle = "#0b0d14";
  ctx.fill();
  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, 0.8, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, -0.82, -0.82, 1.64, 1.64);
    ctx.restore();
  }
  ctx.lineWidth = 0.09;
  ctx.strokeStyle = cor;
  ctx.beginPath();
  ctx.arc(0, 0, 0.88, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 0.035;
  ctx.strokeStyle = alfa(cor, 0.45);
  ctx.beginPath();
  ctx.arc(0, 0, 1.08, 0, Math.PI * 2);
  ctx.stroke();
}

export type Carimbos = (forma: string, cor: string, escala: number) => Tela | null;

/** Endereço do disco de um ícone do app ("fai:soc-01" → /icons/fai/glyph/soc-01-48.png). */
export function enderecoDaMarca(forma: string): string | null {
  const m = /^fai:([a-z]{3}-\d{2})$/.exec(forma);
  return m ? `/icons/fai/glyph/${m[1]}-48.png` : null;
}

/**
 * Fábrica de carimbos para uma largura de tela: `s` é quantos pixels vale uma unidade da arte. `aoCarregar` avisa
 * quando um ícone chegou (a cena parada precisa de um novo quadro).
 */
export function criarCarimbos(formas: Record<string, Forma>, criar: CriarTela, s: number, aoCarregar: () => void): Carimbos {
  const prontos = new Map<string, Tela>();
  return (forma, cor, escala) => {
    const chave = `${forma}|${cor}|${escala}`;
    const pronto = prontos.get(chave);
    if (pronto) return pronto;
    const lado = Math.max(4, Math.ceil(escala * s * FOLGA_DO_CARIMBO * 2));
    const tela = criar(lado, lado);
    if (!tela) return null;
    const marca = enderecoDaMarca(forma);
    const img = marca ? imagemPronta(marca, aoCarregar) : null;
    const { ctx } = tela;
    ctx.setTransform(escala * s, 0, 0, escala * s, lado / 2, lado / 2);
    halo(ctx, cor, marca ? 0.8 : 1);
    if (marca) desenharMarca(ctx, cor, img);
    else if (formas[forma]) desenharForma(ctx, formas[forma], cor);
    if (!marca || img) prontos.set(chave, tela);
    return tela;
  };
}
