import { describe, expect, it } from "vitest";
import { NEUTRAL_ENVIRONMENT, environmentFor } from "@/lib/tryon/fitting-room";
import { resolveScene, type SceneProduct } from "@/lib/scene3d/scene";
import { SCALE_RANGES, inventoryOf, planStore, storeProfileFor, type FixtureFunction } from "@/lib/scene3d/store-plan";

/** Loja do provador: cada objeto tem função, fotos só em suportes, nada de outra marca, escala plausível. */
const FUNCTIONS: FixtureFunction[] = ["exposicao", "organizacao", "circulacao", "prova", "comunicacao", "iluminacao"];
const P = (id: string, category: string, subcategory: string): SceneProduct => ({ id, name: id, category, subcategory, imageUrl: `/x/${id}.webp` });
const SHOES = [P("s1", "shoes_piece", "casual_sneakers"), P("s2", "shoes_piece", "running_shoes"), P("s3", "shoes_piece", "skate_shoes")];
const TOPS = [P("t1", "upper_piece", "t_shirt"), P("t2", "upper_piece", "shirt")];
const norte = environmentFor({ name: "Norte Sport" }), lumi = environmentFor({ name: "Atelier Lumi" });

describe("plano da loja do provador", () => {
  it("todo objeto declara uma função comercial e a altura está na faixa plausível do tipo", () => {
    for (const plan of [
      planStore(norte, [lumi], null),
      planStore(norte, [], resolveScene({ brand: { name: "Norte Sport" }, category: "shoes_piece", product: SHOES[0], results: SHOES })),
      planStore(NEUTRAL_ENVIRONMENT, [norte, lumi], resolveScene({ category: "upper_piece", results: TOPS })),
    ]) {
      for (const o of inventoryOf(plan)) {
        expect(FUNCTIONS).toContain(o.fn);
        const range = SCALE_RANGES[o.kind];
        if (range) { expect(o.heightM, `${o.kind} ${o.heightM}`).toBeGreaterThanOrEqual(range[0]); expect(o.heightM).toBeLessThanOrEqual(range[1]); }
      }
    }
  });

  it("loja de marca não tem logo, painel ou produto de outra marca; o provador neutro mostra as marcas vestidas", () => {
    const brand = planStore(norte, [lumi], null);
    expect(brand.fixtures.every((f) => f.brandKey === null || f.brandKey === norte.key)).toBe(true);
    expect(brand.fixtures.some((f) => f.kind === "paineis-multimarca")).toBe(false);
    const neutral = planStore(NEUTRAL_ENVIRONMENT, [norte, lumi], null);
    expect(neutral.fixtures.find((f) => f.kind === "paineis-multimarca")?.brands?.map((b) => b.key)).toEqual([norte.key, lumi.key]);
  });

  it("trocar de loja troca todos os objetos da marca (ids novos, nenhum resto da anterior)", () => {
    const a = planStore(norte, [], null), b = planStore(lumi, [], null);
    const branded = (p: typeof a) => p.fixtures.filter((f) => f.brandKey).map((f) => f.id);
    expect(branded(a).some((id) => branded(b).includes(id))).toBe(false);
    expect(b.fixtures.some((f) => f.brandKey === norte.key)).toBe(false);
  });

  it("foto de catálogo só em suporte: zona com fotos em prateleira/quadros/mesa/nicho e o produto escolhido no cavalete", () => {
    const shoes = planStore(norte, [], resolveScene({ brand: { name: "Norte Sport" }, category: "shoes_piece", product: SHOES[0], results: SHOES }));
    expect(shoes.fixtures.find((f) => f.kind === "prateleiras-calcados")?.products?.map((p) => p.id)).toEqual(["s2", "s3"]);
    expect(shoes.fixtures.find((f) => f.kind === "foto-em-destaque")?.products?.[0].id).toBe("s1");
    // nenhum objeto da loja é "produto 3D": sem asset 3D aprovado, só fotografias em suportes
    expect(storeProfileFor(norte).approvedAssets).toEqual([]);
    const tops = planStore(NEUTRAL_ENVIRONMENT, [], resolveScene({ category: "upper_piece", results: TOPS }));
    expect(tops.fixtures.find((f) => f.kind === "quadros-da-zona")?.products).toHaveLength(2);
    // sem zona, nada de arara com "roupas" falsas: só prova, circulação e comunicação
    expect(planStore(norte, [], null).fixtures.some((f) => f.fn === "exposicao")).toBe(false);
  });

  it("sem referência oficial registrada, o perfil é conceitual (não se apresenta como reprodução da loja)", () => {
    expect(storeProfileFor(norte)).toMatchObject({ fidelity: "conceptual", references: [] });
    expect(storeProfileFor(environmentFor({ name: "Nike" })).fidelity).toBe("conceptual");
  });
});
