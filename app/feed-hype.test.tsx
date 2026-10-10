// @vitest-environment jsdom
/**
 * Feed (RF8) no HypeScore v2 — RF53 · Lote 1: o chip "Em alta" é FILTRO de faixa mínima (`hypeLevel=HOT`, só Hype
 * público), não aba; e a aba Passarela (quem eu sigo) mostra os looks — o /api/runway devolve `{ reason, scheme }` e a
 * tela passava a entrada inteira para o card.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, settle, waitFor } from "@/test-utils/render";
import { OWNER, SCHEME } from "@/test-utils/fixtures";
import { __resetHypeStore } from "@/lib/hype/use-hype";
import type { SchemeView } from "@/lib/api/types";
import FeedPage from "@/app/(site)/(app)/feed/page";

const HYPE = { "GET /api/hype/summaries": { type: "SCHEME", algorithmVersion: "HYPE_V2", deltaWindowDays: 7, items: {} } };
const HOT_LOOK: SchemeView = { ...SCHEME, id: "s2", title: "Look em alta" };
const feedCalls = (calls: { method: string; path: string }[]) => calls.filter((c) => c.method === "GET" && c.path.startsWith("/api/feed"));

beforeEach(() => __resetHypeStore());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "fai_rt_h=; max-age=0; path=/"; });

describe("Feed › chip Em alta (P2-01)", () => {
  it("liga e desliga hypeLevel=HOT e não duplica o chip que o backend devolve", async () => {
    const api = loggedAs(undefined, {
      ...HYPE,
      "GET /api/feed": (url: URL) => (url.searchParams.get("hypeLevel") === "HOT"
        ? { items: [HOT_LOOK], nextCursor: null, chips: [{ key: "hypeLevel", value: "HOT" }] }
        : { items: [SCHEME, HOT_LOOK], nextCursor: null, chips: [] }),
    });
    renderApp(<FeedPage />);
    await settle();
    expect(await screen.findByText("Look de sexta")).toBeTruthy();
    const chip = screen.getByRole("button", { name: "🔥 Em alta" });
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    expect(chip.getAttribute("title")).toMatch(/HypeScore público/);
    expect(feedCalls(api.calls)[0].path).not.toContain("hypeLevel");

    fireEvent.click(chip);
    await waitFor(() => expect(feedCalls(api.calls).some((c) => c.path.includes("hypeLevel=HOT"))).toBe(true));
    await waitFor(() => expect(screen.queryByText("Look de sexta")).toBeNull());
    expect(screen.getByText("Look em alta")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Em alta/ })).toHaveLength(1);   // o chip do backend (hypeLevel) não vira outro botão
    expect(screen.getByRole("button", { name: "🔥 Em alta" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "🔥 Em alta" }));
    expect(await screen.findByText("Look de sexta")).toBeTruthy();
  });

  it("sem look em alta, o vazio explica o filtro e oferece tirar", async () => {
    loggedAs(undefined, { ...HYPE, "GET /api/feed": (url: URL) => (url.searchParams.get("hypeLevel") ? { items: [], nextCursor: null, chips: [] } : { items: [SCHEME], nextCursor: null, chips: [] }) });
    renderApp(<FeedPage />);
    await settle();
    fireEvent.click(await screen.findByRole("button", { name: "🔥 Em alta" }));
    expect(await screen.findByText("Nenhum look em alta agora")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver todos os looks" }));
    expect(await screen.findByText("Look de sexta")).toBeTruthy();
  });
});

describe("Feed › Passarela (quem eu sigo)", () => {
  it("mostra o look de cada entrada { reason, scheme } e não oferece o filtro de Hype (ordem cronológica)", async () => {
    const shared: SchemeView = { ...SCHEME, id: "s3", title: "Look compartilhado" };
    loggedAs(undefined, {
      ...HYPE,
      "GET /api/feed": { items: [], nextCursor: null, chips: [] },
      "GET /api/runway": { items: [
        { reason: "SEGUINDO", scheme: SCHEME, at: "2026-10-04T10:00:00Z" },
        { reason: "COMPARTILHADO", by: OWNER, caption: "olha", scheme: shared, at: "2026-10-04T09:00:00Z" },
      ], nextCursor: null, fallbackToCommunity: false, battles: [] },
    });
    renderApp(<FeedPage />);
    await settle();
    fireEvent.click(await screen.findByRole("tab", { name: "Passarela" }));
    expect(await screen.findByText("Look de sexta")).toBeTruthy();
    expect(screen.getByText("Look compartilhado")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "🔥 Em alta" })).toBeNull();
  });
});
