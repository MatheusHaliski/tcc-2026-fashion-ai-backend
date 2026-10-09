// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, mockApi, renderApp, screen } from "@/test-utils/render";
import { HypeSealProgressList } from "./hype-seals";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("metas estruturadas dos selos automáticos", () => {
  it("sem dados mantém a meta do servidor visível e não fabrica nota zero", () => {
    mockApi(); renderApp(<HypeSealProgressList progress={[{ code: "VIRAL", earned: false, criteria: "Critério legado", available: false, publicEligible: true, requirements: { rule: "ALL", score: { current: null, target: 93, maximum: 100, missing: null, met: null } } }]} />);
    expect(screen.getByText("93 de 100")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.queryByText("0 de 100")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText("Critério legado")).toBeNull();
  });
  it("Clássico separa alternativas e mostra as condições simultâneas da segunda", () => {
    mockApi(); renderApp(<HypeSealProgressList progress={[{ code: "CLASSIC", earned: false, criteria: "", available: true, requirements: { rule: "ANY", alternatives: [
      { rule: "ALL", momentum: { current: "RISING", accepted: ["CLASSIC"], met: false } },
      { rule: "ALL", score: { current: 50, target: 40, maximum: 100, missing: 0, met: true }, dimensions: [{ dimension: "LONGEVITY", current: 60, target: 70, maximum: 100, missing: 10, met: false }] },
    ] } }]} />);
    expect(screen.getByText("Atenda a uma das alternativas")).toBeTruthy();
    expect(screen.getByText("Alternativa 1")).toBeTruthy();
    expect(screen.getByText("Alternativa 2")).toBeTruthy();
    expect(screen.getByText("Atenda a todos os critérios")).toBeTruthy();
    expect(screen.getByText(/Longevidade: 60 de 100 → meta 70/)).toBeTruthy();
  });
});
