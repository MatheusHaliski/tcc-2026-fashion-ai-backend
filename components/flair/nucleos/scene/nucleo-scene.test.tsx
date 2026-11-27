// @vitest-environment jsdom
/**
 * Palco dos 15 jogos: no jsdom (sem WebGL) a cena cai na reserva 2D com as cores da sala; a sala 3D monta no
 * renderizador de teste (casca, móveis por material, móveis animados, figurantes e luzes) e as sequências mexem os
 * atores — ou, com "reduzir movimento", vão direto ao quadro parado.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { cleanup, renderApp, screen } from "@/test-utils/render";
import { frames, meshes, mount3d } from "@/test-utils/three";
import { NucleoScene } from "@/components/flair/nucleos/nucleo-scene";
import { MODELO_CASA } from "@/components/flair/nucleos/nucleo-avatar";
import { enquadramento } from "@/components/flair/nucleos/nucleo-scene-3d";
import { Figurantes } from "@/components/flair/nucleos/scene/extras";
import { triangulosDe } from "@/components/flair/nucleos/scene/part-geometry";
import { Sala3D } from "@/components/flair/nucleos/scene/room";
import { agora, CenaContexto, type Cena } from "@/components/flair/nucleos/scene/stage-context";
import { boardInicial } from "@/lib/flair/nucleos/board";
import { NUCLEOS } from "@/lib/flair/nucleos/registry";
import { figurantesDaCena, orcamentoDaSala } from "@/lib/flair/nucleos/scene/budget";
import { Diretor } from "@/lib/flair/nucleos/scene/director";
import { SALAS } from "@/lib/flair/nucleos/scene/registry";
import { sequenciaDoResultado } from "@/lib/flair/nucleos/scene/sequences-auto";
import { NUCLEO_CODIGOS, type NucleoCodigo, type NucleoResultado } from "@/lib/flair/nucleos/types";

const AVATAR = boardInicial().avatar;
const RESULTADO: NucleoResultado = { pontos: 100, estrelas: 3, resultado: "VITORIA", regras: [], eventos: [{ codigo: "PLACAR", valor: "2-1" }] };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("reserva 2D (jsdom não tem WebGL)", () => {
  it.each(NUCLEO_CODIGOS)("%s: mostra a sala em 2D, com a marca da zona do avatar e os personagens", async (codigo) => {
    renderApp(<NucleoScene config={NUCLEOS[codigo]} avatar={AVATAR} pecas={[]} protagonista={MODELO_CASA} />);
    const cena = await screen.findByTestId("nucleo-scene-fallback");
    expect(cena.getAttribute("data-sala")).toBe(codigo);
    expect(cena.getAttribute("data-marca")).toBe(SALAS[codigo].zonas.avatar.marca);
    expect(cena.style.getPropertyValue("--n3d-piso")).toBe(SALAS[codigo].materiais[SALAS[codigo].casca.piso].cor);
    expect(cena.querySelectorAll(".n3d-char").length).toBe(Math.min(9, figurantesDaCena(SALAS[codigo], NUCLEOS[codigo].personagens).length));
    expect(cena.textContent).toContain("Cena 2D");
    expect(screen.queryByTestId("nucleo-scene-still")).toBeNull();
  });

  it("com resultado, a partida automática aparece como quadro parado: a nota e o placar", async () => {
    renderApp(<NucleoScene config={NUCLEOS.FASHION_SPORTS} avatar={AVATAR} pecas={[{ id: "p1", name: "Camisa verde" } as never]} protagonista={MODELO_CASA} resultado={RESULTADO} />);
    const parado = await screen.findByTestId("nucleo-scene-still");
    expect(parado.textContent).toBe("Resultado na cena: 100 pontos, 3 de 3 estrelas · Placar: 2 × 1");
    expect(screen.getByTestId("nucleo-scene-fallback").textContent).toContain("Camisa verde");
  });
});

describe("câmera", () => {
  it("o zoom aproxima e sobe; a sala limita a distância e soma a altura do piso do avatar", () => {
    expect(enquadramento(0)).toEqual({ dist: 4.2, alvo: [0, 1, 0] });
    expect(enquadramento(-2, SALAS.PASSARELA).dist).toBeCloseTo(5.8, 5);
    expect(enquadramento(0, SALAS.PASSARELA).alvo[1]).toBeCloseTo(1.3, 5);
    expect(enquadramento(-2, SALAS.LABIRINTO).dist).toBe(3.9);
    expect(enquadramento(3, SALAS.LABIRINTO).dist).toBeCloseTo(1.8, 5);
  });
});

function cenaDe(codigo: NucleoCodigo, reduzido = false): Cena {
  return { codigo, diretor: new Diretor(), reduzido };
}

function Palco({ cena }: { cena: Cena }) {
  const sala = SALAS[cena.codigo];
  return (
    <CenaContexto.Provider value={cena}>
      <Sala3D sala={sala} placar={null} />
      <Figurantes personagens={figurantesDaCena(sala, NUCLEOS[cena.codigo].personagens)} />
    </CenaContexto.Provider>
  );
}

describe("sala 3D no renderizador de teste", () => {
  it.each(NUCLEO_CODIGOS)("%s: casca, móveis, figurantes e luzes montados dentro do orçamento", async (codigo) => {
    const sala = SALAS[codigo];
    const r = await mount3d(<Palco cena={cenaDe(codigo)} />);
    await frames(r, 2);
    const malhas = meshes(r).map((m) => m.instance as THREE.Mesh);
    const triangulos = malhas.reduce((n, m) => n + triangulosDe(m.geometry), 0);
    const o = orcamentoDaSala(sala, NUCLEOS[codigo].personagens);
    expect(triangulos).toBe(o.triangulos - (sala.placar ? 2 : 0));
    expect(new Set(malhas.map((m) => (m.material as THREE.Material).uuid)).size).toBeLessThanOrEqual(12);
    // a casca recebe sombra e não projeta; os móveis animados têm o próprio grupo
    const casca = r.scene.findByProps({ name: "casca" }).instance as THREE.Group;
    casca.traverse((n) => {
      if (n instanceof THREE.Mesh) expect(n.castShadow).toBe(false);
    });
    for (const m of sala.moveis.filter((x) => x.id)) expect(r.scene.findAllByProps({ name: `movel-${m.id}` }).length).toBe(1);
    expect(r.scene.findAllByProps({ name: "luz-principal" }).length).toBe(1);
    expect(r.scene.findAllByProps({ name: "luz-recorte" }).length).toBe(1);
    for (const l of sala.luzes.proprias) expect(r.scene.findAllByProps({ name: `luz-${l.id}` }).length).toBe(1);
    await r.unmount();
  });

  it("a sequência do resultado abre a porta e acende a luz; com reduzir movimento, já no primeiro quadro", async () => {
    const resultado: NucleoResultado = { pontos: 100, estrelas: 3, resultado: "ABRE", regras: [], eventos: [] };
    for (const reduzido of [false, true]) {
      const cena = cenaDe("LABIRINTO", reduzido);
      const r = await mount3d(<Palco cena={cena} />);
      await frames(r, 1);
      const porta = (r.scene.findByProps({ name: "movel-porta" }).instance as THREE.Group).children[0];
      const luz = r.scene.findByProps({ name: "luz-espelho" }).instance as THREE.PointLight;
      expect(porta.rotation.y).toBe(0);
      expect(luz.intensity).toBe(0);
      // a sequência começou há 60 s (animada: já acabou e mantém) ou agora (reduzida: quadro parado imediato)
      cena.diretor.tocar(sequenciaDoResultado("LABIRINTO", resultado), reduzido ? agora() : agora() - 60, reduzido);
      await frames(r, 1);
      expect(porta.rotation.y).toBeCloseTo((96 * Math.PI) / 180, 5);
      expect(luz.intensity).toBeCloseTo(28, 5);
      await r.unmount();
    }
  });

  it("figurantes: o braço gira no ombro com o clipe e o manequim do ateliê gira devagar (parado com reduzir movimento)", async () => {
    const gira = await mount3d(<Palco cena={cenaDe("CLUBE_CORACAO")} />);
    await frames(gira, 2);
    const manequim = (gira.scene.findByProps({ name: "personagem-MANEQUIM" }).instance as THREE.Group).children[0];
    expect(manequim.rotation.y).not.toBe(0);
    await gira.unmount();
    const parado = await mount3d(<Palco cena={cenaDe("CLUBE_CORACAO", true)} />);
    await frames(parado, 2);
    expect((parado.scene.findByProps({ name: "personagem-MANEQUIM" }).instance as THREE.Group).children[0].rotation.y).toBe(0);
    await parado.unmount();
  });
});
