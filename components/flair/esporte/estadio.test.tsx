// @vitest-environment jsdom
/**
 * O campo da transmissão do Fashion Sports montado sem placa de vídeo: a torcida e os bancos são gente leve instanciada
 * (poucas chamadas de desenho para centenas de pessoas) e a geometria cabe no orçamento do campo.
 */
import { appendFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { frames, mount3d } from "@/test-utils/three";
import { Campo3D } from "@/components/flair/esporte/campo-3d";
import { RESERVAS_POR_BANCO } from "@/components/flair/esporte/estadio-3d";
import { triangulosDe } from "@/components/flair/nucleos/scene/part-geometry";
import { CAMPOS } from "@/lib/flair/esporte/campo";
import { TRIANGULOS_POR_PESSOA } from "@/lib/flair/nucleos/gente/detalhe";

/** O teto do campo sem os jogadores (eles têm a conta própria: corpo inteiro ou leve, pela qualidade). */
const ORCAMENTO_DO_CAMPO = { triangulos: 260_000, chamadas: 120 };

async function contar(modalidade: string) {
  const r = await mount3d(<Campo3D campo={CAMPOS[modalidade]} reduzido={false} humor={() => null} />);
  await frames(r, 2);
  const raiz = r.scene.findByProps({ name: "campo" }).instance as THREE.Group;
  const conta = { triangulos: 0, chamadas: 0, pessoas: 0, instanciadas: 0 };
  raiz.traverseVisible((o) => {
    const m = o as THREE.InstancedMesh;
    if (!m.isMesh) return;
    conta.chamadas += 1;
    conta.triangulos += triangulosDe(m.geometry) * (m.isInstancedMesh ? m.count : 1);
    if (m.isInstancedMesh) {
      conta.instanciadas += 1;
      conta.pessoas += m.count / 5;
    }
  });
  await r.unmount();
  return conta;
}

describe("campo da transmissão", () => {
  it.each(Object.keys(CAMPOS))("%s: torcida de gente leve instanciada, dentro do orçamento do campo", async (modalidade) => {
    const conta = await contar(modalidade);
    expect(conta.triangulos).toBeLessThanOrEqual(ORCAMENTO_DO_CAMPO.triangulos);
    expect(conta.chamadas).toBeLessThanOrEqual(ORCAMENTO_DO_CAMPO.chamadas);
    // cinco malhas instanciadas por setor de arquibancada (e por banco, no estádio do futebol): ninguém é uma malha só sua
    expect(conta.instanciadas % 5).toBe(0);
    expect(conta.pessoas).toBeGreaterThan(40);
    expect(conta.triangulos).toBeGreaterThanOrEqual(conta.pessoas * TRIANGULOS_POR_PESSOA.torcida);
    if (process.env.ORCAMENTO_TABELA) appendFileSync(process.env.ORCAMENTO_TABELA, `| campo ${modalidade} | ${conta.pessoas} pessoas | ${Math.round(conta.triangulos / 1000)} mil / ${conta.chamadas} |\n`);
  });

  it("futebol: três setores de arquibancada e os dois bancos com os reservas sentados", async () => {
    const r = await mount3d(<Campo3D campo={CAMPOS.FUTEBOL} reduzido={false} humor={() => null} />);
    await frames(r, 2);
    expect(r.scene.findAllByProps({ name: "setor" })).toHaveLength(3);
    for (const lado of ["NOS", "ELES"]) {
      const banco = r.scene.findByProps({ name: `reservas-${lado}` }).instance as THREE.Group;
      const malhas: THREE.InstancedMesh[] = [];
      banco.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh) malhas.push(o as THREE.InstancedMesh); });
      expect(malhas).toHaveLength(5);
      expect(malhas.every((m) => m.count === RESERVAS_POR_BANCO)).toBe(true);
    }
    await r.unmount();
  });
});
