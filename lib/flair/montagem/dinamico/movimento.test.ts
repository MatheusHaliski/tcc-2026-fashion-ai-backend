import { describe, expect, it } from "vitest";
import { folgaDaPeca } from "@/lib/flair/elencos/jigsaw";
import {
  alfaDaPeca, brilhos, DURACAO_ENCAIXE, emMovimento, folgaNoInstante, interpolarFolga, novosTrajetos, poseDoLogo, suavizar, VOLTA_S,
} from "@/lib/flair/montagem/dinamico/movimento";

describe("movimento do símbolo FAI", () => {
  it("começa parado no lugar e dá uma volta inteira em VOLTA_S segundos", () => {
    expect(poseDoLogo(0)).toEqual({ giro: 0, escala: 1, dx: 2.5, dy: 0 });
    expect(poseDoLogo(VOLTA_S).giro).toBeCloseTo(2 * Math.PI);
    expect(poseDoLogo(VOLTA_S / 2).escala).toBeGreaterThan(0.94);
  });

  it("os brilhos orbitam a borda do símbolo", () => {
    const b = brilhos(1.3, 12);
    expect(b).toHaveLength(12);
    b.forEach((p) => expect(Math.hypot(p.x, p.y)).toBeCloseTo(47, 0));
    b.forEach((p) => expect(p.alfa).toBeGreaterThanOrEqual(0.35));
  });
});

describe("encaixe das peças", () => {
  it("suaviza de 0 a 1 passando um pouco do ponto", () => {
    expect(suavizar(0)).toBeCloseTo(0);
    expect(suavizar(1)).toBe(1);
    expect(Math.max(...[0.6, 0.7, 0.8].map(suavizar))).toBeGreaterThan(1);
    expect(suavizar(5)).toBe(1);
  });

  it("a peça desliza da folga antiga à nova", () => {
    const de = folgaDaPeca(2, "vermelha");
    const para = folgaDaPeca(2, "verde");
    expect(interpolarFolga(de, para, 0)).toEqual(de);
    expect(interpolarFolga(de, para, 1)).toEqual(para);
  });

  it("só as peças que mudaram de estado partem de novo; movimento reduzido vai direto ao fim", () => {
    const inicio = novosTrajetos([], ["coberta", "verde"], [], 10, false);
    expect(inicio[1].de).toEqual(folgaDaPeca(1, "chegando"));
    expect(emMovimento(inicio, 10.1)).toBe(true);
    expect(emMovimento(inicio, 10 + DURACAO_ENCAIXE + 0.01)).toBe(false);
    const depois = novosTrajetos(inicio, ["verde", "verde"], ["coberta", "verde"], 11, false);
    expect(depois[1]).toBe(inicio[1]);
    expect(depois[0].inicio).toBe(11);
    const reduzido = novosTrajetos([], ["vermelha"], [], 5, true);
    expect(folgaNoInstante(reduzido[0], 5, true)).toEqual(folgaDaPeca(0, "vermelha"));
    expect(emMovimento(reduzido, 5)).toBe(false);
  });

  it("opacidade por estado: coberta some, chegando pulsa fraca, encaixada inteira", () => {
    expect(alfaDaPeca("coberta", 0)).toBe(0);
    expect(alfaDaPeca("chegando", 0.25)).toBeCloseTo(0.55);
    expect(alfaDaPeca("vermelha", 0)).toBe(0.7);
    expect(alfaDaPeca("verde", 3)).toBe(1);
  });
});
