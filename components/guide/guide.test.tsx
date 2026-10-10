// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/lib/auth/session";
import type { Session } from "@/lib/api/types";
import { GUIDES, shouldAutoOpen } from "@/lib/guides/registry";
import { GuideAuto, HowItWorks } from "@/components/guide/guide";
import { USER, ME, cleanup, fireEvent, loggedAs, mockApi, renderApp, screen, settle, waitFor } from "@/test-utils/render";

/**
 * Orientação "Como funciona": primeira visita, "Não mostrar novamente" por tutorial, reabrir, troca de conta,
 * acessibilidade (foco, Esc, movimento reduzido) e exemplos que nunca chamam a API.
 */
const GUIDE_PATHS = ["/api/me/guides", "/bff/auth/refresh", "/api/me"];
const isGuideOrAuth = (path: string) => GUIDE_PATHS.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));

function Page({ id = "flair.cbc" }: { id?: string }) {
  return <><HowItWorks id={id} /><GuideAuto id={id} /></>;
}

const guidesRoute = (guides: Record<string, unknown> = {}) => ({ "GET /api/me/guides": { guides } });
const putRoute = (seen: { key: string; body: unknown }[]) => (url: URL, init: RequestInit) => {
  const key = decodeURIComponent(url.pathname.split("/").pop() ?? "");
  const body = JSON.parse(String(init.body)) as { version: number; event: string };
  seen.push({ key, body });
  return { version: body.version, hidden: body.event === "HIDDEN", autoCount: body.event === "AUTO_SHOWN" ? 1 : 0, lastShownAt: new Date().toISOString() };
};

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("regra de abertura automática (mesma do servidor)", () => {
  it("abre na primeira visita, não depois de 'Não mostrar', volta uma vez em outro dia e reapresenta na versão nova", () => {
    const now = Date.parse("2026-10-10T12:00:00Z");
    expect(shouldAutoOpen(undefined, 1, now)).toBe(true);
    expect(shouldAutoOpen({ version: 1, hidden: true, autoCount: 1, lastShownAt: "2026-10-01T00:00:00Z" }, 1, now)).toBe(false);
    expect(shouldAutoOpen({ version: 1, hidden: false, autoCount: 1, lastShownAt: "2026-10-10T11:00:00Z" }, 1, now)).toBe(false);
    expect(shouldAutoOpen({ version: 1, hidden: false, autoCount: 1, lastShownAt: "2026-10-08T11:00:00Z" }, 1, now)).toBe(true);
    expect(shouldAutoOpen({ version: 1, hidden: false, autoCount: 2, lastShownAt: "2026-10-01T11:00:00Z" }, 1, now)).toBe(false);
    expect(shouldAutoOpen({ version: 1, hidden: true, autoCount: 2, lastShownAt: "2026-10-10T11:00:00Z" }, 2, now)).toBe(true);
  });
  it("todo tutorial tem no máximo 3 passos e versão positiva", () => {
    for (const g of Object.values(GUIDES)) { expect(g.steps).toBeLessThanOrEqual(3); expect(g.version).toBeGreaterThan(0); }
  });
});

