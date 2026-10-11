// @vitest-environment jsdom
/**
 * "Provando agora" no formato do card compacto de peça (docs/anatomias): miniatura de 56 px, rótulo do lugar, identidade,
 * nome que é o link e UMA linha de estado — o botão "Ver prévia 2D no espelho" e a barra do 3D com as etapas que faltam
 * (porcentagem só quando é real). No máximo três ações visíveis e o resto no menu ⋯. Peça do guarda-roupa sem 3D entra
 * na fila sozinha (uma vez); peça da loja fica em 0 de 4 até "Guardar a peça e gerar o 3D"; falhou: "Tentar de novo
 * (grátis)"; pedido recusado: "3D pausado" com o motivo acessível.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { FittingItems, resetAutoQueue } from "@/components/try-on/fitting-items";
import type { FittingItem, FittingSlot } from "@/lib/tryon/fitting-room";

beforeEach(() => resetAutoQueue());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const NAMES: Record<FittingSlot, string> = { upper_piece: "Parte de cima", lower_piece: "Parte de baixo", shoes_piece: "Calçado", accessory_piece: "Acessório" };
const catalog: FittingItem = { key: "c:p1", source: "catalog", slot: "upper_piece", wear: "TOP", name: "Blazer de alfaiataria", brand: { name: "Animale", logoUrl: null }, category: "upper_piece", subcategory: "blazer", imageUrl: "/media/b.png", officialUrl: "https://animale.com.br/x", sourceDomain: "animale.com.br", productId: "p1", colorHex: "#aabbcc", addedAt: 1 };
const wardrobe: FittingItem = { key: "w:w1", source: "wardrobe", slot: "lower_piece", wear: "BOTTOM", name: "Calça chevron", brand: null, category: "lower_piece", subcategory: "tailored_pants", imageUrl: "/media/c.png", pieceId: "w1", addedAt: 2 };
const base = () => ({ items: [catalog, wardrobe], products: {}, owned: {}, busyOwn: null, status: "", slotNames: NAMES, onVariantChange: vi.fn(), onOwn: vi.fn(), onRemove: vi.fn() });
const row = (slot: string) => within(screen.getByText(slot, { selector: ".piece-row-kicker" }).closest("li")!);
const posts = (calls: { method: string; path: string }[], path: string) => calls.filter((c) => c.method === "POST" && c.path === path).length;

describe("FittingItems — card compacto de peça", () => {
  it("anatomia: miniatura 56, rótulo, uma linha de estado, nome como link, até 3 ações + menu ⋯ e sem legenda miúda", async () => {
    loggedAs(undefined, { "GET /api/pieces/w1/model3d": { status: "COMPLETED", modelUrl: "/media/w1.glb" } });
    const onPreview2d = vi.fn(); const onOwn = vi.fn();
    const { container } = renderApp(<FittingItems {...base()} onOwn={onOwn} onPreview2d={onPreview2d} />);
    expect(container.querySelectorAll(".piece-row")).toHaveLength(4);
    for (const li of Array.from(container.querySelectorAll(".piece-row"))) {
      expect(li.querySelector(".piece-row-thumb")).toBeTruthy();
      expect(li.querySelectorAll(".piece-row-kicker")).toHaveLength(1);
      expect(li.querySelectorAll(".piece-row-state").length).toBeLessThanOrEqual(1);
      const actions = li.querySelector(".piece-row-actions");
      const visible = actions ? Array.from(actions.querySelectorAll(":scope > a, :scope > button")) : [];
      expect(visible.length).toBeLessThanOrEqual(3);
    }
    const top = row("Parte de cima");
    fireEvent.click(top.getByRole("button", { name: "Ver prévia 2D no espelho" }));
    expect(onPreview2d).toHaveBeenCalledWith(expect.objectContaining({ key: "c:p1" }));
    expect(top.getByRole("link", { name: /Ver em animale.com.br/ }).className).toContain("btn");
    expect(top.getByRole("link", { name: "Blazer de alfaiataria" }).getAttribute("href")).toBe("https://animale.com.br/x");
    fireEvent.click(top.getByRole("button", { name: "Já tenho esta peça" }));
    expect(onOwn).toHaveBeenCalledWith(expect.objectContaining({ key: "c:p1" }));
    expect(top.getByRole("button", { name: "Remover Blazer de alfaiataria de Parte de cima" })).toBeTruthy();
    expect(top.getByRole("button", { name: "Mais ações · Blazer de alfaiataria" }).getAttribute("aria-haspopup")).toBe("menu");
    // guarda-roupa: o nome leva à peça; 3D pronto = barra cheia
    const bottom = row("Parte de baixo");
    expect(bottom.getByRole("link", { name: "Calça chevron" }).getAttribute("href")).toBe("/pieces/w1");
    await waitFor(() => expect(bottom.getByText("Modelo 3D pronto")).toBeTruthy());
    expect(container.querySelectorAll(".piece-row .type-caption")).toHaveLength(0);
    expect(screen.queryByText(/Prévia 2D disponível|ainda não gerado/)).toBeNull();
  });

  it("peça do guarda-roupa sem 3D entra na fila sozinha, uma vez só; a barra mostra a etapa, nunca a porcentagem de referência", async () => {
    let status: Record<string, unknown> = { status: null, featureEnabled: true };
    const { calls } = loggedAs(undefined, {
      "GET /api/pieces/w1/model3d": () => status,
      "POST /api/pieces/w1/model3d": () => { status = { status: "QUEUED", progress: 5, progressReal: false }; return status; },
    });
    const { unmount } = renderApp(<FittingItems {...base()} items={[wardrobe]} />);
    const bottom = row("Parte de baixo");
    await waitFor(() => expect(bottom.getByText("Na fila do 3D · 1 de 4")).toBeTruthy());
    expect(posts(calls, "/api/pieces/w1/model3d")).toBe(1);
    const bar = bottom.getByRole("progressbar", { name: "Modelo 3D da peça" });
    expect(bar.getAttribute("aria-valuenow")).toBe("1");
    expect(bar.getAttribute("aria-valuemax")).toBe("4");
    expect(screen.queryByText(/5%/)).toBeNull();
    unmount();
    // a linha volta (troca de aba, outra visita na mesma sessão): não pede de novo
    status = { status: "PROCESSING", progress: 15, progressReal: false, stages: [{ name: "FOTO", provider: "local" }] };
    renderApp(<FittingItems {...base()} items={[wardrobe]} />);
    await waitFor(() => expect(row("Parte de baixo").getByText("Gerando o 3D · 2 de 4")).toBeTruthy());
    expect(screen.queryByText(/15%/)).toBeNull();
    expect(posts(calls, "/api/pieces/w1/model3d")).toBe(1);
  });

  it("peça da loja: 0 de 4 e, no menu ⋯, Guardar a peça e gerar o 3D (guarda e pede o 3D da peça guardada)", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/pieces/w9/model3d": { status: null, featureEnabled: true }, "POST /api/pieces/w9/model3d": { status: "QUEUED" } });
    const onOwn = vi.fn();
    const props = { ...base(), items: [catalog], onOwn };
    const { rerender } = renderApp(<FittingItems {...props} />);
    const top = row("Parte de cima");
    expect(top.getByText("3D não iniciado · 0 de 4")).toBeTruthy();
    fireEvent.click(top.getByRole("button", { name: "Mais ações · Blazer de alfaiataria" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Guardar a peça e gerar o 3D" }));
    expect(onOwn).toHaveBeenCalledWith(expect.objectContaining({ key: "c:p1" }));
    rerender(<FittingItems {...props} owned={{ "c:p1": "w9" }} />);
    await waitFor(() => expect(posts(calls, "/api/pieces/w9/model3d")).toBe(1));
    await waitFor(() => expect(row("Parte de cima").getByText("Na fila do 3D · 1 de 4")).toBeTruthy());
    expect(row("Parte de cima").getByRole("link", { name: /No seu guarda-roupa/ }).getAttribute("href")).toBe("/pieces/w9");
  });

  it("falhou: o vocabulário do detalhe da peça e Tentar de novo (grátis)", async () => {
    const { calls } = loggedAs(undefined, { "GET /api/pieces/w1/model3d": { status: "FAILED", canRetryFree: true }, "POST /api/pieces/w1/model3d": { status: "QUEUED" } });
    renderApp(<FittingItems {...base()} items={[wardrobe]} />);
    const bottom = row("Parte de baixo");
    await waitFor(() => expect(bottom.getByText("Não deu para gerar o 3D.")).toBeTruthy());
    fireEvent.click(bottom.getByRole("button", { name: "Tentar de novo (grátis)" }));
    await waitFor(() => expect(posts(calls, "/api/pieces/w1/model3d")).toBe(1));
    await waitFor(() => expect(bottom.getByText("Na fila do 3D · 1 de 4")).toBeTruthy());
  });

  it("pedido recusado (peça sem foto): 3D pausado, motivo no nome acessível e nos detalhes; o menu oferece tentar de novo", async () => {
    loggedAs(undefined, {
      "GET /api/pieces/w1/model3d": { status: null, featureEnabled: true },
      "POST /api/pieces/w1/model3d": () => new Response(JSON.stringify({ status: 422, code: "SEM_FOTO", message: "A peça precisa de uma foto" }), { status: 422, headers: { "content-type": "application/json" } }),
    });
    renderApp(<FittingItems {...base()} items={[wardrobe]} />);
    const bottom = row("Parte de baixo");
    await waitFor(() => expect(bottom.getByText("3D pausado")).toBeTruthy());
    expect(bottom.getByRole("progressbar").getAttribute("aria-valuetext")).toContain("A peça precisa de uma foto");
    expect(screen.queryByRole("alert")).toBeNull();                                        // sem aviso solto
    fireEvent.click(bottom.getByRole("button", { name: "Mais ações · Calça chevron" }));
    expect(await screen.findByRole("menuitem", { name: "Tentar gerar o 3D de novo" })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "Detalhes da prévia" }));
    expect(await screen.findByText(/O 3D desta peça não começou: A peça precisa de uma foto/)).toBeTruthy();
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  });

  it("lugar vazio: miniatura tracejada com o glifo e atalhos para as lojas (com a categoria) e o guarda-roupa", () => {
    loggedAs(undefined, {});
    const onPickFromStores = vi.fn(); const onPickFromWardrobe = vi.fn();
    const { container } = renderApp(<FittingItems {...base()} items={[]} onPickFromStores={onPickFromStores} onPickFromWardrobe={onPickFromWardrobe} />);
    expect(container.querySelectorAll(".piece-row.is-empty svg")).toHaveLength(4);
    const shoes = row("Calçado");
    expect(shoes.getByText("Lugar vazio")).toBeTruthy();
    fireEvent.click(shoes.getByRole("button", { name: "Escolher nas lojas" }));
    expect(onPickFromStores).toHaveBeenCalledWith("shoes_piece");
    fireEvent.click(shoes.getByRole("button", { name: "Escolher no guarda-roupa" }));
    expect(onPickFromWardrobe).toHaveBeenCalledWith("shoes_piece");
  });
});
