// @vitest-environment jsdom
/**
 * Espelho + catálogo de marcas: a folha da parte escolhe peças numa janela segmentada (radiogroup) — "Meu closet" (o
 * guarda-roupa, como antes) ou "Catálogo de marcas" (o catálogo paginado da categoria da parte, com busca e "Carregar
 * mais"). Vestir um produto manda só o id ao servidor; a peça da loja aparece no reflexo, na grade e na folha como "Loja",
 * sai pelo catálogo, vai ao Provador com o produto e fica fora de salvar e do editor.
 */
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, loggedAs, renderApp, screen, waitFor, within } from "@/test-utils/render";
import { MirrorControls, type MirrorData } from "./mirror-controls";
import { mirrorLook3d } from "@/lib/mirror/mirror-list";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const TEE = { id: "a", name: "Camiseta preta", imageUrl: "/media/a.png", category: "upper_piece", subcategory: "t_shirt", slot: "upper" };
const JEANS = { id: "b", name: "Calça jeans", imageUrl: "/media/b.png", category: "lower_piece", subcategory: "jeans", slot: "lower" };
const STORE_SHIRT = {
  id: "c:p1", source: "catalog" as const, productId: "p1", variantId: "v1", imageId: "i1", name: "Camisa Oxford", category: "upper_piece", subcategory: "shirt",
  slot: "upper", imageUrl: "https://loja.example/oxford.jpg", brand: { id: "b1", name: "Marca X", slug: "marca-x" }, officialUrl: "https://loja.example/p/oxford", available: true,
};
const EMPTY: MirrorData = { slots: { outer_layer: null, upper: null, dress: null, lower: null, shoes: null, accessory: [] }, complete: false, missing: [], actions: [] };
const state = (slots: Record<string, unknown>, extra: Partial<MirrorData> = {}): MirrorData => ({ ...EMPTY, slots: { ...EMPTY.slots, ...slots } as MirrorData["slots"], ...extra });
const product = (id: string, name: string, brand: string) => ({ id, productName: name, brand: { id: `b-${brand}`, name: brand, slug: brand.toLowerCase() }, category: "upper_piece", subcategory: "t_shirt", imageUrl: `https://loja.example/${id}.jpg`, source: { type: "OFFICIAL", domain: "x", productUrl: "x", status: "OK", lastVerifiedAt: "" }, ingestionStatus: "VALIDATED", ownersCount: 0 });

function Harness({ initial }: { initial: MirrorData }) {
  const [data, setData] = useState(initial);
  return <MirrorControls data={data} setData={setData} reload={() => undefined} />;
}
const cell = (name: RegExp) => screen.getByRole("button", { name });

