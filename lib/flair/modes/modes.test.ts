import { describe, expect, it } from "vitest";
import { MODE_REGISTRY, matchesFilter, modeMeta, scenePhoto, supportsRivalPicker } from "@/lib/flair/modes/registry";
import { bestPicks, bossMatchup, cardSceneEffect, keyStats, mvpMoment, themeFit } from "@/lib/flair/modes/tactics";
import { frameAt, INTRO_MS, MOMENT_MS, replayDuration, slideIn } from "@/lib/flair/replay/timeline";
import type { MatchData, MatchMoment } from "@/lib/flair/match-stage";

const look = (id: string, stats: Record<string, number>, synergies = 0) => ({ schemeId: id, title: id, rating: 50, stats, synergies: Array.from({ length: synergies }, (_, i) => ({ code: `S${i}` })) });
const card = (id: string) => ({ id, name: id, imageUrl: null, tier: "OURO" as const, band: 3 });
const moment = (index: number, winner: "A" | "B" | "DRAW", scoreA: number, scoreB: number): MatchMoment =>
  ({ index, label: `R${index}`, winner, a: card(`a${index}`), b: card(`b${index}`), notes: [], decisive: false, scoreA, scoreB, meta: { A: false, B: false } });
const DATA: MatchData = { mode: "BATTLE", winner: "A", moments: [moment(0, "A", 80, 60), moment(1, "B", 40, 70), moment(2, "A", 95, 50)] };

describe("registro dos modos", () => {
  it("cobre os 18 modos, cada um com solo, multiplayer, cenário e complexidade 1–5", () => {
    expect(MODE_REGISTRY).toHaveLength(18);
    expect(new Set(MODE_REGISTRY.map((m) => m.code)).size).toBe(18);
    for (const m of MODE_REGISTRY) {
      expect(m.complexity).toBeGreaterThanOrEqual(1);
      expect(scenePhoto(m.code)).toMatch(/^\/flair\/games\/scenes\/[\w-]+\.webp$/);
    }
    expect(scenePhoto("BATTLE")).toBe("/flair/games/scenes/boate.webp");
    expect(supportsRivalPicker("BATTLE")).toBe(true);
    expect(supportsRivalPicker("TAG_TEAM")).toBe(true);
    expect(supportsRivalPicker("CHESS")).toBe(false);
    expect(modeMeta("DESCONHECIDO").multi).toBe("score");
  });
  it("filtros: multiplayer direto, cartas soltas e estratégia alta", () => {
    expect(matchesFilter("BATTLE", "multi")).toBe(true);
    expect(matchesFilter("CHESS", "multi")).toBe(false);
    expect(matchesFilter("DRAFT", "cards")).toBe(true);
    expect(matchesFilter("BATTLE", "cards")).toBe(false);
    expect(matchesFilter("LEAGUE", "strategy")).toBe(true);
    expect(matchesFilter("WARDROBE", "all")).toBe(true);
  });
});

describe("leitura tática", () => {
  const theme = { weights: { STYLE: 3, HYPE: 1, COLOR: 0.5 } };
  it("o encaixe pondera pelo tema, soma sinergias e fica entre 0 e 100", () => {
    expect(themeFit(look("a", { STYLE: 90, HYPE: 30 }), theme)).toBe(75);
    expect(themeFit(look("b", { STYLE: 30, HYPE: 90 }), theme)).toBe(45);
    expect(themeFit(look("c", { STYLE: 99 }, 5), null)).toBe(100);
    expect(themeFit(look("d", {}), theme)).toBe(50);
    expect(keyStats(theme)).toEqual(["STYLE"]);
    expect(bestPicks([look("b", { STYLE: 30, HYPE: 90 }), look("a", { STYLE: 90, HYPE: 30 })], theme, 1)).toEqual(["a"]);
  });
  it("contra o chefe conta os atributos vencidos e aponta o mais fraco", () => {
    expect(bossMatchup(look("a", { STYLE: 80, COLOR: 40, HYPE: 70 }), { STYLE: 70, COLOR: 75, HYPE: 72 })).toEqual({ wins: 1, total: 3, weakest: "COLOR" });
  });
  it("cada categoria acende um efeito no cenário; MVP é a vitória com mais folga", () => {
    expect(cardSceneEffect("shoes_piece")).toBe("floor");
    expect(cardSceneEffect("accessory_piece")).toBe("sparkle");
    expect(cardSceneEffect(null)).toBe("spotlight");
    expect(mvpMoment(DATA)?.index).toBe(2);
    expect(mvpMoment({ ...DATA, moments: [moment(0, "B", 1, 2)] })).toBeNull();
  });
});

describe("linha do tempo do vídeo da partida", () => {
  it("abertura, uma rodada por trecho com o ponto entrando na metade, e o fechamento", () => {
    expect(replayDuration(DATA)).toBe(INTRO_MS + 3 * MOMENT_MS + 2200);
    expect(frameAt(DATA, 0).phase).toBe("intro");
    const early = frameAt(DATA, INTRO_MS + 100);
    expect(early.moment?.index).toBe(0);
    expect(early.score).toEqual({ A: 0, B: 0 });
    expect(frameAt(DATA, INTRO_MS + MOMENT_MS * 0.6).score).toEqual({ A: 1, B: 0 });
    expect(frameAt(DATA, INTRO_MS + MOMENT_MS * 1.7).score).toEqual({ A: 1, B: 1 });
    const end = frameAt(DATA, 1e9);
    expect(end.phase).toBe("final");
    expect(end.score).toEqual({ A: 2, B: 1 });
    expect(end.winner).toBe("A");
    expect(slideIn(0)).toBe(1);
    expect(slideIn(0.5)).toBe(0);
  });
});
