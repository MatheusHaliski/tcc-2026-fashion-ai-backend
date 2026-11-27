// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, ME, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { tokenStore } from "@/lib/api/client";
import { internalHref, unlocksRequested, type AuraUnlocks } from "@/lib/aura/unlocks";
import { AuraUnlocksPanel } from "./aura-unlocks-panel";

const PATH = "/api/hype/PIECE/p1/unlocks";
const HOT: AuraUnlocks = {
  entityType: "PIECE", entityId: "p1", status: "AVAILABLE", score: 64, level: "HOT", publicEligible: true, stale: false, counts: true,
  unlocked: [
    { kind: "FLAIR_BAND", family: "HYPE", title: "Joga como Em alta no FLAIR", detail: "É a faixa da carta nas partidas.", href: "/flair/3d", requiredLevel: null, met: true },
    { kind: "COUPON", family: "HYPE", title: "20% na coleção nova", detail: "Cupom de Nike", href: "/coupons", requiredLevel: "HOT", met: true },
    { kind: "MILESTONE_POINTS", family: "HYPE", title: "+20 FAI Points", detail: "Creditados uma vez.", href: "/points", requiredLevel: "HOT", met: true },
  ],
  next: [
    { kind: "SEAL_CAMPAIGN", family: "HYPE", title: "Selo Pico", detail: "Ainda não atende.", href: "/brands/pico", requiredLevel: "TRENDING", met: false },
    { kind: "AURA_REWARD", family: "METAMORPHOSE", title: "Prisma âmbar", detail: "Arte exclusiva.", href: "https://fora.example/x", requiredLevel: "VIRAL", met: false },
  ],
  nextLevel: { level: "TRENDING", missingPoints: 11 },
};

beforeEach(() => { tokenStore.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; tokenStore.clear(); });

describe("painel O que este card destrava", () => {
  it("mostra a faixa, quanto falta, o que já está destravado e o que vem a seguir", async () => {
    loggedAs(ME, { [`GET ${PATH}`]: HOT });
    const seals = vi.fn();
    renderApp(<AuraUnlocksPanel type="PIECE" id="p1" enabled onSeeSeals={seals} />);
    expect(await screen.findByText("Faltam 11 pts para Tendência")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "O que este card destrava" })).toBeTruthy();
    const unlocked = screen.getByRole("heading", { name: "Já destravado" }).parentElement!;
    expect(unlocked.querySelectorAll("li")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Jogar" }).getAttribute("href")).toBe("/flair/3d");
    expect(screen.getByRole("link", { name: "Ver cupons" }).getAttribute("href")).toBe("/coupons");
    expect(screen.getByRole("link", { name: "Ver pontos" }).getAttribute("href")).toBe("/points");
    const next = screen.getByRole("heading", { name: "A seguir" }).parentElement!;
    expect(next.querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByText("A partir de Tendência")).toBeTruthy();
    // arte de Aura: mostra a família; link externo vindo da API não vira link
    expect(screen.getByText("Metamorfose")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Ver arte" })).toBeNull();
    // a campanha de selo leva para a seção de selos da própria análise
    fireEvent.click(screen.getByRole("button", { name: "Ver campanha" }));
    expect(seals).toHaveBeenCalledTimes(1);
  });

  it("erro tem nova tentativa", async () => {
    let fail = true;
    const api = mockApi({ [`GET ${PATH}`]: () => (fail ? new Response(JSON.stringify({ status: 500, code: "ERRO", message: "x" }), { status: 500, headers: { "content-type": "application/json" } }) : HOT) });
    renderApp(<AuraUnlocksPanel type="PIECE" id="p1" enabled />);
    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível carregar");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Já destravado")).toBeTruthy();
    expect(api.calls.filter((c) => c.path === PATH).length).toBeGreaterThanOrEqual(2);
  });

  it("Hype sem nota não aparece como zero e lista vazia tem texto próprio", async () => {
    mockApi({ [`GET ${PATH}`]: { ...HOT, status: "INSUFFICIENT_DATA", score: null, level: null, counts: false, unlocked: [], next: [], nextLevel: null } });
    renderApp(<AuraUnlocksPanel type="PIECE" id="p1" enabled />);
    expect(await screen.findByText(/Ainda não há sinais suficientes/)).toBeTruthy();
    expect(screen.getByText("Nada para destravar por enquanto.")).toBeTruthy();
    expect(screen.queryByText(/pts para/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/\b0 pts\b/);
  });

  it("card privado avisa que é Hype pessoal", async () => {
    loggedAs(ME, { [`GET ${PATH}`]: { ...HOT, publicEligible: false, counts: false } });
    renderApp(<AuraUnlocksPanel type="PIECE" id="p1" enabled />);
    expect(await screen.findByText(/Hype pessoal: card privado/)).toBeTruthy();
  });

  it("não busca nada enquanto a análise está fechada", async () => {
    const api = mockApi({ [`GET ${PATH}`]: HOT });
    renderApp(<AuraUnlocksPanel type="PIECE" id="p1" enabled={false} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "O que este card destrava" })).toBeTruthy());
    expect(api.calls.some((c) => c.path === PATH)).toBe(false);
  });
});

describe("link direto do aviso de marco", () => {
  it("abre só o card pedido e só aceita caminho interno", () => {
    expect(unlocksRequested("p1", "?destrava=p1")).toBe(true);
    expect(unlocksRequested("p2", "?destrava=p1")).toBe(false);
    expect(unlocksRequested("p1", "")).toBe(false);
    expect(internalHref("/coupons")).toBe("/coupons");
    expect(internalHref("//fora.example")).toBeNull();
    expect(internalHref("javascript:alert(1)")).toBeNull();
  });
});
