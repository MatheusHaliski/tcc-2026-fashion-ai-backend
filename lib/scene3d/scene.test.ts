import { describe, expect, it } from "vitest";
import { MAX_DISPLAY, resolveArtistStage, resolveScene, zoneFor, type SceneProduct } from "./scene";
import { NEUTRAL_ENVIRONMENT, type FittingItem } from "@/lib/tryon/fitting-room";

const p = (id: string, category: string, subcategory: string, brand?: string): SceneProduct => ({ id, name: id, category, subcategory, brand: brand ? { name: brand } : null });
const worn = (brand: string): FittingItem => ({ key: brand, source: "catalog", slot: "upper_piece", wear: "TOP", name: brand, brand: { name: brand }, category: "upper_piece", addedAt: 1 });

describe("zonas da loja pela categoria e subcategoria (regras fixas)", () => {
  it("calçados viram parede de calçados, refinada pela subcategoria", () => {
    expect(zoneFor("shoes_piece", "casual_sneakers")).toMatchObject({ key: "sneakers", kind: "SHOE_WALL" });
    expect(zoneFor("shoes_piece", "ankle_boots")?.key).toBe("boots");
    expect(zoneFor("shoes_piece", "loafers")?.key).toBe("shoe_salon");
    expect(zoneFor("shoes_piece", "flip_flops")?.key).toBe("sandals");
    expect(zoneFor("shoes_piece", "algo_novo")?.key).toBe("shoes");
  });
  it("jeans vai para a mesa de denim; casacos e blusas para a arara; acessórios para a vitrine", () => {
    expect(zoneFor("lower_piece", "jeans")?.kind).toBe("DENIM_TABLE");
    expect(zoneFor("lower_piece", "skirt")).toMatchObject({ key: "bottoms", kind: "GARMENT_RACK" });
    expect(zoneFor("upper_piece", "parka")?.key).toBe("outerwear");
    expect(zoneFor("upper_piece", "t_shirt")?.key).toBe("tops");
    expect(zoneFor("accessory_piece", "tote_bag")).toMatchObject({ key: "bags", kind: "VITRINE" });
    expect(zoneFor("accessory_piece", "watch")?.key).toBe("jewelry");
    expect(zoneFor(null, null)).toBeNull();
  });
});

describe("cena pela Busca Catalogada", () => {
  it("busca vazia: a marca da última peça vestida (o provador de antes); nada vestido: loja neutra", () => {
    expect(resolveScene({}).kind).toBe("neutral");
    const s = resolveScene({ worn: [worn("Norte Sport")] });
    expect(s.kind).toBe("brand"); expect(s.brand.name).toBe("Norte Sport"); expect(s.zone).toBeNull();
  });
  it("marca na busca manda sobre o que está vestido; categoria abre a zona dentro da marca", () => {
    const s = resolveScene({ brand: { name: "Atelier Lumi" }, category: "shoes_piece", subcategory: "running_shoes", worn: [worn("Norte Sport")] });
    expect(s.kind).toBe("brand-zone"); expect(s.brand.name).toBe("Atelier Lumi"); expect(s.zone?.key).toBe("sneakers"); expect(s.others).toEqual([]);
  });
  it("categoria sem marca: zona multimarca, mesmo com outra marca vestida", () => {
    const s = resolveScene({ category: "lower_piece", subcategory: "jeans", worn: [worn("Norte Sport")] });
    expect(s.kind).toBe("zone"); expect(s.brand.key).toBe(NEUTRAL_ENVIRONMENT.key); expect(s.zone?.kind).toBe("DENIM_TABLE");
  });
  it("produto escolhido vira o hero, e os expositores mostram só os outros produtos da mesma zona", () => {
    const results = [p("a", "shoes_piece", "casual_sneakers"), p("b", "shoes_piece", "running_shoes"), p("c", "lower_piece", "jeans"), p("d", "shoes_piece", "ankle_boots")];
    const s = resolveScene({ brand: { name: "Norte Sport" }, category: "shoes_piece", product: results[0], results });
    expect(s.hero?.id).toBe("a");
    expect(s.display.map((x) => x.id)).toEqual(["b", "d"]);
  });
  it("sem categoria na busca, o produto escolhido decide a zona e a marca", () => {
    const s = resolveScene({ product: p("x", "accessory_piece", "crossbody_bag", "Atelier Lumi") });
    expect(s.zone?.key).toBe("bags"); expect(s.brand.name).toBe("Atelier Lumi");
  });
  it("no máximo MAX_DISPLAY produtos nos expositores", () => {
    const results = Array.from({ length: 40 }, (_, i) => p(`s${i}`, "shoes_piece", "casual_sneakers"));
    expect(resolveScene({ category: "shoes_piece", results }).display).toHaveLength(MAX_DISPLAY);
  });
});

describe("mini palco por regras a partir do perfil", () => {
  it("paleta das eras, cortina escurecida da cor principal, efeitos ligados por padrão e só cores válidas", () => {
    const st = resolveArtistStage({ name: "  Luma Vale ", era: "Era Neon", colors: ["#C6275E", "azul", "#2D55C9"] });
    expect(st.name).toBe("Luma Vale"); expect(st.palette).toEqual(["#C6275E", "#2D55C9", "#F2C94C"]);
    expect(st.curtain).toMatch(/^#[0-9a-f]{6}$/); expect(st.curtain).not.toBe("#C6275E");
    expect(st.effects).toEqual({ confetti: true, fireworks: true, haze: true, lightsticks: true });
  });
  it("o perfil pode desligar efeitos; no máximo 4 selos", () => {
    const st = resolveArtistStage({ name: "X", colors: [], effects: { fireworks: false }, seals: ["1", "2", "3", "4", "5"] });
    expect(st.effects.fireworks).toBe(false); expect(st.seals).toHaveLength(4);
  });
});
