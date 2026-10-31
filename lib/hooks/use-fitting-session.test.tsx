// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";
import { catalogApi, type CatalogProduct } from "@/lib/api/catalog";
import type { FittingItem } from "@/lib/tryon/fitting-room";
import type { State } from "@/lib/tryon/fitting-room-model";
import { useFittingSession } from "./use-fitting-session";

/**
 * Caracterização (R60b) dos casos de uso da sessão do provador: restauração (sessão, link compartilhado, esquema),
 * vestir com "meu tamanho", remover, trocar variante/tamanho e guardar a peça da loja no guarda-roupa.
 */
const toast = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn(), fromError: vi.fn() }));
vi.mock("@/components/ui", () => ({ useToast: () => toast }));
vi.mock("@/lib/i18n/i18n", () => ({ useI18n: () => ({ t: (key: string, vars?: Record<string, unknown>) => (vars ? `${key} ${JSON.stringify(vars)}` : key) }) }));

const entry = (id: string, name: string, category: string, subcategory: string, slot: string, wear: string) => ({
  slot, wear, piece: { id, name, category, subcategory, color: "white", imageUrl: `/media/${id}.png` },
});
const STATE = { pieces: {
  upper_piece: [entry("coat", "Casaco", "upper_piece", "coat", "upper_piece", "OUTERWEAR")],
  lower_piece: [entry("jeans", "Jeans", "lower_piece", "jeans", "lower_piece", "BOTTOM")],
  shoes_piece: [], accessory_piece: [],
} } as unknown as State;
const product = (id: string, category: string, subcategory: string, extra: Partial<CatalogProduct> = {}) => ({
  id, productName: `Produto ${id}`, category, subcategory, color: "white", brand: { id: "b", name: "Marca", slug: "marca" },
  variants: [{ id: `${id}-w`, key: "white", color: "white" }, { id: `${id}-k`, key: "black", color: "black" }], ...extra,
} as unknown as CatalogProduct);
const params = (query = "") => new URLSearchParams(query) as unknown as ReadonlyURLSearchParams;
function setup(query = "", data: State | null = STATE) {
  const onStatus = vi.fn(), onOwned = vi.fn(), searchParams = params(query);   // estável, como o useSearchParams
  const hook = renderHook((props: { data: State | null }) => useFittingSession({ data: props.data, searchParams, onStatus, onOwned }), { initialProps: { data } });
  return { hook, onStatus, onOwned };
}
const keys = (items: FittingItem[]) => items.map((item) => item.key);
const persisted = () => JSON.parse(sessionStorage.getItem("fai.tryon.fitting") ?? "[]") as FittingItem[];

afterEach(() => { cleanup(); vi.restoreAllMocks(); Object.values(toast).forEach((fn) => fn.mockReset()); sessionStorage.clear(); localStorage.clear(); });

describe("restauração", () => {
  it("espera o estado do provador e então restaura a sessão do navegador uma única vez", async () => {
    sessionStorage.setItem("fai.tryon.fitting", JSON.stringify([{ key: "w:old", source: "wardrobe", slot: "upper_piece", wear: "TOP", name: "Antiga", category: "upper_piece", subcategory: "t_shirt", addedAt: 1 }]));
    const { hook } = setup("", null);
    expect(hook.result.current.items).toEqual([]);
    hook.rerender({ data: STATE });
    await waitFor(() => expect(keys(hook.result.current.items)).toEqual(["w:old"]));
    sessionStorage.clear();
    hook.rerender({ data: { ...STATE } });
    expect(keys(hook.result.current.items)).toEqual(["w:old"]);
  });

  it("link compartilhado vence a sessão: guarda-roupa + catálogo com variante; referência indisponível é ignorada", async () => {
    sessionStorage.setItem("fai.tryon.fitting", JSON.stringify([{ key: "w:old", source: "wardrobe", slot: "upper_piece", wear: "TOP", name: "Antiga", category: "upper_piece", subcategory: "t_shirt", addedAt: 1 }]));
    const shoes = product("p1", "shoes_piece", "casual_sneakers");
    const load = vi.spyOn(catalogApi, "product").mockImplementation(async (id) => { if (id === "p1") return shoes; throw new ApiError(404, "NAO_ENCONTRADO", "x"); });
    const { hook } = setup("provar=c.p1.p1-k,w.coat,c.gone.-,w.not-owned");
    await waitFor(() => expect(keys(hook.result.current.items)).toEqual(["c:p1", "w:coat"]));
    expect(hook.result.current.items[0].variantId).toBe("p1-k");
    expect(hook.result.current.products).toEqual({ p1: shoes });
    expect(keys(persisted())).toEqual(["c:p1", "w:coat"]);
    expect(load.mock.calls.map(([id]) => id)).toEqual(["p1", "gone"]);
  });

  it("esquema: veste só as peças que ainda estão no guarda-roupa, na ordem do esquema, e persiste", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ scheme: { items: [{ wardrobeItemId: "jeans" }, { wardrobeItemId: "deleted" }, { wardrobeItemId: "coat" }] } });
    const { hook } = setup("scheme=s1");
    await waitFor(() => expect(keys(hook.result.current.items)).toEqual(["w:jeans", "w:coat"]));
    expect(get.mock.calls).toEqual([["/api/schemes/s1"]]);
    expect(keys(persisted())).toEqual(["w:jeans", "w:coat"]);
  });

  it("esquema que falha não altera a prova", async () => {
    vi.spyOn(api, "get").mockRejectedValue(new ApiError(404, "NAO_ENCONTRADO", "x"));
    const { hook } = setup("scheme=s404");
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.items).toEqual([]);
  });
});

