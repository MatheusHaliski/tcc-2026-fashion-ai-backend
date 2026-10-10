// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FlairHub } from "@/components/flair/hub";
import { DemoPlayer } from "@/components/flair/demo-player";
import { availability, HUB_MODES, hubMode, LEGACY_TABS, readSelected, writeSelected } from "@/lib/flair/hub";
import { GUIDES } from "@/lib/guides/registry";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, settle, waitFor } from "@/test-utils/render";

/**
 * Central FLAIR: escolher um modo atualiza o painel sem iniciar o jogo, a escolha volta ao retornar, teclado move a
 * seleção, conteúdo indisponível é identificado, a demonstração é uma só por vez (pausa, movimento reduzido, falha),
 * "Jogar" abre a explicação na primeira vez (com "Entendi, começar" e "Não mostrar novamente") e os links antigos
 * (/flair?tab=…) redirecionam.
 */
const push = vi.fn(); const replace = vi.fn();
let search = "";
vi.mock("next/navigation", async (orig) => ({ ...(await orig<typeof import("next/navigation")>()), useRouter: () => ({ push, replace, prefetch: vi.fn(), back: vi.fn() }), useSearchParams: () => new URLSearchParams(search), usePathname: () => "/flair" }));

const ROUTES = {
  "GET /api/flair/me": { coins: 240, rank: { code: "PRATA", label: "Prata", points: 320, next: { label: "Ouro", at: 500 } }, wins: 7, losses: 3, draws: 1, skins: [], activeSkin: null, skinShop: {}, season: "SPRING", team: null, ledger: [], recent: [], ethics: "" },
  "GET /api/flair/decks": [{ schemeId: "s1", title: "Look", cards: [], combos: [], brandMultiplier: 1, seasonBonus: 0, power: 100, avg: {}, abilities: [] }],
  "GET /api/me/flair/cards": { season: "SPRING", counts: { ESPECIAL: 0, OURO: 1, PRATA: 0, BRONZE: 0 }, total: 1, cards: [] },
  "GET /api/flair/challenges": { now: [{ id: "c1" }], upcoming: [], always: [{ id: "c2" }, { id: "c3" }], memories: [], groups: [], season: "SPRING" },
  "GET /api/moments": { now: "2026-10-10T12:00:00Z", active: [], upcoming: [], featured: null },
  "GET /api/me/challenges": { active: [{ id: "ch1" }], invites: [] },
  "GET /api/flair/combinations": [],
  "GET /api/flair/quests": [{ code: "q1", done: true }, { code: "q2", done: false }],
  "GET /api/flair/vouchers": [],
  // a explicação da própria central já foi vista: só os tutoriais dos modos entram em jogo aqui
  "GET /api/me/guides": { guides: { "games.hub": { version: 2, hidden: true, autoCount: 1, lastShownAt: "2026-10-01T00:00:00Z" } } },
  "PUT /api/me/guides/flair.matches": (_u: URL, init: RequestInit) => { const b = JSON.parse(String(init.body)) as { version: number; event: string }; return { version: b.version, hidden: b.event === "HIDDEN", autoCount: 1, lastShownAt: new Date().toISOString() }; },
};

