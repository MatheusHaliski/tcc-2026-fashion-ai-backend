// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PointsHub } from "@/components/points/hub";
import { PointsSection } from "@/components/points/sections";
import { POINTS_MODES, pointsAvailability } from "@/lib/points/hub";
import { GUIDES } from "@/lib/guides/registry";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";

/**
 * Central de FAI Points: a mesma tela de seleção da Central FLAIR (lista lateral + painel com demonstração), com os
 * quatro lugares dos pontos; escolher não navega; a situação vem da conta; as seções mostram saldo, níveis e regras.
 */
const push = vi.fn(); const replace = vi.fn();
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), useRouter: () => ({ push, replace, prefetch: vi.fn(), back: vi.fn() }), useSearchParams: () => new URLSearchParams(""), usePathname: () => "/points" }));

const ACCOUNT = { balance: 1240, lifetime: 2980, level: "Prata", nextLevel: { level: "Ouro", threshold: 4000, missing: 1020, unlocks: "blocos de marcas" },
  levels: [{ level: "Bronze", threshold: 0, reached: true, unlocks: "blocos básicos" }, { level: "Prata", threshold: 1500, reached: true }, { level: "Ouro", threshold: 4000, reached: false, unlocks: "blocos de marcas" }],
  rules: [{ action: "LOOK_DO_DIA", points: 10, description: "Look do dia confirmado", dailyCap: 1 }, { action: "FLAIR_CBC", points: 15, description: "Desafio de Montagem entregue" }] };
const ROUTES = {
  "GET /api/me/points": ACCOUNT,
  "GET /api/points/shop": [{ sku: "a", availability: "DISPONIVEL", affordable: true, levelOk: true }, { sku: "b", availability: "DISPONIVEL", affordable: false, levelOk: false }, { sku: "c", availability: "EM_BREVE", affordable: true }],
  "GET /api/notifications": { unread: 0, items: [{ id: "n1", category: "POINTS" }, { id: "n2", category: "SOCIAL" }] },
  "GET /api/me/guides": { guides: { "points.fai": { version: 2, hidden: true, autoCount: 1, lastShownAt: "2026-10-01T00:00:00Z" } } },
};

beforeEach(() => { localStorage.clear(); push.mockReset(); replace.mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("modelo", () => {
  it("todo lugar tem rota, tutorial registrado e demonstração; a situação vem da conta e da loja", () => {
    for (const m of POINTS_MODES) { expect(GUIDES[m.guide], m.guide).toBeTruthy(); expect(m.demo.mp4).toMatch(/^\/points\/demos\/.*\.mp4$/); }
    expect(pointsAvailability("balance", { account: ACCOUNT })).toMatchObject({ available: true, status: { key: "points.hub.status.balance", vars: { balance: 1240, level: "Prata" } } });
    expect(pointsAvailability("store", { shop: { items: 0, affordable: 0 } }).available).toBe(false);
    expect(pointsAvailability("store", { shop: { items: 2, affordable: 1 } })).toMatchObject({ status: { key: "points.hub.status.store_affordable", vars: { n: 1 } } });
    expect(pointsAvailability("statement", { statement: 0 })).toMatchObject({ status: { key: "points.hub.status.statement", vars: { n: 0 } } });
  });
});

describe("PointsHub", () => {
  it("lista os quatro lugares em grupos, escolher troca o painel sem navegar e a situação mostra saldo e loja", async () => {
    loggedAs(ME, ROUTES);
    renderApp(<PointsHub />);
    const store = await screen.findByRole("tab", { name: /Loja do quarto/ });
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Saldo e níveis", "Como ganhar", "Loja do quarto", "Extrato"]);
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("1240 pontos · nível Prata"));
    fireEvent.click(store);
    expect(store.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toContain("Blocos do guarda-roupa");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("1 item ao seu alcance"));
    expect(push).not.toHaveBeenCalled();
    expect(localStorage.getItem(`fai.points.hub.selected:${ME.user.id}`)).toBe("store");
    expect(document.querySelector("video source")?.getAttribute("src")).toBe("/points/demos/store.webm");
  });
});

describe("seções", () => {
  it("saldo: valor com o ícone oficial, barra até o próximo nível e níveis alcançados", async () => {
    loggedAs(ME, ROUTES);
    renderApp(<PointsSection section="saldo" />);
    expect(await screen.findByRole("heading", { name: "Saldo e níveis" })).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText("1.240").length).toBeGreaterThan(0));
    expect(screen.getByText(/faltam 1020 para Ouro/)).toBeTruthy();
    expect(document.querySelectorAll(".points-levels li.is-reached").length).toBe(2);
  });
  it("como ganhar: cada regra com pontos, limite por dia e atalho para a tela", async () => {
    loggedAs(ME, ROUTES);
    renderApp(<PointsSection section="ganhar" />);
    expect(await screen.findByText("Look do dia confirmado")).toBeTruthy();
    expect(screen.getByText("(máx. 1/dia)")).toBeTruthy();
    const links = screen.getAllByRole("link", { name: "Ir" });
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/autopilot", "/flair/desafios"]);
  });
});
