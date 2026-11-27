import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { alturaDoMovel, glbDoMovel, lerManifesto, materialDoPapel, slugDoTipo, urlDoGlb } from "@/lib/flair/nucleos/scene/assets";
import { orcamentoDaSala } from "@/lib/flair/nucleos/scene/budget";
import { poltrona } from "@/lib/flair/nucleos/scene/moveis/assentos";
import { caixa, comGlb, movel, triangulosDaParte } from "@/lib/flair/nucleos/scene/parts";
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
    expect(lerManifesto({ assets: [{ slug: "a", triangles: "12" }] })).toEqual([{ slug: "a", triangles: 12, title: undefined, games: undefined, category: undefined, bytes: undefined, movel: undefined, leve: undefined }]);
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

/** O mesmo resumo de scripts/blender3d/resumo.py: caminho e conteúdo de cada arquivo do motor, em ordem. */
function resumoDoMotor(): string {
  const raiz = join(process.cwd(), "scripts/blender3d");
  const arquivos: string[] = [];
  const andar = (pasta: string) => {
    for (const nome of readdirSync(pasta)) {
      const caminho = join(pasta, nome);
      if (statSync(caminho).isDirectory()) { if (nome !== "tests" && nome !== "__pycache__") andar(caminho); }
      else if (nome.endsWith(".py") && nome !== "preview.py") arquivos.push(caminho);
    }
  };
  andar(raiz);
  const conta = createHash("sha256");
  // a mesma ordem do Python (sorted de Path): componente a componente
  const partes = (c: string) => relative(raiz, c).split(sep);
  arquivos.sort((a, b) => { const x = partes(a), y = partes(b); for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1; return x.length - y.length; });
  for (const arquivo of arquivos) { conta.update(partes(arquivo).join("/")); conta.update(readFileSync(arquivo)); }
  return conta.digest("hex").slice(0, 16);
}

describe("papéis de cor e versão leve", () => {
  it("o material `sala:<papel>` do objeto recebe o material da sala que o móvel declarou", () => {
    const m = movel("cadeira", { pos: [0, 0, 0] }, [caixa("veludo", [1, 1, 1], [0, 0.5, 0])], { estofado: "veludo", metal: "latao" });
    expect(materialDoPapel("sala:estofado", m)).toBe("veludo");
    expect(materialDoPapel("sala:metal.001", m)).toBe("latao");
    expect(materialDoPapel("sala:desconhecido", m)).toBeNull();
    expect(materialDoPapel("borracha", m)).toBeNull();
    expect(materialDoPapel("sala:estofado", movel("cadeira", { pos: [0, 0, 0] }, []))).toBeNull();
  });

  it("a versão leve tem endereço próprio e vem do manifesto", () => {
    expect(urlDoGlb("cadeira", true)).toBe("/flair/3d/assets/cadeira-leve.glb");
    expect(lerManifesto([{ slug: "cadeira", triangles: 872, leve: 484 }])[0].leve).toBe(484);
    expect(lerManifesto([{ slug: "trave", triangles: 616 }])[0].leve).toBeUndefined();
  });
});

describe("objetos GLB no repositório (public/flair/3d/assets)", () => {
  it("cada entrada do manifesto tem arquivo GLB, crédito e um móvel procedural que ela substitui", async () => {
    const pasta = join(process.cwd(), "public/flair/3d/assets");
    const bruto = JSON.parse(readFileSync(join(pasta, "manifest.json"), "utf8")) as Record<string, unknown>[];
    const lido = lerManifesto(bruto);
    expect(lido.length).toBe(bruto.length);
    expect(lido.length).toBeGreaterThan(0);
    for (const a of bruto) {
      expect(readFileSync(join(pasta, `${String(a.slug)}.glb`)).subarray(0, 4).toString()).toBe("glTF");
      expect(String(a.author).length).toBeGreaterThan(0);
      expect(Number(a.triangles)).toBeGreaterThan(0);
      expect(Number(a.triangles)).toBeLessThanOrEqual(3000);
      if (String(a.source).startsWith("scripts/blender3d")) {
        // gerado pelo motor Blender do projeto (scripts/blender3d): autoria própria; diz qual móvel procedural substitui
        expect(a.license).toBe("Própria");
        // (o corpo das pessoas de cena, categoria "gente", não substitui móvel: components/flair/nucleos/gente)
        if (a.category !== "gente") expect(String(a.movel ?? "").length).toBeGreaterThan(0);
        // o arquivo publicado é o da receita atual: mudou o motor ou uma receita, rode `python -m scripts.blender3d.build`
        expect(a.hash, `${String(a.slug)}: gere os objetos de novo (python -m scripts.blender3d.build)`).toBe(resumoDoMotor());
        if (a.leve) {
          expect(readFileSync(join(pasta, `${String(a.slug)}-leve.glb`)).subarray(0, 4).toString()).toBe("glTF");
          expect(Number(a.leve)).toBeLessThan(Number(a.triangles));
        }
      } else {
        expect(a.license).toBe("CC BY 4.0");
        expect(String(a.source)).toMatch(/^https:\/\/sketchfab\.com\//);
        expect((a.games as string[]).length).toBe(1);
      }
    }
  });
});
