/**
 * A maquiagem escolhida no rosto 3D (Road to Glory e FLAIR 3D MAKE UP): pinta lábios, blush e sombra sobre a textura do
 * rosto — a foto do Avatar 3D da pessoa ou a pele lisa da modelo da casa — no mesmo UV canônico das pessoas de cena
 * (lib/heist/looks-face.ts). O acabamento muda o quanto a cor cobre e o brilho do lábio: fosco sem brilho, cetim com
 * um toque, gloss com reflexo marcado. Usa o canvas do navegador.
 */
import { CANON_UV } from "@/lib/avatar3d/canonical-face";
import { MACAS, OUTER_LIPS, PALPEBRAS } from "@/lib/heist/looks-face";
import { BEAUTY_FAMILIAS } from "@/lib/flair/make-up/palette";
import type { MaquiagemEscolha } from "@/lib/flair/nucleos/types";

export interface MaquiagemNoRosto {
  labios?: string;
  bochechas?: string;
  olhos?: string;
  /** acabamento do batom: FOSCO, CETIM ou GLOSS */
  acabamento?: string;
}

/** As cores de cada área a partir das escolhas da tela (família por área); vazio quando nada foi escolhido. */
export function maquiagemNoRosto(escolhas: Record<string, MaquiagemEscolha> | undefined): MaquiagemNoRosto | null {
  if (!escolhas) return null;
  const cor = (area: "LABIOS" | "BOCHECHAS" | "OLHOS") => BEAUTY_FAMILIAS[area].find((t) => t.codigo === escolhas[area]?.familia)?.hex;
  const m: MaquiagemNoRosto = { labios: cor("LABIOS"), bochechas: cor("BOCHECHAS"), olhos: cor("OLHOS"), acabamento: escolhas.LABIOS?.acabamento };
  return m.labios || m.bochechas || m.olhos ? m : null;
}

const COBRE: Record<string, number> = { FOSCO: 0.8, CETIM: 0.85, GLOSS: 0.9 };
const BRILHO: Record<string, number> = { FOSCO: 0, CETIM: 0.18, GLOSS: 0.45 };

/** A textura do rosto com a maquiagem por cima (lado `size`). */
export function rostoMaquiado(base: CanvasImageSource | null, pele: string, m: MaquiagemNoRosto, size = 1024): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d")!;
  const pt = (i: number): [number, number] => [CANON_UV[i * 2] * size, CANON_UV[i * 2 + 1] * size];
  const poly = (ids: readonly number[]) => {
    g.beginPath();
    ids.forEach((i, k) => (k ? g.lineTo(...pt(i)) : g.moveTo(...pt(i))));
    g.closePath();
  };
  if (base) g.drawImage(base, 0, 0, size, size);
  else {
    g.fillStyle = pele;
    g.fillRect(0, 0, size, size);
  }
  g.filter = `blur(${size / 60}px)`;
  if (m.bochechas) {
    g.globalAlpha = 0.32;
    g.fillStyle = m.bochechas;
    for (const i of MACAS) {
      const [x, y] = pt(i);
      g.beginPath();
      g.ellipse(x, y, size * 0.05, size * 0.032, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (m.olhos) {
    g.globalAlpha = 0.55;
    g.fillStyle = m.olhos;
    poly(PALPEBRAS.right);
    g.fill();
    poly(PALPEBRAS.left);
    g.fill();
  }
  g.filter = `blur(${size / 700}px)`;
  if (m.labios) {
    const acabamento = m.acabamento ?? "CETIM";
    g.globalAlpha = COBRE[acabamento] ?? 0.85;
    g.fillStyle = m.labios;
    poly(OUTER_LIPS);
    g.fill();
    if (BRILHO[acabamento]) {
      g.globalAlpha = BRILHO[acabamento];
      g.fillStyle = "#ffffff";
      const [x, y] = pt(14);
      g.beginPath();
      g.ellipse(x, y + size * 0.006, size * 0.014, size * 0.005, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  g.filter = "none";
  return c;
}
