// @vitest-environment jsdom
/** Etapa 3 — o card do produto do catálogo oferece "Ver em 3D" só quando o produto tem modelo de vitrine publicado. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, mockApi, renderApp, screen } from "@/test-utils/render";
import type { CatalogProduct } from "@/lib/api/catalog";
import { CatalogModel3d } from "./catalog-model3d";
import { CatalogResultCard } from "./catalog-result-card";

vi.mock("next/dynamic", () => ({ default: () => ({ url, name }: { url: string; name: string }) => <div data-testid="viewer" data-url={url}>{name}</div> }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("CatalogModel3d", () => {
  it("abre o visualizador com a URL de mídia resolvida e o aviso do avatar", () => {
    renderApp(<CatalogModel3d url="/media/catalog/model3d/x/tee.glb" name="Camiseta Classic" />);
    expect(screen.queryByTestId("viewer")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /3D/ }));
    const viewer = screen.getByTestId("viewer");
    expect(viewer.getAttribute("data-url")).toMatch(/\/media\/catalog\/model3d\/x\/tee\.glb$/);
    expect(screen.getByText(/molde/)).toBeTruthy();
  });

  it("o card do produto mostra o botão só com modelo publicado", () => {
    mockApi({ "GET /api/taxonomy": { subcategories: {}, colors: {}, materials: [], sizes: [], sexes: [], occasions: [], styles: [], allowedOccasionsByCategory: {}, brands: [] } });
    const product = (model3dUrl: string | null) => ({ id: "p", brand: null, productName: "Camiseta", category: "upper_piece", subcategory: "t_shirt",
      catalogImage: null, imageUrl: null, source: { type: "X", domain: "nike.com" }, ingestionStatus: "VALIDATED", ownersCount: 0, model3dUrl }) as unknown as CatalogProduct;
    renderApp(<CatalogResultCard product={product("/media/catalog/model3d/x/p.glb")} onPick={() => {}} />);
    expect(screen.getByRole("button", { name: "Ver em 3D" })).toBeTruthy();
    cleanup();
    renderApp(<CatalogResultCard product={product(null)} onPick={() => {}} />);
    expect(screen.queryByRole("button", { name: "Ver em 3D" })).toBeNull();
  });

  it("sem URL utilizável não mostra nada", () => {
    const { container } = renderApp(<CatalogModel3d url="" name="Sem modelo" />);
    expect(container.querySelector("button")).toBeNull();
  });
});
