// @vitest-environment jsdom
/**
 * Lookbook › Peças com Hype (docs/hype/HYPE_AUDITORIA_ABAS.md, P2-11 · Lote A4): ordenar (Recentes · Maior Hype · Em
 * crescimento) e filtrar por faixa mínima de Hype em GET /api/users/{id}/closet; o dono ordena pelo Hype pessoal e quem
 * visita só pelo público (o aviso diz isso). Os selos de marca/celebridade chegam num pedido por página
 * (GET /api/pieces/seals) e dividem o SealSlot com os Selos de Hype exatamente como no /closet.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, settle, waitFor } from "@/test-utils/render";
import { nav } from "@/test-utils/setup";
import { OWNER, PIECE, PIECE_2, page } from "@/test-utils/fixtures";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import { tokenStore } from "@/lib/api/client";
import type { HypeSummary } from "@/lib/hype/types";
import type { UserCard } from "@/lib/api/types";
import { LookbookTabs } from "@/components/lookbook-tabs";
import ClosetPage from "@/app/(site)/(app)/closet/page";

const BIA: UserCard = { ...OWNER, id: "u2", username: "bia", displayName: "Bia Lima" };
const overview = (self: boolean) => ({ owner: self ? OWNER : BIA, self, visible: true, institutional: false,
  tabs: [{ id: "closet", count: 2 }, { id: "looks", count: 0 }, { id: "publications", count: 0 }, { id: "favorites", count: 0 }] });
const VIRAL: HypeSummary = { status: "AVAILABLE", score: 92, level: "VIRAL", direction: "UP", deltaPercent: 20, momentum: "RISING", calculatedAt: new Date().toISOString(), algorithmVersion: "HYPE_V2", seals: ["VIRAL", "RARE"] };
const summaries = (items: Record<string, HypeSummary>) => ({ type: "PIECE", algorithmVersion: "HYPE_V2", deltaWindowDays: 7, items });
const badge = (name: string, owner: string) => ({ tier: "PECA", owner, premium: false, name, design: { kind: "FASHIONAI", mode: "TEMPLATE", template: "fai/01" }, linkedPieceIds: ["p1"] });
/** p1: três selos de marca + Selos de Hype (Viral, Raro) — o slot lota e o Hype garante uma vaga; p2: sem selo de marca. */
const SEALS = { items: { p1: [badge("Nike Verde", "nike"), badge("Adidas Azul", "adidas"), badge("Puma Roxo", "puma")] } };
const closetCalls = (calls: { method: string; path: string }[], owner: string) => calls.filter((c) => c.method === "GET" && c.path.startsWith(`/api/users/${owner}/closet`));
/** Títulos dos medalhões no SealSlot da frente do card da peça (mesmo lugar no /closet e no Lookbook). */
const slotOf = (root: ParentNode, name: string) => {
  const card = Array.from(root.querySelectorAll<HTMLElement>(".fcard-face.is-front")).find((f) => f.textContent?.includes(name));
  return Array.from(card?.querySelectorAll<HTMLElement>(".pc-sub .seal-slot [title]") ?? []).map((m) => m.title);
};