describe("casos de uso", () => {
  it("nomes dos lugares vêm do i18n", () => {
    expect(setup().hook.result.current.slotNames).toEqual({ upper_piece: "tryOn.slot_upper", lower_piece: "tryOn.slot_lower", shoes_piece: "tryOn.slot_shoes", accessory_piece: "tryOn.slot_accessory" });
  });

  it("escolher produto: veste a variante (ou a selecionada), lembra o produto e aplica meu tamanho da grade", async () => {
    localStorage.setItem("fai.tryon.sizes", JSON.stringify({ numeric: "44" }));
    const { hook, onStatus } = setup();
    const jeans = product("p2", "lower_piece", "jeans", { selectedVariant: { id: "p2-k", key: "black", color: "black" } as CatalogProduct["selectedVariant"] });
    act(() => hook.result.current.pickProduct(jeans, null));
    const worn = hook.result.current.items[0];
    expect(worn).toMatchObject({ key: "c:p2", variantId: "p2-k", size: "44" });
    expect(hook.result.current.products.p2).toBe(jeans);
    expect(onStatus).toHaveBeenLastCalledWith(`tryOn.provando_status ${JSON.stringify({ name: "Produto p2", slot: "tryOn.slot_lower", marca: "Marca" })}`);
    expect(persisted()[0]).toMatchObject({ key: "c:p2", size: "44" });
  });

  it("vestir peça que já tem tamanho conserva o tamanho dela; sem tamanho, recebe o da grade", () => {
    localStorage.setItem("fai.tryon.sizes", JSON.stringify({ letter: "G" }));
    const { hook } = setup();
    const base = { key: "c:p5", source: "catalog", slot: "upper_piece", wear: "TOP", name: "Camisa", category: "upper_piece", subcategory: "t_shirt", productId: "p5", addedAt: 1 } as FittingItem;
    act(() => hook.result.current.tryOn({ ...base, size: "PP" }));
    expect(hook.result.current.items[0].size).toBe("PP");
    act(() => hook.result.current.tryOn({ ...base, key: "c:p6", productId: "p6", wear: "OUTERWEAR" }));
    expect(hook.result.current.items.find((item) => item.key === "c:p6")?.size).toBe("G");
  });

  it("produto sem lugar no provador: avisa e não veste", () => {
    const { hook } = setup();
    act(() => hook.result.current.pickProduct(product("x", "unclassified", "thing"), null));
    expect(toast.info).toHaveBeenCalledWith("tryOn.category_review");
    expect(hook.result.current.items).toEqual([]);
  });

  it("trocar tamanho grava a preferência da grade; trocar variante conserva tamanho e ordem; remover esvazia o lugar", () => {
    const { hook, onStatus } = setup();
    act(() => hook.result.current.pickProduct(product("p3", "upper_piece", "t_shirt"), null));
    const first = hook.result.current.items[0];
    act(() => hook.result.current.changeSize(first, "G"));
    expect(hook.result.current.items[0].size).toBe("G");
    expect(JSON.parse(localStorage.getItem("fai.tryon.sizes") ?? "{}")).toEqual({ letter: "G" });
    expect(onStatus).toHaveBeenLastCalledWith(`size.vestindo_status ${JSON.stringify({ name: "Produto p3", size: "G" })}`);
    act(() => hook.result.current.changeVariant(hook.result.current.items[0], { id: "p3-k", key: "black", color: "black" } as never));
    expect(hook.result.current.items[0]).toMatchObject({ key: "c:p3", variantId: "p3-k", size: "G", addedAt: first.addedAt });
    act(() => hook.result.current.changeVariant({ ...first, productId: "unknown" }, { id: "z", key: "z" } as never));
    expect(hook.result.current.items[0].variantId).toBe("p3-k");
    act(() => hook.result.current.remove("upper_piece"));
    expect(hook.result.current.items).toEqual([]);
    expect(onStatus).toHaveBeenLastCalledWith(`tryOn.lugar_vazio_status ${JSON.stringify({ slot: "tryOn.slot_upper" })}`);
  });
});

