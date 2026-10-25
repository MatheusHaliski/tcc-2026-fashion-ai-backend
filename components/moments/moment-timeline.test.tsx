// @vitest-environment jsdom
/**
 * Perfil → Momentos: privado, vazio (próprio x de outra pessoa), trajetória por ano com top %, insígnia, pontos e o
 * interruptor "Mostrar no perfil" (com erro), e o Replay do ano.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { MomentsReplay, MomentsTimelineSection } from "@/components/moments/moment-timeline";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const YEAR = new Date().getFullYear();
const entry = (o: object) => ({ momentId: "m1", slug: "halloween", name: "Halloween", type: "CULTURAL", theme: { icon: "🎃" }, localStart: "2026-10-20", localEnd: "2026-10-31", status: "COMPLETED", outcome: "TOP_10", percentile: 5, badgeCode: "B1", publicOnProfile: true, pointsEarned: 40, ...o });
const TL = { visible: true, years: [{ year: 2026, items: [entry({}), entry({ momentId: "m2", slug: "denim", name: "Denim", outcome: "PARTICIPATED", percentile: 30, badgeCode: null, publicOnProfile: false, pointsEarned: 0 })] }] };
const fail = () => new Response(JSON.stringify({ status: 500, code: "ERRO", message: "Não salvou" }), { status: 500, headers: { "content-type": "application/json" } });

describe("MomentsTimelineSection", () => {
  it("privado e vazio (de outra pessoa e próprio)", async () => {
    mockApi({ "GET /api/users/u2/moments": { visible: false, years: [] } });
    renderApp(<MomentsTimelineSection userId="u2" self={false} />);
    expect(await screen.findByText("A linha do tempo de Momentos desta pessoa é privada.")).toBeTruthy();
    cleanup();
    mockApi({ "GET /api/users/u2/moments": { visible: true, years: [] } });
    renderApp(<MomentsTimelineSection userId="u2" self={false} />);
    expect(await screen.findByText("Ainda sem Momentos públicos.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Descobrir Momentos" })).toBeNull();
    cleanup();
    mockApi({ "GET /api/users/u1/moments": { visible: true, years: [] } });
    renderApp(<MomentsTimelineSection userId="u1" self />);
    expect(await screen.findByText("Você ainda não viveu nenhum Momento.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Descobrir Momentos" }).getAttribute("href")).toBe("/moments");
  });

  it("de outra pessoa: sem pontos nem interruptor; erro oferece tentar de novo", async () => {
    mockApi({ "GET /api/users/u2/moments": TL });
    renderApp(<MomentsTimelineSection userId="u2" self={false} />);
    expect(await screen.findByText(/Top 10% · top 5%/)).toBeTruthy();
    expect(screen.getByText(/Participou/).textContent).not.toContain("top 30%");
    expect(screen.queryByText(/FAI/)).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.getAllByText("Insígnia").length).toBe(1);
    cleanup();
    mockApi({ "GET /api/users/u2/moments": fail });
    renderApp(<MomentsTimelineSection userId="u2" self={false} />);
    expect(await screen.findByRole("button", { name: "Tentar de novo" })).toBeTruthy();
  });

  it("próprio: Replay, pontos, item oculto e alterna a visibilidade (com erro)", async () => {
    let fails = false;
    const { calls } = mockApi({ "GET /api/users/u1/moments": TL, [`GET /api/me/moments/replay?year=${YEAR}`]: { year: YEAR, moments: 3, completed: 2, looks: 5, stylesTried: 4, rediscoveredPieces: 1, points: 90, bestMonth: 10, favoriteMoment: "Halloween", peakHype: { hype: 88, moment: null } },
      "PUT /api/moments/denim/profile-visibility": () => (fails ? fail() : {}), "PUT /api/moments/halloween/profile-visibility": fail });
    renderApp(<MomentsTimelineSection userId="u1" self />);
    expect(await screen.findByText(/\+40 FAI/)).toBeTruthy();
    expect(document.querySelector(".moment-tl-item.is-hidden")!.textContent).toContain("Denim");
    expect(await screen.findByText(`Em ${YEAR} você…`)).toBeTruthy();
    expect(screen.getByText("participou de 3 Momentos")).toBeTruthy();
    expect(screen.getByText("seu melhor mês foi outubro")).toBeTruthy();
    expect(screen.getByText("seu Momento favorito foi Halloween")).toBeTruthy();
    expect(screen.getByText(/seu maior Hype \(88\) foi em/)).toBeTruthy();
    const switches = screen.getAllByRole("switch", { name: "Mostrar no perfil" });
    fireEvent.click(switches[1]);
    await waitFor(() => expect(calls.find((c) => c.path === "/api/moments/denim/profile-visibility")?.body).toEqual({ publicOnProfile: true }));
    await waitFor(() => expect(calls.filter((c) => c.path === "/api/users/u1/moments").length).toBe(2));
    fireEvent.click(switches[0]);
    expect(await screen.findByText("Não salvou")).toBeTruthy();
  });
});

describe("MomentsReplay", () => {
  it("some sem Momentos no ano e omite as linhas opcionais", async () => {
    const { container } = (mockApi({ [`GET /api/me/moments/replay?year=${YEAR}`]: { year: YEAR, moments: 0 } }), renderApp(<MomentsReplay />));
    await waitFor(() => expect(container.textContent).toBe(""));
    cleanup();
    mockApi({ [`GET /api/me/moments/replay?year=${YEAR}`]: { year: YEAR, moments: 1, completed: 0, looks: 1, stylesTried: 1, rediscoveredPieces: 0, points: 0 } });
    renderApp(<MomentsReplay />);
    expect(await screen.findByText("participou de 1 Momento")).toBeTruthy();
    expect(screen.queryByText(/melhor mês/)).toBeNull();
    expect(screen.queryByText(/favorito/)).toBeNull();
    expect(screen.queryByText(/maior Hype/)).toBeNull();
  });
});
