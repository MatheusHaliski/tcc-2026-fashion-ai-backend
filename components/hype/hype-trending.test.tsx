// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor } from "@/test-utils/render";
import { HypeTrendingPanel } from "@/components/hype/hype-trending";
import { __resetHypeStore } from "@/lib/hype/use-hype";

const top = { type: "PIECE", id: "p1", hype: { status: "AVAILABLE", score: 80, level: "TRENDING" } };
const BRANDS = { type: "BRAND", window: 7, algorithmVersion: "HYPE_V2", minItems: 3, items: [
  { rank: 1, key: "nike", name: "Nike", value: 72.4, items: 5, pieces: 5, looks: 0, top },
] };
const CREATORS = { type: "CREATOR", window: 7, algorithmVersion: "HYPE_V2", minItems: 3, items: [
  { rank: 1, key: "u9", ownerId: "u9", user: { id: "u9", username: "bia", displayName: "Bia Lima", profileType: "PESSOAL", verified: false, privateAccount: false }, value: 66, items: 4, pieces: 3, looks: 1, top },
] };

beforeEach(() => __resetHypeStore());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Em alta › marcas e criadores (RF53)", () => {
  it("marcas: lista ranqueada com o valor em texto, a base de itens e o link para as peças da marca", async () => {
    const api = mockApi({ "GET /api/hype/trending": (url: URL) => (url.searchParams.get("type") === "BRAND" ? BRANDS : { type: "PIECE", window: 7, algorithmVersion: "HYPE_V2", items: [] }) });
    renderApp(<HypeTrendingPanel />);
    fireEvent.click(await screen.findByRole("radio", { name: "Marcas" }));
    expect(await screen.findByText("Nike")).toBeTruthy();
    expect(screen.getByText("Hype médio 72")).toBeTruthy();          // leitor de tela: o número com o que ele significa
    expect(screen.getByText("5 peças públicas")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Nike/ }).getAttribute("href")).toBe("/search?tab=PECAS&q=Nike");
    expect(screen.getByText(/pelo menos 3 itens públicos/)).toBeTruthy();
    expect(api.calls.some((c) => c.path.includes("type=BRAND"))).toBe(true);
  });

  it("criadores: avatar, nome e link para o perfil; peças e looks contam", async () => {
    mockApi({ "GET /api/hype/trending": (url: URL) => (url.searchParams.get("type") === "CREATOR" ? CREATORS : { type: "PIECE", window: 7, algorithmVersion: "HYPE_V2", items: [] }) });
    renderApp(<HypeTrendingPanel />);
    fireEvent.click(await screen.findByRole("radio", { name: "Criadores" }));
    await waitFor(() => expect(screen.getByText("Bia Lima")).toBeTruthy());
    expect(screen.getByText("3 peças · 1 look")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Bia Lima/ }).getAttribute("href")).toBe("/u/bia");
  });
});
