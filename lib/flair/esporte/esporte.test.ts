import { describe, expect, it } from "vitest";
import { CORTE_DO_LANCE, CORTE_DO_REPLAY, planoDaCamera, poseDaCamera, seguir } from "@/lib/flair/esporte/camera";
import { CAMPOS, campoDe, noMundo, repouso } from "@/lib/flair/esporte/campo";
import { bolaNoLance, FOLGA, quadroDoLance } from "@/lib/flair/esporte/timeline";
import { comoJogada, jogadasDe, modalidadeDe, relogioEmTexto, resumoDe, situacaoDe, type Jogada } from "@/lib/flair/esporte/types";

const lance = (over: Partial<Jogada>): Jogada => ({ n: 1, jogada: 1, tempo: 1, relogio: 150, tipo: "PASSE", time: "NOS", ok: true, jogador: 3, alvo: 4, de: [45, 20], para: [70, 34], placar: "0-0", ...over });
const FUTEBOL = CAMPOS.FUTEBOL;

describe("leitura dos eventos do servidor", () => {
  const eventos = [
    { codigo: "MODALIDADE", valor: "BASQUETE" },
    { codigo: "JOGADA", valor: { n: 1, jogada: 1, tempo: 1, relogio: 0, tipo: "SAIDA", time: "NOS", ok: true, jogador: 3, alvo: 4, de: [45, 30], para: [45, 31], placar: "0-0" } },
    { codigo: "JOGADA", valor: { tipo: 7 } },
    { codigo: "SITUACAO", valor: { jogada: 1, total: 16, tempo: 1, relogio: 0, posse: "NOS", zona: 1, goleiroPronto: false, mao: ["c4", 9, "c5"], baralho: 2, placar: "0-0" } },
  ];

  it("lances, situação, modalidade e relógio saem dos eventos; valor torto é ignorado", () => {
    expect(jogadasDe({ eventos })).toHaveLength(1);
    expect(comoJogada({ tipo: "PASSE", carta: "c1", acao: "PASSE" })).toMatchObject({ tipo: "PASSE", carta: "c1", time: "NOS", de: [50, 30] });
    expect(comoJogada(null)).toBeNull();
    expect(modalidadeDe({ eventos })).toBe("BASQUETE");
    expect(modalidadeDe({ eventos: [] }, "TENIS")).toBe("TENIS");
    expect(situacaoDe({ eventos, status: "EM_ACAO" })).toMatchObject({ jogada: 1, total: 16, posse: "NOS", zona: 1, mao: ["c4", "c5"], baralho: 2 });
    expect(situacaoDe({ eventos, status: "ENTREGUE" })).toBeNull();
    expect(resumoDe({ eventos: [{ codigo: "RESUMO", valor: { posse: [56, 44], chutes: [4, 2], noGol: [3, 1], defesas: [1, 2], desarmes: [3, 1], passes: [5, 6], cartas: 14 } }] })).toMatchObject({ posse: [56, 44], cartas: 14 });
    expect(resumoDe({ eventos })).toBeNull();
    expect(relogioEmTexto(0)).toBe("00:00");
    expect(relogioEmTexto(754)).toBe("12:34");
    expect(relogioEmTexto(2400)).toBe("40:00");
  });
});

describe("campo de cada modalidade", () => {
  it("as seis modalidades têm campo, formação para todos os jogadores e os números do relógio", () => {
    expect(Object.keys(CAMPOS)).toEqual(["FUTEBOL", "BASQUETE", "VOLEI", "TENIS", "CORRIDA", "SKATE"]);
    for (const campo of Object.values(CAMPOS)) {
      expect(campo.formacao).toHaveLength(campo.jogadores);
      for (const [x, y] of campo.formacao) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(100);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(60);
      }
    }
    expect(campoDe("XADREZ")).toBe(FUTEBOL);
    expect(CAMPOS.CORRIDA.bola).toBe(false);
    expect(CAMPOS.SKATE.bola).toBe(false);
    expect(CAMPOS.VOLEI.metades).toBe(true);
  });

  it("o adversário é o espelho da formação e o centro do campo é a origem do mundo", () => {
    expect(repouso(FUTEBOL, "NOS", 1)).toEqual([5, 30]);
    expect(repouso(FUTEBOL, "ELES", 1)).toEqual([95, 30]);
    expect(noMundo(FUTEBOL, [50, 30])).toEqual([0, 0]);
    expect(noMundo(FUTEBOL, [100, 60])).toEqual([20, 10]);
  });
});

