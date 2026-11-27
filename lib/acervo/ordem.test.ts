import { describe, expect, it } from "vitest";
import { reordenar } from "./ordem";

describe("reordenar o diretório", () => {
  it("leva o item à posição pedida e devolve a lista inteira", () => {
    expect(reordenar(["a", "b", "c"], ["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"]);
    expect(reordenar(["a", "b", "c"], ["a", "b", "c"], "a", 2)).toEqual(["b", "c", "a"]);
    expect(reordenar(["a", "b", "c"], ["a", "b", "c"], "b", 0)).toEqual(["b", "a", "c"]);
  });

  it("os itens escondidos (móveis do outro modo) ficam onde estavam", () => {
    // m1 e m3 são de Meu espaço; d1 e d2, do Dream Space
    expect(reordenar(["m1", "d1", "m3", "d2"], ["m1", "m3"], "m3", 0)).toEqual(["m3", "d1", "m1", "d2"]);
    expect(reordenar(["m1", "d1", "m3", "d2"], ["d1", "d2"], "d1", 1)).toEqual(["m1", "d2", "m3", "d1"]);
  });

  it("nada muda quando a posição é a mesma, fica fora da lista ou o item não está visível", () => {
    expect(reordenar(["a", "b"], ["a", "b"], "a", 0)).toBeNull();
    expect(reordenar(["a", "b"], ["a", "b"], "a", -1)).toBeNull();
    expect(reordenar(["a", "b"], ["a", "b"], "b", 2)).toBeNull();
    expect(reordenar(["a", "b"], ["a"], "b", 0)).toBeNull();
  });
});
