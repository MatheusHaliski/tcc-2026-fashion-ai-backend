import { describe, expect, it } from "vitest";
import { alturaDoMovel, glbDoMovel, lerManifesto, slugDoTipo, urlDoGlb } from "@/lib/flair/nucleos/scene/assets";
import { orcamentoDaSala } from "@/lib/flair/nucleos/scene/budget";
import { poltrona } from "@/lib/flair/nucleos/scene/moveis/assentos";
import { comGlb, triangulosDaParte } from "@/lib/flair/nucleos/scene/parts";
import { SALAS } from "@/lib/flair/nucleos/scene/registry";
import type { Sala } from "@/lib/flair/nucleos/scene/types";

/** Objetos GLB licenciados: o manifesto decide; sem o arquivo, a sala fica com os móveis procedurais. */
describe("objetos GLB das salas", () => {
  const manifesto = lerManifesto([
    { slug: "poltrona", title: "Armchair", games: ["BOUTIQUE_3D"], category: "furniture", triangles: 5200, bytes: 180000 },
    { slug: "director-chair", movel: "cadeiraDiretor", triangles: 3000 },
    { slug: "vintage-camera", triangles: 9000 },
    { title: "sem slug", triangles: 10 },
  ]);

  it("lê o manifesto (lista direta ou {assets}) e ignora entradas sem slug ou arquivo ilegível", () => {
    expect(manifesto.map((a) => a.slug)).toEqual(["poltrona", "director-chair", "vintage-camera"]);
    expect(lerManifesto({ assets: [{ slug: "a", triangles: "12" }] })).toEqual([{ slug: "a", triangles: 12, title: undefined, games: undefined, category: undefined, bytes: undefined, movel: undefined }]);
    expect(lerManifesto(null)).toEqual([]);
    expect(lerManifesto("erro 404")).toEqual([]);
    expect(urlDoGlb("poltrona")).toBe("/flair/3d/assets/poltrona.glb");
    expect(slugDoTipo("cadeiraDiretor")).toBe("cadeira-diretor");
  });

  it("um móvel usa o GLB pelo slug apontado, pelo tipo marcado no manifesto ou pelo slug convencionado do tipo", () => {
    const m = poltrona({ pos: [0, 0, 0] }, "a", "b");
    expect(glbDoMovel(m, [])).toBeNull();
    expect(glbDoMovel(m, manifesto, "BOUTIQUE_3D")?.slug).toBe("poltrona");
    expect(glbDoMovel(m, manifesto, "PASSARELA")).toBeNull();
    expect(glbDoMovel(comGlb(m, "vintage-camera"), manifesto)?.triangles).toBe(9000);
    expect(glbDoMovel(comGlb(m, "nao-baixado"), manifesto, "BOUTIQUE_3D")).toBeNull();
    const diretor = SALAS.PERSONAGEM_FILME.moveis.find((x) => x.tipo === "cadeiraDiretor")!;
    expect(glbDoMovel(diretor, manifesto, "PERSONAGEM_FILME")?.slug).toBe("director-chair");
    expect(alturaDoMovel(m)).toBeGreaterThan(0.7);
    expect(alturaDoMovel(m)).toBeLessThan(1);
  });

  it("orçamento: o GLB disponível troca os triângulos do móvel procedural pelos do manifesto e conta um material", () => {
    const sala = SALAS.BOUTIQUE_3D;
    const semGlb = orcamentoDaSala(sala);
    const alvo = sala.moveis.find((m) => m.tipo === "poltrona")!;
    const procedural = alvo.partes.reduce((n, p) => n + triangulosDaParte(p), 0);
    const comObjeto = orcamentoDaSala(sala, [], manifesto);
    expect(comObjeto.triangulos).toBe(semGlb.triangulos - procedural + 5200);
    expect(comObjeto.materiais).toBe(semGlb.materiais + 1);
    // um arquivo pesado demais aparece como estouro, como qualquer móvel
    const pesada: Sala = { ...sala, moveis: sala.moveis.map((m) => (m === alvo ? comGlb(m, "vintage-camera") : m)) };
    expect(orcamentoDaSala(pesada, [], lerManifesto([{ slug: "vintage-camera", triangles: 70000 }])).triangulos).toBeGreaterThan(60000);
  });
});

describe("objetos GLB no repositório (public/flair/3d/assets)", () => {
  it("cada entrada do manifesto tem arquivo GLB, crédito e um móvel procedural que ela substitui", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const pasta = join(process.cwd(), "public/flair/3d/assets");
    const bruto = JSON.parse(readFileSync(join(pasta, "manifest.json"), "utf8")) as Record<string, unknown>[];
    const lido = lerManifesto(bruto);
    expect(lido.length).toBe(bruto.length);
    expect(lido.length).toBeGreaterThan(0);
    for (const a of bruto) {
      expect(readFileSync(join(pasta, `${String(a.slug)}.glb`)).subarray(0, 4).toString()).toBe("glTF");
      expect(a.license).toBe("CC BY 4.0");
      expect(String(a.author).length).toBeGreaterThan(0);
      expect(String(a.source)).toMatch(/^https:\/\/sketchfab\.com\//);
      expect(Number(a.triangles)).toBeLessThanOrEqual(3000);
      expect((a.games as string[]).length).toBe(1);
    }
  });
});
