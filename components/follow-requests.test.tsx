// @vitest-environment jsdom
/**
 * Pedidos para seguir: aceitar e recusar pela tela (antes ficavam pendentes para sempre) e o aviso de que "publicado"
 * não é "visto por todos" quando o perfil não é público.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import { FollowRequests, ProfileVisibilityNotice } from "@/components/follow-requests";

const caio = { id: "u3", username: "caio", displayName: "Caio", avatarUrl: null, verified: false, privateAccount: false };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("pedidos para seguir", () => {
  it("aceita um pedido e avisa quem passou a seguir", async () => {
    let pending = [{ id: "f1", user: caio, at: "2026-10-18T12:00:00Z" }];
    const { calls } = loggedAs({ ...ME, profileVisibility: "FOLLOWERS" }, {
      "GET /api/me/follow-requests": () => pending,
      "POST /api/follow-requests/f1": () => { pending = []; return { accepted: true }; },
    });
    const onChange = vi.fn();
    renderApp(<FollowRequests onChange={onChange} />);
    expect(await screen.findByText("Pedidos para seguir (1)")).toBeTruthy();
    expect(screen.queryByRole("note")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Aceitar o pedido de @caio" }));
    await waitFor(() => expect(calls.find((c) => c.path === "/api/follow-requests/f1")?.body).toEqual({ accept: true }));
    await waitFor(() => expect(screen.queryByText("Pedidos para seguir (1)")).toBeNull());
    expect(onChange).toHaveBeenCalled();
  });

  it("com o perfil Privado, explica que aceitar não abre as publicações", async () => {
    loggedAs({ ...ME, profileVisibility: "PRIVATE" }, { "GET /api/me/follow-requests": [{ id: "f1", user: caio, at: "2026-10-18T12:00:00Z" }] });
    renderApp(<FollowRequests />);
    expect((await screen.findByRole("note")).textContent).toContain("só vê suas publicações quando o perfil estiver como Seguidores ou Público");
  });

  it("sem pedidos, não ocupa espaço na caixa de entrada", async () => {
    loggedAs(ME, { "GET /api/me/follow-requests": [] });
    const { container } = renderApp(<FollowRequests />);
    await waitFor(() => expect(container.textContent).toBe(""));
  });
});

describe("aviso nos criadores", () => {
  it("só aparece quando o perfil não é público", async () => {
    loggedAs({ ...ME, profileVisibility: "PRIVATE" });
    renderApp(<ProfileVisibilityNotice />);
    expect((await screen.findByRole("note")).textContent).toContain("só você vê o que publicar");
    cleanup();
    loggedAs({ ...ME, profileVisibility: "PUBLIC" });
    const { container } = renderApp(<ProfileVisibilityNotice />);
    await waitFor(() => expect(container.textContent).toBe(""));
  });
});
