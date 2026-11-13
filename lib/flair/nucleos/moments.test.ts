import { afterEach, describe, expect, it, vi } from "vitest";
import { cartasQuePontuaram, especialOk, janelaDoAcionamento, passosDaAcao, PASSO_MS } from "@/lib/flair/nucleos/action-fx";
import { assinantesFx, assinarFx, emitirFx, type FxEvento } from "@/lib/flair/nucleos/fx-events";
import {
  acionamentoDe,
  comandoPermitido,
  momentoInicial,
  permitido,
  proximoMomento,
  type AcaoDeCarta,
  type Momento,
} from "@/lib/flair/nucleos/moments";
import { NUCLEO_ACOES, type EfeitoItem, type NucleoResultado } from "@/lib/flair/nucleos/types";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";

/** Os quatro momentos da partida (seção 4 do desenho), os passos da ação a partir do servidor e os eventos de efeito. */
const LUTA: NucleoResultado = {
  pontos: 100,
  estrelas: 3,
  resultado: "VITORIA",
  regras: [{ codigo: "VITORIA", ok: true, pontos: 100 }, { codigo: "UM_ROUND", ok: false, pontos: 0 }],
  eventos: [1, 2, 3].map((round) => ({ codigo: "ROUND", valor: { round, atributo: "ATAQUE", voce: 50, oponente: 40, venceu: round !== 2 } })),
};
const FIGURINO: NucleoResultado = {
  pontos: 50,
  estrelas: 0,
  resultado: "PONTUADO",
  regras: [{ codigo: "FIGURINO_SUP", ok: true, pontos: 25 }, { codigo: "FIGURINO_INF", ok: false, pontos: 0 }, { codigo: "FIGURINO_CAL", ok: true, pontos: 25 }],
  eventos: [],
};
const card = (id: string): FlairCollectionCard => ({ id, originType: "PIECE", originId: id, season: "SPRING", tier: "PRATA", ovr: 70, rare: false, position: "SUP", name: id, priceVerified: true, state: "AVAILABLE", tradeable: true, acquiredVia: "GENERATED" });

afterEach(() => vi.restoreAllMocks());

describe("máquina dos momentos", () => {
  it("deck → preparação → ação → resultado; núcleo sem deck começa na preparação", () => {
    expect(momentoInicial(false)).toBe("DECK");
    expect(momentoInicial(true)).toBe("PREPARACAO");
    let m: Momento = "DECK";
    m = proximoMomento(m, { type: "ENTRAR" });
    expect(m).toBe("PREPARACAO");
    m = proximoMomento(m, { type: "ENTREGUE" });
    expect(m).toBe("ACAO");
    m = proximoMomento(m, { type: "FIM_ACAO" });
    expect(m).toBe("RESULTADO");
    expect(proximoMomento(m, { type: "REINICIAR", semDeck: false })).toBe("DECK");
    expect(proximoMomento(m, { type: "REINICIAR", semDeck: true })).toBe("PREPARACAO");
  });

  it("evento fora de hora não muda o momento", () => {
    expect(proximoMomento("DECK", { type: "ENTREGUE" })).toBe("DECK");
    expect(proximoMomento("DECK", { type: "FIM_ACAO" })).toBe("DECK");
    expect(proximoMomento("PREPARACAO", { type: "FIM_ACAO" })).toBe("PREPARACAO");
    expect(proximoMomento("ACAO", { type: "ENTRAR" })).toBe("ACAO");
    expect(proximoMomento("RESULTADO", { type: "ENTREGUE" })).toBe("RESULTADO");
  });

  it("o que a pessoa pode fazer com a carta em cada momento", () => {
    const pode = (m: Momento) => (["ESCOLHER", "VESTIR", "TROCAR", "TIRAR", "AMPLIAR", "ENTREGAR", "CAMERA", "PULAR"] as AcaoDeCarta[]).filter((a) => permitido(m, a));
    expect(pode("DECK")).toEqual(["ESCOLHER", "AMPLIAR"]);
    expect(pode("PREPARACAO")).toEqual(["VESTIR", "TROCAR", "TIRAR", "AMPLIAR", "ENTREGAR", "CAMERA"]);
    expect(pode("ACAO")).toEqual(["CAMERA", "PULAR"]);
    expect(pode("RESULTADO")).toEqual(["CAMERA"]);
  });

  it("acionamento: só nos quatro jogos da tabela e só no momento de cada um", () => {
    expect(acionamentoDe("DRESS_FIGHTER")).toEqual({ tipo: "ESPECIAL", momento: "ACAO" });
    expect(acionamentoDe("FASHION_SPORTS")).toEqual({ tipo: "TROCA", momento: "ACAO" });
    expect(acionamentoDe("LABIRINTO")).toEqual({ tipo: "ESPELHO", momento: "PREPARACAO" });
    expect(acionamentoDe("PERSONAGEM_FILME")).toEqual({ tipo: "RESPOSTA", momento: "PREPARACAO" });
    expect(acionamentoDe("PASSARELA")).toBeNull();
    expect(permitido("ACAO", "ACIONAR", "DRESS_FIGHTER")).toBe(true);
    expect(permitido("PREPARACAO", "ACIONAR", "DRESS_FIGHTER")).toBe(false);
    expect(permitido("PREPARACAO", "ACIONAR", "LABIRINTO")).toBe(true);
    expect(permitido("ACAO", "ACIONAR", "PASSARELA")).toBe(false);
    expect(permitido("ACAO", "ACIONAR")).toBe(false);
  });

  it("comandos do controle: tudo na preparação; na ação e no resultado só câmera e objetivo", () => {
    expect(NUCLEO_ACOES.filter((a) => comandoPermitido("PREPARACAO", a))).toEqual([...NUCLEO_ACOES]);
    expect(NUCLEO_ACOES.filter((a) => comandoPermitido("ACAO", a))).toEqual(["GIRAR", "ZOOM", "POSAR", "VER_OBJETIVO"]);
    expect(NUCLEO_ACOES.filter((a) => comandoPermitido("RESULTADO", a))).toEqual(["GIRAR", "ZOOM", "POSAR", "VER_OBJETIVO"]);
    expect(NUCLEO_ACOES.filter((a) => comandoPermitido("DECK", a))).toEqual([]);
  });
});

