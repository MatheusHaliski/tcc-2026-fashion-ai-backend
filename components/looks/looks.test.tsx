// @vitest-environment jsdom
/**
 * Domínio Looks (/looks) e Lookbook social (docs/hype/01-AUDITORIA_E_PROPOSTA_IA.md §3.1/§3.3): a gestão dos looks
 * (origem, estado, ocasião, salvos) mora em /looks; o Lookbook mostra a vitrine — Looks publicados, Publicações
 * (looks + peças em ordem cronológica) e Favoritos — igual para o dono e para quem visita.
 */
import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, settle, waitFor } from "@/test-utils/render";
import { nav, router } from "@/test-utils/setup";
import { OWNER, PIECE, SCHEME, page } from "@/test-utils/fixtures";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import type { PieceView, SchemeView, UserCard } from "@/lib/api/types";
import LooksPage from "@/app/(site)/(app)/looks/page";
import ProfilePage from "@/app/(site)/(app)/u/[username]/page";
import { LookbookTabs } from "@/components/lookbook-tabs";

const HYPE = { "GET /api/hype/summaries": { type: "PIECE", algorithmVersion: "HYPE_V2", deltaWindowDays: 7, items: {} } };
const schemeCalls = (calls: { method: string; path: string }[]) => calls.filter((c) => c.method === "GET" && c.path.startsWith("/api/me/schemes"));

/** Dona do perfil visitado (a sessão é a Ana, u1). */
const BIA: UserCard = { ...OWNER, id: "u2", username: "bia", displayName: "Bia Lima" };
const JACKET: PieceView = { ...PIECE, id: "p9", name: "Jaqueta de couro", owner: BIA };
const SAVED: SchemeView = { ...SCHEME, id: "s9", title: "Look salvo da Bia", owner: BIA };
const overview = (self: boolean, owner = self ? OWNER : BIA) => ({ owner, self, visible: true, institutional: false,
  tabs: [{ id: "closet", count: 2 }, { id: "looks", count: 1 }, { id: "publications", count: 2 }, { id: "favorites", count: 2 }, { id: "saved_looks", count: 0 }, { id: "saved_pieces", count: 0 }] });

