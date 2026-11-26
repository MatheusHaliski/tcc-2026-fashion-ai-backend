// @vitest-environment jsdom
/**
 * Orçamento por cena (auditoria dos jogos, mudança 7), conferido sem placa de vídeo: a cena de cada jogo é montada no
 * renderizador de teste e a geometria que ela manda por quadro é contada de verdade — triângulos e chamadas de desenho
 * da sala, dos objetos de cena e das pessoas leves, com a passada de sombra. A conta montada tem de bater com a conta
 * do orçamento (lib/flair/nucleos/scene/orcamento-da-cena.ts), e a cena inteira tem de caber no teto de cada qualidade.
 */
import { appendFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { useRef } from "react";
import * as THREE from "three";
import { frames, mount3d, ReactThreeTestRenderer } from "@/test-utils/three";
import { FigurantesHumanos } from "@/components/flair/nucleos/gente/figurantes-humanos";
import { Figurantes } from "@/components/flair/nucleos/scene/extras";
import { triangulosDe } from "@/components/flair/nucleos/scene/part-geometry";
import { Sala3D } from "@/components/flair/nucleos/scene/room";
import { QualidadeDaCena } from "@/components/flair/nucleos/scene/scene-quality";
import { CenaContexto } from "@/components/flair/nucleos/scene/stage-context";
import { ehGente } from "@/lib/flair/nucleos/gente/figurantes";
import { NUCLEOS } from "@/lib/flair/nucleos/registry";
import { figurantesDaCena } from "@/lib/flair/nucleos/scene/budget";
import { Diretor } from "@/lib/flair/nucleos/scene/director";
import { contaDaCena, CORPO_INTEIRO, corposCheiosDaCena, estourosDaCena, ORCAMENTO_DA_CENA } from "@/lib/flair/nucleos/scene/orcamento-da-cena";
import { AJUSTES, QUALIDADES, type Qualidade } from "@/lib/flair/nucleos/scene/qualidade";
import { salaDe, VARIANTES } from "@/lib/flair/nucleos/scene/registry";
import type { Sala } from "@/lib/flair/nucleos/scene/types";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

/** Os dez jogos da auditoria. */
const JOGOS: NucleoCodigo[] = ["PASSARELA", "DRESS_FIGHTER", "DRESS_THE_STAR", "PERSONAGEM_FILME", "FASHION_DETECTIVE", "BOUTIQUE_3D", "LABIRINTO", "AROUND_THE_WORLD", "FASHION_SPORTS", "BATALHA_LOOKS"];
/** Os papéis que entraram agora (a conta de antes não os tinha). */
const NOVOS = new Set(["VENDEDORA", "CLIENTE_DA_LOJA", "JURADO", "TORCEDOR", "RESERVA"]);

function Cena({ codigo, sala, qualidade }: { codigo: NucleoCodigo; sala: Sala; qualidade: Qualidade }) {
  const prontos = useRef(new Set<string>());
  const nivel = useRef<Qualidade>(qualidade);
  const figurantes = figurantesDaCena(sala, NUCLEOS[codigo].personagens);
  return (
    <CenaContexto.Provider value={{ codigo, diretor: new Diretor(), reduzido: false }}>
      <Sala3D sala={sala} placar={null} />
      <Figurantes personagens={figurantes} prontos={prontos} />
      {/* nenhum corpo inteiro: a geometria deles vem do arquivo do corpo humano e é contada pela medida (CORPO_INTEIRO) */}
      <FigurantesHumanos codigo={codigo} personagens={figurantes} prontos={prontos} reduzido={false} limite={() => 0} />
      {qualidade !== "ALTA" && <QualidadeDaCena nivel={nivel} />}
    </CenaContexto.Provider>
  );
}

/** O que a cena montada manda por quadro: cada malha visível, e outra vez as que fazem sombra quando há luz com sombra. */
function contar(raiz: THREE.Object3D): { triangulos: number; chamadas: number } {
  let comSombra = false;
  raiz.traverseVisible((o) => {
    if ((o as THREE.DirectionalLight).isDirectionalLight && o.castShadow) comSombra = true;
  });
  const conta = { triangulos: 0, chamadas: 0 };
  raiz.traverseVisible((o) => {
    const m = o as THREE.InstancedMesh;
    if (!m.isMesh) return;
    const vezes = (m.isInstancedMesh ? m.count : 1) * (comSombra && m.castShadow ? 2 : 1);
    conta.triangulos += triangulosDe(m.geometry) * vezes;
    conta.chamadas += comSombra && m.castShadow ? 2 : 1;
  });
  return conta;
}

async function montada(codigo: NucleoCodigo, sala: Sala, qualidade: Qualidade) {
  const r = await mount3d(<Cena codigo={codigo} sala={sala} qualidade={qualidade} />);
  // duas rodadas: o renderizador de teste roda os quadros de um componente antes dos do seguinte, e a silhueta só sai
  // de cena no quadro depois de a pessoa leve entrar
  await frames(r, 2);
  await frames(r, 2);
  const raiz = (r.scene as unknown as { instance: THREE.Object3D }).instance ?? (r.scene.children[0].instance as THREE.Object3D).parent!;
  if (qualidade !== "ALTA") {
    const luz = raiz.getObjectByName("luz-principal") as THREE.DirectionalLight;
    luz.castShadow = AJUSTES[qualidade].sombra;
  }
  const conta = contar(raiz);
  await r.unmount();
  return conta;
}

describe.each(JOGOS)("orçamento da cena: %s", (codigo) => {
  const salas: [string, Sala][] = [["", salaDe(codigo)], ...Object.entries(VARIANTES[codigo] ?? {}).filter(([, s]) => s !== salaDe(codigo))];

  it.each(salas)("a geometria montada bate com a conta e a cena cabe no teto de cada qualidade %s", async (_, sala) => {
    const personagens = NUCLEOS[codigo].personagens;
    for (const qualidade of ["ALTA", "BAIXA"] as const) {
      const conta = await montada(codigo, sala, qualidade);
      // a conta do orçamento sem corpo inteiro nenhum de figurante e sem a avatar (os dois vêm da medida)
      const modelo = contaDaCena(codigo, sala, personagens, qualidade, 0);
      const avatar = AJUSTES[qualidade].sombra ? 2 : 1;
      expect(conta.triangulos, `${qualidade}: triângulos`).toBe(modelo.triangulos - avatar * CORPO_INTEIRO.triangulos);
      expect(conta.chamadas, `${qualidade}: chamadas`).toBe(modelo.chamadas - avatar * CORPO_INTEIRO.chamadas);
    }
    for (const qualidade of QUALIDADES) {
      const cena = contaDaCena(codigo, sala, personagens, qualidade);
      expect(estourosDaCena(cena, qualidade), `${qualidade}: ${cena.triangulos} triângulos, ${cena.chamadas} chamadas`).toEqual([]);
      expect(cena.cheios).toBeLessThanOrEqual(corposCheiosDaCena(codigo, qualidade));
    }
  }, 30000);

  it("fica mais leve que antes em todas as qualidades, mesmo com as pessoas que entraram", () => {
    const sala = salaDe(codigo);
    const personagens = NUCLEOS[codigo].personagens;
    const gente = figurantesDaCena(sala, personagens).filter(ehGente).length;
    // antes: os papéis de então, até 5 corpos inteiros, todos com sombra, cinco chamadas por pessoa leve
    const salaDeAntes = { ...sala, figurantes: sala.figurantes.filter((p) => !NOVOS.has(p.papel)) };
    const genteDeAntes = figurantesDaCena(salaDeAntes, personagens).filter(ehGente).length;
    const antes = contaDaCena(codigo, salaDeAntes, personagens, "ALTA", Math.min(5, genteDeAntes), false);
    // antes, no resultado: a reação de grupo punha a plateia inteira de corpo inteiro
    const noResultado = contaDaCena(codigo, salaDeAntes, personagens, "ALTA", genteDeAntes, false);
    const depois = contaDaCena(codigo, sala, personagens, "ALTA");
    const baixa = contaDaCena(codigo, sala, personagens, "BAIXA");
    expect(depois.triangulos).toBeLessThanOrEqual(antes.triangulos + (gente - genteDeAntes) * CORPO_INTEIRO.triangulos * 2);
    expect(depois.chamadas).toBeLessThanOrEqual(Math.max(antes.chamadas, ORCAMENTO_DA_CENA.ALTA.chamadas));
    expect(baixa.triangulos).toBeLessThan(antes.triangulos);
    expect(baixa.chamadas).toBeLessThan(antes.chamadas);
    expect(noResultado.triangulos).toBeGreaterThanOrEqual(antes.triangulos);
    // a tabela do relatório (docs/flair/flair-3d/BASE_NUCLEOS.md): ORCAMENTO_TABELA=<arquivo> acrescenta uma linha por jogo
    if (process.env.ORCAMENTO_TABELA) {
      const media = contaDaCena(codigo, sala, personagens, "MEDIA");
      const par = (c: { triangulos: number; chamadas: number }) => `${Math.round(c.triangulos / 1000)} mil / ${c.chamadas}`;
      appendFileSync(process.env.ORCAMENTO_TABELA, `| ${codigo} | ${genteDeAntes} → ${gente} | ${par(antes)} | ${par(noResultado)} | ${par(depois)} | ${par(media)} | ${par(baixa)} |\n`);
    }
  });
});

describe("Passarela, a prioridade (0,2 quadro por segundo sem placa de vídeo)", () => {
  it("no nível baixo a plateia inteira são 5 chamadas e a cena cai para menos de um quinto dos triângulos", () => {
    const sala = salaDe("PASSARELA");
    const personagens = NUCLEOS.PASSARELA.personagens;
    const antes = contaDaCena("PASSARELA", sala, personagens, "ALTA", 5, false);
    const noResultado = contaDaCena("PASSARELA", sala, personagens, "ALTA", 14, false);
    const alta = contaDaCena("PASSARELA", sala, personagens, "ALTA");
    const baixa = contaDaCena("PASSARELA", sala, personagens, "BAIXA");
    expect(alta).toMatchObject({ cheios: 2, leves: 12 });
    expect(baixa).toMatchObject({ cheios: 0, leves: 14 });
    expect(alta.triangulos).toBeLessThan(antes.triangulos * 0.6);
    expect(baixa.triangulos).toBeLessThan(antes.triangulos / 5);
    expect(baixa.chamadas).toBeLessThan(antes.chamadas / 4);
    expect(noResultado.triangulos).toBeGreaterThan(alta.triangulos * 4);
  });
});

describe("a cena desce de qualidade sozinha", () => {
  it("com quadros de 2 s a luz principal deixa de fazer sombra e os figurantes ficam todos de corpo leve", async () => {
    const nivel = { current: "ALTA" as Qualidade };
    const r = await mount3d(
      <>
        <directionalLight name="luz-principal" castShadow />
        <QualidadeDaCena nivel={nivel} />
      </>,
    );
    const luz = r.scene.findByProps({ name: "luz-principal" }).instance as THREE.DirectionalLight;
    await frames(r, 30);
    expect(nivel.current).toBe("ALTA");
    expect(luz.castShadow).toBe(true);
    // a máquina sem placa de vídeo: cada quadro leva 2 s
    await ReactThreeTestRenderer.act(async () => { await r.advanceFrames(4, 2); });
    expect(nivel.current).toBe("BAIXA");
    expect(luz.castShadow).toBe(false);
    expect(corposCheiosDaCena("PASSARELA", nivel.current)).toBe(0);
    await r.unmount();
  });
});
