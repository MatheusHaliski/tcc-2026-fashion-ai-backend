import { describe, expect, it } from "vitest";
import { gradeDoQuebraCabeca } from "@/lib/flair/elencos/board";

/** Grade das cenas dinâmicas (usada pelos desafios de montagem). */
describe("grade do quebra-cabeça das cenas", () => {
  it("colunas pela proporção 16:10 e fileiras para caber todas as peças", () => {
    expect(gradeDoQuebraCabeca(5)).toEqual({ colunas: 3, fileiras: 2 });
    expect(gradeDoQuebraCabeca(17)).toEqual({ colunas: 5, fileiras: 4 });
  });
});
