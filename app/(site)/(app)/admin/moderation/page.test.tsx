// @vitest-environment jsdom
/**
 * Admin · Fila de moderação: itens com trecho, categorias e confiança, foto pública ou retida (lida pelo endpoint
 * autenticado do admin), aprovar e rejeitar (com o motivo da política) e a fila vazia.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ME, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor } from "@/test-utils/render";
import ModerationPage from "./page";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const ADMIN = { ...ME, role: "ADMIN" as const };
const fail = (status: number, message: string) => () => new Response(JSON.stringify({ status, code: "ERRO", message }), { status, headers: { "content-type": "application/json" } });
const ITEMS = [
  { id: "m1", targetType: "COMMENT", targetId: "abcdefgh1234", excerpt: "texto ofensivo", categories: ["ODIO", "SPAM"], confidence: 0.876, createdAt: "2026-10-24T12:00:00Z" },
  { id: "m2", targetType: "PHOTO", targetId: "photo0001xyz", createdAt: "2026-10-24T12:00:00Z", imageUrl: "/media/p.jpg" },
  { id: "m3", targetType: "UPLOAD", targetId: "upl000001", createdAt: "2026-10-24T12:00:00Z", imageEndpoint: "/api/admin/moderation/m3/image", upload: { kind: "PROFILE_COVER", engine: "rekognition" } },
  { id: "m4", targetType: "UPLOAD", targetId: "upl000002", createdAt: "2026-10-24T12:00:00Z", imageEndpoint: "/api/admin/moderation/m4/image", upload: { kind: "OUTRO", engine: "local" } },
];

describe("admin · moderação", () => {
  it("mostra trecho, categorias, confiança, foto pública e retidas (com origem e motor)", async () => {
    URL.createObjectURL = vi.fn(() => "blob:retida");
    URL.revokeObjectURL = vi.fn();
    loggedAs(ADMIN, { "GET /api/admin/moderation": ITEMS, "GET /api/admin/moderation/m3/image": () => new Response("img", { status: 200, headers: { "content-type": "image/png" } }), "GET /api/admin/moderation/m4/image": fail(404, "x") });
    const { unmount } = renderApp(<ModerationPage />);
    expect(await screen.findByText("texto ofensivo", undefined, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText("abcdefgh")).toBeTruthy();
    expect(screen.getByText("ODIO")).toBeTruthy();
    expect(screen.getByText("88%")).toBeTruthy();
    expect(screen.getByText("Capa do perfil · verificação automática: rekognition")).toBeTruthy();
    // tipo desconhecido cai em "Foto enviada"
    expect(screen.getByText("Foto enviada · verificação automática: local")).toBeTruthy();
    expect(screen.getAllByText(/^Foto retida para revisão/)).toHaveLength(2);
    await waitFor(() => expect(document.querySelector('img[src="blob:retida"]')).toBeTruthy());
    expect(document.querySelector('img[src$="/media/p.jpg"]')).toBeTruthy();
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:retida");
  });

  it("aprovar manda motivo vazio, rejeitar manda o motivo da política; erro avisa", async () => {
    const { calls } = loggedAs(ADMIN, { "GET /api/admin/moderation": ITEMS.slice(0, 2), "POST /api/admin/moderation/m1": {}, "POST /api/admin/moderation/m2": fail(409, "Já decidido") });
    renderApp(<ModerationPage />);
    await screen.findByText("texto ofensivo", undefined, { timeout: 4000 });
    fireEvent.click(screen.getAllByRole("button", { name: "Aprovar" })[0]);
    await waitFor(() => expect(calls.find((c) => c.path === "/api/admin/moderation/m1")?.body).toEqual({ approve: true, reason: "" }));
    fireEvent.click((await screen.findAllByRole("button", { name: "Rejeitar" }))[0]);
    await waitFor(() => expect(calls.filter((c) => c.path === "/api/admin/moderation/m1").at(-1)!.body).toEqual({ approve: false, reason: "Conteúdo fora da política." }));
    fireEvent.click((await screen.findAllByRole("button", { name: "Rejeitar" }))[1]);
    expect(await screen.findByText("Já decidido")).toBeTruthy();
  });

  it("fila vazia", async () => {
    loggedAs(ADMIN, { "GET /api/admin/moderation": [] });
    renderApp(<ModerationPage />);
    expect(await screen.findByText("Fila vazia.", undefined, { timeout: 4000 })).toBeTruthy();
  });
});