beforeEach(() => { __resetHypeStore(); router.replace.mockClear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); nav.search = new URLSearchParams(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

describe("Meus looks (/looks) — gestão dos looks", () => {
  it("a origem é SegmentPicker e envia kind=ia/manual/remix, guardando a origem na URL", async () => {
    const api = loggedAs(undefined, { ...HYPE, "GET /api/me/schemes": page([SCHEME]) });
    renderApp(<LooksPage />);
    await settle();
    expect(await screen.findByText("Look de sexta")).toBeTruthy();
    expect(schemeCalls(api.calls)[0].path).not.toContain("kind=");
    expect(screen.getByRole("tab", { name: "Meus looks" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("link", { name: /Criar look/ }).getAttribute("href")).toBe("/schemes/new");

    for (const [name, kind] of [["Criados por IA", "ia"], ["Criados manualmente", "manual"], ["Remixes", "remix"]] as const) {
      fireEvent.click(screen.getByRole("radio", { name }));
      await waitFor(() => expect(schemeCalls(api.calls).some((c) => c.path.includes(`kind=${kind}`))).toBe(true));
      expect(screen.getByRole("radio", { name }).getAttribute("aria-checked")).toBe("true");
      expect(router.replace).toHaveBeenLastCalledWith(`/looks?kind=${kind}`, { scroll: false });
    }
  });

  it("abre na origem da URL e o estado \"Publicados\" envia state=publicados (arquivados e rascunhos também existem)", async () => {
    nav.search = new URLSearchParams("kind=remix");
    const api = loggedAs(undefined, { ...HYPE, "GET /api/me/schemes": page([SCHEME]) });
    renderApp(<LooksPage />);
    await settle();
    await waitFor(() => expect(schemeCalls(api.calls)[0]?.path).toContain("kind=remix"));
    expect((await screen.findByRole("radio", { name: "Remixes" })).getAttribute("aria-checked")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Estado: Todos" }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Todos", "Publicados", "Rascunhos", "Favoritos", "Arquivados"]);
    fireEvent.click(screen.getByRole("option", { name: "Publicados" }));
    await waitFor(() => expect(schemeCalls(api.calls).some((c) => c.path.includes("state=publicados") && c.path.includes("kind=remix"))).toBe(true));
    // a ocasião continua aqui (era filtro da antiga aba Looks do Lookbook)
    expect(screen.getByRole("button", { name: "Ocasião: Todos" })).toBeTruthy();
  });

  it("a aba Salvos lista os looks salvos de outras pessoas", async () => {
    const api = loggedAs(undefined, { ...HYPE, "GET /api/me/schemes": page([]), "GET /api/me/saved-looks": page([{ scheme: SAVED, origin: "SALVO", originLabel: "Salvo de @bia" }]) });
    renderApp(<LooksPage />);
    await settle();
    expect(await screen.findByText("Você ainda não tem looks.")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Salvos" }));
    expect(await screen.findByText("Look salvo da Bia")).toBeTruthy();
    expect(screen.getByText("Salvo de @bia")).toBeTruthy();
    expect(api.calls.some((c) => c.path.startsWith("/api/me/saved-looks"))).toBe(true);
    expect(router.replace).toHaveBeenLastCalledWith("/looks?tab=saved", { scroll: false });
  });
});

describe("Lookbook — vitrine social", () => {
  it("Publicações mistura look e peça, na ordem do endpoint", async () => {
    const api = loggedAs(undefined, { ...HYPE, "GET /api/users/u2/lookbook": overview(false),
      "GET /api/users/u2/publications": page([{ type: "LOOK", at: "2026-10-02T10:00:00Z", scheme: { ...SCHEME, owner: BIA } }, { type: "PIECE", at: "2026-10-01T10:00:00Z", piece: JACKET }]) });
    const { container } = renderApp(<LookbookTabs ownerId="u2" initialTab="publications" />);
    await settle();
    expect(await screen.findByText("Look de sexta")).toBeTruthy();
    expect(screen.getByText("Jaqueta de couro")).toBeTruthy();
    // a grade vem na ordem cronológica do backend: o look (mais recente) antes da peça
    const text = container.textContent ?? "";
    expect(text.indexOf("Look de sexta")).toBeLessThan(text.indexOf("Jaqueta de couro"));
    expect(api.calls.some((c) => c.path === "/api/users/u2/publications?page=0&size=24")).toBe(true);
    // a ordem das abas: Peças · Looks · Publicações · Favoritos · … (visitante não vê Salvos nem Insights)
    expect(screen.getAllByRole("tab").map((t) => t.firstChild?.textContent)).toEqual(["Peças", "Looks", "Publicações", "Favoritos", "Agrupamentos"]);
    expect(screen.getByRole("tab", { name: /Publicações/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("Favoritos mostra os looks e, no seletor, as peças favoritas", async () => {
    loggedAs(undefined, { ...HYPE, "GET /api/users/u2/lookbook": overview(false), "GET /api/users/u2/favorites": { looks: [{ ...SCHEME, owner: BIA }], pieces: [JACKET] } });
    renderApp(<LookbookTabs ownerId="u2" initialTab="favorites" />);
    await settle();
    expect(await screen.findByText("Look de sexta")).toBeTruthy();
    expect(screen.queryByText("Jaqueta de couro")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /Peças/ }));
    expect(await screen.findByText("Jaqueta de couro")).toBeTruthy();
  });

  it("na aba Looks o dono vê a vitrine (publicados) e o atalho \"Gerenciar meus looks\" para /looks", async () => {
    const api = loggedAs(undefined, { ...HYPE, "GET /api/users/u1/lookbook": overview(true), "GET /api/profiles/u1": { schemes: [SCHEME] } });
    renderApp(<LookbookTabs ownerId="u1" initialTab="looks" />);
    await settle();
    expect(await screen.findByText("Look de sexta")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Gerenciar meus looks/ }).getAttribute("href")).toBe("/looks");
    // a gestão saiu do Lookbook: nenhum filtro e nenhuma chamada a /api/me/schemes
    expect(screen.queryByRole("button", { name: /Estado:/ })).toBeNull();
    expect(schemeCalls(api.calls)).toEqual([]);
    expect(screen.getAllByRole("tab").map((t) => t.firstChild?.textContent)).toEqual(["Peças", "Looks", "Publicações", "Favoritos", "Salvos", "DNA de estilo", "Look do Dia", "Cápsula", "Agrupamentos", "Insights"]);
  });

  it("quem visita vê os mesmos looks publicados, sem o atalho de gestão", async () => {
    loggedAs(undefined, { ...HYPE, "GET /api/users/u2/lookbook": overview(false), "GET /api/profiles/u2": { schemes: [{ ...SCHEME, owner: BIA }] } });
    renderApp(<LookbookTabs ownerId="u2" initialTab="looks" />);
    await settle();
    expect(await screen.findByText("Look de sexta")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Gerenciar meus looks/ })).toBeNull();
  });

  it("o perfil aceita ?tab=publicacoes e ?tab=favoritos (aliases em português)", async () => {
    const profile = { user: BIA, layout: "PESSOAL", self: false, relation: "NENHUMA", counters: { followers: 0, following: 0, published: 1 }, visibility: "PUBLIC", contentVisible: true };
    const routes = { ...HYPE, "GET /api/profiles/bia": profile, "GET /api/users/u2/lookbook": overview(false), "GET /api/users/u2/publications": page([]), "GET /api/users/u2/favorites": { looks: [], pieces: [] } };
    const params = Object.assign(Promise.resolve({ username: "bia" }), { status: "fulfilled", value: { username: "bia" } });
    for (const [alias, path] of [["publicacoes", "/api/users/u2/publications"], ["favoritos", "/api/users/u2/favorites"]] as const) {
      nav.search = new URLSearchParams(`tab=${alias}`);
      const api = loggedAs(undefined, routes);
      renderApp(<Suspense fallback={null}><ProfilePage params={params} /></Suspense>);
      await waitFor(() => expect(api.calls.some((c) => c.path.startsWith(path))).toBe(true), { timeout: 3000 });
      cleanup();
    }
  });
});