beforeEach(() => { __resetHypeStore(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); nav.search = new URLSearchParams(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

describe("Lookbook › Peças — ordenar e filtrar por Hype", () => {
  it("quem visita: Recentes · Maior Hype · Em crescimento e faixa mínima com o nome da faixa; só o Hype público conta", async () => {
    const api = loggedAs(undefined, { "GET /api/users/u2/lookbook": overview(false), "GET /api/users/u2/closet": page([PIECE, PIECE_2]),
      "GET /api/pieces/seals": { items: {} }, "GET /api/hype/summaries": summaries({}) });
    renderApp(<LookbookTabs ownerId="u2" initialTab="closet" />);
    await settle();
    expect(await screen.findByText("Camiseta branca lisa")).toBeTruthy();
    // "Recentes" é a rota de sempre: sem ?sort= nem ?hypeLevel=
    expect(closetCalls(api.calls, "u2")[0].path).toBe("/api/users/u2/closet?page=0&size=24");
    expect(screen.queryByText(/Só o Hype público/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Ordenar peças: Recentes" }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Recentes", "Maior Hype", "Em crescimento"]);
    fireEvent.click(screen.getByRole("option", { name: "Em crescimento" }));
    await waitFor(() => expect(closetCalls(api.calls, "u2").some((c) => c.path === "/api/users/u2/closet?page=0&size=24&sort=growth")).toBe(true));
    expect(screen.getByText("Só o Hype público entra na ordem e no filtro; peças sem Hype ficam no fim.")).toBeTruthy();

    // faixa mínima: "Todos" + Nicho…Viral, sempre com o nome da faixa ("Sinal baixo" não filtra nada, fica fora)
    fireEvent.click(await screen.findByRole("button", { name: "Faixa de Hype: Todos" }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Todos", "Nicho ou mais", "Relevante ou mais", "Em alta ou mais", "Tendência ou mais", "Viral ou mais"]);
    fireEvent.click(screen.getByRole("option", { name: "Em alta ou mais" }));
    await waitFor(() => expect(closetCalls(api.calls, "u2").some((c) => c.path === "/api/users/u2/closet?page=0&size=24&sort=growth&hypeLevel=HOT")).toBe(true));
    expect(screen.getByRole("button", { name: "Faixa de Hype: Em alta ou mais" })).toBeTruthy();
  });

  it("o dono ordena pelo Hype pessoal; faixa sem peças mostra o vazio próprio", async () => {
    let n = 0;
    const api = loggedAs(undefined, { "GET /api/users/u1/lookbook": overview(true), "GET /api/users/u1/closet": () => (n++ === 0 ? page([PIECE]) : page([])),
      "GET /api/pieces/seals": { items: {} }, "GET /api/hype/summaries": summaries({}) });
    renderApp(<LookbookTabs ownerId="u1" initialTab="closet" />);
    await settle();
    expect(await screen.findByText("Camiseta branca lisa")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Faixa de Hype: Todos" }));
    fireEvent.click(screen.getByRole("option", { name: "Viral ou mais" }));
    expect(await screen.findByText("Nenhuma peça nesta faixa de Hype.")).toBeTruthy();
    expect(screen.getByText("Pelo seu Hype pessoal; peças sem Hype ficam no fim.")).toBeTruthy();
    expect(closetCalls(api.calls, "u1").at(-1)?.path).toBe("/api/users/u1/closet?page=0&size=24&hypeLevel=VIRAL");
    // filtrado por Hype: sem o atalho "Adicionar peça" do vazio inicial
    expect(screen.queryByRole("link", { name: /Adicionar peça/ })).toBeNull();
  });
});

describe("Lookbook › Peças — selos de marca e Selos de Hype juntos, como no /closet", () => {
  it("um pedido de selos por página (anônimo para quem não entrou) e o mesmo SealSlot do guarda-roupa", async () => {
    // visitante sem conta (sem sessão guardada de outro teste): o closet e os selos saem sem token
    tokenStore.clear(); try { localStorage.clear(); } catch { /* jsdom */ }
    const anon = mockApi({ "GET /api/users/u2/lookbook": overview(false), "GET /api/users/u2/closet": page([PIECE, PIECE_2]), "GET /api/pieces/seals": SEALS,
      "GET /api/hype/summaries": summaries({ p1: VIRAL, p2: { ...VIRAL, seals: ["TRENDING"] } }) });
    const { container: lookbook } = renderApp(<LookbookTabs ownerId="u2" initialTab="closet" />);
    expect(await screen.findByTitle("Nike Verde · @nike · PECA")).toBeTruthy();
    await screen.findAllByTitle("Selo de Hype: Viral");
    const sealCalls = anon.calls.filter((c) => c.path.startsWith("/api/pieces/seals"));
    expect(sealCalls).toHaveLength(1);
    expect(sealCalls[0].path).toBe("/api/pieces/seals?ids=p1,p2");
    const authOf = (path: string) => new Headers((anon.fetchMock.mock.calls.find(([u]) => String(u).includes(path))?.[1] as RequestInit | undefined)?.headers).get("authorization");
    expect(authOf("/api/users/u2/closet")).toBeNull();
    expect(authOf("/api/pieces/seals")).toBeNull();
    // slot lotado: 2 de marca + 1 de Hype (o Hype garante a vaga); p2 sem marca: os Selos de Hype sozinhos
    const lookbookP1 = slotOf(lookbook, "Camiseta branca lisa");
    const lookbookP2 = slotOf(lookbook, "Calça jeans reta");
    expect(lookbookP1).toEqual(["Nike Verde · @nike · PECA", "Adidas Azul · @adidas · PECA", "Selo de Hype: Viral"]);
    expect(lookbookP2).toEqual(["Selo de Hype: Tendência"]);
    cleanup(); __resetHypeStore(); vi.unstubAllGlobals();

    // o mesmo par de peças no /closet do dono: medalhões idênticos, na mesma ordem
    loggedAs(undefined, { "GET /api/me/closet": page([PIECE, PIECE_2]), "GET /api/pieces/seals": SEALS,
      "GET /api/hype/summaries": summaries({ p1: VIRAL, p2: { ...VIRAL, seals: ["TRENDING"] } }) });
    const { container: closet } = renderApp(<ClosetPage />);
    await settle();
    expect(await screen.findByTitle("Nike Verde · @nike · PECA")).toBeTruthy();
    await screen.findAllByTitle("Selo de Hype: Viral");
    expect(slotOf(closet, "Camiseta branca lisa")).toEqual(lookbookP1);
    expect(slotOf(closet, "Calça jeans reta")).toEqual(lookbookP2);
  });
});