describe("linha do tempo da transmissão", () => {
  it("no passe a bola sai de quem passa e chega a quem recebe; o recebedor espera no destino", () => {
    const passe = lance({});
    expect(bolaNoLance(passe, 0)).toMatchObject({ x: 45, y: 20 });
    expect(bolaNoLance(passe, 1)).toMatchObject({ x: 70, y: 34 });
    expect(bolaNoLance(passe, 0.5).altura).toBeGreaterThan(0.3);
    const fim = quadroDoLance(FUTEBOL, null, passe, 1);
    const recebedor = fim.figuras.find((f) => f.time === "NOS" && f.n === 4);
    expect(Math.hypot((recebedor?.x ?? 0) - 70, (recebedor?.y ?? 0) - 34)).toBeLessThan(FOLGA);
    expect(quadroDoLance(FUTEBOL, null, passe, 0.3).figuras.find((f) => f.time === "NOS" && f.n === 3)?.gesto).toBe("chuta");
  });

  it("na condução a bola anda com o jogador; lance perdido para no meio do caminho", () => {
    const corrida = lance({ tipo: "CONDUCAO" });
    const meio = quadroDoLance(FUTEBOL, null, corrida, 0.6);
    const ator = meio.figuras.find((f) => f.time === "NOS" && f.n === 3);
    expect(ator?.x).toBeCloseTo(meio.bola.x, 5);
    expect(ator?.gesto).toBe("corre");
    expect(ator?.comCarta).toBe(false);
    expect(quadroDoLance(FUTEBOL, null, lance({ tipo: "CONDUCAO", carta: "c1" }), 0.6).figuras.find((f) => f.n === 3 && f.time === "NOS")?.comCarta).toBe(true);
    expect(bolaNoLance(lance({ tipo: "DRIBLE_PERDIDO", ok: false }), 1).x).toBeLessThan(60);
  });

  it("na finalização a bola vai ao gol, o goleiro mergulha na defesa e o time comemora o gol", () => {
    const gol = lance({ tipo: "CHUTE_GOL", jogador: 5, de: [88, 30], para: [100, 28] });
    expect(bolaNoLance(gol, 1).x).toBeGreaterThan(100);
    expect(bolaNoLance(gol, 0.6).x).toBeLessThanOrEqual(100);
    const fim = quadroDoLance(FUTEBOL, null, gol, 0.95);
    expect(fim.figuras.filter((f) => f.time === "NOS").every((f) => f.gesto === "comemora")).toBe(true);
    expect(fim.figuras.filter((f) => f.time === "ELES").every((f) => f.gesto === "lamenta")).toBe(true);
    const defesa = lance({ tipo: "CHUTE_DEFENDIDO", ok: false, jogador: 5, de: [88, 30], para: [100, 33] });
    expect(bolaNoLance(defesa, 1).x).toBeLessThan(100);
    expect(quadroDoLance(FUTEBOL, null, defesa, 0.8).figuras.find((f) => f.time === "ELES" && f.n === 1)?.gesto).toBe("mergulha");
    const fora = lance({ tipo: "CHUTE_FORA", ok: false, de: [88, 30], para: [100, 33] });
    expect(Math.abs(bolaNoLance(fora, 1).y - 30)).toBeGreaterThan(10);
  });

  it("ninguém fica em cima de ninguém, o goleiro quase não sai do gol e todos ficam dentro do campo", () => {
    const lances = [lance({}), lance({ tipo: "RIVAL_AVANCA", time: "ELES", de: [55, 30], para: [30, 22], jogador: 4 }), lance({ tipo: "DESARME", de: [30, 22], para: [30, 30], jogador: 2 })];
    for (let i = 0; i < lances.length; i++) {
      for (const k of [0, 0.3, 0.6, 1]) {
        const q = quadroDoLance(FUTEBOL, lances[i - 1] ?? null, lances[i], k);
        expect(q.figuras).toHaveLength(10);
        for (const a of q.figuras) {
          expect(a.x).toBeGreaterThanOrEqual(-2);
          expect(a.x).toBeLessThanOrEqual(102);
          for (const b of q.figuras) {
            if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(FOLGA * 0.6);
          }
        }
        expect(q.figuras.find((f) => f.time === "NOS" && f.n === 1)?.x).toBeLessThan(14);
      }
    }
  });

  it("com rede no meio cada time fica na própria metade; o relógio anda durante o lance", () => {
    const q = quadroDoLance(CAMPOS.VOLEI, null, lance({ jogador: 1, alvo: 2, de: [30, 20], para: [70, 40] }), 1);
    expect(q.figuras.filter((f) => f.time === "ELES").every((f) => f.x >= 50)).toBe(true);
    expect(quadroDoLance(FUTEBOL, null, lance({}), 1).relogio).toBe(150 + 75);
    expect(quadroDoLance(FUTEBOL, null, null, 0.5).figuras).toHaveLength(10);
  });
});

