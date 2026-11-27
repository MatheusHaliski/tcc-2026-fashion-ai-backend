/**
 * Pintura do quebra-cabeça dinâmico num canvas 2D. O quadro da fonte (o vídeo ou o símbolo animado) é pintado UMA vez
 * por quadro numa tela de apoio; cada peça é uma janela recortada (clip) dessa mesma tela, por isso todas mostram o
 * mesmo instante, sincronizadas. Ao fundo, o quadro apagado e sem cor mostra o que falta; cada peça entra com a sua
 * folga (fora do lugar, girada) e a sua opacidade; a vazia é só o contorno tracejado. Completo, o quadro inteiro
 * sem emendas. As coordenadas das peças estão nas unidades do recorte (altura 100); `escala` leva a pixels.
 */
import type { Folga } from "@/lib/flair/elencos/jigsaw";
import type { Peca } from "@/lib/flair/elencos/recortes";
import type { PecaEstado } from "@/lib/flair/elencos/board";
import type { Ctx } from "@/lib/flair/cenas/tipos";
import type { Janela } from "@/lib/flair/montagem/dinamico/catalogo";
import { brilhos, type Pose } from "@/lib/flair/montagem/dinamico/movimento";

export interface PecaNoQuadro extends Peca {
  estado: PecaEstado;
  folga: Folga;
  alfa: number;
  selecionada?: boolean;
}

export type CriarCaminho = (d: string) => Path2D;

const CONTORNO: Record<PecaEstado, string> = { coberta: "#ffffffaa", chegando: "#ffffffcc", vermelha: "#d93a3a", laranja: "#f08a24", verde: "#ffffff66" };

/** Retângulo da fonte (em pixels dela) que cobre o destino sem distorcer, dentro da janela pedida. */
export function cobrir(fw: number, fh: number, janela: Janela, dw: number, dh: number): [number, number, number, number] {
  const [jx, jy, jw, jh] = [janela.x * fw, janela.y * fh, janela.w * fw, janela.h * fh];
  const alvo = dw / dh;
  if (jw / jh > alvo) {
    const w = jh * alvo;
    return [jx + (jw - w) / 2, jy, w, jh];
  }
  const h = jw / alvo;
  return [jx, jy + (jh - h) / 2, jw, h];
}

/** Um quadro do vídeo (ou do pôster) na tela de apoio inteira. */
export function pintarVideo(ctx: Ctx, fonte: CanvasImageSource, fw: number, fh: number, janela: Janela, w: number, h: number): void {
  if (!fw || !fh) return;
  const [sx, sy, sw, sh] = cobrir(fw, fh, janela, w, h);
  ctx.drawImage(fonte, sx, sy, sw, sh, 0, 0, w, h);
}

/** O símbolo FAI na pose do instante, sobre um fundo escuro com halo, e os brilhos em órbita (unidades → `escala`). */
export function pintarLogo(ctx: Ctx, imagem: CanvasImageSource | null, pose: Pose, t: number, w: number, h: number): void {
  const escala = h / 100;
  const fundo = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
  fundo.addColorStop(0, "#3a2414");
  fundo.addColorStop(1, "#0d0a14");
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2 + pose.dx * escala, h / 2 + pose.dy * escala);
  ctx.rotate(pose.giro);
  ctx.scale(pose.escala, pose.escala);
  const lado = 92 * escala;
  if (imagem) ctx.drawImage(imagem, -lado / 2, -lado / 2, lado, lado);
  ctx.restore();
  for (const b of brilhos(t, 12)) {
    ctx.globalAlpha = b.alfa;
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(w / 2 + b.x * escala, h / 2 + b.y * escala, b.r * escala, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Contorno da peça: tracejado se vazia, na cor do estado; mais grosso se é a vaga em destaque. */
function contornar(ctx: Ctx, caminho: Path2D, p: PecaNoQuadro, escala: number): void {
  ctx.lineWidth = (p.selecionada ? 3 : 1.2) / escala;
  ctx.setLineDash(p.estado === "coberta" && !p.selecionada ? [4 / escala, 3 / escala] : []);
  ctx.strokeStyle = p.selecionada ? "#f08a24" : CONTORNO[p.estado];
  ctx.stroke(caminho);
}

export interface Quadro {
  /** a tela de apoio com o quadro da fonte, do tamanho do canvas */
  apoio: CanvasImageSource;
  /** pixels por unidade */
  escala: number;
  /** largura do quadro em unidades */
  largura: number;
  completo: boolean;
}

/** Fundo apagado, peças nas folgas e contornos; completo, o quadro inteiro. */
export function pintarQuebraCabeca(ctx: Ctx, q: Quadro, pecas: PecaNoQuadro[], caminho: CriarCaminho): void {
  const [W, H] = [q.largura * q.escala, 100 * q.escala];
  ctx.clearRect(0, 0, W, H);
  if (q.completo) {
    ctx.drawImage(q.apoio, 0, 0, W, H);
    return;
  }
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.filter = "grayscale(1)";
  ctx.drawImage(q.apoio, 0, 0, W, H);
  ctx.restore();
  ctx.save();
  ctx.scale(q.escala, q.escala);
  for (const p of pecas) {
    const forma = caminho(p.d);
    if (p.alfa > 0) {
      ctx.save();
      ctx.translate(p.cx + p.folga.dx, p.cy + p.folga.dy);
      ctx.rotate((p.folga.giro * Math.PI) / 180);
      ctx.translate(-p.cx, -p.cy);
      ctx.globalAlpha = p.alfa;
      if (p.estado === "vermelha" || p.estado === "chegando") ctx.filter = "grayscale(1) brightness(0.75)";
      ctx.clip(forma);
      ctx.drawImage(q.apoio, 0, 0, q.largura, 100);
      ctx.filter = "none";
      ctx.globalAlpha = 1;
      contornar(ctx, forma, p, q.escala);
      ctx.restore();
    } else {
      contornar(ctx, forma, p, q.escala);
    }
  }
  ctx.restore();
}
