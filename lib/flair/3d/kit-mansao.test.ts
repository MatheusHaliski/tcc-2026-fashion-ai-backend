import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lerKitMansao, MATERIAIS_DO_COMODO, MODELOS_DO_HEIST, pecasDoComodo, repeticoes, urlDaPeca } from "@/lib/flair/3d/kit-mansao";

const PUBLICO = join(process.cwd(), "public");
const manifesto = () => lerKitMansao(JSON.parse(readFileSync(join(PUBLICO, "flair/3d/kit-mansao/manifest.json"), "utf8")));

describe("kit de interiores da mansão", () => {
  it("lê o manifesto com os nomes do jogo e ignora o que não tem slug", () => {
    const kit = lerKitMansao({
      materials: [{ slug: "piso-x", title: "X", kind: "piso", repeatMeters: 0.72, maps: { cor: "/c.webp" }, mapsMedium: {}, sample: { url: "/x.glb" } }, {}],
      pieces: [{ slug: "lustre", support: "teto", rooms: ["hall"], size: [1, 2, 1], levels: { alto: { url: "/l.glb", triangles: 9 } } },
        { slug: "quadro", support: "parede", rooms: ["qualquer"], levels: { medio: { url: "/q-medio.glb" } } }],
    });
    expect(kit.materiais[0]).toMatchObject({ slug: "piso-x", superficie: "piso", repeticaoMetros: 0.72, amostra: "/x.glb" });
    expect(repeticoes(kit.materiais[0], 7.2, 3.6)).toEqual([10, 5]);
    expect(pecasDoComodo(kit, "hall").map((p) => p.slug)).toEqual(["lustre", "quadro"]);
    expect(pecasDoComodo(kit, "jardim").map((p) => p.slug)).toEqual(["quadro"]);
    expect(urlDaPeca(kit.pecas[1], "alto")).toBe("/q-medio.glb");
    expect(lerKitMansao(null)).toEqual({ materiais: [], pecas: [] });
  });

  it("o manifesto publicado tem os mapas, as amostras e as peças nos arquivos que aponta", () => {
    const kit = manifesto();
    expect(kit.materiais.length).toBeGreaterThanOrEqual(10);
    for (const m of kit.materiais) {
      for (const url of [...Object.values(m.mapas), ...Object.values(m.mapasMedio), m.amostra]) expect(existsSync(join(PUBLICO, url)), url).toBe(true);
    }
    for (const p of kit.pecas) for (const n of Object.values(p.niveis)) expect(existsSync(join(PUBLICO, n!.url)), n!.url).toBe(true);
  });

  it("cada cômodo aponta materiais que existem e os modelos do Heist estão no lugar original", () => {
    const slugs = new Set(manifesto().materiais.map((m) => m.slug));
    for (const uso of Object.values(MATERIAIS_DO_COMODO)) for (const s of [...uso.piso, ...uso.parede, ...uso.teto]) expect(slugs.has(s), s).toBe(true);
    for (const m of Object.values(MODELOS_DO_HEIST)) expect(existsSync(join(PUBLICO, m.url)), m.url).toBe(true);
  });
});
