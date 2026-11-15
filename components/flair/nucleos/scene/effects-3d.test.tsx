// @vitest-environment jsdom
/**
 * A luz de efeito da cor da peça e a peça pintada do Ateliê, no renderizador de teste: a carta vestida (evento
 * "entrada") toca a sequência do efeito dela, a luz acende atrás do avatar na cor da família e o halo aparece no piso;
 * com os efeitos desligados nada acontece; com "reduzir movimento" a luz já aparece acesa, sem piscar. Cada zona pintada
 * vira uma faixa no manequim, com a cor e o acabamento escolhidos.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { cleanup } from "@/test-utils/render";
import { frames, mount3d } from "@/test-utils/three";
import { ACABAMENTO_3D, faixasDasZonas, LuzDeEfeito, PecaPintada, POSICAO_DA_LUZ_DE_EFEITO } from "@/components/flair/nucleos/scene/effects-3d";
import { Figurantes } from "@/components/flair/nucleos/scene/extras";
import { CenaContexto } from "@/components/flair/nucleos/scene/stage-context";
import { useSceneDirector } from "@/components/flair/nucleos/scene/use-scene-director";
import { boardInicial } from "@/lib/flair/nucleos/board";
import type { EntradaFx } from "@/lib/flair/nucleos/card-fx";
import { emitirFx } from "@/lib/flair/nucleos/fx-events";
import { NUCLEOS } from "@/lib/flair/nucleos/registry";
import type { NucleoCodigo } from "@/lib/flair/nucleos/types";

const AVATAR = boardInicial().avatar;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Palco({ codigo, reduzido = false, figurantes = false }: { codigo: NucleoCodigo; reduzido?: boolean; figurantes?: boolean }) {
  const cena = useSceneDirector({ codigo, avatar: AVATAR, resultado: null, reduzido });
  return (
    <CenaContexto.Provider value={cena}>
      <LuzDeEfeito />
      {figurantes && <Figurantes personagens={NUCLEOS[codigo].personagens} />}
    </CenaContexto.Provider>
  );
}

const entrada = (efeito: string | null, cor = "#C62B28"): EntradaFx => ({
  cardId: "c1", vaga: "SUP", tier: "PRATA", cor: "#9DA3AA", pontua: true, selo: null, motivo: null, aura: false, som: "tecido",
  efeitoDaCor: efeito ? { codigo: efeito, valor: 5 } : null, corDaPeca: efeito ? cor : null,
});

describe("luz de efeito da cor da peça", () => {
  it("a carta vermelha vestida na Passarela acende a luz atrás do avatar, na cor dela, e a plateia aplaude", async () => {
    const r = await mount3d(<Palco codigo="PASSARELA" figurantes />);
    await frames(r, 1);
    const luz = r.scene.findByProps({ name: "luz-efeito" }).instance as THREE.PointLight;
    const halo = r.scene.findByProps({ name: "halo-efeito" }).instance as THREE.Mesh;
    expect(luz.intensity).toBe(0);
    expect(halo.visible).toBe(false);
    // atrás do avatar (z negativo): nunca na frente da roupa
    expect(luz.position.z).toBe(POSICAO_DA_LUZ_DE_EFEITO[2]);
    expect(luz.position.z).toBeLessThan(0);
    expect(halo.position.z).toBeLessThan(0);
    const plateia = r.scene.findAllByProps({ name: "personagem-PLATEIA" })[0].instance as THREE.Group;
    const braco = () => (plateia.children[0].children[1] as THREE.Mesh).rotation.x;
    expect(braco()).toBe(0);

    await frames(r, 1);
    emitirFx({ tipo: "entrada", nucleo: "PASSARELA", entrada: entrada("COR_APLAUSOS"), reduzido: false, efeitos: true });
    // meio segundo depois o clipe já está em curso
    await new Promise((ok) => setTimeout(ok, 900));
    await frames(r, 2);
    expect(luz.intensity).toBeGreaterThan(0);
    expect(`#${luz.color.getHexString()}`).toBe("#c62b28");
    expect(halo.visible).toBe(true);
    expect((halo.material as THREE.MeshBasicMaterial).opacity).toBeGreaterThan(0);
    expect(braco()).not.toBe(0);
    await r.unmount();
  });

  it("com reduzir movimento a luz aparece acesa já no primeiro quadro; efeito de outro jogo ou desligado não acende", async () => {
    const r = await mount3d(<Palco codigo="LABIRINTO" reduzido />);
    await frames(r, 1);
    const luz = r.scene.findByProps({ name: "luz-efeito" }).instance as THREE.PointLight;
    emitirFx({ tipo: "entrada", nucleo: "PASSARELA", entrada: entrada("COR_APLAUSOS"), reduzido: true, efeitos: true });
    emitirFx({ tipo: "entrada", nucleo: "LABIRINTO", entrada: entrada("COR_CLARAO"), reduzido: true, efeitos: false });
    emitirFx({ tipo: "entrada", nucleo: "LABIRINTO", entrada: entrada(null), reduzido: true, efeitos: true });
    await frames(r, 1);
    expect(luz.intensity).toBe(0);
    emitirFx({ tipo: "entrada", nucleo: "LABIRINTO", entrada: entrada("COR_CLARAO", "#F3EFE7"), reduzido: true, efeitos: true });
    await frames(r, 1);
    expect(luz.intensity).toBeGreaterThan(30);
    expect(`#${luz.color.getHexString()}`).toBe("#f3efe7");
    await r.unmount();
  });
});

describe("peça pintada no manequim (modos do Ateliê)", () => {
  it("cada zona pintada vira uma faixa, de cima para baixo; zona sem cor não aparece", () => {
    const faixas = faixasDasZonas(["CABEDAL", "SOLA", "CADARCO"], { CABEDAL: { cor: "#1E4FBF", acabamento: "ESPELHADO" }, CADARCO: { cor: "#F2C230" }, SOLA: {} });
    expect(faixas.map((f) => f.zona)).toEqual(["CABEDAL", "CADARCO"]);
    expect(faixas[0].y).toBeGreaterThan(faixas[1].y);
    expect(faixas[1].acabamento).toBe("FOSCO");
    expect(faixasDasZonas([], {})).toEqual([]);
  });

  it("a faixa leva a cor e o acabamento escolhidos e fica no lugar do manequim, ao lado do avatar", async () => {
    const pos = NUCLEOS.PILOTO_FAVORITO.personagens[0].pos;
    const cena = { codigo: "PILOTO_FAVORITO" as const, diretor: new (await import("@/lib/flair/nucleos/scene/director")).Diretor(), reduzido: true };
    const r = await mount3d(
      <CenaContexto.Provider value={cena}>
        <PecaPintada pos={pos} zonas={["TOPO", "LATERAIS"]} escolhas={{ TOPO: { cor: "#F2C230", acabamento: "METALICO" } }} />
      </CenaContexto.Provider>,
    );
    await frames(r, 1);
    const grupo = r.scene.findByProps({ name: "peca-pintada" }).instance as THREE.Group;
    expect(Math.abs(grupo.position.x)).toBeGreaterThanOrEqual(1);
    const faixa = r.scene.findByProps({ name: "zona-TOPO" }).instance as THREE.Mesh;
    const material = faixa.material as THREE.MeshStandardMaterial;
    expect(`#${material.color.getHexString()}`).toBe("#f2c230");
    expect(material.metalness).toBe(ACABAMENTO_3D.METALICO.metalness);
    expect(r.scene.findAllByProps({ name: "zona-LATERAIS" })).toHaveLength(0);
    await r.unmount();
  });
});