beforeEach(() => { localStorage.clear(); search = ""; push.mockReset(); replace.mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("modelo da central", () => {
  it("todo modo tem rota, tutorial registrado e demonstração com MP4, WebM e capa", () => {
    for (const m of HUB_MODES) {
      expect(m.href.startsWith("/")).toBe(true);
      expect(GUIDES[m.guide], m.guide).toBeTruthy();
      expect(m.demo.mp4).toMatch(/\.mp4$/); expect(m.demo.webm).toMatch(/\.webm$/); expect(m.demo.poster).toMatch(/\.jpg$/);
      expect(m.demo.seconds).toBeGreaterThanOrEqual(10); expect(m.demo.seconds).toBeLessThanOrEqual(20);
    }
    expect(hubMode("cbc").group).toBe("play");
    expect(Object.values(LEGACY_TABS).every((l) => l.href.startsWith("/flair/"))).toBe(true);
  });
  it("disponibilidade: sem decks o modo de partidas vira destravar; desafios abertos contam; sem missões fica indisponível", () => {
    expect(availability("matches", { decks: 0 })).toMatchObject({ available: false, action: "unlock", unlockHref: "/schemes/new" });
    expect(availability("matches", { decks: 2 })).toMatchObject({ available: true, action: "play", status: { key: "flair.hub.status.decks", vars: { n: 2 } } });
    expect(availability("cbc", { cbc: { now: 1, upcoming: 0, always: 2 } })).toMatchObject({ available: true, status: { vars: { n: 3 } } });
    expect(availability("cbc", { cbc: { now: 0, upcoming: 2, always: 0 } })).toMatchObject({ available: false, status: { key: "flair.hub.status.cbc_soon" } });
    expect(availability("quests", { quests: { done: 0, total: 0 } }).available).toBe(false);
    expect(availability("challenges", { challenges: { active: 1, invites: 0 } }).action).toBe("continue");
    expect(availability("wallet", {}).available).toBe(true);
  });
  it("a escolha fica guardada por conta", () => {
    writeSelected("u1", "cbc"); expect(readSelected("u1")).toBe("cbc"); expect(readSelected("u2")).toBeNull();
    localStorage.setItem("fai.flair.hub.selected:u1", "nada"); expect(readSelected("u1")).toBeNull();
  });
});

describe("FlairHub", () => {
  it("escolher um modo atualiza o painel sem navegar; a escolha volta na próxima visita", async () => {
    loggedAs(ME, ROUTES);
    renderApp(<FlairHub />);
    const cbc = await screen.findByRole("tab", { name: /Desafios de Montagem/ });
    expect(screen.getByRole("tab", { name: /Partidas FLAIR/ }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(cbc);
    expect(cbc.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toContain("Complete o mini mapa");
    expect(push).not.toHaveBeenCalled();
    expect(readSelected(ME.user.id)).toBe("cbc");
    cleanup();
    renderApp(<FlairHub />);
    await waitFor(() => expect(screen.getByRole("tab", { name: /Desafios de Montagem/ }).getAttribute("aria-selected")).toBe("true"));
  });

  it("?mode= vence a escolha guardada; links antigos ?tab= redirecionam para a sub-rota", async () => {
    writeSelected(ME.user.id, "wallet");
    search = "mode=moments";
    loggedAs(ME, ROUTES);
    renderApp(<FlairHub />);
    await waitFor(() => expect(screen.getByRole("tab", { name: /^Momentos/ }).getAttribute("aria-selected")).toBe("true"));
    cleanup();
    search = "tab=lojas";
    renderApp(<FlairHub />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/flair/lojas"));
  });

  it("teclado: setas movem e escolhem, Home/End vão às pontas; indisponível aparece com rótulo e botão de destravar", async () => {
    loggedAs(ME, { ...ROUTES, "GET /api/flair/decks": [] });
    renderApp(<FlairHub />);
    const first = await screen.findByRole("tab", { name: /Partidas FLAIR/ });
    await waitFor(() => expect(first.textContent).toContain("Indisponível"));
    expect(screen.getByTestId("hub-primary").textContent).toBe("Destravar");
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(screen.getByRole("tab", { name: /Desafios de Montagem/ }).getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "End" });
    expect(screen.getByRole("tab", { name: /Missões/ }).getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "Home" });
    expect(first.getAttribute("aria-selected")).toBe("true");
    // destravar leva direto ao caminho de criar o esquema, sem tutorial
    fireEvent.click(screen.getByTestId("hub-primary"));
    expect(push).toHaveBeenCalledWith("/schemes/new");
  });

  it("primeira entrada: Jogar abre a explicação com 'Entendi, começar'; Esc não entra; 'Não mostrar novamente' persiste e a segunda vez vai direto", async () => {
    const { calls } = loggedAs(ME, ROUTES);
    renderApp(<FlairHub />);
    await screen.findByRole("tab", { name: /Partidas FLAIR/ });
    await settle();
    fireEvent.click(screen.getByTestId("hub-primary"));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Partidas FLAIR");
    expect(screen.getByRole("button", { name: "Entendi, começar" })).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(push).not.toHaveBeenCalled();
    // reabre pelo "Como funciona" do painel, marca para não mostrar e confirma
    fireEvent.click(screen.getAllByRole("button", { name: "Como funciona" })[1]);
    const box = await screen.findByRole("checkbox", { name: "Não mostrar novamente" });
    fireEvent.click(box);
    fireEvent.click(screen.getByRole("button", { name: "Entendi" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT" && c.path === "/api/me/guides/flair.matches" && (c.body as { event: string }).event === "HIDDEN")).toBe(true));
    fireEvent.click(screen.getByTestId("hub-primary"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/flair/partidas"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("só a demonstração do modo escolhido está montada e trocar de modo troca o vídeo", async () => {
    loggedAs(ME, ROUTES);
    const { container } = renderApp(<FlairHub />);
    await screen.findByRole("tab", { name: /Partidas FLAIR/ });
    expect(container.querySelectorAll("video").length).toBe(1);
    expect(container.querySelector("video source")?.getAttribute("src")).toContain("/flair/demos/matches.webm");
    fireEvent.click(screen.getByRole("tab", { name: /^Momentos/ }));
    expect(container.querySelectorAll("video").length).toBe(1);
    expect(container.querySelector("video source")?.getAttribute("src")).toContain("/flair/demos/moments.webm");
  });
});

describe("DemoPlayer", () => {
  const demo = { mp4: "/flair/demos/x.mp4", webm: "/flair/demos/x.webm", poster: "/flair/demos/x.jpg", seconds: 12, recorded: true };
  it("pausa e retoma; capa enquanto carrega; vídeo sem áudio e em loop", async () => {
    loggedAs(ME, {});
    const play = vi.fn(() => Promise.resolve()); const pause = vi.fn();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) { this.dispatchEvent(new Event("play")); return play(); });
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) { pause(); this.dispatchEvent(new Event("pause")); });
    vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(() => pause.mock.calls.length > play.mock.calls.length - 1 && pause.mock.calls.length > 0);
    const { container } = renderApp(<DemoPlayer demo={demo} title="Demo" description="desc" />);
    const video = container.querySelector("video")!;
    expect(video.muted).toBe(true); expect(video.loop).toBe(true); expect(video.getAttribute("poster")).toBe(demo.poster);
    expect(container.querySelector(".flair-demo-poster")).toBeTruthy();
    await waitFor(() => expect(play).toHaveBeenCalled());
    const toggle = screen.getByRole("button", { name: "Pausar" });
    fireEvent.click(toggle);
    await waitFor(() => expect(screen.getByRole("button", { name: "Reproduzir" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Reproduzir" }));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
  });
  it("movimento reduzido: abre parado na capa, sem tocar sozinho", async () => {
    loggedAs(ME, {});
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), addEventListener: () => undefined, removeEventListener: () => undefined }));
    const { container } = renderApp(<DemoPlayer demo={demo} title="Demo" description="desc" />);
    await settle();
    expect(play).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Reproduzir" })).toBeTruthy();
    expect(container.querySelector("video")?.getAttribute("preload")).toBe("none");
  });
  it("falha de reprodução: fica a capa estática com aviso e sem botão de pausa", async () => {
    loggedAs(ME, {});
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
    const { container } = renderApp(<DemoPlayer demo={demo} title="Demo" description="desc" />);
    fireEvent(container.querySelector("video")!, new Event("error"));
    await waitFor(() => expect(container.querySelector("video")).toBeNull());
    expect(container.querySelector(".flair-demo-poster")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Demonstração indisponível");
    expect(screen.queryByRole("button", { name: "Pausar" })).toBeNull();
  });
});