describe("passos da ação (só o que o servidor devolveu)", () => {
  it("disputa automática: os rounds contam a história e o efeito especial fecha", () => {
    const passos = passosDaAcao(LUTA, true);
    expect(passos.map((p) => [p.fonte, p.codigo, p.ok])).toEqual([["evento", "ROUND", true], ["evento", "ROUND", false], ["evento", "ROUND", true], ["especial", "VITORIA", true]]);
    expect(PASSO_MS).toBeLessThanOrEqual(2000);
  });

  it("demais jogos: uma peça por regra (com a vaga), os eventos e o especial; sem regras cumpridas, o especial falha", () => {
    const passos = passosDaAcao(FIGURINO);
    expect(passos.map((p) => [p.fonte, p.codigo, p.ok, p.vaga])).toEqual([
      ["regra", "FIGURINO_SUP", true, "SUP"],
      ["regra", "FIGURINO_INF", false, "INF"],
      ["regra", "FIGURINO_CAL", true, "CAL"],
      ["especial", "PONTUADO", false, null],
    ]);
    expect(especialOk({ ...FIGURINO, regras: FIGURINO.regras.map((r) => ({ ...r, ok: true })) })).toBe(true);
    expect(especialOk({ pontos: 0, estrelas: 0, resultado: "NAO_ABRE", regras: [], eventos: [] })).toBe(false);
  });

  it("janela do acionamento: carta Especial só entre dois rounds; troca só depois do INTERVALO do servidor", () => {
    const luta = passosDaAcao(LUTA, true);
    expect([0, 1, 2, 3, 4].map((i) => janelaDoAcionamento("ESPECIAL", luta, i))).toEqual([false, true, true, false, false]);
    expect(janelaDoAcionamento("TROCA", luta, 1)).toBe(false);
    const partida = passosDaAcao({ ...LUTA, eventos: [{ codigo: "INTERVALO", valor: "1-0" }, { codigo: "PLACAR", valor: "2-1" }] }, true);
    expect(janelaDoAcionamento("TROCA", partida, 1)).toBe(true);
    expect(janelaDoAcionamento("TROCA", partida, 2)).toBe(false);
    expect(janelaDoAcionamento("RESPOSTA", partida, 1)).toBe(false);
  });

  it("cartas que pontuaram: pela regra da vaga; sem regra por vaga, pelo efeito que o servidor deu à carta", () => {
    const cards = [card("a"), card("b"), card("c")];
    const vestidas = { SUP: "a", INF: "b", CAL: "c" };
    const efeitos = new Map<string, EfeitoItem[]>([["a", [{ codigo: "MARCA_BR", valor: 10 }]], ["b", []]]);
    expect(cartasQuePontuaram(FIGURINO, vestidas, cards, efeitos).map((x) => [x.vaga, x.cardId, x.pontos])).toEqual([["SUP", "a", 25], ["CAL", "c", 25]]);
    const semVaga: NucleoResultado = { pontos: 14, estrelas: 0, resultado: "REPROVADO", regras: [{ codigo: "MARCA_BR", ok: true, pontos: 10 }], eventos: [] };
    expect(cartasQuePontuaram(semVaga, vestidas, cards, efeitos)).toEqual([{ vaga: "SUP", cardId: "a", pontos: null, selo: { codigo: "MARCA_BR", valor: 10 } }]);
    expect(cartasQuePontuaram(semVaga, { SUP: "fora" }, cards, efeitos)).toEqual([]);
  });
});

describe("eventos de efeito (fx-events)", () => {
  it("quem assina recebe; cancelar para de receber; assinante com erro não derruba os outros", () => {
    const recebidos: FxEvento[] = [];
    const cancelar = assinarFx((e) => recebidos.push(e));
    const cancelarRuim = assinarFx(() => {
      throw new Error("falhou");
    });
    expect(assinantesFx()).toBe(2);
    emitirFx({ tipo: "momento", nucleo: "PASSARELA", momento: "ACAO" });
    expect(recebidos).toEqual([{ tipo: "momento", nucleo: "PASSARELA", momento: "ACAO" }]);
    cancelar();
    cancelarRuim();
    emitirFx({ tipo: "acao-fim", nucleo: "PASSARELA", resultado: "APROVADO", estrelas: 2 });
    expect(recebidos).toHaveLength(1);
    expect(assinantesFx()).toBe(0);
  });
});
