import { describe, expect, it } from "vitest";
import { elencoDaPartida, atorDoJogador, chaveDoJogador } from "@/lib/flair/esporte/elenco";
import { campoDe, UNIFORME_DA_CASA, UNIFORME_VISITANTE } from "@/lib/flair/esporte/campo";
import { nivelDeDetalhe, QUADROS_POR_NIVEL, triangulosComGente, TRIANGULOS_POR_PESSOA } from "@/lib/flair/nucleos/gente/detalhe";
import { PELES, pessoaDaSemente, sementeDoTexto, sorteio } from "@/lib/flair/nucleos/gente/elenco";
import { torcidaEmDegraus } from "@/lib/flair/nucleos/gente/torcida";
import type { Figura } from "@/lib/flair/esporte/timeline";

const FUTEBOL = campoDe("FUTEBOL");

describe("elenco humano", () => {
  it("a mesma semente dá o mesmo elenco; outra semente muda as pessoas", () => {
    const a = elencoDaPartida(42, FUTEBOL, UNIFORME_DA_CASA);
    const b = elencoDaPartida(42, FUTEBOL, UNIFORME_DA_CASA);
    expect([...a.values()].map((p) => p.chave)).toEqual([...b.values()].map((p) => p.chave));
    const c = elencoDaPartida(43, FUTEBOL, UNIFORME_DA_CASA);
    expect([...a.values()].map((p) => p.chave)).not.toEqual([...c.values()].map((p) => p.chave));
  });

  it("dez jogadores no futebol, cada um com corpo próprio, e variedade de pele, altura e cabelo", () => {
    for (const semente of [1, 7, 99, 2026]) {
      const e = [...elencoDaPartida(semente, FUTEBOL, UNIFORME_DA_CASA).values()];
      expect(e).toHaveLength(10);
      expect(new Set(e.map((p) => p.chave)).size).toBe(10);
      expect(new Set(e.map((p) => p.pele)).size).toBeGreaterThanOrEqual(3);
      expect(new Set(e.map((p) => p.estatura)).size).toBeGreaterThanOrEqual(5);
      expect(new Set(e.map((p) => `${p.cabelo?.length}:${p.cabelo?.texture}:${p.cabelo?.color}`)).size).toBeGreaterThanOrEqual(4);
      expect(new Set(e.map((p) => p.sexo)).size).toBe(1);
    }
  });

  it("veste o papel: uniforme do time, e o goleiro de manga longa em outra cor", () => {
    const e = elencoDaPartida(5, FUTEBOL, UNIFORME_DA_CASA);
    const linha = e.get(chaveDoJogador("NOS", 2))!;
    expect(linha.pecas.map((p) => [p.subcategory, p.colorHex])).toEqual([["t_shirt", UNIFORME_DA_CASA.camisa], ["shorts", UNIFORME_DA_CASA.calcao], ["casual_sneakers", UNIFORME_DA_CASA.calcado]]);
    expect(e.get(chaveDoJogador("ELES", 3))!.pecas[0].colorHex).toBe(UNIFORME_VISITANTE.camisa);
    const goleiro = e.get(chaveDoJogador("NOS", 1))!.pecas[0];
    expect(goleiro.subcategory).toBe("long_sleeve");
    expect([UNIFORME_DA_CASA.camisa, UNIFORME_VISITANTE.camisa]).not.toContain(goleiro.colorHex);
    // sem goleiro onde não há trave
    expect([...elencoDaPartida(5, campoDe("BASQUETE"), UNIFORME_DA_CASA).values()].every((p) => p.pecas[0].subcategory === "t_shirt")).toBe(true);
  });

  it("todos os tons de pele aparecem ao longo das sementes (nenhum fica de fora)", () => {
    const vistos = new Set(Array.from({ length: 200 }, (_, i) => pessoaDaSemente(i, "x", "FEMININO", []).pele));
    expect(vistos.size).toBe(PELES.length);
  });

  it("sorteio é estável e fica entre 0 e 1; a semente do texto também", () => {
    expect(sorteio(3, "a")).toBe(sorteio(3, "a"));
    for (let i = 0; i < 50; i++) expect(sorteio(i, "k")).toBeGreaterThanOrEqual(0);
    expect(sementeDoTexto("p-1")).toBe(sementeDoTexto("p-1"));
  });
});

