import { describe, expect, it } from "vitest";
import { triangulosDaTorcida } from "@/components/flair/nucleos/gente/torcida-3d";
import { TRIANGULOS_POR_PESSOA } from "@/lib/flair/nucleos/gente/detalhe";

describe("pessoa leve da torcida", () => {
  it("tem os triângulos que o orçamento conta", () => {
    expect(triangulosDaTorcida()).toBe(TRIANGULOS_POR_PESSOA.torcida);
  });
});
