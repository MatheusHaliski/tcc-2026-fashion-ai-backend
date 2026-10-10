// @vitest-environment jsdom
/**
 * Onde os insights dinâmicos (RF53) aparecem: cada aba do Explorador pede o seu contexto, a Cápsula do perfil mostra os
 * dela acima dos números e o Autopiloto manda o modo (Seguro · Descoberta · Experimental), mostra os números de cada
 * look lado a lado e prefere os insights que vieram com a sugestão.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, waitFor, USER } from "@/test-utils/render";
import { tokenStore } from "@/lib/api/client";
import ExplorerPage from "@/app/(site)/(app)/explorer/page";
import AutopilotPage from "@/app/(site)/(app)/autopilot/page";
import { LookbookTabs } from "@/components/lookbook-tabs";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"; });

const TAXONOMY = { subcategories: { upper_piece: ["t_shirt"], shoes_piece: ["casual_sneakers"] }, colors: { white: "#fff" }, materials: [], sizes: [], sexes: [], occasions: ["casual", "work"], styles: ["basic"], allowedOccasionsByCategory: {} };
const insight = (code: string, title: string) => ({ code, tone: "POSITIVE", title, text: `${title}: cresceu 12% em 7 dias.`, metric: { label: "Crescimento", value: 12, unit: "%" }, basis: ["HYPE_V2"] });
const contextOf = (path: string) => new URLSearchParams(path.split("?")[1]).get("context");

describe("Explorador: uma faixa por aba, com o contexto certo", () => {
  it("Passarela, Em alta (com a janela), Painel global, Marcas e Insights globais", async () => {
    tokenStore.clear(); localStorage.clear();
    const { calls } = mockApi({
      "GET /api/insights": (url: URL) => ({ context: url.searchParams.get("context"), generatedAt: new Date().toISOString(), algorithmVersion: "HYPE_V2", source: "local", items: [insight("X", `Insight ${url.searchParams.get("context")}`)] }),
      "GET /api/taxonomy": TAXONOMY,
    });
    const { container } = renderApp(<ExplorerPage />);
    expect(await screen.findByText("Insight EXPLORER_RUNWAY")).toBeTruthy();
    for (const [tab, ctx] of [["Em alta", "EXPLORER_TRENDING"], ["Painel global", "EXPLORER_MAP"], ["Buscar marcas & lojas", "EXPLORER_BRANDS"], ["Insights globais", "EXPLORER_GLOBAL"]] as const) {
      fireEvent.click(screen.getByRole("tab", { name: tab }));
      expect(await screen.findByText(`Insight ${ctx}`)).toBeTruthy();
      expect(container.querySelectorAll(`[data-context="${ctx}"]`).length).toBe(1);
    }
    const trending = calls.find((c) => c.path.startsWith("/api/insights") && contextOf(c.path) === "EXPLORER_TRENDING")!;
    expect(new URLSearchParams(trending.path.split("?")[1]).get("window")).toBe("7");
  });
});

describe("Perfil › Cápsula", () => {
  it("faixa CAPSULE acima dos números, seguindo o filtro de categoria", async () => {
    const { calls } = loggedAs(undefined, {
      "GET /api/users/u1/lookbook": { owner: USER, self: true, visible: true, institutional: false, tabs: [{ id: "capsule", label: "Cápsula", count: 3 }] },
      "GET /api/me/capsule": { basePieces: 3, looks: 5, factor: 1.7, filters: ["Tudo", "upper_piece"], cards: [] },
      "GET /api/insights": { context: "CAPSULE", generatedAt: new Date().toISOString(), algorithmVersion: "HYPE_V2", source: "local", items: [insight("CAPSULE_IDLE_REDISCOVERY", "Redescubra a jaqueta")] },
      "GET /api/taxonomy": TAXONOMY,
    });
    const { container } = renderApp(<LookbookTabs ownerId="u1" initialTab="capsule" />);
    expect(await screen.findByText("Redescubra a jaqueta")).toBeTruthy();
    const strip = container.querySelector('[data-context="CAPSULE"]')!;
    const stats = container.querySelector(".capsule-stats")!;
    expect(strip.compareDocumentPosition(stats) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByText("Parte superior"));
    await waitFor(() => expect(calls.some((c) => c.path === "/api/insights?context=CAPSULE&category=upper_piece")).toBe(true));
  });
});

describe("Autopiloto", () => {
  it("manda o modo, mostra os números de cada look e os insights que vieram na resposta", async () => {
    const { calls } = loggedAs(undefined, {
      "GET /api/taxonomy": TAXONOMY,
      "GET /api/insights": { context: "AUTOPILOT", generatedAt: new Date().toISOString(), algorithmVersion: "HYPE_V2", source: "local", items: [insight("AUTO_BEFORE", "Antes de gerar")] },
      "POST /api/autopilot/daily": { weather: { available: false }, suggestions: [{ key: "k1", title: "Look leve", pieces: [], why: "Combina com o seu DNA.", scores: { compatibility: 82, hype: null, novelty: 40 } }],
        insights: [insight("AUTOPILOT_REUSE", "Reuso em alta")] },
    });
    renderApp(<AutopilotPage />);
    expect(await screen.findByText("Antes de gerar")).toBeTruthy();
    fireEvent.click(await screen.findByRole("radio", { name: "Descoberta" }));
    fireEvent.click(screen.getByRole("button", { name: /Sugerir look de hoje/ }));
    expect(await screen.findByText("Look leve")).toBeTruthy();
    const body = calls.find((c) => c.method === "POST" && c.path === "/api/autopilot/daily")!.body as Record<string, unknown>;
    expect(body.mode).toBe("DISCOVERY");
    expect(screen.getByText("Compatibilidade").nextElementSibling?.textContent).toBe("82");
    expect(screen.getByText("Hype").nextElementSibling?.textContent).toBe("—");
    // a resposta trouxe insights: a faixa mostra os dela no lugar dos buscados antes
    expect(await screen.findByText("Reuso em alta")).toBeTruthy();
    expect(screen.queryByText("Antes de gerar")).toBeNull();
  });
});
