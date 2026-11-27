import { describe, expect, it } from "vitest";
import { cartasUsaveis } from "@/lib/flair/recursos/uso";

const CARTAS = [{ id: "casaco" }, { id: "calca" }, { id: "guardada" }];

describe("cartas que dá para usar como recurso", () => {
  it("nos jogos de deck, todas as do deck", () => {
    expect(cartasUsaveis(CARTAS)).toEqual(CARTAS);
  });

  it("nos jogos sem deck (Road to Glory), só as vestidas na partida, como o servidor confere", () => {
    expect(cartasUsaveis(CARTAS, { SUP: "casaco", INF: "calca" }).map((c) => c.id)).toEqual(["casaco", "calca"]);
    expect(cartasUsaveis(CARTAS, {})).toEqual([]);
  });
});
