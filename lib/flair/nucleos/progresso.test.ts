import { describe, expect, it } from "vitest";
import ptBR from "@/lib/i18n/messages/pt-BR.json";
import en from "@/lib/i18n/messages/en.json";
import es from "@/lib/i18n/messages/es.json";
import { etapaDe, fraseDoEnredo, rodadaAberta, type EtapaDaCampanha, type NucleoProgresso } from "@/lib/flair/nucleos/progresso";
import { marcarSalvo, limparSalvamento, oQueDaResposta, ouvirSalvamento, salvamentoAtual } from "@/lib/flair/nucleos/salvamento";

const etapa = (codigo: string, ordem: number, over: Partial<EtapaDaCampanha> = {}): EtapaDaCampanha => ({ codigo, ordem, aberta: ordem === 1, vencida: false, estrelas: 0, pontos: 0, partidas: 0, vencidaEm: null, abreCom: null, ...over });
const campanha = (over: Partial<NucleoProgresso> = {}): NucleoProgresso => ({
  nucleo: "DRESS_FIGHTER", emSequencia: true, porResposta: false, estrelas: 0, maximo: 9, vencidas: 0, total: 3, completo: false,
  rodadas: [etapa("VENCER_2_DE_3", 1), etapa("ARENA_VELOZ", 2, { abreCom: "VENCER_2_DE_3" }), etapa("ARENA_BLINDADA", 3, { abreCom: "ARENA_VELOZ" })],
  ultima: null, enredo: { momento: "ABERTURA", proxima: "VENCER_2_DE_3" }, ...over,
});

/** Os dez jogos auditados em 15/11/2026 (núcleos 1, 2, 3, 4, 6, 7, 10, 12, 14 e 15). */
const JOGOS = ["PASSARELA", "DRESS_FIGHTER", "DRESS_THE_STAR", "PERSONAGEM_FILME", "FASHION_DETECTIVE", "BOUTIQUE_3D", "LABIRINTO", "AROUND_THE_WORLD", "FASHION_SPORTS", "BATALHA_LOOKS"];

describe("frase do enredo: sempre pelo que o servidor gravou", () => {
  it("quem nunca jogou lê a abertura; depois de uma partida, a transição cita a rodada, os pontos e as estrelas dela", () => {
    expect(fraseDoEnredo(campanha())).toMatchObject({ momento: "ABERTURA", chave: "flair3d.enredo.DRESS_FIGHTER.abertura", rodada: null, proxima: "VENCER_2_DE_3" });
    const venceu = campanha({ ultima: { rodada: "VENCER_2_DE_3", pontos: 100, estrelas: 3, resultado: "VITORIA", venceu: true, quando: "2026-11-19T10:00:00Z" }, enredo: { momento: "TRANSICAO", proxima: "ARENA_VELOZ" } });
    expect(fraseDoEnredo(venceu)).toEqual({ momento: "TRANSICAO", chave: "flair3d.enredo.DRESS_FIGHTER.transicao.VENCEU", rodada: "VENCER_2_DE_3", proxima: "ARENA_VELOZ", pontos: 100, estrelas: 3, maximo: 9 });
    const perdeu = campanha({ ultima: { rodada: "VENCER_2_DE_3", pontos: 50, estrelas: 0, resultado: "DERROTA", venceu: false, quando: "2026-11-19T10:00:00Z" }, enredo: { momento: "TRANSICAO", proxima: "VENCER_2_DE_3" } });
    expect(fraseDoEnredo(perdeu)).toMatchObject({ chave: "flair3d.enredo.DRESS_FIGHTER.transicao.NAO_VENCEU", rodada: "VENCER_2_DE_3", proxima: "VENCER_2_DE_3", pontos: 50, estrelas: 0 });
  });

  it("com tudo vencido vem o fecho, com as estrelas do jogo, mesmo que a última partida tenha sido uma derrota", () => {
    const fim = campanha({ completo: true, estrelas: 7, vencidas: 3, ultima: { rodada: "ARENA_VELOZ", pontos: 0, estrelas: 0, resultado: "DERROTA", venceu: false, quando: "2026-11-19T10:00:00Z" }, enredo: { momento: "FECHO", proxima: null } });
    expect(fraseDoEnredo(fim)).toEqual({ momento: "FECHO", chave: "flair3d.enredo.DRESS_FIGHTER.fecho", rodada: null, proxima: null, pontos: 0, estrelas: 7, maximo: 9 });
  });

  it("sem a campanha do servidor nada fica travado; com ela, vale o que ela diz", () => {
    expect(rodadaAberta(null, "ARENA_VELOZ")).toBe(true);
    expect(rodadaAberta(campanha(), "ARENA_VELOZ")).toBe(false);
    expect(rodadaAberta(campanha(), "VENCER_2_DE_3")).toBe(true);
    expect(etapaDe(campanha(), "ARENA_BLINDADA")?.abreCom).toBe("ARENA_VELOZ");
    expect(etapaDe(campanha(), "NAO_EXISTE")).toBeNull();
  });

  it("os dez jogos têm abertura, as duas transições e fecho nos três idiomas, com os mesmos números do servidor", () => {
    for (const catalogo of [ptBR, en, es] as Record<string, string>[]) {
      for (const jogo of JOGOS) {
        const base = `flair3d.enredo.${jogo}`;
        expect(catalogo[`${base}.abertura`], `${jogo} abertura`).toBeTruthy();
        // a transição cita a rodada jogada, os pontos dela e a rodada que falta; a vitória também as estrelas
        for (const desfecho of ["VENCEU", "NAO_VENCEU"]) {
          const texto = catalogo[`${base}.transicao.${desfecho}`];
          expect(texto, `${jogo} ${desfecho}`).toContain("{rodada}");
          expect(texto, `${jogo} ${desfecho}`).toContain("{pontos}");
          expect(texto, `${jogo} ${desfecho}`).toContain("{proxima}");
        }
        expect(catalogo[`${base}.transicao.VENCEU`]).toContain("{estrelas, plural");
        expect(catalogo[`${base}.fecho`]).toContain("{estrelas}");
        expect(catalogo[`${base}.fecho`]).toContain("{maximo}");
      }
    }
  });
});

describe("o que foi salvo e quando", () => {
  it("guarda só o último salvamento confirmado e avisa quem ouve", () => {
    limparSalvamento();
    let avisos = 0;
    const parar = ouvirSalvamento(() => (avisos += 1));
    expect(salvamentoAtual()).toBeNull();
    marcarSalvo("m1", "rascunho", "2026-11-19T14:32:00Z");
    expect(salvamentoAtual()).toEqual({ partida: "m1", oQue: "rascunho", quando: "2026-11-19T14:32:00Z" });
    marcarSalvo("m1", "entrega");
    expect(salvamentoAtual()?.oQue).toBe("entrega");
    expect(avisos).toBe(2);
    parar();
    limparSalvamento();
    expect(avisos).toBe(2);
    expect(salvamentoAtual()).toBeNull();
  });

  it("a resposta que fecha a partida salva o resultado; a que segue, a entrega ou a jogada", () => {
    expect(oQueDaResposta("ENTREGUE", "entrega")).toBe("resultado");
    expect(oQueDaResposta(undefined, "passo")).toBe("resultado");
    expect(oQueDaResposta("EM_ACAO", "entrega")).toBe("entrega");
    expect(oQueDaResposta("ABERTA", "passo")).toBe("passo");
  });
});
