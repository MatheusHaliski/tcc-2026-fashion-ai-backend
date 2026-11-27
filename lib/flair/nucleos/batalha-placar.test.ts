import { describe, expect, it } from "vitest";
import { fechoDaBatalha, pecasDoAdversario, rodadasDaBatalha, somaDaBatalha } from "@/lib/flair/nucleos/batalha-placar";
import { faixaDeHype } from "@/lib/flair/nucleos/hype-da-carta";
import { pessoasDosFigurantes } from "@/lib/flair/nucleos/gente/figurantes";
import type { NucleoPersonagem, NucleoResultado } from "@/lib/flair/nucleos/types";

const LOOK = { SUP: { subcategoria: "blazer", familia: "Preto", cor: "black" }, INF: { subcategoria: "jeans", familia: "Azul", cor: "blue" }, ACE: { subcategoria: "cap", familia: "Azul", cor: "blue" } };

const rodada = (n: number, voce: number, adversario: number) => ({
  codigo: "RODADA_DA_BATALHA",
  valor: { rodada: n, desafio: "MONO_AZUL", voce, adversario, conta: { voce: { regra: voce - 3, look: 2, recurso: 1 }, adversario: { regra: adversario, look: 0, recurso: 0 } }, cansadas: n === 2 ? ["INF"] : [], familia: "Preto", look: LOOK },
});

const resultado = (eventos: NucleoResultado["eventos"], pontos = 0): NucleoResultado => ({ pontos, estrelas: 0, resultado: "ETAPA_CUMPRIDA", regras: [], eventos });

describe("placar da Batalha de Looks", () => {
  it("lê as rodadas do resultado; na preparação seguinte, a da última entrega", () => {
    const fim = resultado([rodada(1, 78, 50), rodada(2, 53, 75), rodada(3, 100, 25)]);
    const rodadas = rodadasDaBatalha(fim, resultado([rodada(1, 1, 1)]));
    expect(rodadas.map((r) => [r.rodada, r.voce, r.adversario])).toEqual([[1, 78, 50], [2, 53, 75], [3, 100, 25]]);
    expect(rodadas[1].cansadas).toEqual(["INF"]);
    expect(rodadas[0].conta?.voce).toEqual({ regra: 75, look: 2, recurso: 1 });
    expect(somaDaBatalha(rodadas)).toEqual({ voce: 231, adversario: 150 });
    expect(rodadasDaBatalha(null, resultado([rodada(1, 78, 50)]))).toHaveLength(1);
    expect(somaDaBatalha(rodadasDaBatalha(null, null))).toBeNull();
  });

  it("no treino, junta o look da casa, a conta e o desafio numa rodada só", () => {
    const treino = resultado([{ codigo: "DESAFIO", valor: "CLIMA_FRIO" }, { codigo: "ADVERSARIO", valor: 52 }, { codigo: "LOOK_DO_ADVERSARIO", valor: { nota: 52, familia: "Azul", look: LOOK } },
      { codigo: "CONTA_DA_BATALHA", valor: { voce: { regra: 75, look: 4, recurso: 0 }, adversario: { regra: 50, look: 2, recurso: 0 }, cansadas: ["SUP"] } }], 79);
    expect(rodadasDaBatalha(treino)).toEqual([expect.objectContaining({ rodada: 1, desafio: "CLIMA_FRIO", voce: 79, adversario: 52, cansadas: ["SUP"], familia: "Azul" })]);
  });

  it("o look da casa vira peças do corpo 3D na cor da etiqueta; acessório fica de fora; sem look, nada", () => {
    const pecas = pecasDoAdversario(rodadasDaBatalha(resultado([rodada(1, 10, 20)])));
    expect(pecas?.map((p) => [p.slot, p.subcategory])).toEqual([["upper", "blazer"], ["lower", "jeans"]]);
    expect(pecas?.every((p) => /^#[0-9a-f]{6}$/.test(p.colorHex ?? ""))).toBe(true);
    expect(pecas?.[0].colorHex).not.toBe(pecas?.[1].colorHex);
    expect(pecasDoAdversario([])).toBeNull();
  });

  it("a roupa dada pela partida troca só a roupa do papel: a pessoa é a mesma e o molde é outro", () => {
    const lista: NucleoPersonagem[] = [{ papel: "ADVERSARIO", tipo: "manequim", pos: [1.8, 0, 0], cor: "#7A3FC4" }, { papel: "PLATEIA", tipo: "silhueta", pos: [3, 0, 3], cor: "#333333" }];
    const antes = pessoasDosFigurantes(7, lista);
    const pecas = pecasDoAdversario(rodadasDaBatalha(resultado([rodada(1, 10, 20)])))!;
    const depois = pessoasDosFigurantes(7, lista, false, { ADVERSARIO: pecas });
    const a = antes.get("fig:ADVERSARIO:0")!;
    const d = depois.get("fig:ADVERSARIO:0")!;
    expect(d.pecas).toBe(pecas);
    expect([d.sexo, d.pele, d.estatura]).toEqual([a.sexo, a.pele, a.estatura]);
    expect(d.chave).not.toBe(a.chave);
    expect(depois.get("fig:PLATEIA:0")!.chave).toBe(antes.get("fig:PLATEIA:0")!.chave);
  });
});

describe("faixa de Hype da carta (só leitura)", () => {
  it("usa os limiares do servidor; sem HYP público, sinal baixo", () => {
    expect([null, 19, 20, 40, 60, 75, 90, 100].map((h) => faixaDeHype({ hype: h == null ? null : { HYP: h } }))).toEqual(["LOW_SIGNAL", "LOW_SIGNAL", "NICHE", "RELEVANT", "HOT", "TRENDING", "VIRAL", "VIRAL"]);
    expect(faixaDeHype(null)).toBe("LOW_SIGNAL");
  });
});

describe("fecho da Batalha (rodada 8g)", () => {
  it("a soma final é a do servidor, com a execução do desfile final; o treino guarda a nota da rodada", () => {
    const soma = { codigo: "SOMA_DA_BATALHA", valor: { voce: 115, adversario: 79, rodadas: 127, execucao: -12 } };
    const fim = resultado([rodada(1, 50, 30), rodada(2, 40, 25), rodada(3, 37, 24), soma], 60);
    expect(fechoDaBatalha(fim)).toEqual({ voce: 115, adversario: 79, rodadas: 127, execucao: -12 });
    expect(fechoDaBatalha(resultado([{ codigo: "SOMA_DA_BATALHA", valor: { voce: 1, adversario: 2 } }]))).toBeNull();
    const treino = resultado([{ codigo: "LOOK_DO_ADVERSARIO", valor: { nota: 52, look: LOOK } }, { codigo: "SOMA_DA_BATALHA", valor: { voce: 46, adversario: 52, rodadas: 58, execucao: -12 } }], 59);
    expect(rodadasDaBatalha(treino)[0].voce).toBe(58);
  });
});
