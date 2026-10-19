// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import { loggedAs, renderApp, ME } from "@/test-utils/render";
import { catalogApi, type CatalogProduct } from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/client";
import { CatalogResultCard } from "./catalog-search";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const TAXONOMY = {
  subcategories: { upper_piece: ["t_shirt"], lower_piece: ["jeans"], shoes_piece: ["casual_sneakers"], accessory_piece: ["watch"], full_body_piece: ["dress"] },
  colors: { white: "#FFFFFF", black: "#12100F" }, materials: ["LEATHER", "COTTON"], sizes: ["m", "shoe_41"], sexes: ["UNISSEX"],
  occasions: ["casual"], styles: ["basic"], allowedOccasionsByCategory: {}, brands: [],
};

const PRODUCT = {
  id: "sem-frame", brand: { id: "b1", name: "Nike", slug: "nike", logoUrl: null }, productName: "Air Force 1",
  category: "shoes_piece", subcategory: "casual_sneakers", imageUrl: "https://brand.example/tenis.jpg",
  source: { type: "MANUAL_ADMIN", domain: "null", productUrl: "null", status: "ACTIVE" }, ingestionStatus: "VALIDATED",
} as unknown as CatalogProduct;

function renderCard(product: CatalogProduct = PRODUCT) {
  loggedAs(ME, { "GET /api/taxonomy": TAXONOMY });
  renderApp(<CatalogResultCard product={product} onPick={() => {}} />);
}

it.each([
  ["CATEGORY_FRAME_UNAVAILABLE", "enquadramento"],
  ["CATALOG_IMAGE_FETCH_FAILED", "origem"],
  ["ERRO_INTERNO", "serviço"],
])("falha de %s (%s): o card mostra a foto original, nunca a mensagem de erro", async (code) => {
  vi.spyOn(catalogApi, "previewImage").mockRejectedValue(new ApiError(code === "ERRO_INTERNO" ? 500 : 422, code, "falhou"));
  renderCard();
  await waitFor(() => expect(screen.getByRole("img", { name: /Air Force 1/ })).toBeTruthy());
  expect(screen.getByRole("img", { name: /Air Force 1/ }).getAttribute("src")).toContain("tenis.jpg");
  expect(screen.queryByText(/enquadramento seguro/)).toBeNull();
  expect(screen.queryByText(/não foi possível carregar/i)).toBeNull();
});

it("peça só com a foto de origem também mostra uma foto quando o enquadramento falha", async () => {
  const sourceOnly = { ...PRODUCT, id: "sem-frame-fonte", imageUrl: null, imageSource: { imageUrl: "https://brand.example/original.jpg" } } as unknown as CatalogProduct;
  vi.spyOn(catalogApi, "previewImage").mockRejectedValue(new ApiError(422, "CATEGORY_FRAME_UNAVAILABLE", "falhou"));
  renderCard(sourceOnly);
  await waitFor(() => expect(screen.getByRole("img", { name: /Air Force 1/ })).toBeTruthy());
  expect(screen.getByRole("img", { name: /Air Force 1/ }).getAttribute("src")).toContain("original.jpg");
  expect(screen.queryByText(/enquadramento seguro/)).toBeNull();
});

it("enquadramento verificado continua valendo: preview com recorte mostra a foto enquadrada", async () => {
  const framed = { ...PRODUCT, catalogImage: { url: PRODUCT.imageUrl!, mode: "SEMANTIC_CROP" as const, crop: { x: .1, y: .1, w: .8, h: .8 } } };
  vi.spyOn(catalogApi, "previewImage").mockResolvedValue(framed as CatalogProduct);
  renderCard();
  await waitFor(() => expect(screen.getByRole("img", { name: /Air Force 1/ })).toBeTruthy());
  expect(screen.queryByText(/enquadramento seguro/)).toBeNull();
});
