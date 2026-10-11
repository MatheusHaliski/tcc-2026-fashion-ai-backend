// @vitest-environment jsdom
/**
 * RF53 · Lote Final (docs/hype/HYPE_AUDITORIA_ABAS.md): o Espelho — dentro do Meu Quarto — mostra os seis números do look montado (P3-07, o mesmo
 * `LookScores` do Copilot e do Autopiloto — Hype ao lado da compatibilidade, "—" sem base, nunca 0) e Configurações ›
 * Privacidade ganha a opção de não aparecer em "Criadores em alta" (P3-12), salva em PUT /api/me/preferences.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, loggedAs, renderApp, screen, settle, waitFor, within } from "@/test-utils/render";
import { nav } from "@/test-utils/setup";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import RoomPage from "@/app/(site)/(app)/room/page";
import SettingsPage from "@/app/(site)/(app)/settings/page";

// o Espelho abre dentro do quarto pelo link de entrada (/room?espelho=1); a cena 3D não roda no jsdom
vi.mock("@/components/room3d/room-scene", () => ({ default: () => <div data-testid="room-scene" /> }));
vi.mock("@/components/three/avatar-still", () => ({ default: () => null }));
const ROOM = { owner: true, level: "ESTREIA", levelInfo: { unlocks: "", aesthetic: "Estreia" }, modules: [], drawerLabels: {}, pieces: {}, capacity: { pieces: 0, positions: 0 } };
const roomRoutes = { "GET /api/me/room": ROOM, "GET /api/me/room/list": [], "GET /api/tipos-look": [] };
const withWebgl = () => { const real = HTMLCanvasElement.prototype.getContext; vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) { return kind === "webgl" || kind === "webgl2" ? ({} as unknown as RenderingContext) : (real as (this: HTMLCanvasElement, k: string, ...r: unknown[]) => RenderingContext | null).call(this, kind, ...rest); }); };
const openMirror = async () => { const r = renderApp(<RoomPage />); await act(async () => { await new Promise((res) => setTimeout(res, 60)); }); await screen.findByTestId("mirror-controls"); return r; };

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
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); nav.search = new URLSearchParams(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

describe("Espelho › leitura do look (P3-07)", () => {
  beforeEach(() => { withWebgl(); nav.search = new URLSearchParams("espelho=1"); });
  it("o look montado mostra os seis números, com Hype ao lado da compatibilidade e \"—\" para dimensão sem base", async () => {
    loggedAs(undefined, { ...roomRoutes, "GET /api/me/avatar3d": { exists: false },
      "GET /api/me/mirror": mirrorState({ upper: TOP, lower: BOTTOM, shoes: SHOES }, { compatibility: 82, hype: null, novelty: 100, reuse: 35, usage: 0, sustainability: 71 }) });
    const { container } = await openMirror();
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
    const { calls } = loggedAs(undefined, { ...roomRoutes, "GET /api/me/avatar3d": { exists: false },
      "GET /api/me/mirror": mirrorState({}, null),
      "POST /api/me/mirror/vista-me": mirrorState({ upper: TOP, lower: BOTTOM, shoes: SHOES }, { compatibility: 64, hype: 58, novelty: 67, reuse: 10, usage: 40, sustainability: 55 }) });
    const { container } = await openMirror();
    await settle();
    expect(await screen.findByText(/Toque numa ocasião do Vista-me/)).toBeTruthy();
    expect(container.querySelector(".copilot-scores")).toBeNull();
    // sem campo de texto: um toque numa ocasião (com o humor) monta o look
    fireEvent.click(screen.getByRole("button", { name: "Confortável" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Para onde é o look" })).getByRole("button", { name: /Trabalho/ }));
    await waitFor(() => expect(container.querySelector(".copilot-scores")).toBeTruthy());
    const grid = container.querySelector(".copilot-scores") as HTMLElement;
    expect(score(grid, "Hype")).toBe("58");
    expect(score(grid, "Compatibilidade")).toBe("64");
    expect(calls.find((c) => c.method === "POST" && c.path === "/api/me/mirror/vista-me")?.body).toEqual({ prompt: "Trabalho, Confortável", anchorIds: [] });
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
