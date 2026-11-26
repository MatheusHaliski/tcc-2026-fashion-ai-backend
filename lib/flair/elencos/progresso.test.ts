import { describe, expect, it } from "vitest";
import { elencoDaRota, FORMACOES, formacaoLocal, mesclarElenco, rotaDoElenco } from "@/lib/flair/elencos/formacoes";
import { cartaCumpre, encaixadas, estadosDasPecas } from "@/lib/flair/elencos/progresso";
import type { ElencoConferencia } from "@/lib/flair/elencos/types";

describe("formações locais", () => {
  it("dez elencos do mais simples ao mais difícil, com o que cada peça pede e o requisito de cartas", () => {
    expect(FORMACOES.map((f) => [f.codigo, f.vagas.length])).toEqual([
      ["DESAFIO_FOGO", 4], ["DESAFIO_VERDE_FLORESTAL", 4], ["DESAFIO_AZUL_TECH", 4], ["DESAFIO_FASHIONAI_TECH", 4], ["CELEBRACAO_ARENA", 6],
      ["LOGO_QUEBRA_CABECA", 12], ["LOGO_SETORES", 12], ["LOGO_TEAL", 12], ["LOGO_CACOS", 12], ["LOGO_PECAS_FALTANDO", 16],
    ]);
    const fogo = formacaoLocal("DESAFIO_FOGO")!;
    expect(fogo.vagas[0]).toEqual({ chave: "p1", posicao: "ANY", pede: { color: ["red"] } });
    expect(fogo.requisitos).toEqual([{ tipo: "COR", alvo: 4, valor: "red" }, { tipo: "CARTAS", alvo: 4 }]);
    expect(formacaoLocal("DESAFIO_VERDE_FLORESTAL")!.vagas[3].pede).toEqual({});
    expect(formacaoLocal("DESAFIO_FASHIONAI_TECH")!.vagas.every((v) => v.pede?.style?.[0] === "modern")).toBe(true);
    expect(mesclarElenco("DESAFIO_FOGO", { vagas: [] })!.vagas).toHaveLength(4);
    expect(elencoDaRota("celebracao-arena")).toBe("CELEBRACAO_ARENA");
    expect(rotaDoElenco("LOGO_CACOS")).toBe("/flair/elencos/logo-cacos");
  });
});

describe("progresso do quebra-cabeça", () => {
  const vagas = formacaoLocal("DESAFIO_FOGO")!.vagas;
  const conf: ElencoConferencia = { pecas: { p1: true, p2: false, p3: false, p4: false }, completas: 1, total: 4, requisitos: [], ok: false };

  it("vazia sem carta; conferindo sem julgamento; encaixada ou fora pelo servidor", () => {
    const cartas = { p1: "a", p2: "b", p3: "c" };
    expect(estadosDasPecas(vagas, cartas, conf, cartas)).toEqual({ p1: "encaixada", p2: "fora", p3: "fora", p4: "vazia" });
    expect(estadosDasPecas(vagas, cartas, null, {})).toEqual({ p1: "conferindo", p2: "conferindo", p3: "conferindo", p4: "vazia" });
    // a conferência julgou outra carta na peça 1: ela ainda não encaixa
    expect(estadosDasPecas(vagas, cartas, conf, { ...cartas, p1: "outra" }).p1).toBe("conferindo");
    expect(encaixadas(estadosDasPecas(vagas, cartas, conf, cartas))).toBe(1);
  });

  it("a carta combina com o pedido pela família de cor, pelo estilo ou pela ocasião (só ordena a bandeja)", () => {
    expect(cartaCumpre({ tags: { colors: ["crimson"] } }, { color: ["red"] })).toBe(true);
    expect(cartaCumpre({ tags: { colors: ["navy"] } }, { color: ["red"] })).toBe(false);
    expect(cartaCumpre({ tags: { styles: ["modern", "chic"] } }, { style: ["modern"] })).toBe(true);
    expect(cartaCumpre({ tags: { occasions: ["party"] } }, { occasion: ["party"] })).toBe(true);
    expect(cartaCumpre({ tags: null }, {})).toBe(true);
    expect(cartaCumpre({ tags: null }, { color: ["blue"] })).toBe(false);
  });
});
