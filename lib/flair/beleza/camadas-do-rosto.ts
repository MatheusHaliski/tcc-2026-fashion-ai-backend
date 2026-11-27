/**
 * O desenho da maquiagem no UV canônico do rosto (lib/avatar3d/canonical-face.ts), o mesmo das pessoas de cena
 * (lib/heist/looks-face.ts): base, blush, sombra, delineado, batom e iluminador, nessa ordem. `desenharMaquiagem` pinta
 * num contexto qualquer (fundo transparente: a camada por cima do rosto do Estúdio); `rostoMaquiado` faz a textura
 * inteira do rosto — a foto do Avatar 3D ou a pele lisa — com a maquiagem por cima (Road to Glory, aba MAKE UP). O
 * acabamento muda o quanto o batom cobre e o brilho do lábio: fosco sem brilho, cetim com um toque, gloss marcado.
 */
import { CANON_UV, FACE_OVAL } from "@/lib/avatar3d/canonical-face";
import { MACAS, OUTER_LIPS, PALPEBRAS } from "@/lib/heist/looks-face";
import type { CamadaDoRosto } from "@/lib/flair/beleza/familias";
import type { MaquiagemNoRosto } from "@/lib/flair/beleza/maquiagem-no-rosto";

const COBRE: Record<string, number> = { FOSCO: 0.8, CETIM: 0.85, GLOSS: 0.9 };
const BRILHO_DO_BATOM: Record<string, number> = { FOSCO: 0, CETIM: 0.18, GLOSS: 0.45 };

/** A linha dos cílios de cima (o delineado), de fora para dentro, nos dois olhos. */
export const LINHA_DOS_CILIOS = {
  right: [33, 246, 161, 160, 159, 158, 157, 173, 133],
  left: [263, 466, 388, 387, 386, 385, 384, 398, 362],
} as const;

/** Onde o iluminador bate: o dorso do nariz, o alto das duas maçãs e o arco do lábio. */
export const PONTOS_DE_LUZ = [6, 117, 346, 0] as const;

type Ctx = CanvasRenderingContext2D;

/** A maquiagem por cima do que já está no contexto (lado `size`), sem pintar o fundo. */
export function desenharMaquiagem(g: Ctx, size: number, m: MaquiagemNoRosto): void {
  const pt = (i: number): [number, number] => [CANON_UV[i * 2] * size, CANON_UV[i * 2 + 1] * size];
  const poly = (ids: readonly number[]) => {
    g.beginPath();
    ids.forEach((i, k) => (k ? g.lineTo(...pt(i)) : g.moveTo(...pt(i))));
    g.closePath();
  };
  const forca = (camada: CamadaDoRosto) => m.intensidade?.[camada] ?? 1;
  if (m.base) {
    g.filter = `blur(${size / 40}px)`;
    g.globalAlpha = 0.38 * forca("BASE");
    g.fillStyle = m.base;
    poly(FACE_OVAL);
    g.fill();
  }
  g.filter = `blur(${size / 60}px)`;
  if (m.bochechas) {
    g.globalAlpha = 0.32 * forca("BOCHECHAS");
    g.fillStyle = m.bochechas;
    for (const i of MACAS) {
      const [x, y] = pt(i);
      g.beginPath();
      g.ellipse(x, y, size * 0.05, size * 0.032, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (m.olhos) {
    g.globalAlpha = 0.55 * forca("OLHOS");
    g.fillStyle = m.olhos;
    poly(PALPEBRAS.right);
    g.fill();
    poly(PALPEBRAS.left);
    g.fill();
  }
  g.filter = `blur(${size / 700}px)`;
  if (m.delineado) desenharDelineado(g, size, m.delineado, forca("DELINEADO"), pt);
  if (m.labios) {
    const acabamento = m.acabamento ?? "CETIM";
    g.globalAlpha = (COBRE[acabamento] ?? 0.85) * forca("LABIOS");
    g.fillStyle = m.labios;
    poly(OUTER_LIPS);
    g.fill();
    if (BRILHO_DO_BATOM[acabamento]) {
      g.globalAlpha = BRILHO_DO_BATOM[acabamento];
      g.fillStyle = "#ffffff";
      const [x, y] = pt(14);
      g.beginPath();
      g.ellipse(x, y + size * 0.006, size * 0.014, size * 0.005, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (m.brilho) desenharIluminador(g, size, m.brilho, forca("BRILHO"), pt);
  g.globalAlpha = 1;
  g.filter = "none";
}

function desenharDelineado(g: Ctx, size: number, cor: string, forca: number, pt: (i: number) => [number, number]) {
  g.globalAlpha = 0.9 * forca;
  g.strokeStyle = cor;
  g.lineWidth = size / 220;
  g.lineCap = "round";
  for (const linha of [LINHA_DOS_CILIOS.right, LINHA_DOS_CILIOS.left]) {
    g.beginPath();
    linha.forEach((i, k) => (k ? g.lineTo(...pt(i)) : g.moveTo(...pt(i))));
    g.stroke();
  }
}

function desenharIluminador(g: Ctx, size: number, cor: string, forca: number, pt: (i: number) => [number, number]) {
  g.filter = `blur(${size / 120}px)`;
  g.globalAlpha = 0.4 * forca;
  g.fillStyle = cor;
  for (const i of PONTOS_DE_LUZ) {
    const [x, y] = pt(i);
    g.beginPath();
    g.ellipse(x, y, size * 0.024, size * 0.012, 0, 0, Math.PI * 2);
    g.fill();
  }
}

/** A textura do rosto com a maquiagem por cima (lado `size`): a foto, quando há, ou a pele lisa. */
export function rostoMaquiado(base: CanvasImageSource | null, pele: string, m: MaquiagemNoRosto, size = 1024): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d")!;
  if (base) g.drawImage(base, 0, 0, size, size);
  else {
    g.fillStyle = pele;
    g.fillRect(0, 0, size, size);
  }
  desenharMaquiagem(g, size, m);
  return c;
}
