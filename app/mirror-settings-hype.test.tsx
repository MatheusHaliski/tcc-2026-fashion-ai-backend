// @vitest-environment jsdom
/**
 * RF53 · Lote Final (docs/hype/HYPE_AUDITORIA_ABAS.md): o Espelho mostra os seis números do look montado (P3-07, o mesmo
 * `LookScores` do Copilot e do Autopiloto — Hype ao lado da compatibilidade, "—" sem base, nunca 0) e Configurações ›
 * Privacidade ganha a opção de não aparecer em "Criadores em alta" (P3-12), salva em PUT /api/me/preferences.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, settle, waitFor, within } from "@/test-utils/render";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import MirrorPage from "@/app/(site)/(app)/mirror/page";
import SettingsPage from "@/app/(site)/(app)/settings/page";

const score = (scope: HTMLElement, label: string) => within(scope).getByText(label).nextElementSibling?.textContent;

const TOP = { id: "p1", name: "Camiseta preta", category: "upper_piece", subcategory: "t_shirt", color: "black", imageUrl: "/media/p1.png" };
const BOTTOM = { id: "p2", name: "Calça jeans", category: "lower_piece", subcategory: "jeans", color: "blue", imageUrl: "/media/p2.png" };
const SHOES = { id: "p3", name: "Tênis branco", category: "shoes_piece", subcategory: "casual_sneakers", color: "white", imageUrl: "/media/p3.png" };

function mirrorState(slots: Record<string, unknown>, scores: Record<string, number | null> | null) {
  return { slots: { outer_layer: null, upper: null, dress: null, lower: null, shoes: null, accessory: [], ...slots }, complete: !!slots.shoes, missing: [], warnings: [],
    origin: "manual", prompt: null, interpretation: null, actions: [], silhouette: null, postIt: null, light: { kelvin: 4000 }, restriction: null, shownCount: 0, scores };
}

const PREFS = { theme: "AUTO", language: "PT_BR", density: "COMFORTABLE", fontScale: 100, highContrast: false, reduceMotion: false, soundEnabled: false, hapticsEnabled: true, hypeCreatorOptOut: false };

beforeEach(() => { __resetHypeStore(); try { localStorage.clear(); } catch { /* sem storage */ } });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

describe("Espelho › leitura do look (P3-07)", () => {
  it("o look montado mostra os seis números, com Hype ao lado da compatibilidade e \"—\" para dimensão sem base", async () => {
    loggedAs(undefined, { "GET /api/me/avatar3d": { exists: false },
      "GET /api/me/mirror": mirrorState({ upper: TOP, lower: BOTTOM, shoes: SHOES }, { compatibility: 82, hype: null, novelty: 100, reuse: 35, usage: 0, sustainability: 71 }) });
    const { container } = renderApp(<MirrorPage />);
    await settle();
    expect(await screen.findByText("Leitura do look")).toBeTruthy();
    const grid = container.querySelector(".copilot-scores") as HTMLElement;
    expect(grid).toBeTruthy();
    expect(score(grid, "Compatibilidade")).toBe("82");
    expect(score(grid, "Hype")).toBe("—");                 // sem base: "—", nunca 0
    expect(score(grid, "Novidade")).toBe("100");
    expect(score(grid, "Reutilização")).toBe("35");
    expect(score(grid, "Uso comprovado")).toBe("0");       // 0 de verdade (nenhum uso) é número
    expect(score(grid, "Sustentabilidade")).toBe("71");
    expect(grid.textContent).not.toMatch(/Hype\s*0/);
    expect(screen.getByText(/Hype ≠ seu estilo/)).toBeTruthy();
  });

  it("espelho vazio não tem números; o Vista-me traz o look com os números novos", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/me/avatar3d": { exists: false },
      "GET /api/me/mirror": mirrorState({}, null),
      "POST /api/me/mirror/vista-me": mirrorState({ upper: TOP, lower: BOTTOM, shoes: SHOES }, { compatibility: 64, hype: 58, novelty: 67, reuse: 10, usage: 40, sustainability: 55 }) });
    const { container } = renderApp(<MirrorPage />);
    await settle();
    expect(await screen.findByText("O espelho está vazio")).toBeTruthy();
    expect(container.querySelector(".copilot-scores")).toBeNull();
    fireEvent.change(screen.getByLabelText("pedido"), { target: { value: "algo confortável" } });
    fireEvent.submit(screen.getByLabelText("pedido").closest("form") as HTMLFormElement);
    await waitFor(() => expect(container.querySelector(".copilot-scores")).toBeTruthy());
    const grid = container.querySelector(".copilot-scores") as HTMLElement;
    expect(score(grid, "Hype")).toBe("58");
    expect(score(grid, "Compatibilidade")).toBe("64");
    expect(calls.some((c) => c.method === "POST" && c.path === "/api/me/mirror/vista-me")).toBe(true);
  });
});

describe("Configurações › Privacidade › Criadores em alta (P3-12)", () => {
  it("o switch salva a preferência e alterna", async () => {
    const saved: unknown[] = [];
    loggedAs(undefined, { "GET /api/me/preferences": PREFS, "GET /api/me/consents": [],
      "PUT /api/me/preferences": (_u: URL, init: RequestInit) => { const body = JSON.parse(String(init.body)); saved.push(body); return { ...PREFS, hypeCreatorOptOut: body.hypeCreatorOptOut }; } });
    renderApp(<SettingsPage />);
    await settle();
    fireEvent.click(await screen.findByRole("tab", { name: "Privacidade" }));
    const sw = await screen.findByRole("switch", { name: "Não aparecer em Criadores em alta" });
    expect(sw.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText(/continuam com o próprio Hype/)).toBeTruthy();   // a explicação de uma linha
    fireEvent.click(sw);
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({ hypeCreatorOptOut: true });
    await waitFor(() => expect(screen.getByRole("switch", { name: "Não aparecer em Criadores em alta" }).getAttribute("aria-checked")).toBe("true"));
    fireEvent.click(screen.getByRole("switch", { name: "Não aparecer em Criadores em alta" }));
    await waitFor(() => expect(saved).toHaveLength(2));
    expect(saved[1]).toMatchObject({ hypeCreatorOptOut: false });
    await waitFor(() => expect(screen.getByRole("switch", { name: "Não aparecer em Criadores em alta" }).getAttribute("aria-checked")).toBe("false"));
  });

  it("se salvar falhar, o switch volta ao estado anterior (nunca mostra uma opção que não valeu)", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/me/preferences": PREFS, "GET /api/me/consents": [],
      "PUT /api/me/preferences": () => new Response(JSON.stringify({ status: 500, code: "ERRO", message: "falhou" }), { status: 500, headers: { "content-type": "application/json" } }) });
    renderApp(<SettingsPage />);
    await settle();
    fireEvent.click(await screen.findByRole("tab", { name: "Privacidade" }));
    const sw = await screen.findByRole("switch", { name: "Não aparecer em Criadores em alta" });
    fireEvent.click(sw);
    expect(screen.getByRole("switch", { name: "Não aparecer em Criadores em alta" }).getAttribute("aria-checked")).toBe("true");   // otimista
    await waitFor(() => expect(calls.some((c) => c.method === "PUT" && c.path === "/api/me/preferences")).toBe(true));
    await waitFor(() => expect(screen.getByRole("switch", { name: "Não aparecer em Criadores em alta" }).getAttribute("aria-checked")).toBe("false"));
  });
});
