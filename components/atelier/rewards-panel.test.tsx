// @vitest-environment jsdom
/**
 * Atelier › Conquistas (era a primeira parte de "Conquistas & Quarto"): as quatro categorias de recompensa com o que
 * foi concedido, o aviso por categoria vazia e o aviso quando as recompensas não vieram. Sem loja, sem quarto em 3D e
 * sem nenhuma chamada à API.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, mockApi, renderApp, screen } from "@/test-utils/render";
import { AtelierRewardsPanel } from "./rewards-panel";
import type { AtelierRewardSystem } from "@/lib/atelier/types";

afterEach(() => cleanup());

const reward = (id: string, category: string, title: string) => ({ id, category, code: id, title, description: `${title}: descrição`, sourceType: "CHALLENGE", sourceReference: "x", earnedAt: "2026-11-01T10:00:00Z" });
const REWARDS = {
  categories: { auraSignature: [], garmentMemory: [], habitableTrofeus: [reward("r1", "habitableTrofeus", "Troféu da Semana")], directorPower: [], collectiveWork: [], seasonPasses: [reward("r2", "seasonPasses", "Convite de Verão")] },
  levelProgress: { level: 1, label: "nível 1", progress: 0 },
  total: 2,
} as unknown as AtelierRewardSystem;

describe("Atelier › Conquistas", () => {
  it("mostra as concessões de cada categoria e o aviso nas vazias, sem chamar a API", () => {
    const { calls } = mockApi({});
    renderApp(<AtelierRewardsPanel rewards={REWARDS} />);
    expect(screen.getByText("Troféu da Semana")).toBeTruthy();
    expect(screen.getByText("Convite de Verão")).toBeTruthy();
    expect(screen.getAllByText("Nenhuma concessão ativa nesta categoria ainda.")).toHaveLength(2);
    expect(screen.queryByText(/quarto/i)).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("sem as recompensas, cada categoria diz que não foi possível consultar", () => {
    mockApi({});
    renderApp(<AtelierRewardsPanel />);
    expect(screen.getAllByText("Não foi possível consultar suas recompensas.")).toHaveLength(4);
  });
});
