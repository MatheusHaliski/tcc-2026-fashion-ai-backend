import { describe, expect, it } from "vitest";
import { cacos, grade, jigsaw, setores } from "@/lib/flair/elencos/recortes";
import { QUEBRA_CABECAS, quebraCabecaDe } from "@/lib/flair/elencos/quebra-cabecas";

/** Área de um polígono de retas (só M, L, H, V e Z), pela fórmula do laço. */
function area(d: string): number {
  const pts: [number, number][] = [];
  let [x, y] = [0, 0];
  for (const [, cmd, args] of d.matchAll(/([MLHVZ])([^MLHVZ]*)/g)) {
    const n = args.trim().split(/\s+/).filter(Boolean).map(Number);
    if (cmd === "M" || cmd === "L") [x, y] = [n[0], n[1]];
    else if (cmd === "H") x = n[0];
    else if (cmd === "V") y = n[0];
    else continue;
    pts.push([x, y]);
  }
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [a, b] = [pts[i], pts[(i + 1) % pts.length]];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

describe("recortes das imagens dos elencos", () => {
  it("grade 2 × 2: quatro quadrados iguais cortados pelo centro da largura e da altura", () => {
    const pecas = grade(2, 2, 100);
    expect(pecas.map((p) => p.d)).toEqual(["M0 0H50V50H0Z", "M50 0H100V50H50Z", "M0 50H50V100H0Z", "M50 50H100V100H50Z"]);
    expect(pecas.map((p) => [p.cx, p.cy])).toEqual([[25, 25], [75, 25], [25, 75], [75, 75]]);
    expect(pecas.map((p) => area(p.d))).toEqual([2500, 2500, 2500, 2500]);
    // a arena (proporção 1452 × 1083) em 3 × 2 partes iguais
    expect(grade(3, 2, 134.07).map((p) => area(p.d)).every((a) => Math.abs(a - (134.07 * 100) / 6) < 0.5)).toBe(true);
  });

  it("jigsaw: borda de fora reta e encaixes entre vizinhas (canto 2, borda 3, meio 4)", () => {
    const pecas = jigsaw(4, 3, 100);
    const curvas = (d: string) => (d.match(/C/g) ?? []).length;
    expect(pecas.map((p) => curvas(p.d))).toEqual([2, 3, 3, 2, 3, 4, 4, 3, 2, 3, 3, 2]);
    expect(pecas[0].d.startsWith("M0 0")).toBe(true);
    expect(jigsaw(4, 4, 100)).toHaveLength(16);
  });

  it("setores: 12 fatias iguais do círculo, a primeira começando no alto", () => {
    const pecas = setores(12, 50, 50, 50);
    expect(pecas).toHaveLength(12);
    expect(pecas[0].d).toBe("M50 50L50 0A50 50 0 0 1 75 6.7Z");
    expect(pecas[3].d).toBe("M50 50L100 50A50 50 0 0 1 93.3 75Z");
    // o centro de cada fatia fica no meio do arco, a 62% do raio
    expect([pecas[0].cx, pecas[0].cy]).toEqual([58.02, 20.06]);
  });

  it("cacos: os polígonos entre as rachaduras cobrem a imagem inteira, sem sobra", () => {
    const pecas = cacos([50, 50], [[[50, 0]], [[100, 50]], [[50, 100]], [[0, 50]]], 100);
    expect(pecas.map((p) => area(p.d))).toEqual([2500, 2500, 2500, 2500]);
    const logo = quebraCabecaDe("LOGO_CACOS")!;
    expect(logo.pecas).toHaveLength(12);
    expect(logo.pecas.reduce((s, p) => s + area(p.d), 0)).toBeCloseTo(10000, 3);
    expect(logo.pecas.every((p) => area(p.d) > 300)).toBe(true);
  });

  it("cada elenco tem uma peça por vaga, a imagem e o vídeo (os logos montam em CSS)", () => {
    expect(QUEBRA_CABECAS.map((q) => [q.codigo, q.forma, q.pecas.length, q.pedidos.length === q.pecas.length, !!q.video])).toEqual([
      ["DESAFIO_FOGO", "grade", 4, true, true], ["DESAFIO_VERDE_FLORESTAL", "grade", 4, true, true],
      ["DESAFIO_AZUL_TECH", "grade", 4, true, true], ["DESAFIO_FASHIONAI_TECH", "grade", 4, true, true],
      ["CELEBRACAO_ARENA", "grade", 6, true, true], ["LOGO_QUEBRA_CABECA", "jigsaw", 12, true, false],
      ["LOGO_SETORES", "setores", 12, true, false], ["LOGO_TEAL", "jigsaw", 12, true, false],
      ["LOGO_CACOS", "cacos", 12, true, false], ["LOGO_PECAS_FALTANDO", "jigsaw", 16, true, false],
    ]);
    expect(quebraCabecaDe("CELEBRACAO_ARENA")!.video).toBe("/flair/elencos/arena-celebracao.mp4");
    expect(quebraCabecaDe("DESAFIO_FOGO")!.imagem).toBe("/flair/elencos/fogo.webp");
  });
});