describe("guardar no guarda-roupa", () => {
  const catalogItem = { key: "c:p1", source: "catalog", slot: "shoes_piece", wear: "SHOES", name: "Tênis", category: "shoes_piece", subcategory: "casual_sneakers", productId: "p1", variantId: "p1-k", addedAt: 1 } as FittingItem;

  it("sucesso: devolve o id, marca a peça como guardada, avisa e recarrega", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ id: "piece-9" });
    const { hook, onOwned } = setup();
    let result: string | false = false;
    await act(async () => { result = await hook.result.current.ownIt(catalogItem); });
    expect(result).toBe("piece-9");
    expect(post).toHaveBeenCalledWith("/api/pieces/from-catalog", { productId: "p1", variantId: "p1-k", visibility: "PRIVATE" });
    expect(hook.result.current.owned).toEqual({ "c:p1": "piece-9" });
    expect(hook.result.current.busyOwn).toBeNull();
    expect(toast.success).toHaveBeenCalledWith(`tryOn.adicionada_ao_guarda_roupa ${JSON.stringify({ name: "Tênis" })}`);
    expect(onOwned).toHaveBeenCalledTimes(1);
  });

  it("formulário recusado: mostra os motivos do servidor; outro erro vai para o aviso padrão", async () => {
    vi.spyOn(api, "post").mockRejectedValueOnce(new ApiError(422, "FORMULARIO_INVALIDO", "x", { fields: { variantId: "Variante esgotada", size: "Sem estoque", n: 3 } }))
      .mockRejectedValueOnce(new ApiError(500, "ERRO", "y"));
    const { hook, onOwned } = setup();
    let first: string | false = "x", second: string | false = "x";
    await act(async () => { first = await hook.result.current.ownIt(catalogItem); });
    expect(first).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(`tryOn.nao_deu_para_guardar ${JSON.stringify({ name: "Tênis", reason: "Variante esgotada · Sem estoque" })}`);
    await act(async () => { second = await hook.result.current.ownIt(catalogItem); });
    expect(second).toBe(false);
    expect(toast.fromError).toHaveBeenCalledWith(expect.objectContaining({ code: "ERRO" }));
    expect(hook.result.current.owned).toEqual({});
    expect(hook.result.current.busyOwn).toBeNull();
    expect(onOwned).not.toHaveBeenCalled();
  });

  it("sem produto da loja ou com outra inclusão em andamento: não chama a API", async () => {
    let finish!: (value: unknown) => void;
    const post = vi.spyOn(api, "post").mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const { hook } = setup();
    expect(await hook.result.current.ownIt({ ...catalogItem, productId: undefined })).toBe(false);
    let pending!: Promise<string | false>;
    act(() => { pending = hook.result.current.ownIt(catalogItem); });
    expect(hook.result.current.busyOwn).toBe("c:p1");
    expect(await hook.result.current.ownIt({ ...catalogItem, key: "c:p2", productId: "p2" })).toBe(false);
    await act(async () => { finish({ id: "piece-1" }); await pending; });
    expect(post).toHaveBeenCalledTimes(1);
    expect(hook.result.current.busyOwn).toBeNull();
  });
});
