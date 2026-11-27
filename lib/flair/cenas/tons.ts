/**
 * Tons do quadro para as peças que perdem cor: em vez de tirar a cor peça por peça (uma mistura "saturation" por peça
 * a cada quadro, o passo mais caro do quebra-cabeça), o quadro é copiado uma vez sem cor e uma vez com meia cor, só
 * quando alguma peça precisa, e cada peça copia a sua caixa do tom certo. Os tons ficam em meia resolução (um quarto
 * dos pixels a misturar): a peça sem cor está velada e fora do lugar, e a leve suavidade reforça que ainda não encaixou.
 */
import type { CriarTela, Tela } from "@/lib/flair/cenas/sprites";

/** Quanto cada tom tira da cor: cinza (peça solta ou chegando) e meio (peça quase no lugar). */
export const DESBOTA_DO_TOM = { cinza: 1, meio: 0.55 } as const;
export type Tom = keyof typeof DESBOTA_DO_TOM;

/** Fração da resolução do quadro em que os tons são pintados. */
export const ESCALA_DOS_TONS = 0.5;

export type Tons = Record<Tom, Tela>;

export function criarTons(criar: CriarTela, largura: number, altura: number): Tons | null {
  const [w, h] = [Math.max(1, Math.round(largura * ESCALA_DOS_TONS)), Math.max(1, Math.round(altura * ESCALA_DOS_TONS))];
  const cinza = criar(w, h);
  const meio = criar(w, h);
  return cinza && meio ? { cinza, meio } : null;
}

/** Pinta os tons pedidos a partir do quadro (reduzido à resolução dos tons). */
export function pintarTons(tons: Tons, quadro: CanvasImageSource, pedidos: Set<Tom>): void {
  for (const tom of pedidos) {
    const { ctx, canvas } = tons[tom];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "copy";
    ctx.drawImage(quadro, 0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "saturation";
    ctx.globalAlpha = DESBOTA_DO_TOM[tom];
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
}
