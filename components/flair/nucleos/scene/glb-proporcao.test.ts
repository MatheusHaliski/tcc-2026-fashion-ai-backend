import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { caixaDoMovel } from "@/components/flair/nucleos/scene/glb-prop";
import { glbDoMovel, lerManifesto } from "@/lib/flair/nucleos/scene/assets";
import { SALAS, VARIANTES } from "@/lib/flair/nucleos/scene/registry";

/**
 * O objeto GLB entra na sala ajustado pela ALTURA do móvel procedural. Se o objeto modela mais (ou menos) coisa que o
 * móvel — uma penteadeira com espelho no lugar de uma bancada —, ele sai encolhido ou esticado. Este teste compara a
 * largura e a profundidade que o objeto terá na sala com as do móvel que ele substitui.
 */
const TOLERANCIA = 0.4;

describe("proporção dos objetos do motor Blender nas salas", () => {
  const pasta = join(process.cwd(), "public/flair/3d/assets");
  const bruto = JSON.parse(readFileSync(join(pasta, "manifest.json"), "utf8")) as { slug: string; source?: string; size?: [number, number, number] }[];
  const manifesto = lerManifesto(bruto);
  const medidas = new Map(bruto.filter((a) => String(a.source).startsWith("scripts/blender3d") && a.size).map((a) => [a.slug, a.size!]));

  it("cada objeto ocupa na sala o mesmo espaço do móvel que substitui", () => {
    const problemas: string[] = [];
    const vistos = new Set<string>();
    for (const sala of [...Object.values(SALAS), ...Object.values(VARIANTES).flatMap((v) => Object.values(v ?? {}))]) {
      for (const movel of sala.moveis) {
        const glb = glbDoMovel(movel, manifesto, sala.codigo);
        const medida = glb && medidas.get(glb.slug);
        if (!glb || !medida) continue;
        const caixa = caixaDoMovel(movel);
        const [largura, altura, fundo] = [caixa.max.x - caixa.min.x, caixa.max.y - caixa.min.y, caixa.max.z - caixa.min.z];
        const k = altura / medida[1];
        const chave = `${glb.slug}:${largura.toFixed(2)}x${altura.toFixed(2)}x${fundo.toFixed(2)}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        // um objeto redondo ou girado em planta pode trocar largura por fundo: compara o maior com o maior
        const [maiorGlb, menorGlb] = [Math.max(medida[0], medida[2]) * k, Math.min(medida[0], medida[2]) * k];
        const [maior, menor] = [Math.max(largura, fundo), Math.min(largura, fundo)];
        const fora = (a: number, b: number) => Math.abs(a - b) > TOLERANCIA * Math.max(b, 0.15);
        if (fora(maiorGlb, maior) || fora(menorGlb, menor)) {
          problemas.push(`${sala.codigo} ${movel.tipo} → ${glb.slug}: objeto ${maiorGlb.toFixed(2)}×${menorGlb.toFixed(2)} m, móvel ${maior.toFixed(2)}×${menor.toFixed(2)} m (altura ${altura.toFixed(2)})`);
        }
      }
    }
    expect(problemas, problemas.join("\n")).toEqual([]);
    expect(vistos.size).toBeGreaterThan(8);
  });
});
