import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HUMANOIDES, humanoideDaPessoa, humanoidesDaCena, MEMBROS, OSSOS, poseHumana } from "@/lib/flair/nucleos/gente/humanoides";

/** O JSON de dentro do arquivo GLB (o primeiro bloco). */
function conteudo(slug: string): { nodes: { name?: string }[]; skins?: unknown[] } {
  const b = readFileSync(join(process.cwd(), "public/flair/3d/gente", `${slug}.glb`));
  expect(b.subarray(0, 4).toString()).toBe("glTF");
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8"));
}
/** O nome do osso como o three o lê (sem os caracteres reservados). */
const lido = (nome: string) => nome.replace(/\s/g, "_").replace(/[\[\].:/]/g, "");

describe("humanoides das pessoas de cena", () => {
  it("cada modelo do catálogo tem arquivo, crédito, esqueleto e todos os ossos que a pose usa", () => {
    expect(HUMANOIDES.length).toBeGreaterThanOrEqual(4);
    for (const h of HUMANOIDES) {
      const g = conteudo(h.slug);
      expect(h.license).toBe("CC BY 4.0");
      expect(h.author.length).toBeGreaterThan(0);
      expect(h.source).toMatch(/^https:\/\/sketchfab\.com\/3d-models\//);
      expect(h.triangles).toBeGreaterThan(1000);
      expect(h.triangles).toBeLessThanOrEqual(12000);
      expect(g.skins?.length).toBe(1);
      const nomes = g.nodes.map((n) => lido(n.name ?? ""));
      for (const m of MEMBROS) expect(nomes.filter((n) => OSSOS[m].test(n)), `${h.slug}: ${m}`).toHaveLength(1);
    }
  });

  it("a mesma pessoa é sempre o mesmo modelo, do sexo dela; o uniforme só veste quem é segurança", () => {
    const a = humanoideDaPessoa("fig:PLATEIA:3", "FEMININO");
    expect(a).toEqual(humanoideDaPessoa("fig:PLATEIA:3", "FEMININO"));
    expect(a?.sexo).toBe("FEMININO");
    for (let i = 0; i < 30; i++) expect(humanoideDaPessoa(`fig:PLATEIA:${i}`, "MASCULINO")?.slug).not.toBe("seguranca");
    expect(humanoideDaPessoa("dtv:seguranca-1", "MASCULINO")?.slug).toBe("seguranca");
  });

  it("sentada, a coxa aponta para a frente e o corpo desce; andando, as pernas alternam; qualidade baixa mostra menos", () => {
    const parada = { bracos: 0, inclina: 0, pulo: 0, sentada: false };
    const sentada = poseHumana("idle", 0, { ...parada, sentada: true }, 0);
    expect(sentada.direcoes.coxaE[2]).toBeGreaterThan(0.9);
    expect(sentada.desce).toBeGreaterThan(0);
    const andando = poseHumana("walk", 1, parada, 0.2);
    expect(Math.sign(andando.direcoes.coxaE[2])).toBe(-Math.sign(andando.direcoes.coxaD[2]));
    expect(poseHumana("idle", 0, parada, 0).direcoes.bracoE[1]).toBeLessThan(-0.9);
    expect(humanoidesDaCena(0)).toBeLessThan(humanoidesDaCena(Infinity));
  });
});