describe("Espelho — janela segmentada Meu closet | Catálogo de marcas", () => {
  it("o catálogo paginado da categoria da parte: busca, carregar mais e vestir mandando só o id do produto", async () => {
    const pages: Record<string, unknown> = {
      "0:": { items: [product("p1", "Camisa Oxford", "Marca X"), product("p2", "Camiseta básica", "Marca Y")], page: 0, size: 12, total: 3, hasMore: true },
      "1:": { items: [product("p2", "Camiseta básica", "Marca Y"), product("p3", "Polo piquet", "Marca Z")], page: 1, size: 12, total: 3, hasMore: false },
      "0:nike": { items: [product("p9", "Camiseta Nike", "Nike")], page: 0, size: 12, total: 1, hasMore: false },
    };
    const { calls } = loggedAs(undefined, {
      "GET /api/tipos-look": [], "GET /api/me/mirror/wardrobe?slot=upper": { pieces: [TEE] }, "GET /api/me/mirror/wardrobe?slot=outer_layer": { pieces: [] },
      "GET /api/catalog/products": (url: URL) => pages[`${url.searchParams.get("page")}:${url.searchParams.get("q") ?? ""}`],
      "POST /api/me/mirror/catalog": () => state({ upper: STORE_SHIRT }),
    });
    renderApp(<Harness initial={EMPTY} />);
    fireEvent.click(cell(/^Parte de cima:/));
    const sheet = within(await screen.findByRole("dialog", { name: "Parte de cima" }));
    const origin = within(sheet.getByRole("radiogroup", { name: "Origem das peças" }));
    expect(origin.getByRole("radio", { name: "Meu closet" }).getAttribute("aria-checked")).toBe("true");
    expect(await sheet.findByTestId("mirror-wardrobe-picker")).toBeTruthy();                     // o closet de antes continua
    fireEvent.click(origin.getByRole("radio", { name: "Catálogo de marcas" }));
    const picker = within(await sheet.findByTestId("mirror-catalog-picker"));
    await picker.findByRole("button", { name: "Vestir Camisa Oxford em Parte de cima" });
    const browse = () => calls.filter((c) => c.path.startsWith("/api/catalog/products"));
    expect(browse()[0].path).toBe("/api/catalog/products?category=upper_piece&page=0&size=12");
    expect(picker.getByText("3 peças no catálogo")).toBeTruthy();
    expect(picker.getByText("Marca Y")).toBeTruthy();
    fireEvent.click(picker.getByRole("button", { name: "Carregar mais" }));
    await picker.findByRole("button", { name: "Vestir Polo piquet em Parte de cima" });
    expect(browse()[1].path).toBe("/api/catalog/products?category=upper_piece&page=1&size=12");
    expect(picker.getAllByRole("button", { name: /^Vestir Camiseta básica/ })).toHaveLength(1);    // sem repetir produto
    expect(picker.queryByRole("button", { name: "Carregar mais" })).toBeNull();
    fireEvent.change(picker.getByRole("searchbox", { name: "Buscar Parte de cima no catálogo de marcas" }), { target: { value: "nike" } });
    await picker.findByRole("button", { name: "Vestir Camiseta Nike em Parte de cima" });
    expect(browse().at(-1)?.path).toBe("/api/catalog/products?category=upper_piece&q=nike&page=0&size=12");
    expect(picker.queryByRole("button", { name: /Camisa Oxford/ })).toBeNull();
    fireEvent.change(picker.getByRole("searchbox"), { target: { value: "" } });
    fireEvent.click(await picker.findByRole("button", { name: "Vestir Camisa Oxford em Parte de cima" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.path === "/api/me/mirror/catalog")?.body).toEqual({ productId: "p1" }));
    // vestido: a folha mostra a peça da loja e o produto fica marcado no catálogo
    const row = (await sheet.findByText("Camisa Oxford", { selector: ".piece-row-link" })).closest("li")!;
    expect(within(row).getByText("Loja")).toBeTruthy();
    await waitFor(() => expect((picker.getByRole("button", { name: "Vestir Camisa Oxford em Parte de cima" }) as HTMLButtonElement).disabled).toBe(true));
  });

  it("peça da loja vestida: Loja na grade, tirar pelo catálogo, Provador com o produto, sem Manter; salvar e editor só com as da pessoa", async () => {
    const { calls } = loggedAs(undefined, {
      "GET /api/tipos-look": [], "GET /api/me/mirror/wardrobe": { pieces: [] },
      "DELETE /api/me/mirror/catalog/p1": state({ lower: JEANS }),
      "DELETE /api/me/mirror": EMPTY, "POST /api/me/mirror/catalog": state({ upper: STORE_SHIRT }), "POST /api/me/mirror/pieces": state({}),
    });
    renderApp(<Harness initial={state({ upper: STORE_SHIRT, lower: JEANS, shoes: { ...TEE, id: "t", name: "Tênis", slot: "shoes", category: "shoes_piece" } })} />);
    const top = cell(/^Parte de cima: Camisa Oxford/);
    expect(within(top).getByText("Loja")).toBeTruthy();
    expect(screen.getByRole("note").textContent).toMatch(/Peças da loja entram só na prova/);
    expect(screen.getByRole("link", { name: /Provar o look no Provador/ }).getAttribute("href")).toBe("/try-on?provar=c.p1.v1,w.b,w.t");
    expect(screen.getByRole("link", { name: "Abrir no editor" }).getAttribute("href")).toBe("/schemes/new?pieces=b,t");
    expect((screen.getByRole("button", { name: "Salvar look" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(top);
    const sheet = within(await screen.findByRole("dialog", { name: "Parte de cima" }));
    const row = sheet.getByText("Camisa Oxford", { selector: ".piece-row-link" }).closest("li")!;
    expect(within(row).getByRole("link", { name: "Camisa Oxford" }).getAttribute("href")).toBe("https://loja.example/p/oxford");
    expect(within(row).getByText("Marca X")).toBeTruthy();
    expect(within(row).queryByRole("button", { name: "Manter" })).toBeNull();
    fireEvent.click(within(row).getByRole("button", { name: /Mais ações/ }));
    expect((await screen.findByRole("menuitem", { name: "Provar no provador" })).getAttribute("href")).toBe("/try-on?provar=c.p1.v1");
    expect(screen.queryByRole("menuitem", { name: "Tirar da lista do espelho" })).toBeNull();
    fireEvent.click(within(row).getByRole("button", { name: "Tirar Camisa Oxford" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/me/mirror/catalog/p1")).toBe(true));
    expect(calls.some((c) => c.path.startsWith("/api/me/mirror/pieces"))).toBe(false);
  });

  it("limpar e desfazer veste de novo cada peça pela origem dela; sem peça no closet, o atalho para o catálogo", async () => {
    const { calls } = loggedAs(undefined, {
      "GET /api/tipos-look": [], "GET /api/me/mirror/wardrobe": { pieces: [], message: "Você não tem peça disponível para esse lugar.", href: "/pieces/new" },
      "GET /api/catalog/products": { items: [], page: 0, size: 12, total: 0, hasMore: false },
      "DELETE /api/me/mirror": EMPTY, "POST /api/me/mirror/catalog": state({ upper: STORE_SHIRT }), "POST /api/me/mirror/pieces": state({ upper: STORE_SHIRT, lower: JEANS }),
    });
    renderApp(<Harness initial={state({ upper: STORE_SHIRT, lower: JEANS })} />);
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "POST").map((c) => [c.path, c.body])).toEqual([
      ["/api/me/mirror/catalog", { productId: "p1" }], ["/api/me/mirror/pieces", { pieceId: "b" }],
    ]));
    fireEvent.click(cell(/^Calçado:/));
    const sheet = within(await screen.findByRole("dialog", { name: "Calçado" }));
    fireEvent.click(await sheet.findByRole("button", { name: "Ver no catálogo de marcas" }));
    expect(within(sheet.getByRole("radiogroup", { name: "Origem das peças" })).getByRole("radio", { name: "Catálogo de marcas" }).getAttribute("aria-checked")).toBe("true");
    expect(await sheet.findByText("Nada no catálogo de marcas para esta parte com essa busca.")).toBeTruthy();
    expect(calls.find((c) => c.path.startsWith("/api/catalog/products"))?.path).toBe("/api/catalog/products?category=shoes_piece&page=0&size=12");
  });

  it("no 3D a peça da loja leva produto, variante e foto (a textura sai da rota do catálogo, como no provador)", () => {
    expect(mirrorLook3d(STORE_SHIRT, "upper")).toMatchObject({ id: "c:p1", slot: "upper", catalogProductId: "p1", catalogVariantId: "v1", catalogImageId: "i1" });
    expect(mirrorLook3d(TEE, "upper")).toMatchObject({ id: "a", catalogProductId: null, catalogVariantId: null, catalogImageId: null });
  });
});
