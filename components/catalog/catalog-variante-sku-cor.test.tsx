// @vitest-environment jsdom
/**
 * Exercício 20 — SKU e cor da MESMA variante na tela: o card mostra a variante que a busca confirmou, não deixa uma
 * escolha antiga ativa quando a busca devolve o mesmo produto em outra variante, entrega produto + variante a quem
 * escolhe, e a peça criada mostra a origem (SKU e cor) que o servidor guardou.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen } from "@/test-utils/render";
import type { CatalogProduct, CatalogVariant } from "@/lib/api/catalog";
import { CatalogResultCard } from "./catalog-result-card";
import { pieceCatalogOrigin } from "@/components/expanded-card/piece-catalog-origin";

const TAXONOMY = { subcategories: { upper_piece: ["t_shirt"] }, colors: { blue: "#2A5FA8", red: "#C62B28" }, materials: [], sizes: [], sexes: [], occasions: [], styles: [], allowedOccasionsByCategory: {}, brands: [] };
const AZUL: CatalogVariant = { id: "v-azul", key: "blue", color: "blue", colorName: "Azul", sku: "SKU-A" };
const VERMELHA: CatalogVariant = { id: "v-vermelha", key: "red", color: "red", colorName: "Vermelho", sku: "SKU-B" };
const produto = (selectedVariant: CatalogVariant | null): CatalogProduct => ({
  id: "tee", brand: { id: "b1", name: "Nike", slug: "nike", logoUrl: null }, productName: "Camiseta Essencial", category: "upper_piece", subcategory: "t_shirt",
  color: selectedVariant?.color ?? "white", sku: "TEE-1", catalogImage: null, imageUrl: null, variants: [AZUL, VERMELHA], selectedVariant,
  source: { type: "MANUAL_ADMIN", domain: "nike.com", productUrl: "", status: "ACTIVE", lastVerifiedAt: "" }, ingestionStatus: "VALIDATED", ownersCount: 0,
});
const ativa = () => screen.getAllByRole("button", { pressed: true }).map((b) => b.getAttribute("aria-label"));

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("variante por SKU e cor no card do catálogo", () => {
  it("a variante que a busca por código confirmou vem ativa e é a entregue junto do produto", () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY });
    const onPick = vi.fn();
    renderApp(<CatalogResultCard product={produto(AZUL)} onPick={onPick} />);
    expect(ativa()).toEqual(["Azul"]);
    fireEvent.click(screen.getByRole("button", { name: "Selecionar" }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: "v-azul", sku: "SKU-A", color: "blue" }), expect.objectContaining({ id: "tee" }), expect.any(Function));
  });

  it("escolha antiga não fica ativa quando a busca devolve o mesmo produto em outra variante", () => {
    mockApi({ "GET /api/taxonomy": TAXONOMY });
    const onPick = vi.fn();
    const view = renderApp(<CatalogResultCard product={produto(AZUL)} onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: "Vermelho" }));
    expect(ativa()).toEqual(["Vermelho"]);
    // a pessoa refina por SKU-A + azul: o servidor confirma a azul e a vermelha escolhida antes deixa de valer
    view.rerender(<CatalogResultCard product={{ ...produto(AZUL) }} onPick={onPick} />);
    expect(ativa()).toEqual(["Vermelho"]);
    view.rerender(<CatalogResultCard product={produto(VERMELHA)} onPick={onPick} />);
    view.rerender(<CatalogResultCard product={produto(AZUL)} onPick={onPick} />);
    expect(ativa()).toEqual(["Azul"]);
    fireEvent.click(screen.getByRole("button", { name: "Selecionar" }));
    expect(onPick).toHaveBeenLastCalledWith(expect.objectContaining({ id: "v-azul" }), expect.anything(), expect.any(Function));
  });
});

describe("origem da peça no catálogo (pieceCatalogOrigin)", () => {
  const t = (k: string, v?: Record<string, unknown>) => (v ? `${k}:${JSON.stringify(v)}` : k);
  const cor = (c: string) => ({ blue: "Azul", red: "Vermelho" } as Record<string, string>)[c] ?? c;
  it("mostra SKU e cor da variante guardada; sem variante, só o produto; fora do catálogo, nada", () => {
    expect(pieceCatalogOrigin({ catalogProductId: "tee", catalogVariantId: "v-azul", sku: "SKU-A", color: "blue" }, cor, t)).toBe('pieceDetail.catalogo_sku_cor:{"sku":"SKU-A","cor":"Azul"}');
    expect(pieceCatalogOrigin({ catalogProductId: "tee", catalogVariantId: "v-azul", sku: null, color: "red" }, cor, t)).toBe('pieceDetail.catalogo_sem_sku:{"cor":"Vermelho"}');
    expect(pieceCatalogOrigin({ catalogProductId: "tee", catalogVariantId: null, sku: "TEE-1", color: "blue" }, cor, t)).toBe("pieceDetail.catalogo_produto");
    expect(pieceCatalogOrigin({ catalogProductId: null, catalogVariantId: null, sku: "X", color: "blue" }, cor, t)).toBeNull();
  });
});
