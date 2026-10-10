// @vitest-environment jsdom
/**
 * Linha do slot do provador: nada de legenda miúda — texto em corpo normal com ícone ou dentro de botão; "Ver prévia
 * 2D no espelho" é um botão; o modelo 3D tem barra de progresso e "Gerar modelo 3D" / "Gerar novamente o 3D";
 * lugar vazio oferece as lojas e o guarda-roupa.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { FittingItems } from "@/components/try-on/fitting-items";
import type { FittingItem, FittingSlot } from "@/lib/tryon/fitting-room";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const NAMES: Record<FittingSlot, string> = { upper_piece: "Parte de cima", lower_piece: "Parte de baixo", shoes_piece: "Calçado", accessory_piece: "Acessório" };
const catalog: FittingItem = { key: "c:p1", source: "catalog", slot: "upper_piece", wear: "TOP", name: "Blazer de alfaiataria", brand: { name: "Animale", logoUrl: null }, category: "upper_piece", subcategory: "blazer", imageUrl: "/media/b.png", officialUrl: "https://animale.com.br/x", sourceDomain: "animale.com.br", productId: "p1", colorHex: "#aabbcc" };
const wardrobe: FittingItem = { key: "w:w1", source: "wardrobe", slot: "lower_piece", wear: "BOTTOM", name: "Calça chevron", brand: null, category: "lower_piece", subcategory: "tailored_pants", imageUrl: "/media/c.png", pieceId: "w1", model3dStatus: "FAILED" };
const base = () => ({ items: [catalog, wardrobe], products: {}, owned: {}, busyOwn: null, status: "", slotNames: NAMES, onVariantChange: vi.fn(), onOwn: vi.fn(), onRemove: vi.fn() });

describe("FittingItems — linha do slot", () => {
  it("prévia 2D é um botão; loja, guarda-roupa e remover são botões/links com ícone; sem legenda miúda", async () => {
    loggedAs(undefined, { "GET /api/pieces/w1/model3d": { status: "FAILED", canRetryFree: true } });
    const onPreview2d = vi.fn(); const onOwn = vi.fn();
    const { container } = renderApp(<FittingItems {...base()} onOwn={onOwn} onPreview2d={onPreview2d} />);
    const top = within(screen.getByText("Parte de cima").closest("li")!);
    fireEvent.click(top.getByRole("button", { name: "Ver prévia 2D no espelho" }));
    expect(onPreview2d).toHaveBeenCalledWith(expect.objectContaining({ key: "c:p1" }));
    expect(top.getByRole("link", { name: /Ver em animale.com.br/ }).className).toContain("btn");
    fireEvent.click(top.getByRole("button", { name: "Já tenho esta peça" }));
    expect(onOwn).toHaveBeenCalledWith(expect.objectContaining({ key: "c:p1" }));
    expect(top.getByRole("button", { name: "Remover Blazer de alfaiataria de Parte de cima" })).toBeTruthy();
    expect(container.querySelectorAll(".fitting-slot .type-caption")).toHaveLength(0);
    expect(screen.queryByText(/Prévia 2D disponível; modelo 3D/)).toBeNull();
  });

  it("modelo 3D: barra de progresso e Gerar novamente quando falhou; peça da loja sem guarda-roupa guarda e gera", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/pieces/w1/model3d": { status: "FAILED", canRetryFree: true }, "POST /api/pieces/w1/model3d": { status: "QUEUED", progress: 5 } });
    const onOwn = vi.fn();
    renderApp(<FittingItems {...base()} onOwn={onOwn} />);
    const bottom = within(screen.getByText("Parte de baixo").closest("li")!);
    await waitFor(() => expect(bottom.getByText("A geração do modelo 3D falhou")).toBeTruthy());
    expect(bottom.getByRole("progressbar")).toBeTruthy();
    fireEvent.click(bottom.getByRole("button", { name: "Gerar novamente o 3D" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/pieces/w1/model3d")).toBe(true));
    await waitFor(() => expect(bottom.getByText("Modelo 3D na fila para gerar")).toBeTruthy());
    expect(bottom.queryByRole("button", { name: /Gerar/ })).toBeNull();                 // enquanto anda, só a barra
    const top = within(screen.getByText("Parte de cima").closest("li")!);
    expect(top.getByText("Modelo 3D da peça ainda não gerado")).toBeTruthy();
    fireEvent.click(top.getByRole("button", { name: "Guardar a peça e gerar o 3D" }));
    expect(onOwn).toHaveBeenCalled();
  });

  it("lugar vazio: texto com ícone e botões para as lojas (com a categoria) e o guarda-roupa", () => {
    loggedAs(undefined, {});
    const onPickFromStores = vi.fn(); const onPickFromWardrobe = vi.fn();
    renderApp(<FittingItems {...base()} items={[]} onPickFromStores={onPickFromStores} onPickFromWardrobe={onPickFromWardrobe} />);
    const shoes = within(screen.getByText("Calçado").closest("li")!);
    expect(shoes.getByText("Lugar vazio")).toBeTruthy();
    fireEvent.click(shoes.getByRole("button", { name: "Escolher nas lojas" }));
    expect(onPickFromStores).toHaveBeenCalledWith("shoes_piece");
    fireEvent.click(shoes.getByRole("button", { name: "Escolher no guarda-roupa" }));
    expect(onPickFromWardrobe).toHaveBeenCalledWith("shoes_piece");
  });
});
