// @vitest-environment jsdom
/**
 * Fases pessoais (F3): lista com resumo, criação, Memória e publicação no perfil (ato explícito); no perfil só aparecem as
 * fases publicadas e nada sem publicação.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { PhasesPanel, PublishedPhases } from "./daily-phases";

afterEach(() => { cleanup(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

const PHASE = { id: "f1", name: "Primeiro mês no novo emprego", startDate: "2026-11-02", endDate: "2026-12-01", status: "ACTIVE", daysLeft: 8, publicOnProfile: false, totalDays: 30, daysWithLook: 22, looks: 9, purposes: { "Trabalho presencial": 15, "Home office": 7 }, topPieces: [{ id: "p1", name: "Blazer azul", imageUrl: null, times: 11 }] };

describe("PhasesPanel", () => {
  it("lista, cria, abre a memória e publica", async () => {
    const api = loggedAs(undefined, { "GET /api/me/daily-looks/phases": [PHASE], "POST /api/me/daily-looks/phases": { ...PHASE, id: "f2", name: "Gestação" }, "PUT /api/me/daily-looks/phases/f1/visibility": { ...PHASE, publicOnProfile: true },
      "GET /api/me/daily-looks/phases/f1/memory": { ...PHASE, days: [{ date: "2026-11-02", schemeId: "s1", title: "Look do primeiro dia", purposeLabel: "Primeiro dia", feedback: "ADOREI" }] } });
    renderApp(<PhasesPanel />);
    expect(await screen.findByText("Primeiro mês no novo emprego")).toBeTruthy();
    expect(screen.getByText("22 de 30 dias com Look do Dia · 9 looks")).toBeTruthy();
    expect(screen.getByText("Trabalho presencial ×15 · Home office ×7")).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "Peças que mais te acompanharam" })).getByText("Blazer azul ×11")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver memória" }));
    const dialog = await screen.findByRole("dialog", { name: "Primeiro mês no novo emprego" });
    expect(within(dialog).getByRole("list", { name: "Dias da fase" }).textContent).toContain("Look do primeiro dia");
    expect(within(dialog).getByRole("list", { name: "Dias da fase" }).textContent).toContain("Primeiro dia ✓");
    fireEvent.click(screen.getByRole("switch", { name: "Publicar no perfil" }));
    await waitFor(() => expect(api.calls.find((c) => c.path === "/api/me/daily-looks/phases/f1/visibility")?.body).toEqual({ publicOnProfile: true }));
    fireEvent.click(screen.getByRole("button", { name: "Nova fase" }));
    fireEvent.change(await screen.findByLabelText("Nome da fase"), { target: { value: "Gestação" } });
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-11-01" } });
    fireEvent.change(screen.getByLabelText("Fim"), { target: { value: "2027-01-30" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar fase" }));
    await waitFor(() => expect(api.calls.find((c) => c.method === "POST" && c.path === "/api/me/daily-looks/phases")?.body).toEqual({ name: "Gestação", startDate: "2026-11-01", endDate: "2027-01-30" }));
    expect(await screen.findByText("Fase criada.")).toBeTruthy();
  });

  it("no perfil, só fases publicadas; sem nenhuma, nada", async () => {
    loggedAs(undefined, { "GET /api/users/u2/daily-looks/phases": [{ ...PHASE, publicOnProfile: true }] });
    renderApp(<PublishedPhases userId="u2" />);
    expect(await screen.findByRole("heading", { name: "Fases" })).toBeTruthy();
    expect(screen.getByText("Primeiro mês no novo emprego")).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull();
    cleanup();
    loggedAs(undefined, { "GET /api/users/u3/daily-looks/phases": [] });
    const { container } = renderApp(<PublishedPhases userId="u3" />);
    await new Promise((r) => setTimeout(r, 20));
    expect(container.textContent).toBe("");
  });
});
