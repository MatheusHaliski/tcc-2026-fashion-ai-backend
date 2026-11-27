import { describe, expect, it } from "vitest";
import { caixaChanfrada, fundirPorMaterial, geometriaDaParte, triangulosDe } from "@/components/flair/nucleos/scene/part-geometry";
import { NUCLEOS } from "@/lib/flair/nucleos/registry";
import { NUCLEO_CODIGOS } from "@/lib/flair/nucleos/types";
import { figurantesDaCena, orcamentoDaSala, partesDaSala } from "@/lib/flair/nucleos/scene/budget";
import { partesDoFigurante } from "@/lib/flair/nucleos/scene/figurantes";
import { caixa, chanfrada, cilindro, esfera, extrusao, plano, toro, triangulosDaParte } from "@/lib/flair/nucleos/scene/parts";
import { SALAS } from "@/lib/flair/nucleos/scene/registry";

/** A geometria gerada tem exatamente os triângulos que o orçamento conta na descrição pura. */
describe("geometria das partes", () => {
  it("cada forma gera os triângulos da conta", () => {
    const perfil: [number, number][] = [[0, 0], [1, 0], [1.2, 0.6], [0.5, 1], [-0.2, 0.5]];
    const partes = [
      caixa("m", [1, 2, 3], [0, 0, 0]),
      chanfrada("m", [1, 0.4, 0.6], [0, 0, 0]),
      plano("m", [2, 1], [0, 0, 0]),
      cilindro("m", 0.2, 1, [0, 0, 0]),
      cilindro("m", [0.1, 0.3], 1, [0, 0, 0], undefined, 3),
      esfera("m", 0.3, [0, 0, 0]),
      esfera("m", [0.3, 0.1, 0.2], [0, 0, 0], 20),
      toro("m", 1, 0.05, [0, 0, 0]),
      extrusao("m", perfil, 0.4, [0, 0, 0]),
    ];
    for (const p of partes) expect(triangulosDe(geometriaDaParte(p, 1)), p.forma).toBe(triangulosDaParte(p));
  });

  it("caixa chanfrada: 44 triângulos, fechada e com as faces para fora", () => {
    const g = caixaChanfrada(1, 0.5, 0.25);
    expect(triangulosDe(g)).toBe(44);
    g.computeBoundingBox();
    expect(g.boundingBox!.max.toArray()).toEqual([0.5, 0.25, 0.125]);
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const fora = pos.getX(i) * nor.getX(i) + pos.getY(i) * nor.getY(i) + pos.getZ(i) * nor.getZ(i);
      expect(fora).toBeGreaterThan(0);
    }
  });

  it("textura na escala real: a mesma repetição por metro em qualquer tamanho de face", () => {
    const grande = geometriaDaParte(plano("m", [8, 4], [0, 0, 0]), 2);
    const uv = grande.attributes.uv;
    const us = Array.from({ length: uv.count }, (_, i) => uv.getX(i));
    expect(Math.max(...us) - Math.min(...us)).toBeCloseTo(4, 5);
    const propria = geometriaDaParte(plano("m", [8, 4], [0, 0, 0]), 0);
    expect(Math.max(...Array.from({ length: 6 }, (_, i) => propria.attributes.uv.getX(i)))).toBe(1);
  });

  it("as 15 salas: triângulos gerados = triângulos do orçamento, uma geometria por material", () => {
    for (const codigo of NUCLEO_CODIGOS) {
      const sala = SALAS[codigo];
      const fundidas = fundirPorMaterial(partesDaSala(sala), sala.materiais);
      const figurantes = figurantesDaCena(sala, NUCLEOS[codigo].personagens);
      let total = sala.placar ? 2 : 0;
      for (const g of fundidas.values()) total += triangulosDe(g);
      for (const f of figurantes) for (const p of partesDoFigurante(f.postura)) total += triangulosDe(geometriaDaParte(p, 1));
      const o = orcamentoDaSala(sala, NUCLEOS[codigo].personagens);
      expect(total, codigo).toBe(o.triangulos);
      expect(fundidas.size + (figurantes.length ? 1 : 0) + (sala.placar ? 1 : 0), codigo).toBe(o.materiais);
      process.stdout.write(`${codigo}: ${o.triangulos} triângulos, ${o.materiais} materiais, ${o.texturaPx} px, ${o.luzesProprias} luzes próprias\n`);
    }
  });
});
