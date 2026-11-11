import { describe, expect, it } from "vitest";
import { estadoDasPecas, gradeDoQuebraCabeca, nivelDe, vagaVizinha } from "@/lib/flair/elencos/board";
import { elencoDaRota, FORMACOES, formacaoLocal, mesclarElenco, rotaDoElenco } from "@/lib/flair/elencos/formacoes";
import type { ElencoConferencia } from "@/lib/flair/elencos/types";

/** Formações do contrato (vagas e número de linhas) e as regras puras do tabuleiro e do quebra-cabeça. */
describe("formações", () => {
  it("cinco elencos com as vagas e linhas da tabela, e toda linha liga duas vagas existentes", () => {
    expect(FORMACOES.map((f) => [f.codigo, f.vagas.length, f.linhas.length])).toEqual([
      ["PRIMEIRO_ELENCO", 5, 5], ["PALETA_ATELIE", 7, 9], ["CASA_MARCA", 9, 12], ["NOITE_ESTREIA", 9, 13], ["ELENCO_LENDARIO", 11, 17],
    ]);
    for (const f of FORMACOES) {
      const chaves = new Set(f.vagas.map((v) => v.chave));
      for (const l of f.linhas) expect(chaves.has(l.a) && chaves.has(l.b)).toBe(true);
    }
    expect(formacaoLocal("NOITE_ESTREIA")!.vagas.find((v) => v.chave === "ves")).toEqual({ chave: "ves", posicao: "VES", coluna: 2, linha: 1 });
    expect(elencoDaRota("casa-marca")).toBe("CASA_MARCA");
    expect(rotaDoElenco("ELENCO_LENDARIO")).toBe("/flair/elencos/elenco-lendario");
    expect(mesclarElenco("PRIMEIRO_ELENCO", { vagas: [] })!.vagas).toHaveLength(5);
  });
});

describe("tabuleiro e quebra-cabeça", () => {
  const f = formacaoLocal("PRIMEIRO_ELENCO")!;
  const conf: ElencoConferencia = {
    links: [
      { a: "acessorio", b: "cima", forca: 2, nivel: "GREEN", atributos: ["BRAND"] },
      { a: "bolsa", b: "cima", forca: 1, nivel: "ORANGE", atributos: ["COLOR"] },
      { a: "cima", b: "baixo", forca: 0, nivel: "RED", atributos: [] },
    ],
    quimicaCartas: {}, quimica: 30, requisitos: [], ok: false,
  };

  it("peças na ordem das linhas: verde, laranja, vermelha e coberta sem link", () => {
    const cartas = { acessorio: "a", cima: "b", bolsa: "c", baixo: "d" };
    expect(estadoDasPecas(f.linhas, cartas, conf)).toEqual(["verde", "laranja", "vermelha", "coberta", "coberta"]);
    expect(nivelDe("verde")).toBe("GREEN");
    expect(nivelDe("x")).toBeNull();
    expect(gradeDoQuebraCabeca(5)).toEqual({ colunas: 3, fileiras: 2 });
    expect(gradeDoQuebraCabeca(17)).toEqual({ colunas: 5, fileiras: 4 });
  });

  it("navegação entre vagas: esquerda/direita na ordem de leitura, cima/baixo na fileira vizinha", () => {
    expect(vagaVizinha(f.vagas, "acessorio", 1, "x")).toBe("cima");
    expect(vagaVizinha(f.vagas, "cima", 1, "x")).toBe("bolsa");
    expect(vagaVizinha(f.vagas, "bolsa", 1, "y")).toBe("baixo");
    expect(vagaVizinha(f.vagas, "acessorio", -1, "y")).toBe("acessorio");
  });
});
