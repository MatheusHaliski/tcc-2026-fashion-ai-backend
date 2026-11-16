// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { desfazer, guardar, lerGuardada, limpar, MESA_VAZIA, por, proximaVazia, tirar, vagaDaCarta } from "@/lib/flair/montagem/mesa";

/** Mesa de montagem: pôr, trocar, tirar, desfazer, próxima vaga vazia e a montagem guardada no aparelho. */
describe("mesa", () => {
  it("pôr guarda o estado anterior; desfazer volta uma jogada por vez", () => {
    const a = por(MESA_VAZIA, "cima", "c1");
    const b = por(a, "baixo", "c2");
    expect(b.cartas).toEqual({ cima: "c1", baixo: "c2" });
    expect(desfazer(b).cartas).toEqual({ cima: "c1" });
    expect(desfazer(desfazer(b)).cartas).toEqual({});
    expect(desfazer(MESA_VAZIA)).toBe(MESA_VAZIA);
    // pôr a mesma carta na mesma vaga não é jogada
    expect(por(a, "cima", "c1")).toBe(a);
  });

  it("carta que vem de outra vaga troca com a que estava no destino, ou só se move", () => {
    const m = por(por(MESA_VAZIA, "a", "c1"), "b", "c2");
    expect(por(m, "b", "c1").cartas).toEqual({ a: "c2", b: "c1" });
    // a deslocada não cabe na vaga de origem: sai da mesa
    expect(por(m, "b", "c1", () => false).cartas).toEqual({ b: "c1" });
    // destino vazio: só move
    expect(por(m, "c", "c1").cartas).toEqual({ b: "c2", c: "c1" });
    // carta nova sobre vaga ocupada: substitui
    expect(por(m, "a", "c3").cartas).toEqual({ a: "c3", b: "c2" });
    expect(vagaDaCarta(m.cartas, "c2")).toBe("b");
  });

  it("tirar e limpar são jogadas que o desfazer devolve", () => {
    const m = por(por(MESA_VAZIA, "a", "c1"), "b", "c2");
    expect(tirar(m, "a").cartas).toEqual({ b: "c2" });
    expect(tirar(m, "x")).toBe(m);
    expect(desfazer(limpar(m)).cartas).toEqual({ a: "c1", b: "c2" });
    expect(limpar(MESA_VAZIA)).toBe(MESA_VAZIA);
  });

  it("a próxima vaga vazia segue a ordem e dá a volta; sem vaga vazia, null", () => {
    const ordem = ["a", "b", "c"];
    expect(proximaVazia(ordem, { a: "1" }, "a")).toBe("b");
    expect(proximaVazia(ordem, { a: "1", b: "2", c: "3" }, "a")).toBeNull();
    expect(proximaVazia(ordem, { b: "2", c: "3" }, "c")).toBe("a");
  });
});

describe("montagem guardada", () => {
  beforeEach(() => localStorage.clear());

  it("volta só com vagas e cartas que ainda existem, sem repetir carta; mesa vazia apaga", () => {
    guardar("elenco.X", { a: "c1", b: "c2", velha: "c3", c: "c1" });
    expect(lerGuardada("elenco.X", ["a", "b", "c"], new Set(["c1", "c9"]))).toEqual({ a: "c1" });
    expect(lerGuardada("outra", ["a"], new Set(["c1"]))).toEqual({});
    guardar("elenco.X", {});
    expect(localStorage.getItem("fai.flair.montagem.elenco.X")).toBeNull();
    localStorage.setItem("fai.flair.montagem.ruim", "{nao é json");
    expect(lerGuardada("ruim", ["a"], new Set(["c1"]))).toEqual({});
  });
});
