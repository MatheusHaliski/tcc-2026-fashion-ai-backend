import { describe, expect, it } from "vitest";
import { keepAllowed, missingTags, sameTags } from "./tags";

const STYLES = ["classic", "basic", "sporty", "streetwear"];
const LOWER_OCCASIONS = ["casual", "work", "business", "formal", "sport"];

describe("ocasião e estilo da peça (RF4)", () => {
  it("descarta o código que não é estilo — o pré-preenchimento antigo mandava 'casual' e o cadastro falhava", () => {
    expect(keepAllowed(["casual"], STYLES)).toEqual([]);
    expect(keepAllowed(["casual", "basic"], STYLES)).toEqual(["basic"]);
  });

  it("normaliza, tira repetidos e respeita o máximo de 2", () => {
    expect(keepAllowed([" Classic ", "classic", "SPORTY", "basic"], STYLES)).toEqual(["classic", "sporty"]);
  });

  it("ao trocar de categoria, mantém só as ocasiões que a nova categoria permite", () => {
    expect(keepAllowed(["beach", "work"], LOWER_OCCASIONS)).toEqual(["work"]);
  });

  it("sem taxonomia carregada, não apaga o que já foi escolhido", () => {
    expect(keepAllowed(["casual"], undefined)).toEqual(["casual"]);
  });

  it("aponta o que falta antes de ir ao servidor", () => {
    expect(missingTags({ occasion: [], style: ["basic"] })).toEqual(["occasion"]);
    expect(missingTags({ occasion: ["casual"], style: ["basic"] })).toEqual([]);
    expect(sameTags(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameTags(["a"], ["b"])).toBe(false);
  });
});
