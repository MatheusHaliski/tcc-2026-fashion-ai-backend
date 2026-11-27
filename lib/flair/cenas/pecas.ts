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
import { DESBOTA_DO_TOM, ESCALA_DOS_TONS, type Tom, type Tons } from "@/lib/flair/cenas/tons";

/** Caixa [x, y, largura, altura] em unidades da arte. */
export type Caixa = [number, number, number, number];

/** Estado de uma célula do recorte: o da peça da linha, ou "moldura" nas células que sobram na grade. */
export type EstadoDaCelula = PecaEstado | "moldura";

export interface Recortes {
  recortes: Recorte[];
  contornos: Amostra[];
  /** caixa de cada peça [x, y, largura, altura], com as abas e uma folga: só essa parte do quadro é copiada */
  caixas: Caixa[];
}

function caixaDe(a: Amostra): Caixa {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < a.pontos.length; i += 2) {
    x0 = Math.min(x0, a.pontos[i]);
    x1 = Math.max(x1, a.pontos[i]);
    y0 = Math.min(y0, a.pontos[i + 1]);
    y1 = Math.max(y1, a.pontos[i + 1]);
  }
  const [x, y] = [Math.max(0, Math.floor(x0 - 1)), Math.max(0, Math.floor(y0 - 1))];
  return [x, y, Math.min(ARTE_L, Math.ceil(x1 + 1)) - x, Math.min(ARTE_A, Math.ceil(y1 + 1)) - y];
}

export function prepararRecortes(n: number): Recortes {
  const { recortes } = recortesDoQuebraCabeca(n);
  const contornos = recortes.map((r) => amostrar(r.d));
  return { recortes, contornos, caixas: contornos.map(caixaDe) };
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

/** Tom de cada estado: a peça solta e a que chega ficam cinza, a quase no lugar guarda parte da cor, a encaixada tem toda. */
const TOM: Partial<Record<EstadoDaCelula, Tom>> = { vermelha: "cinza", chegando: "cinza", laranja: "meio" };

/** Tons que os estados pedem (os que nenhuma peça usa não são pintados). */
export function tonsPedidos(estados: EstadoDaCelula[]): Set<Tom> {
  return new Set(estados.map((e) => TOM[e]).filter((t): t is Tom => !!t));
}

/** Escurece a janela conforme o estado e, sem `tons` prontos, também tira a cor (a área de recorte já está ativa). */
function velar(ctx: Ctx, estado: EstadoDaCelula, [x, y, w, h]: Caixa, semTons: boolean): void {
  const tom = TOM[estado];
  if (tom && semTons) {
    ctx.globalCompositeOperation = "saturation";
    ctx.globalAlpha = DESBOTA_DO_TOM[tom];
    ctx.fillStyle = "#000";
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
  const veu = estado === "vermelha" ? 0.6 : estado === "chegando" ? 0.72 : estado === "laranja" ? 0.12 : estado === "moldura" ? 0.6 : 0;
  if (veu > 0) {
    ctx.fillStyle = `rgba(7,8,13,${veu})`;
    ctx.fillRect(x, y, w, h);
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
 * copiando o mesmo `quadro` da cena (ou o tom dele já sem cor, com `tons` pintados por tons.ts neste quadro).
 */
export function comporPecas(ctx: Ctx, quadro: CanvasImageSource, r: Recortes, c: Composicao, largura: number, tons?: Tons | null): void {
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
      // só a caixa da peça: copiar o quadro inteiro por peça custava uma tela cheia por peça a cada quadro
      const [x, y, w, h] = r.caixas[i];
      ctx.save();
      ctx.clip();
      const tom = TOM[estado];
      const [fonte, k] = tom && tons ? [tons[tom].canvas, s * ESCALA_DOS_TONS] : [quadro, s];
      ctx.drawImage(fonte, x * k, y * k, w * k, h * k, x, y, w, h);
      velar(ctx, estado, r.caixas[i], !tons);
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
