// @vitest-environment jsdom
/**
 * Extrato dos FAI Points na central de notificações (sino da topbar): cada lançamento chega como notificação da
 * categoria POINTS; os do mesmo dia viram um item só com o total do dia, e o link da página FAI Points abre o filtro.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen } from "@/test-utils/render";
import NotificationsPage from "@/app/(site)/(app)/notifications/page";
import PointsPage from "@/app/(site)/(app)/points/page";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, "", "/"); });

const at = (h: number) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d.toISOString(); };
const points = (id: string, delta: number, title: string, body: string, h: number) =>
  ({ id, type: "FAI_POINTS", category: "POINTS", title, body, payload: { delta, action: "X", href: "/points" }, read: false, createdAt: at(h) });
const INBOX = { unread: 4, items: [
  points("p3", -180, "−180 FAI Points", "Compra na loja do quarto: Porta 60", 12),
  { id: "c1", type: "NEW_COMMENT", category: "SOCIAL", title: "Novo comentário", body: "@bia comentou no seu look", read: false, createdAt: at(11) },
  points("p2", 1, "+1 FAI Points", "Curtida recebida num look seu", 10),
  points("p1", 40, "+40 FAI Points", "Esquema criado", 9),
] };

describe("extrato dos FAI Points nas notificações", () => {
  it("lançamentos do dia viram um item só com o total, e o resto continua na caixa", async () => {
    loggedAs(undefined, { "GET /api/notifications": INBOX });
    renderApp(<NotificationsPage />);
    expect(await screen.findByText("3 lançamentos de FAI Points · −139 no dia")).toBeTruthy();
    expect(screen.getByText("Novo comentário")).toBeTruthy();
    expect(screen.getByText("Compra na loja do quarto: Porta 60")).toBeTruthy();   // dentro do item agrupado
    expect(screen.getByText("Esquema criado")).toBeTruthy();
  });

  it("?cat=POINTS abre só o extrato", async () => {
    window.history.replaceState(null, "", "/notifications?cat=POINTS");
    loggedAs(undefined, { "GET /api/notifications": INBOX });
    renderApp(<NotificationsPage />);
    expect(await screen.findByText("3 lançamentos de FAI Points · −139 no dia")).toBeTruthy();
    expect(screen.queryByText("Novo comentário")).toBeNull();
    expect(screen.getByRole("button", { name: "FAI Points" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Todos" }));
    expect(screen.getByText("Novo comentário")).toBeTruthy();
  });

  it("a página FAI Points leva ao extrato nas notificações", async () => {
    loggedAs(undefined, { "GET /api/me/points": { balance: 120, lifetime: 300, level: "ESTREIA", levels: [], rules: [] }, "GET /api/points/shop": [] });
    renderApp(<PointsPage />);
    const link = await screen.findByRole("link", { name: "Ver extrato nas notificações" });
    expect(link.getAttribute("href")).toBe("/notifications?cat=POINTS");
  });
});