describe("GuideProvider", () => {
  it("primeira visita: abre sozinho, com foco em 'Entendi', e o exemplo não chama a API", async () => {
    const seen: { key: string; body: unknown }[] = [];
    const { calls } = loggedAs(ME, { ...guidesRoute(), "PUT /api/me/guides/flair.cbc": putRoute(seen) });
    renderApp(<Page />);
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Desafio de Montagem");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Entendi" })));
    expect(seen).toEqual([{ key: "flair.cbc", body: { version: 1, event: "AUTO_SHOWN" } }]);
    // palco do exemplo: inerte e fora da árvore de acessibilidade
    const stage = dialog.querySelector(".guide-demo-stage")!;
    expect(stage.hasAttribute("inert")).toBe(true);
    expect(stage.getAttribute("aria-hidden")).toBe("true");
    await settle();
    expect(calls.filter((c) => !isGuideOrAuth(c.path.split("?")[0]))).toEqual([]);
  });

  it("'Entendi' sem marcar fecha e não reabre na mesma visita; 'Como funciona' reabre", async () => {
    const seen: { key: string; body: unknown }[] = [];
    loggedAs(ME, { ...guidesRoute(), "PUT /api/me/guides/flair.cbc": putRoute(seen) });
    const { rerender } = renderApp(<Page />);
    fireEvent.click(await screen.findByRole("button", { name: "Entendi" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(seen.map((s) => (s.body as { event: string }).event)).toEqual(["AUTO_SHOWN", "CLOSED"]);
    rerender(<><Page /><GuideAuto id="flair.cbc" /></>);
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Como funciona" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(seen.at(-1)?.body).toEqual({ version: 1, event: "MANUAL_SHOWN" });
  });

  it("'Não mostrar novamente' vale só para aquele tutorial; Esc fecha sem marcar", async () => {
    const seen: { key: string; body: unknown }[] = [];
    loggedAs(ME, { ...guidesRoute(), "PUT /api/me/guides/flair.cbc": putRoute(seen), "PUT /api/me/guides/moments.calendar": putRoute(seen) });
    renderApp(<Page />);
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("checkbox", { name: "Não mostrar novamente" }));
    fireEvent.click(screen.getByRole("button", { name: "Entendi" }));
    await waitFor(() => expect(seen.at(-1)).toEqual({ key: "flair.cbc", body: { version: 1, event: "HIDDEN" } }));
    // outro tutorial continua abrindo
    renderApp(<GuideAuto id="moments.calendar" />);
    const other = await screen.findByRole("dialog");
    expect(other.textContent).toContain("Momentos: o calendário da moda");
    fireEvent.keyDown(other, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(seen.at(-1)).toEqual({ key: "moments.calendar", body: { version: 1, event: "CLOSED" } });
  });

  it("tutorial escondido não abre sozinho; 'Como funciona' abre com a caixa marcada e desmarcar volta a mostrar", async () => {
    const seen: { key: string; body: unknown }[] = [];
    loggedAs(ME, { ...guidesRoute({ "flair.cbc": { version: 1, hidden: true, autoCount: 1, lastShownAt: "2026-10-01T00:00:00Z" } }), "PUT /api/me/guides/flair.cbc": putRoute(seen) });
    renderApp(<Page />);
    await settle(); await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Como funciona" }));
    const box = await screen.findByRole("checkbox", { name: "Não mostrar novamente" });
    expect((box as HTMLInputElement).checked).toBe(true);
    fireEvent.click(box);
    fireEvent.click(screen.getByRole("button", { name: "Entendi" }));
    await waitFor(() => expect(seen.at(-1)?.body).toEqual({ version: 1, event: "UNHIDDEN" }));
  });

  it("troca de conta não herda a preferência da conta anterior", async () => {
    const other = { ...USER, id: "u2", username: "bia", displayName: "Bia" };
    const seen: { key: string; body: unknown }[] = [];
    let current = "u1";
    loggedAs(ME, {
      "GET /api/me": () => (current === "u1" ? ME : { ...ME, user: other }),
      "GET /api/me/guides": () => ({ guides: current === "u1" ? { "flair.cbc": { version: 1, hidden: true, autoCount: 1 } } : {} }),
      "PUT /api/me/guides/flair.cbc": putRoute(seen),
    });
    function Switch() {
      const { signIn } = useAuth();
      return <button type="button" onClick={() => { current = "u2"; signIn({ accessToken: "t2", user: other } as Session); }}>trocar</button>;
    }
    renderApp(<><Switch /><Page /></>);
    await settle(); await settle();
    expect(screen.queryByRole("dialog")).toBeNull();                 // ana escondeu
    fireEvent.click(screen.getByRole("button", { name: "trocar" }));
    expect((await screen.findByRole("dialog")).textContent).toContain("Desafio de Montagem"); // bia vê pela primeira vez
  });

  it("visitante sem conta guarda a preferência só no navegador e nunca chama a API de tutoriais", async () => {
    const { calls } = mockApi({});
    renderApp(<Page id="explore.search" />);
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("checkbox", { name: "Não mostrar novamente" }));
    fireEvent.click(screen.getByRole("button", { name: "Entendi" }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem("fai.guides.anon") ?? "{}")["explore.search"]?.hidden).toBe(true));
    expect(calls.some((c) => c.path.startsWith("/api/me/guides"))).toBe(false);
  });

  it("com movimento reduzido o exemplo começa parado (quadro final) e o botão oferece reproduzir", async () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
    try {
      loggedAs(ME, { ...guidesRoute(), "PUT /api/me/guides/flair.cbc": putRoute([]) });
      renderApp(<Page />);
      const dialog = await screen.findByRole("dialog");
      expect(dialog.querySelector(".guide-demo-stage")?.getAttribute("data-playing")).toBe("false");
      expect(screen.getByRole("button", { name: "Reproduzir animação" })).toBeTruthy();
    } finally { window.matchMedia = original; }
  });

  it("nunca empilha: com um tutorial aberto, outro pedido automático espera", async () => {
    loggedAs(ME, { ...guidesRoute(), "PUT /api/me/guides/flair.cbc": putRoute([]), "PUT /api/me/guides/feed.posts": putRoute([]) });
    renderApp(<><GuideAuto id="flair.cbc" /><GuideAuto id="feed.posts" /></>);
    await screen.findByRole("dialog");
    await settle();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });
});
