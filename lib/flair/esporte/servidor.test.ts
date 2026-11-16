import { describe, expect, it } from "vitest";
import { tremorDaTrave, TREMOR } from "@/components/flair/esporte/gol-3d";
import { ALTURA_DO_TRAVESSAO, bolaNoLance, CHEGADA_AO_GOL, lancamento, naTrave, reinicio } from "@/lib/flair/esporte/bola";
import { planoDaCamera, tapaOReplay } from "@/lib/flair/esporte/camera";
import { CAMPOS } from "@/lib/flair/esporte/campo";
import { CHEGADA_SEM_BOLA, quadroDoLance } from "@/lib/flair/esporte/timeline";
import { comoJogada, type Jogada, type JogadorNoLance } from "@/lib/flair/esporte/types";

/**
 * O que a tela faz com o que o servidor decide (pedido da dona de 15/11/2026): cada jogador vai de onde estava até o
 * destino que o servidor deu, com o estado dele; os reinícios saem do ponto certo pelo alto; a bola na trave sobe até o
 * travessão, volta e a armação do gol treme.
 */
const FUTEBOL = CAMPOS.FUTEBOL;
const j = (time: "NOS" | "ELES", n: number, estado: JogadorNoLance["estado"], x: number, y: number): JogadorNoLance => ({ time, n, estado, x, y });
const TIME = (dx: number): JogadorNoLance[] => [
  j("NOS", 1, "GOLEIRO", 5, 30), j("NOS", 2, "COBERTURA", 30 + dx, 20), j("NOS", 3, "BOLA", 45 + dx, 30), j("NOS", 4, "APOIO", 48 + dx, 43), j("NOS", 5, "CORRIDA", 61 + dx, 18),
  j("ELES", 1, "GOLEIRO", 95, 30), j("ELES", 2, "COBERTURA", 62 + dx, 30), j("ELES", 3, "MARCA", 64 + dx, 19), j("ELES", 4, "PRESSAO", 48.2 + dx, 31), j("ELES", 5, "RETORNO", 53 + dx, 36),
];
const lance = (over: Partial<Jogada>): Jogada => ({ n: 2, jogada: 1, tempo: 1, relogio: 150, tipo: "CONDUCAO", time: "NOS", ok: true, jogador: 3, alvo: 4, de: [45, 30], para: [55, 30], placar: "0-0", ...over });
const figura = (q: ReturnType<typeof quadroDoLance>, time: string, n: number) => q.figuras.find((f) => f.time === time && f.n === n);

describe("jogadores decididos pelo servidor", () => {
  it("lê a lista do lance: estado e destino de cada um; estado desconhecido e item torto ficam de fora", () => {
    const lido = comoJogada({ tipo: "PASSE", jogadores: [{ time: "ELES", n: 4, estado: "PRESSAO", x: 48.2, y: 31 }, { time: "NOS", n: 2, estado: "VOA", x: 1, y: 1 }, 7], saiu: true, bateu: "TRAVESSAO" });
    expect(lido?.jogadores).toEqual([{ time: "ELES", n: 4, estado: "PRESSAO", x: 48.2, y: 31 }]);
    expect(lido).toMatchObject({ saiu: true, bateu: "TRAVESSAO" });
    expect(comoJogada({ tipo: "PASSE", jogadores: [] })?.jogadores).toBeUndefined();
    expect(comoJogada({ tipo: "PASSE", bateu: "REDE" })?.bateu).toBeUndefined();
  });

  it("cada jogador termina o lance onde o servidor mandou, com o estado dele, vindo de onde estava no lance anterior", () => {
    const antes = lance({ n: 1, tipo: "SAIDA", jogadores: TIME(0), para: [45, 30] });
    const agora = lance({ jogadores: TIME(10) });
    const fim = quadroDoLance(FUTEBOL, antes, agora, 1);
    for (const esperado of TIME(10)) {
      const f = figura(fim, esperado.time, esperado.n);
      expect(f?.estado).toBe(esperado.estado);
      expect(f?.x).toBeCloseTo(esperado.x, 5);
      expect(f?.y).toBeCloseTo(esperado.y, 5);
    }
    const comeco = quadroDoLance(FUTEBOL, antes, agora, 0);
    expect(figura(comeco, "ELES", 3)?.x).toBeCloseTo(64, 5);
    // no meio do lance, quem não tem a bola está a caminho e correndo
    const meio = quadroDoLance(FUTEBOL, antes, agora, CHEGADA_SEM_BOLA / 2);
    const marcador = figura(meio, "ELES", 3);
    expect(marcador?.x).toBeGreaterThan(64);
    expect(marcador?.x).toBeLessThan(74);
    expect(marcador?.gesto).toBe("corre");
    // quem conduz anda com a bola
    const dono = figura(quadroDoLance(FUTEBOL, antes, agora, 0.6), "NOS", 3);
    expect(dono?.x).toBeCloseTo(bolaNoLance(agora, 0.6).x, 5);
  });

  it("na finalização o goleiro de quem defende chega à bola no tempo do chute, e quem finaliza não sai do lugar", () => {
    const jogadores = TIME(40).map((p) => (p.time === "ELES" && p.n === 1 ? { ...p, y: 34 } : p.time === "NOS" && p.n === 3 ? { ...p, x: 88, y: 30 } : p));
    const chute = lance({ tipo: "CHUTE_DEFENDIDO", ok: false, de: [88, 30], para: [100, 34], jogadores });
    const anterior = lance({ n: 1, jogadores: TIME(40) });
    expect(figura(quadroDoLance(FUTEBOL, anterior, chute, 0.3), "ELES", 1)?.y).toBeCloseTo(30, 5);
    expect(figura(quadroDoLance(FUTEBOL, anterior, chute, CHEGADA_AO_GOL), "ELES", 1)?.y).toBeCloseTo(34, 5);
    expect(figura(quadroDoLance(FUTEBOL, anterior, chute, 0.9), "NOS", 3)?.x).toBeCloseTo(88, 5);
  });

  it("sem a lista do servidor (vôlei, tênis, corrida, skate) vale a formação de sempre", () => {
    const q = quadroDoLance(CAMPOS.VOLEI, null, lance({ jogador: 1, alvo: 2, tipo: "PASSE" }), 1);
    expect(q.figuras).toHaveLength(4);
    expect(q.figuras.every((f) => f.estado === undefined)).toBe(true);
  });
});

