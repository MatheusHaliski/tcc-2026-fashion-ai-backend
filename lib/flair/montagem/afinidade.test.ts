import { describe, expect, it } from "vitest";
import type { FlairCollectionCard } from "@/components/flair/flair-game-card";
import { emComum, emComumComVizinhas } from "./afinidade";

const carta = (id: string, extra: Record<string, unknown> = {}) => ({ id, ...extra }) as unknown as FlairCollectionCard;

describe("FLAIR — o que duas cartas têm em comum na bandeja", () => {
  it("compara marca, subcategoria e categoria sem diferenciar maiúsculas nem espaços", () => {
    const a = carta("a", { brandName: " Nike ", subcategory: "t_shirt", category: "upper_piece" });
    const b = carta("b", { brandName: "nike", subcategory: "T_SHIRT", category: "upper_piece" });
    expect(emComum(a, b)).toEqual(["MARCA", "SUBCATEGORIA", "CATEGORIA"]);
  });

  it("estilo, cor e ocasião contam quando as listas se cruzam em algum item", () => {
    const a = carta("a", { tags: { styles: ["street", "basic"], colors: ["Preto"], occasions: ["festa"] } });
    const b = carta("b", { tags: { styles: ["classic", "Basic"], colors: ["branco"], occasions: ["festa", "casual"] } });
    expect(emComum(a, b)).toEqual(["ESTILO", "OCASIAO"]);
  });

  it("valor ausente ou vazio nunca conta como igual", () => {
    const a = carta("a", { brandName: null, subcategory: "", tags: { styles: [] } });
    const b = carta("b", { brandName: null, subcategory: "", tags: { styles: [] } });
    expect(emComum(a, b)).toEqual([]);
    expect(emComum(carta("a"), carta("b"))).toEqual([]);
  });

  it("com as vizinhas: junta os atributos sem repetir e na ordem fixa", () => {
    const meio = carta("m", { brandName: "Nike", category: "upper_piece", tags: { colors: ["azul"] } });
    const vizinhas = [
      carta("v1", { tags: { colors: ["azul"] } }),
      carta("v2", { brandName: "nike", category: "upper_piece" }),
      carta("v3", { category: "upper_piece" }),
    ];
    expect(emComumComVizinhas(meio, vizinhas)).toEqual(["MARCA", "CATEGORIA", "COR"]);
  });

  it("a própria carta na lista de vizinhas é ignorada", () => {
    const meio = carta("m", { brandName: "Nike" });
    expect(emComumComVizinhas(meio, [meio])).toEqual([]);
    expect(emComumComVizinhas(meio, [])).toEqual([]);
  });
});
