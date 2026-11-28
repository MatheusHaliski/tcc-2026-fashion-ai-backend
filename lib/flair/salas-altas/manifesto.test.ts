import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { arquivoDoImportado, lerSalasAltas, nivelDaSala, salaAltaPorSlug, slugDoDetetive } from "@/lib/flair/salas-altas/manifesto";
import { gravarPreferencia, lerPreferencia, qualidadeEfetiva } from "@/lib/flair/salas-altas/preferencia";

const SALA = {
  slug: "detetive-salao", games: ["FASHION_DETECTIVE"], environment: "/flair/3d/salas/detetive-salao-ambiente.webp",
  levels: { alto: { url: "/a.glb", triangles: 300000, calls: 40, bytes: 3 }, medio: { url: "/m.glb", triangles: 90000, calls: 40, bytes: 1 } },
  imports: [{ model: "patronTable", url: "/heist/models/patronTable.glb", medium: "/flair/3d/salas/importados/patronTable-medio.glb", pos: [-3.5, 0, 1], rotation: 15, height: 1 }],
};

describe("salas high poly: manifesto e nível de detalhe", () => {
  it("lê o manifesto e descarta entrada sem slug ou sem nível", () => {
    const lidas = lerSalasAltas([SALA, { slug: "vazia", levels: {} }, { title: "sem slug" }]);
    expect(lidas.map((s) => s.slug)).toEqual(["detetive-salao"]);
    expect(lidas[0].imports[0]).toMatchObject({ model: "patronTable", rotation: 15, height: 1, pos: [-3.5, 0, 1] });
    expect(lerSalasAltas("erro 404")).toEqual([]);
    expect(salaAltaPorSlug(lidas, slugDoDetetive("SALAO"))?.slug).toBe("detetive-salao");
    expect(salaAltaPorSlug(lidas, null)).toBeNull();
  });

  it("Alta usa o alto (o médio em tela de celular), Média o médio e Baixa a sala procedural", () => {
    const [s] = lerSalasAltas([SALA]);
    expect(nivelDaSala(s, "ALTA", 1280)).toBe("alto");
    expect(nivelDaSala(s, "ALTA", 390)).toBe("medio");
    expect(nivelDaSala(s, "MEDIA", 1920)).toBe("medio");
    expect(nivelDaSala(s, "BAIXA", 1920)).toBeNull();
    const [soAlto] = lerSalasAltas([{ ...SALA, levels: { alto: SALA.levels.alto } }]);
    expect(nivelDaSala(soAlto, "MEDIA", 1920)).toBe("alto");
    expect(arquivoDoImportado(s.imports[0], "medio")).toContain("-medio.glb");
    expect(arquivoDoImportado(s.imports[0], "alto")).toBe("/heist/models/patronTable.glb");
  });

  it("a escolha da pessoa vale; na automática decide a máquina (sem placa de vídeo, Baixa)", () => {
    expect(qualidadeEfetiva("AUTO", "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))")).toBe("BAIXA");
    expect(qualidadeEfetiva("AUTO", "NVIDIA GeForce RTX 3060")).toBe("ALTA");
    expect(qualidadeEfetiva("MEDIA", "NVIDIA GeForce RTX 3060")).toBe("MEDIA");
    gravarPreferencia("ALTA");
    expect(lerPreferencia()).toBe("ALTA");
    gravarPreferencia("AUTO");
  });

  it("o manifesto publicado aponta arquivos que existem, com os modelos do Heist no lugar original", () => {
    const pasta = join(process.cwd(), "public");
    const salas = lerSalasAltas(JSON.parse(readFileSync(join(pasta, "flair/3d/salas/manifest.json"), "utf8")));
    expect(salas.length).toBeGreaterThan(0);
    for (const s of salas) {
      for (const n of Object.values(s.levels)) expect(readFileSync(join(pasta, n!.url)).subarray(0, 4).toString()).toBe("glTF");
      for (const i of s.imports) {
        expect(i.url.startsWith("/heist/models/")).toBe(true);
        expect(readFileSync(join(pasta, i.url)).subarray(0, 4).toString()).toBe("glTF");
        if (i.medium) expect(readFileSync(join(pasta, i.medium)).subarray(0, 4).toString()).toBe("glTF");
      }
    }
  });
});
