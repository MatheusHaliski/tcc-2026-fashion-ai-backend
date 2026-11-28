// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { FaiStore } from "@/components/fai-store/fai-store";
import type { FaiStoreItem, FaiStoreView } from "@/lib/fai-store/api";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";

/**
 * Loja FAI Points: grade de cards (foto, descrição, preço), filtro por tipo, card de loja expandido com o botão de
 * comprar, compra concluída e recusa por saldo insuficiente — tudo só com FAI Points, sem endereço nem pagamento.
 */
const item = (over: Partial<FaiStoreItem>): FaiStoreItem => ({ id: "X", type: "WARDROBE", name: "Item", description: "Descrição", pricePoints: 100,
  visual: null, creator: null, product: null, owned: false, affordable: true, ...over });
const WARDROBE = item({ id: "WARDROBE_NOGUEIRA_CLASSICO", name: "Guarda-roupa Nogueira Clássico", description: "Madeira nogueira e portas de abrir.", pricePoints: 400,
  visual: { material: "MADEIRA", cor: "NOGUEIRA", porta: "ABRIR", puxador: "BARRA", puxadorAcabamento: "LATAO" } });
const AURA = item({ id: "AURA_META_PRISMA", type: "AURA_PRESET", name: "Prisma marfim", description: "Preset de Aura Metamorfose.", pricePoints: 150, visual: { auraMetamorphose: "PRISMA" } });
const LOOK = item({ id: "LOOK_CARD_TERRACOTA", type: "LOOK_CARD", name: "Card de look Terracota", pricePoints: 900, affordable: false, visual: { border: ["#C8643B", "#F2C29B"] } });
const CELEB = item({ id: "BRAND_AURA_LIA_SOLAR", type: "BRAND_AURA", name: "Aura Solar", pricePoints: 480, creator: { name: "Lia Solar", kind: "CELEBRIDADE", demo: true }, visual: { palette: ["#FFE066", "#F48C06"] } });
const view = (over: Partial<FaiStoreView> = {}): FaiStoreView => ({ balance: 500, types: ["AURA_PRESET", "WARDROBE", "LOOK_CARD", "BRAND_AURA"], items: [AURA, WARDROBE, LOOK, CELEB], ...over });

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("FaiStore", () => {
  it("mostra a grade de cards com foto, descrição e preço, e filtra por tipo", async () => {
    loggedAs(undefined, { "GET /api/fai-store": view() });
    renderApp(<FaiStore />);
    const grid = await screen.findByRole("list");
    expect(within(grid).getAllByRole("listitem")).toHaveLength(4);
    const card = screen.getByRole("button", { name: /Ver Guarda-roupa Nogueira Clássico/ });
    expect(card.textContent).toContain("Madeira nogueira e portas de abrir.");
    expect(card.textContent).toContain("400");
    expect(card.querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("button", { name: /Ver Card de look Terracota/ }).textContent).toContain("Saldo insuficiente");

    fireEvent.click(screen.getByRole("button", { name: "Cards de look" }));
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Ver Prisma marfim/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tudo" }));
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(4);
  });

  it("abre o card expandido e conclui a compra só com FAI Points", async () => {
    let bought = false;
    const { calls } = loggedAs(undefined, {
      "GET /api/fai-store": () => view(bought ? { balance: 100, items: [AURA, { ...WARDROBE, owned: true }, LOOK, CELEB] } : {}),
      "POST /api/fai-store/items/WARDROBE_NOGUEIRA_CLASSICO/purchase": () => { bought = true; return { itemId: WARDROBE.id, owned: true, balance: 100 }; },
    });
    const onChanged = vi.fn();
    renderApp(<FaiStore onChanged={onChanged} />);
    fireEvent.click(await screen.findByRole("button", { name: /Ver Guarda-roupa Nogueira Clássico/ }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Depois da compra, seu saldo fica em 100 FAI Points.");
    expect(dialog.textContent).toContain("Comprado só com FAI Points");
    fireEvent.click(within(dialog).getByRole("button", { name: "Comprar por 400 FAI Points" }));
    await waitFor(() => expect(within(screen.getByRole("dialog")).getByText("Você já tem")).toBeTruthy());
    const post = calls.find((c) => c.method === "POST");
    expect(post?.path).toBe("/api/fai-store/items/WARDROBE_NOGUEIRA_CLASSICO/purchase");
    expect(JSON.stringify(post?.body ?? {})).toBe("{}");   // nada de endereço nem dado de pagamento
    expect(onChanged).toHaveBeenCalled();
  });

  it("saldo insuficiente: o botão fica bloqueado e a recusa do servidor aparece no card sem fechar", async () => {
    loggedAs(undefined, {
      "GET /api/fai-store": view(),
      "POST /api/fai-store/items/BRAND_AURA_LIA_SOLAR/purchase": new Response(JSON.stringify({ status: 409, code: "SALDO_INSUFICIENTE", message: "Saldo insuficiente: você tem 300 FAI Points e o item custa 480." }), { status: 409, headers: { "content-type": "application/json" } }),
    });
    renderApp(<FaiStore />);
    fireEvent.click(await screen.findByRole("button", { name: /Ver Card de look Terracota/ }));
    let dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Faltam 400 FAI Points");
    expect((within(dialog).getByRole("button", { name: "Comprar por 900 FAI Points" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    fireEvent.click(screen.getByRole("button", { name: /Ver Aura Solar/ }));
    dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Assinado pela celebridade Lia Solar");
    fireEvent.click(within(dialog).getByRole("button", { name: "Comprar por 480 FAI Points" }));
    expect((await within(screen.getByRole("dialog")).findByRole("alert")).textContent).toContain("Saldo insuficiente: você tem 300");
  });
});
