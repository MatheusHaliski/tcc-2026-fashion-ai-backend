import { describe, expect, it } from "vitest";
import { NEUTRAL_ENVIRONMENT, brandKey, decodeTryOn, encodeTryOn, environmentFor, resolveEnvironment, slotOf, visibleItems, wearItem, wearOf, type FittingItem } from "@/lib/tryon/fitting-room";

let t = 0;
const item = (over: Partial<FittingItem>): FittingItem => ({
  key: `c:${over.productId ?? "p"}`, source: "catalog", slot: "upper_piece", wear: "TOP", name: "Peça", brand: { name: "Nike", slug: "nike" },
  category: "upper_piece", productId: "p", addedAt: ++t, ...over,
});

describe("provador virtual: peças e lugares", () => {
  it("forma de vestir e lugar seguem a categoria (como no backend)", () => {
    expect(wearOf("upper_piece", "jacket")).toBe("OUTERWEAR");
    expect(wearOf("upper_piece", "t_shirt")).toBe("TOP");
    expect(wearOf("full_body_piece")).toBe("FULL_BODY");
    expect(slotOf("full_body_piece")).toBe("upper_piece");
    expect(slotOf("accessory_piece")).toBe("accessory_piece");
  });

  it("vestir troca só o lugar da peça; a peça inteira esconde a parte de baixo", () => {
    let items = wearItem([], item({ productId: "a", slot: "lower_piece", wear: "BOTTOM", category: "lower_piece" }));
    items = wearItem(items, item({ productId: "b" }));
    items = wearItem(items, item({ productId: "c" }));
    expect(items.map((i) => i.productId)).toEqual(["a", "c"]);
    items = wearItem(items, item({ productId: "d", wear: "FULL_BODY", category: "full_body_piece" }));
    expect(visibleItems(items).map((i) => i.productId)).toEqual(["d"]);
  });
});

describe("provador virtual: motor de ambiente", () => {
  it("sem marca ou modo neutro: ambiente FashionAI", () => {
    expect(resolveEnvironment([]).featured).toBe(NEUTRAL_ENVIRONMENT);
    expect(resolveEnvironment([item({})], "neutral").kind).toBe("neutral");
  });

  it("a marca da última peça escolhida é o destaque; as outras viram painéis", () => {
    const items = [
      item({ productId: "a", brand: { name: "Levi's", slug: "levis" }, slot: "lower_piece" }),
      item({ productId: "b", brand: { name: "Nike", slug: "nike" }, slot: "shoes_piece" }),
    ];
    const env = resolveEnvironment(items);
    expect(env.kind).toBe("multibrand");
    expect(env.featured.key).toBe("nike");
    expect(env.featured.accent).toBe("#F26A1B");
    expect(env.others.map((o) => o.key)).toEqual(["levis"]);
  });

  it("fixar uma marca mantém o destaque nela", () => {
    const items = [item({ productId: "a", brand: { name: "Vans" }, slot: "shoes_piece" }), item({ productId: "b", brand: { name: "Zara" } })];
    expect(resolveEnvironment(items, { pinned: "vans" }).featured.key).toBe("vans");
  });

  it("marca sem tema escolhido ganha um ambiente estável derivado do nome", () => {
    const a = environmentFor({ name: "Osklen" }); const b = environmentFor({ name: "Osklen" });
    expect(a).toEqual(b);
    expect(a.curated).toBe(false);
    expect(a.accent).toMatch(/^#[0-9a-f]{6}$/);
    expect(brandKey("Levi's")).toBe("levis");
    expect(brandKey("New Balance")).toBe("new-balance");
  });

  it("toda marca não curada tem estilo e motivo definidos (hash ≥ 2³¹ não vira índice negativo)", () => {
    const names = ["Costa Linho", "Norte Sport", "Atelier Lumi", "Rio Aurora", "Osklen", "Farm", ...Array.from({ length: 200 }, (_, i) => `Marca ${i}`)];
    for (const name of names) {
      const env = environmentFor({ name });
      expect(env.style, name).toBeTruthy(); expect(env.motif, name).toBeTruthy();
    }
  });
});

describe("provador virtual: link da prova", () => {
  it("codifica e decodifica lojas e guarda-roupa, ignorando lixo", () => {
    const items = [item({ productId: "p1", variantId: "v2" }), { ...item({}), source: "wardrobe" as const, pieceId: "w9", productId: undefined }];
    const raw = encodeTryOn(items);
    expect(raw).toBe("c.p1.v2,w.w9");
    expect(decodeTryOn(raw)).toEqual([{ source: "catalog", id: "p1", variantId: "v2" }, { source: "wardrobe", id: "w9", variantId: null }]);
    expect(decodeTryOn("x.1,c.<script>,c.ok.-")).toEqual([{ source: "catalog", id: "ok", variantId: null }]);
  });
});