describe("gesto do jogador no corpo humano", () => {
  const f = (gesto: Figura["gesto"]): Figura => ({ time: "NOS", n: 2, x: 50, y: 30, giro: 0, gesto, comCarta: false });
  const mundo = (x: number, y: number): [number, number] => [x / 10, y / 10];
  it("corre com velocidade, chuta com a perna, o goleiro mergulha de lado e todos ficam no lugar do quadro", () => {
    expect(atorDoJogador(f("corre"), mundo, false)).toMatchObject({ id: "NOS-2", x: 5, z: 3, anim: "run", velocidade: 4.5 });
    expect(atorDoJogador(f("chuta"), mundo, true)).toMatchObject({ chute: 1, naJogada: true });
    expect(atorDoJogador(f("mergulha"), mundo, false).tombo).toBeGreaterThan(1);
    expect(atorDoJogador(f("comemora"), mundo, false).anim).toBe("celebrate");
    expect(atorDoJogador(f("parado"), mundo, false)).toMatchObject({ anim: "idle", velocidade: 0, giro: Math.PI / 2 });
  });
});

describe("níveis de detalhe", () => {
  it("perto ou na jogada é completo; longe continua gente, animado com menos frequência", () => {
    expect(nivelDeDetalhe(5)).toBe("COMPLETO");
    expect(nivelDeDetalhe(60, true)).toBe("COMPLETO");
    expect(nivelDeDetalhe(20)).toBe("LEVE");
    expect(nivelDeDetalhe(50)).toBe("LONGE");
    expect(QUADROS_POR_NIVEL.LONGE).toBeGreaterThan(QUADROS_POR_NIVEL.COMPLETO);
    expect(triangulosComGente(1000, 2, 10)).toBe(1000 + 2 * TRIANGULOS_POR_PESSOA.humano + 10 * TRIANGULOS_POR_PESSOA.torcida);
  });
});

describe("torcida", () => {
  it("degraus cheios, mesma semente mesma torcida, cores da lista e cerca de um terço torcendo", () => {
    const t = torcidaEmDegraus(9, 18, 5, ["#111111", "#222222"]);
    expect(t).toHaveLength(100);
    expect(torcidaEmDegraus(9, 18, 5, ["#111111", "#222222"])).toEqual(t);
    expect(new Set(t.map((p) => p.roupa))).toEqual(new Set(["#111111", "#222222"]));
    const torcem = t.filter((p) => p.torce).length;
    expect(torcem).toBeGreaterThan(15);
    expect(torcem).toBeLessThan(50);
    expect(new Set(t.map((p) => p.pele)).size).toBeGreaterThanOrEqual(5);
  });
});

describe("figurantes das salas como gente", () => {
  const lista = [
    { papel: "PLATEIA", tipo: "silhueta", pos: [2, 0, -1], cor: "#3A3550", giro: -90, postura: "sentada" },
    { papel: "PLATEIA", tipo: "silhueta", pos: [-2, 0, -1], cor: "#3A3550", giro: 90, postura: "sentada" },
    { papel: "MANEQUIM", tipo: "manequim", pos: [0, 0, -2], cor: "#fff", postura: "busto" },
    { papel: "COLEGA", tipo: "silhueta", pos: [1, 0, -3], cor: "#1F7A76" },
  ] as const;
  it("cada pessoa tem o id de ator do diretor, a roupa do papel e o movimento; manequim continua objeto", async () => {
    const { atoresDosFigurantes, pessoasDosFigurantes } = await import("@/lib/flair/nucleos/gente/figurantes");
    const pessoas = pessoasDosFigurantes(3, [...lista]);
    expect([...pessoas.keys()]).toEqual(["fig:PLATEIA:0", "fig:PLATEIA:1", "fig:COLEGA:0"]);
    expect(atoresDosFigurantes([...lista]).map((a) => [a.id, a.anim])).toEqual([["fig:PLATEIA:0", "sit"], ["fig:PLATEIA:1", "sit"], ["fig:COLEGA:0", "idle"]]);
    expect(pessoasDosFigurantes(3, [...lista], true).get("fig:COLEGA:0")?.pecas.map((p) => p.subcategory)).toEqual(["t_shirt", "shorts", "casual_sneakers"]);
  });
});

describe("corpos inteiros com limite (passe de desempenho da Passarela)", () => {
  it("quem está na jogada e os mais perto da câmera ficam inteiros; o resto vai para o corpo leve", async () => {
    const { corposCheios, CORPOS_CHEIOS } = await import("@/lib/flair/nucleos/gente/detalhe");
    const plateia = Array.from({ length: 14 }, (_, i) => ({ id: `p${i}`, distancia: 3 + i }));
    const cheios = corposCheios([...plateia, { id: "cliente", naJogada: true, distancia: 30 }]);
    expect(cheios.size).toBe(CORPOS_CHEIOS);
    expect(cheios.has("cliente")).toBe(true);
    expect(cheios.has("p0")).toBe(true);
    expect(cheios.has("p13")).toBe(false);
    expect(corposCheios(plateia, Infinity).size).toBe(14);
  });
});