describe("câmera de transmissão", () => {
  it("acompanha a bola do alto da lateral, corta para perto na finalização e fecha no jogador da carta", () => {
    expect(planoDaCamera(lance({}), 0.2, false)).toBe("transmissao");
    expect(planoDaCamera(lance({ tipo: "CHUTE_GOL" }), CORTE_DO_LANCE, false)).toBe("lance");
    expect(planoDaCamera(lance({ tipo: "DESARME" }), 0.6, false)).toBe("lance");
    expect(planoDaCamera(lance({ carta: "c1" }), CORTE_DO_REPLAY, false)).toBe("replay");
    expect(planoDaCamera(lance({ carta: "c1", ok: false }), 0.9, false)).toBe("transmissao");
    expect(planoDaCamera(null, 0.5, false)).toBe("geral");
  });

  it("com reduzir movimento a câmera fica no plano geral, parada", () => {
    expect(planoDaCamera(lance({ tipo: "CHUTE_GOL", carta: "c1" }), 0.9, true)).toBe("geral");
    expect(poseDaCamera("geral", FUTEBOL, [10, 10], null)).toEqual(poseDaCamera("geral", FUTEBOL, [90, 50], null));
  });

  it("a câmera fica sempre do mesmo lado do campo, acima dele, e olha para a bola", () => {
    for (const plano of ["geral", "transmissao", "lance", "replay"] as const) {
      for (const bola of [[5, 5], [50, 30], [95, 55]] as [number, number][]) {
        const pose = poseDaCamera(plano, FUTEBOL, bola, bola);
        expect(pose.pos[2]).toBeGreaterThan(noMundo(FUTEBOL, bola)[1]);
        expect(pose.pos[1]).toBeGreaterThan(1);
      }
    }
    const transmissao = poseDaCamera("transmissao", FUTEBOL, [90, 30], null);
    expect(transmissao.pos[1]).toBeGreaterThan(8);
    expect(transmissao.alvo[0]).toBeGreaterThan(0);
    const replay = poseDaCamera("replay", FUTEBOL, [90, 30], [80, 20]);
    const distancia = Math.hypot(replay.pos[0] - replay.alvo[0], replay.pos[2] - replay.alvo[2]);
    // perto o bastante para ver a roupa, longe o bastante para o corpo inteiro caber no quadro (fov 32)
    expect(distancia).toBeGreaterThan(1.8 / (2 * Math.tan((16 * Math.PI) / 180)));
    expect(distancia).toBeLessThan(6);
    const meio = seguir(transmissao, replay, 0.5);
    expect(meio.pos[1]).toBeCloseTo((transmissao.pos[1] + replay.pos[1]) / 2, 5);
  });
});
