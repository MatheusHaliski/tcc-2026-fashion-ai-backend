// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { LookCompositionEditor, defaultPosition, layersOf, toLayout } from "./look-composition-editor";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/schemes/s1/photo" }));

const SCHEME = { id: "s1", title: "Look de sábado", owner: { id: "u1", username: "ana", displayName: "Ana", profileType: "PESSOAL", verified: false, privateAccount: false },
  creationMode: "MANUAL", origin: "USER", style: [], occasion: [], visibility: "PUBLIC", status: "DRAFT", disponivel: true, lookDoDia: false, seals: [], tags: [], revalidationPending: false,
  counters: { likes: 0, comments: 0, shares: 0, remixes: 0, views: 0, saves: 0, reactions: {} }, viewer: { liked: false, reactions: [], saved: false, canEdit: true, following: false }, createdAt: "2026-10-10", updatedAt: "2026-10-10",
  items: [
    { wardrobeItemId: "a", slot: "TOP", sortOrder: 0, zIndex: 0, positionX: null, positionY: null, scale: 1, rotation: 0, opacity: 1, piece: { id: "a", name: "Camiseta branca", imageUrl: "/media/a.png" } },
    { wardrobeItemId: "b", slot: "BOTTOM", sortOrder: 1, zIndex: 1, positionX: 0.5, positionY: 0.7, scale: 1.2, rotation: 0, opacity: 1, piece: { id: "b", name: "Calça jeans", imageUrl: "/media/b.png" } },
  ] };

afterEach(() => { cleanup(); push.mockClear(); });

describe("composição do look por camadas (RF15)", () => {
  it("camadas vêm dos itens do look e o layout enviado tem só posição, tamanho, rotação, opacidade e ordem", () => {
    const layers = layersOf(SCHEME.items as never);
    expect(layers.map((l) => l.name)).toEqual(["Camiseta branca", "Calça jeans"]);
    expect(layers[0].x).toBeNull(); expect(layers[1].scale).toBe(1.2);
    expect(toLayout(layers)[1]).toEqual({ wardrobeItemId: "b", zIndex: 1, sortOrder: 1, positionX: 0.5, positionY: 0.7, scale: 1.2, rotation: 0, opacity: 1 });
    expect(defaultPosition("SHOES", 0)).toEqual([0.72, 0.86, 0.36, 0.2]);
  });

  it("barra Cancelar · Desfazer · Refazer · Comparar · Salvar; mover pelo teclado, reordenar e salvar pelo endpoint de layout", async () => {
    URL.createObjectURL = vi.fn(() => "blob:card");
    const { calls } = mockApi({ "GET /api/schemes/s1": { scheme: SCHEME }, "GET /api/schemes/s1/card.png": new Blob(["png"], { type: "image/png" }),
      "POST /api/schemes/s1/layout/preview": new Blob(["png"], { type: "image/png" }), "PUT /api/schemes/s1/layout": { ...SCHEME } });
    const { container } = renderApp(<LookCompositionEditor schemeId="s1" />);
    await screen.findByText("Editar imagem do look: Look de sábado");
    const bar = within(screen.getByRole("banner", { name: "Barra do editor" }));
    for (const name of ["Cancelar", "Desfazer", "Refazer", "Comparar", "Salvar"]) expect(bar.getByRole("button", { name })).toBeTruthy();
    expect((bar.getByRole("button", { name: "Salvar" }) as HTMLButtonElement).disabled).toBe(true);
    // a camada selecionada (a primeira) anda com as setas
    const stage = container.querySelector(".look-compose-stage") as HTMLElement;
    fireEvent.keyDown(stage, { key: "ArrowRight" });
    const top = screen.getByRole("button", { name: "Camada Camiseta branca" });
    expect(parseFloat(top.style.left)).toBeGreaterThan((0.4 - 0.31) * 100 - 0.01);
    expect((bar.getByRole("button", { name: "Salvar" }) as HTMLButtonElement).disabled).toBe(false);
    // ordem: a calça vai para trás
    fireEvent.click(screen.getByRole("button", { name: "Enviar Calça jeans para trás" }));
    expect(Number(screen.getByRole("button", { name: "Camada Calça jeans" }).style.zIndex)).toBe(1);
    fireEvent.click(bar.getByRole("button", { name: "Desfazer" }));
    expect(Number(screen.getByRole("button", { name: "Camada Calça jeans" }).style.zIndex)).toBe(2);
    fireEvent.click(bar.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT" && c.path === "/api/schemes/s1/layout")).toBe(true));
    const body = calls.find((c) => c.method === "PUT" && c.path === "/api/schemes/s1/layout")!.body as { wardrobeItemId: string; positionX: number | null }[];
    expect(body.map((b) => b.wardrobeItemId)).toEqual(["a", "b"]);
    expect(body[0].positionX).toBeCloseTo(0.41, 2);
    // Revisão: prévia do servidor pelo endpoint de layout
    fireEvent.click(screen.getByRole("radio", { name: "Revisão" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/schemes/s1/layout/preview")).toBe(true), { timeout: 2000 });
  });
});
