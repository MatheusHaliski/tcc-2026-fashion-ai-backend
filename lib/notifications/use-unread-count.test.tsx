// @vitest-environment jsdom
/**
 * Regressão da auditoria: depois de "Marcar todas como lidas" o sino do topo continuava com o número antigo até
 * recarregar a página.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { notifyNotificationsChanged, useUnreadCount } from "./use-unread-count";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function Bell({ enabled = true }: { enabled?: boolean }) {
  return <output data-testid="bell">{useUnreadCount(enabled, "/notifications")}</output>;
}

describe("sino de notificações", () => {
  it("relê o número de não lidas quando a página avisa que algo foi lido", async () => {
    let unread = 5;
    const { calls } = loggedAs(undefined, { "GET /api/notifications/unread-count": () => ({ unread }) });
    renderApp(<Bell />);
    await waitFor(() => expect(screen.getByTestId("bell").textContent).toBe("5"));
    unread = 0;
    act(() => notifyNotificationsChanged());
    await waitFor(() => expect(screen.getByTestId("bell").textContent).toBe("0"));
    expect(calls.filter((c) => c.path === "/api/notifications/unread-count")).toHaveLength(2);
  });

  it("sem sessão não consulta nada", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/notifications/unread-count": { unread: 9 } });
    renderApp(<Bell enabled={false} />);
    act(() => notifyNotificationsChanged());
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.getByTestId("bell").textContent).toBe("0");
    expect(calls.some((c) => c.path === "/api/notifications/unread-count")).toBe(false);
  });
});
