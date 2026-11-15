/**
 * O desenho é o quebra-cabeça: cada peça é uma janela para o mesmo quadro da cena. A peça encaixada mostra a cena no
 * lugar; a solta mostra o mesmo quadro deslocado e girado com ela; onde falta peça, a cena não aparece. Como todas as
 * janelas copiam o mesmo quadro, um viajante atravessa de uma peça encaixada para a vizinha sem emenda.
 */
import { amostrar, tracarTrecho, type Amostra } from "@/lib/flair/cenas/caminho";
import { ARTE_A, ARTE_L } from "@/lib/flair/cenas/enfeites";
import type { Ctx } from "@/lib/flair/cenas/tipos";
import type { PecaEstado } from "@/lib/flair/elencos/board";
import { folgaDaPeca, recortesDoQuebraCabeca, type Folga, type Recorte } from "@/lib/flair/elencos/jigsaw";

/** Estado de uma célula do recorte: o da peça da linha, ou "moldura" nas células que sobram na grade. */
export type EstadoDaCelula = PecaEstado | "moldura";

export interface Recortes {
  recortes: Recorte[];
  contornos: Amostra[];
}

export function prepararRecortes(n: number): Recortes {
  const { recortes } = recortesDoQuebraCabeca(n);
  return { recortes, contornos: recortes.map((r) => amostrar(r.d)) };
}

/** Folga em movimento de uma peça: onde está agora e a velocidade (a mola leva até o alvo). */
export interface FolgaViva extends Folga {
  vx: number;
  vy: number;
  vg: number;
}

export const PARADA: FolgaViva = { dx: 0, dy: 0, giro: 0, vx: 0, vy: 0, vg: 0 };

const MOLA = 150;
const FREIO = 17;

/** Um passo da mola (dt em segundos): a peça passa um pouco do ponto e volta, o estalo do encaixe. */
export function aproximar(atual: FolgaViva, alvo: Folga, dt: number): FolgaViva {
  const passo = Math.min(dt, 1 / 30);
  const eixo = (x: number, v: number, a: number): [number, number] => {
    const nv = v + (MOLA * (a - x) - FREIO * v) * passo;
    return [x + nv * passo, nv];
  };
  const [dx, vx] = eixo(atual.dx, atual.vx, alvo.dx);
  const [dy, vy] = eixo(atual.dy, atual.vy, alvo.dy);
  const [giro, vg] = eixo(atual.giro, atual.vg, alvo.giro);
  return { dx, dy, giro, vx, vy, vg };
}

/** A peça chegou ao alvo (pode parar de animar)? */
export function assentada(atual: FolgaViva, alvo: Folga): boolean {
  const longe = Math.abs(atual.dx - alvo.dx) + Math.abs(atual.dy - alvo.dy) + Math.abs(atual.giro - alvo.giro);
  return longe < 0.02 && Math.abs(atual.vx) + Math.abs(atual.vy) + Math.abs(atual.vg) < 0.05;
}

export function alvoDaCelula(i: number, estado: EstadoDaCelula): Folga {
  return folgaDaPeca(i, estado === "moldura" ? "verde" : estado);
}

const BORDA: Record<EstadoDaCelula, string> = {
  verde: "#2fe39a",
  laranja: "#ffa23a",
  vermelha: "#ff5d6c",
  chegando: "#8d93a8",
  coberta: "#4b4f63",
  moldura: "#20222e",
};
const ORDEM: EstadoDaCelula[] = ["moldura", "verde", "laranja", "vermelha", "chegando"];

function contorno(ctx: Ctx, a: Amostra): void {
  ctx.beginPath();
  tracarTrecho(ctx, a, 0, 1);
  ctx.closePath();
}

/** Escurece ou tira a cor da janela conforme o estado (a área de recorte já está ativa). */
function velar(ctx: Ctx, estado: EstadoDaCelula): void {
  if (estado === "laranja") {
    ctx.globalCompositeOperation = "saturation";
    ctx.fillStyle = "#000";
    ctx.fillRect(-20, -20, ARTE_L + 40, ARTE_A + 40);
    ctx.globalCompositeOperation = "source-over";
  }
  const veu = estado === "vermelha" ? 0.66 : estado === "chegando" ? 0.8 : estado === "laranja" ? 0.22 : estado === "moldura" ? 0.6 : 0;
  if (veu > 0) {
    ctx.fillStyle = `rgba(7,8,13,${veu})`;
    ctx.fillRect(-20, -20, ARTE_L + 40, ARTE_A + 40);
  }
}

export interface Composicao {
  estados: EstadoDaCelula[];
  folgas: Folga[];
  /** 0 a 1: quanto das linhas de corte ainda aparece (some quando a arte se completa) */
  corte: number;
}

/**
 * Pinta em `ctx` (largura em pixels dada) o tabuleiro do quebra-cabeça com as peças no estado e na folga dados, todas
 * copiando o mesmo `quadro` da cena.
 */
export function comporPecas(ctx: Ctx, quadro: CanvasImageSource, r: Recortes, c: Composicao, largura: number): void {
  const s = largura / ARTE_L;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#0d0e15";
  ctx.fillRect(0, 0, ARTE_L, ARTE_A);
  ctx.lineJoin = "round";
  r.recortes.forEach((_, i) => {
    if (c.estados[i] !== "coberta") return;
    contorno(ctx, r.contornos[i]);
    ctx.fillStyle = "#14161f";
    ctx.fill();
    ctx.setLineDash([1.6, 1.6]);
    ctx.strokeStyle = BORDA.coberta;
    ctx.lineWidth = 0.3;
    ctx.stroke();
    ctx.setLineDash([]);
  });
  for (const estado of ORDEM) {
    r.recortes.forEach((peca, i) => {
      if (c.estados[i] !== estado) return;
      const f = c.folgas[i];
      const solta = Math.abs(f.dx) + Math.abs(f.dy) + Math.abs(f.giro) > 0.05;
      ctx.save();
      ctx.translate(peca.cx + f.dx, peca.cy + f.dy);
      ctx.rotate((f.giro * Math.PI) / 180);
      ctx.translate(-peca.cx, -peca.cy);
      contorno(ctx, r.contornos[i]);
      if (solta) {
        ctx.strokeStyle = "rgba(0,0,0,0.45)";
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }
      ctx.save();
      ctx.clip();
      ctx.drawImage(quadro, 0, 0, ARTE_L, ARTE_A);
      velar(ctx, estado);
      ctx.restore();
      const forca = estado === "moldura" ? 1 : c.corte;
      if (forca > 0.01) {
        ctx.globalAlpha = forca;
        ctx.strokeStyle = BORDA[estado];
        ctx.lineWidth = estado === "moldura" ? 0.25 : estado === "verde" ? 0.42 : 0.55;
        ctx.stroke();
      }
      ctx.restore();
    });
  }
}
