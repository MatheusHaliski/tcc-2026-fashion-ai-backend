/** Enfeites que várias cenas usam: as cantoneiras finas da moldura e as marcas de régua (o acabamento de painel). */
import type { Enfeite } from "@/lib/flair/cenas/tipos";

/** Cantoneiras nos quatro cantos e uma régua de marcas curtas embaixo. */
export function moldura(cor: string, a = 0.5): Enfeite[] {
  const canto = (x: number, y: number, dx: number, dy: number): Enfeite => ({
    k: "traco",
    d: `M${x} ${y + dy * 7}L${x} ${y}L${x + dx * 7} ${y}`,
    cor,
    largura: 0.3,
    a,
  });
  const regua: Enfeite[] = Array.from({ length: 9 }, (_, i) => ({
    k: "traco",
    d: `M${62 + i * 4.5} 95.5L${62 + i * 4.5} ${i % 4 === 0 ? 93.2 : 94.4}`,
    cor,
    largura: 0.22,
    a: a * 0.8,
  }));
  return [canto(4, 4, 1, 1), canto(156, 4, -1, 1), canto(4, 96, 1, -1), canto(156, 96, -1, -1), ...regua];
}
