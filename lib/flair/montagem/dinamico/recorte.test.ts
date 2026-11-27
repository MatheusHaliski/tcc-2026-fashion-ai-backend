import { describe, expect, it } from "vitest";
import { ehDinamico, imagemParada, quebraCabecaDinamico, QUEBRA_CABECAS_DINAMICOS } from "@/lib/flair/montagem/dinamico/catalogo";
import { fatorar, fileirasIrregulares, gradeIrregular, naBorda, pecasDinamicas, rachaduras } from "@/lib/flair/montagem/dinamico/recorte";

describe("catálogo dos quebra-cabeças dinâmicos", () => {
  it("tem os cinco cenários, com vídeo ou símbolo animado e pôster parado", () => {
    expect(Object.keys(QUEBRA_CABECAS_DINAMICOS).sort()).toEqual(["arena", "caleidoscopio", "firefly-fogo", "logo-deriva", "logo-fai"]);
    expect(quebraCabecaDinamico("logo-fai")?.fonte.tipo).toBe("logo");
    expect(imagemParada(quebraCabecaDinamico("arena")!.fonte)).toBe("/flair/elencos/arena.webp");
    expect(ehDinamico("ipanema")).toBe(false);
    expect(ehDinamico(null)).toBe(false);
    expect(ehDinamico("toString")).toBe(false);
  });

  it("nenhum desafio usa o vídeo 2×2 do Firefly: cada cena usa só o vídeo do próprio quadrante", () => {
    const videos = Object.values(QUEBRA_CABECAS_DINAMICOS).flatMap((q) => (q.fonte.tipo === "video" ? [q.fonte.src] : []));
    expect(videos.some((v) => v.includes("cenas-firefly"))).toBe(false);
    expect(quebraCabecaDinamico("firefly-fogo")?.fonte).toMatchObject({ src: "/flair/elencos/fogo.mp4" });
  });
});

describe("recorte do quadro em n peças", () => {
  it("fatora n na grade de células mais quadradas", () => {
    expect(fatorar(4, 100)).toEqual({ colunas: 2, fileiras: 2 });
    expect(fatorar(9, 100)).toEqual({ colunas: 3, fileiras: 3 });
    expect(fatorar(6, 133.33)).toEqual({ colunas: 3, fileiras: 2 });
    expect(fatorar(7, 100)).toBeNull();
  });

  it("sem boa fatoração, fileiras com números diferentes de peças cobrem o quadro", () => {
    expect(fileirasIrregulares(7, 100)).toEqual([3, 2, 2]);
    const pecas = gradeIrregular(7, 100);
    expect(pecas).toHaveLength(7);
    expect(pecas[0].d).toBe("M0 0H33.33V33.33H0Z");
    expect(pecas[6]).toMatchObject({ cx: 75, cy: 83.33 });
  });

  it("o raio encontra a borda do quadro", () => {
    expect(naBorda([50, 50], -Math.PI / 2, 100)).toEqual([50, 0]);
    expect(naBorda([50, 50], 0, 160)).toEqual([160, 50]);
  });

  it("as rachaduras saem do centro em sentido horário e terminam na borda", () => {
    const { impacto, raios } = rachaduras(7, 100);
    expect(raios).toHaveLength(7);
    const angulos = raios.map((r) => Math.atan2(r[2][1] - impacto[1], r[2][0] - impacto[0]));
    const ordenados = angulos.map((a) => (a < angulos[0] ? a + 2 * Math.PI : a));
    expect([...ordenados].sort((a, b) => a - b)).toEqual(ordenados);
    raios.forEach((r) => expect([0, 100].some((b) => r[2][0] === b || r[2][1] === b)).toBe(true));
  });

  it("cada forma dá uma peça por vaga", () => {
    for (const forma of ["grade", "jigsaw", "setores", "cacos"] as const) {
      for (const n of [1, 2, 4, 6, 7, 8]) expect(pecasDinamicas(forma, n, 100)).toHaveLength(n);
    }
    expect(pecasDinamicas("jigsaw", 4, 100)[0].d).toContain("C");
    expect(pecasDinamicas("setores", 8, 100)[0].d).toMatch(/^M50 50L50 0A50 50/);
    expect(pecasDinamicas("grade", 0, 100)).toEqual([]);
  });
});
