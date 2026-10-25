import { describe, expect, it } from "vitest";
import { EMPTY_ATELIER_REWARDS, REWARD_CATEGORIES, SAMPLE_PROJECT, projectProgress, rewardCount, toggleTrophy, type AtelierRewardModel } from "./model";

const MODEL: AtelierRewardModel = {
  auraSignature: { unlocked: ["CIRCUIT", "HOLOGRAM"] },
  garmentMemory: [{ pieceId: "p1", pieceName: "Jaqueta", chapters: [{ id: "c1", kind: "MATCH", title: "Partida", date: "2026-01-01" }, { id: "c2", kind: "COLLAB", title: "Colab", date: "2026-01-02" }] }],
  habitableTrofeus: [{ id: "t1", kind: "LAMP", name: "Luminária", equipped: false }, { id: "t2", kind: "MIRROR", name: "Espelho", equipped: true }],
  directorPower: { permissions: ["CUSTOM_SCENE"] },
  collectiveWork: [{ installationId: "i1", name: "Mural", fragments: 3, total: 10 }],
  seasonPasses: [{ id: "s1", owner: "Marca", title: "Verão" }],
};

describe("recompensas do Atelier", () => {
  it("categorias trazem título, como ganhar e efeito traduzidos", () => {
    expect(REWARD_CATEGORIES.map((c) => c.key)).toEqual(["auraSignature", "garmentMemory", "habitableTrofeus", "directorPower", "collectiveWork", "seasonPasses"]);
    const titles = REWARD_CATEGORIES.map((c) => c.title);
    expect(titles).toEqual(["Assinatura de Aura", "Memória da peça", "Troféus habitáveis", "Poder de direção", "Obra coletiva", "Convites de temporada"]);
    for (const c of REWARD_CATEGORIES) {
      expect(c.how).not.toContain("atelier.");
      expect(c.effect).not.toContain("atelier.");
    }
    expect(REWARD_CATEGORIES[0].how).toBe("Ativar uma sinergia nova numa partida dos modos FLAIR");
    expect(REWARD_CATEGORIES[5].effect).toBe("Cenários, histórias e desafios exclusivos daquele perfil.");
  });

  it("projeto de exemplo tem nome, recompensa e metas traduzidas", () => {
    expect(SAMPLE_PROJECT.name).toBe("Espelho Constelação FAI");
    expect(SAMPLE_PROJECT.reward).toContain("espelho aparece no seu quarto");
    expect(SAMPLE_PROJECT.goals.map((g) => g.label)).toEqual(["Descubra três combinações cromáticas", "Reutilize uma peça em dois cenários", "Conclua um dueto"]);
  });

  it("conta recompensas somando capítulos e fragmentos", () => {
    expect(rewardCount(EMPTY_ATELIER_REWARDS)).toBe(0);
    expect(rewardCount(MODEL)).toBe(2 + 2 + 2 + 1 + 3 + 1);
  });

  it("progresso do projeto é a porcentagem de metas concluídas, 0 sem metas", () => {
    expect(projectProgress(SAMPLE_PROJECT)).toBe(0);
    expect(projectProgress({ id: "x", name: "x", reward: "x", goals: [{ label: "a", done: true }, { label: "b", done: false }, { label: "c", done: true }] })).toBe(67);
    expect(projectProgress({ id: "x", name: "x", reward: "x", goals: [] })).toBe(0);
  });

  it("alterna só o troféu indicado sem mutar o original", () => {
    const next = toggleTrophy(MODEL, "t1");
    expect(next.habitableTrofeus.map((t) => t.equipped)).toEqual([true, true]);
    expect(MODEL.habitableTrofeus[0].equipped).toBe(false);
    expect(toggleTrophy(next, "t2").habitableTrofeus[1].equipped).toBe(false);
  });
});
