import { describe, expect, it } from "vitest";
import { consultaDosFiltros, desfecho, filtrosAtivos, modosDoJogo, outraPessoa, precisaAgir, rotaDoJogoNaSala } from "@/lib/flair/multi/filtros";
import { cartasDoTurnoAnterior, lanceCompleto, placarDeQuemLe, vagaDaCarta } from "@/lib/flair/multi/lance";
import type { Sala, Turnos } from "@/lib/flair/multi/types";

/** Regras puras do multiplayer: a consulta da busca com filtros, o lado de cada pessoa, a rota da sala e o lance. */
const pessoa = (u: string) => ({ id: `id-${u}`, username: u });
const sala = (extra: Partial<Sala> = {}): Sala => ({
  id: "s1", jogo: "BATALHA_LOOKS", modo: "TURNOS", estado: "JOGANDO", prazo: "2026-11-29T12:00:00Z", voce: "DE", de: pessoa("ana"), para: pessoa("bia"), ...extra,
});
const turnos = (extra: Partial<Turnos> = {}): Turnos => ({
  total: 3, vagas: ["SUP", "INF", "CAL", "ACE"], minimo: 1, repete: true, vez: 2, esperando: false, outroLancou: false, meuDeck: ["c1"],
  deckDoOutroPronto: true, usadas: [], julgados: [], pontos: { de: 80, para: 55 }, encerrado: false, ...extra,
});

describe("busca de adversários", () => {
  it("monta a consulta só com o que está preenchido, sem @ e com o país em maiúsculas", () => {
    expect(consultaDosFiltros({ q: " @bia ", relacao: "TODOS" })).toBe("q=bia");
    expect(consultaDosFiltros({ relacao: "MUTUOS", nivel: "ICONIC", estilo: "CLASSIC", pais: "br", cidade: " Recife ", ativo: true }))
      .toBe("relacao=MUTUOS&nivel=ICONIC&estilo=CLASSIC&pais=BR&cidade=Recife&ativo=true");
    expect(consultaDosFiltros({ comDeck: true })).toBe("");
    expect(consultaDosFiltros({ jogo: "PASSARELA", comDeck: true })).toBe("jogo=PASSARELA&comDeck=true");
  });

  it("conta os filtros ligados além do termo", () => {
    expect(filtrosAtivos({ q: "x", relacao: "TODOS" })).toBe(0);
    expect(filtrosAtivos({ relacao: "SIGO", ativo: true, pais: "PT" })).toBe(3);
  });

  it("modos por jogo: turnos só nos três de confronto", () => {
    expect(modosDoJogo("BATALHA_LOOKS")).toEqual(["TURNOS", "ASSINCRONO"]);
    expect(modosDoJogo("FASHION_SPORTS")[0]).toBe("TURNOS");
    expect(modosDoJogo("PASSARELA")).toEqual(["ASSINCRONO"]);
    expect(modosDoJogo("MAKE_UP")).toEqual(["ASSINCRONO"]);
  });
});

describe("sala", () => {
  it("a outra pessoa, o desfecho e a vez", () => {
    expect(outraPessoa(sala()).username).toBe("bia");
    expect(outraPessoa(sala({ voce: "PARA" })).username).toBe("ana");
    expect(desfecho(sala())).toBeNull();
    expect(desfecho(sala({ estado: "FECHADO", vencedor: "DE" }))).toBe("VITORIA");
    expect(desfecho(sala({ estado: "FECHADO", vencedor: "DE", voce: "PARA" }))).toBe("DERROTA");
    expect(desfecho(sala({ estado: "FECHADO", vencedor: "EMPATE" }))).toBe("EMPATE");
    expect(precisaAgir(sala({ estado: "CONVIDADO", voce: "PARA" }))).toBe(true);
    expect(precisaAgir(sala({ estado: "CONVIDADO" }))).toBe(false);
    expect(precisaAgir(sala({ turnos: turnos({ esperando: true }) }))).toBe(false);
    expect(precisaAgir(sala({ modo: "ASSINCRONO", assincrono: { eu: { terminou: true } } }))).toBe(false);
  });

  it("a partida da mesma semente abre na tela do jogo com ?sala=", () => {
    expect(rotaDoJogoNaSala({ id: "s9", jogo: "DRESS_THE_STAR" })).toBe("/flair/3d/dress-the-star?sala=s9");
    expect(rotaDoJogoNaSala({ id: "s9", jogo: "MAKE_UP", rodada: "ENSAIO_VERAO" })).toBe("/flair/make-up/ensaio-verao?sala=s9");
    expect(rotaDoJogoNaSala({ id: "s9", jogo: "XADREZ" })).toBe("/flair/3d/sala/s9");
  });
});

describe("lance", () => {
  it("a vaga da carta pela posição (vestido em SUP) ou a vaga única", () => {
    expect(vagaDaCarta("INF", ["SUP", "INF", "CAL", "ACE"])).toBe("INF");
    expect(vagaDaCarta("VES", ["SUP", "INF", "CAL", "ACE"])).toBe("SUP");
    expect(vagaDaCarta("VES", ["INF"])).toBeNull();
    expect(vagaDaCarta("CAL", ["CARTA"])).toBe("CARTA");
    expect(lanceCompleto({}, 0)).toBe(true);
    expect(lanceCompleto({}, 1)).toBe(false);
  });

  it("as cartas do turno anterior e o placar de quem lê", () => {
    const t = turnos({ julgados: [{ turno: 1, vencedor: "DE", de: { cartas: { SUP: "c1", INF: "c2" } }, para: { carta: "x9" } }] });
    expect(cartasDoTurnoAnterior(t, "DE")).toEqual(["c1", "c2"]);
    expect(cartasDoTurnoAnterior(t, "PARA")).toEqual(["x9"]);
    expect(cartasDoTurnoAnterior(turnos(), "DE")).toEqual([]);
    expect(placarDeQuemLe(t, "PARA")).toEqual({ meu: 55, outro: 80 });
  });
});