describe("reinícios e bola na trave", () => {
  it("tiro de meta, escanteio, lateral e saída posicionada vão pelo alto de um ponto ao outro; o relógio não anda", () => {
    for (const tipo of ["TIRO_DE_META", "ESCANTEIO", "LATERAL"]) {
      const r = lance({ tipo, de: [99, 1], para: [88, 30] });
      expect(reinicio(tipo)).toBe(true);
      expect(lancamento(r)).toBe(true);
      expect(bolaNoLance(r, 0)).toMatchObject({ x: 99, y: 1 });
      expect(bolaNoLance(r, 1)).toMatchObject({ x: 88, y: 30 });
      expect(bolaNoLance(r, 0.5).altura).toBeGreaterThan(0.8);
      expect(quadroDoLance(FUTEBOL, null, r, 1).relogio).toBe(150);
      expect(quadroDoLance(FUTEBOL, null, r, 0.3).figuras.find((f) => f.time === "NOS" && f.n === 3)?.gesto).toBe("chuta");
    }
    expect(bolaNoLance(lance({ tipo: "ESCANTEIO" }), 0.5).altura).toBeGreaterThan(bolaNoLance(lance({ tipo: "LATERAL" }), 0.5).altura);
    expect(lancamento(lance({ tipo: "SAIDA", jogadores: TIME(0) }))).toBe(true);
    expect(lancamento(lance({ tipo: "SAIDA" }))).toBe(false);
  });

  it("o passe que sai pela lateral leva a bola até a linha; o passe só interceptado para no caminho", () => {
    expect(bolaNoLance(lance({ tipo: "PASSE_PERDIDO", ok: false, saiu: true, de: [45, 30], para: [53, 0] }), 1)).toMatchObject({ x: 53, y: 0 });
    expect(bolaNoLance(lance({ tipo: "PASSE_PERDIDO", ok: false, de: [45, 30], para: [53, 0] }), 1).y).toBeGreaterThan(10);
  });

  it("a bola na trave chega ao gol na altura em que bate, não entra, volta e cai; a câmera corta para o lance", () => {
    const travessao = lance({ tipo: "CHUTE_NA_TRAVE", ok: false, bateu: "TRAVESSAO", de: [88, 30], para: [100, 30] });
    expect(naTrave(travessao.tipo)).toBe(true);
    const batida = bolaNoLance(travessao, CHEGADA_AO_GOL);
    expect(batida.x).toBeCloseTo(100, 5);
    expect(batida.altura).toBeCloseTo(ALTURA_DO_TRAVESSAO, 5);
    const fim = bolaNoLance(travessao, 1);
    expect(fim.x).toBeLessThan(100);
    expect(fim.altura).toBeLessThan(0.6);
    const poste = lance({ tipo: "RIVAL_NA_TRAVE", time: "ELES", ok: false, bateu: "TRAVE", de: [12, 30], para: [0, 25.5] });
    expect(bolaNoLance(poste, CHEGADA_AO_GOL)).toMatchObject({ x: 0, y: 25.5 });
    expect(bolaNoLance(poste, CHEGADA_AO_GOL).altura).toBeLessThan(ALTURA_DO_TRAVESSAO);
    expect(bolaNoLance(poste, 1).x).toBeGreaterThan(0);
    expect(planoDaCamera(travessao, 0.6, false)).toBe("lance");
  });

  it("no replay, só quem está entre a lente e o jogador da carta é escondido", () => {
    // 1 unidade na largura = 1/3 m; a câmera fica do lado de y maior (z positivo)
    expect(tapaOReplay(FUTEBOL, [50, 30], [51, 39])).toBe(true);
    expect(tapaOReplay(FUTEBOL, [50, 30], [51, 21])).toBe(false);
    expect(tapaOReplay(FUTEBOL, [50, 30], [62, 39])).toBe(false);
    expect(tapaOReplay(FUTEBOL, [50, 30], [50, 55])).toBe(false);
    expect(tapaOReplay(FUTEBOL, [50, 30], [50, 30])).toBe(false);
  });

  it("a trave treme depois da batida, para os dois lados, cada vez menos, e para sozinha", () => {
    expect(tremorDaTrave(0)).toBe(0);
    const amostras = Array.from({ length: 60 }, (_, i) => tremorDaTrave((i / 60) * TREMOR.duracao));
    expect(Math.max(...amostras)).toBeGreaterThan(TREMOR.amplitude * 0.5);
    expect(Math.min(...amostras)).toBeLessThan(-TREMOR.amplitude * 0.3);
    const pico = (de: number, ate: number) => Math.max(...amostras.slice(de, ate).map(Math.abs));
    expect(pico(0, 20)).toBeGreaterThan(pico(20, 40));
    expect(pico(20, 40)).toBeGreaterThan(pico(40, 60));
    expect(tremorDaTrave(TREMOR.duracao)).toBe(0);
    expect(tremorDaTrave(-1)).toBe(0);
    expect(tremorDaTrave(5)).toBe(0);
  });
});
