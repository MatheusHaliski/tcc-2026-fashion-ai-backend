import { describe, expect, it } from "vitest";
import { maquiagemNoRosto } from "@/lib/flair/make-up/rosto-maquiado";

describe("maquiagem no rosto 3D", () => {
  it("traduz a família de cada área na cor da paleta; sem escolha, nada a pintar", () => {
    const m = maquiagemNoRosto({ LABIOS: { familia: "CORAL", acabamento: "GLOSS" }, OLHOS: { familia: "DOURADO" } });
    expect(m).toEqual({ labios: "#F27A5E", bochechas: undefined, olhos: "#C9A23A", acabamento: "GLOSS" });
    expect(maquiagemNoRosto({})).toBeNull();
    expect(maquiagemNoRosto(undefined)).toBeNull();
    expect(maquiagemNoRosto({ LABIOS: { familia: "INEXISTENTE" } })).toBeNull();
  });
});
