// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { CommunityTrends, TREND_KINDS } from "./community-trends";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const trend = (id: string, kind: string, extra = {}) => ({ id, title: `Trend ${id}`, description: "Uma composição por pessoa", kind, status: "PUBLISHED",
  publishedAt: "2026-11-26T12:00:00Z", endsAt: "2026-12-03T12:00:00Z", author: { username: "ana", displayName: "Ana" }, ...extra });

describe("exercício 17 — tipo de dinâmica da Trend", () => {
  it("a lista mostra a dinâmica traduzida e a publicação de cada trend; código desconhecido não vira chave crua", async () => {
    loggedAs(undefined, { "GET /api/challenges/trends": { items: [trend("t1", "COR_EM_COMUM"), trend("t2", "DINAMICA_ANTIGA")], total: 2, kinds: [...TREND_KINDS] } });
    renderApp(<CommunityTrends />);
    await screen.findByText("Trend t1");
    expect(document.querySelector('[data-trend-kind="COR_EM_COMUM"]')?.textContent).toBe("Cor em comum");
    expect(document.querySelector('[data-trend-kind="DINAMICA_ANTIGA"]')?.textContent).toBe("Dinâmica DINAMICA_ANTIGA");
    expect(screen.getAllByText(/^Publicada em /)).toHaveLength(2);
    expect(screen.getAllByText(/^Disponível até /)).toHaveLength(2);
  });

  it("a escolha oferece só as dinâmicas que o servidor aceita, e a criada vai com o código escolhido", async () => {
    const { calls } = loggedAs(undefined, {
      "GET /api/challenges/trends": { items: [], total: 0, kinds: ["PASSA_O_LOOK", "COR_EM_COMUM"] },
      "POST /api/challenges/trends": { id: "t9" }, "POST /api/challenges/trends/t9/publish": { awardedPoints: 20, pointsMessage: "20 Points", alreadyPublished: false },
    });
    renderApp(<CommunityTrends />);
    await screen.findByText("Nenhuma trend publicada neste filtro");
    fireEvent.click(screen.getByRole("button", { name: "Criar trend" }));
    fireEvent.click(document.getElementById("trend-kind")!);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["PASSA O LOOK", "Cor em comum"]);
    fireEvent.click(screen.getByRole("option", { name: "Cor em comum" }));
    fireEvent.change(document.getElementById("trend-title")!, { target: { value: "Azul em comum" } });
    fireEvent.change(document.getElementById("trend-description")!, { target: { value: "Uma composição por pessoa" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar trend" }));
    await waitFor(() => expect(calls.some((c) => c.path === "/api/challenges/trends/t9/publish")).toBe(true));
    expect(calls.find((c) => c.method === "POST" && c.path === "/api/challenges/trends")?.body).toEqual({ title: "Azul em comum", description: "Uma composição por pessoa", kind: "COR_EM_COMUM", durationDays: 7 });
  });

  it("se a publicação falha, o rascunho fica salvo e a nova tentativa não cria outra trend", async () => {
    let tentativas = 0;
    const { calls } = loggedAs(undefined, {
      "GET /api/challenges/trends": { items: [], total: 0, kinds: [...TREND_KINDS] }, "POST /api/challenges/trends": { id: "t9" },
      "POST /api/challenges/trends/t9/publish": () => (++tentativas === 1 ? new Response(JSON.stringify({ status: 503, message: "Offline" }), { status: 503, headers: { "content-type": "application/json" } })
        : { awardedPoints: 20, pointsMessage: "20 Points", alreadyPublished: false }),
    });
    renderApp(<CommunityTrends />);
    await screen.findByText("Nenhuma trend publicada neste filtro");
    fireEvent.click(screen.getByRole("button", { name: "Criar trend" }));
    fireEvent.change(document.getElementById("trend-title")!, { target: { value: "Azul em comum" } });
    fireEvent.change(document.getElementById("trend-description")!, { target: { value: "Uma composição por pessoa" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar trend" }));
    expect(await screen.findByText("O rascunho foi salvo. Tente publicar novamente para concluir.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Publicar trend" }));
    await waitFor(() => expect(tentativas).toBe(2));
    expect(calls.filter((c) => c.method === "POST" && c.path === "/api/challenges/trends")).toHaveLength(1);
  });
});
