// @vitest-environment jsdom
/**
 * As pessoas leves da cena (plateia, torcida do beco, banco): todas em cinco malhas instanciadas, sem sombra, e mesmo
 * assim reagindo (palmas, levantar, lamentar). Montado no renderizador de teste, sem GPU: conta a geometria de verdade.
 */
import { describe, expect, it } from "vitest";
import { useRef } from "react";
import * as THREE from "three";
import { frames, meshes, mount3d } from "@/test-utils/three";
import { MALHAS_LEVES, MultidaoLeve } from "@/components/flair/nucleos/gente/corpo-leve";
import { Elenco3D } from "@/components/flair/nucleos/gente/elenco-3d";
import { Torcida3D, triangulosDaTorcida } from "@/components/flair/nucleos/gente/torcida-3d";
import { triangulosDe } from "@/components/flair/nucleos/scene/part-geometry";
import type { AtorDeCena } from "@/lib/flair/nucleos/gente/ator";
import { TRIANGULOS_POR_PESSOA } from "@/lib/flair/nucleos/gente/detalhe";
import { atoresDosFigurantes, pessoasDosFigurantes } from "@/lib/flair/nucleos/gente/figurantes";
import { poseLeveDoAtor } from "@/lib/flair/nucleos/gente/leve";
import { torcidaEmDegraus, type HumorDaTorcida } from "@/lib/flair/nucleos/gente/torcida";
import { NUCLEOS } from "@/lib/flair/nucleos/registry";
import { figurantesDaCena } from "@/lib/flair/nucleos/scene/budget";
import { SALAS } from "@/lib/flair/nucleos/scene/registry";

const PASSARELA = figurantesDaCena(SALAS.PASSARELA, NUCLEOS.PASSARELA.personagens);
const altura = (m: THREE.Matrix4) => new THREE.Vector3().setFromMatrixPosition(m).y;
const escala = (m: THREE.Matrix4) => new THREE.Vector3().setFromMatrixScale(m);

describe("multidão leve", () => {
  it("cinco malhas instanciadas para qualquer número de pessoas, sem sombra, com os triângulos do orçamento", () => {
    const pessoas = pessoasDosFigurantes(3, PASSARELA);
    const m = new MultidaoLeve(pessoas.size);
    const malhas = m.grupo.children as THREE.InstancedMesh[];
    expect(malhas.map((x) => x.name)).toEqual(MALHAS_LEVES.map((n) => `leve-${n}`));
    expect(malhas.every((x) => x.isInstancedMesh && x.count === 14 && !x.castShadow)).toBe(true);
    expect(new Set(malhas.map((x) => (x.material as THREE.Material).uuid)).size).toBe(1);
    expect(malhas.reduce((n, x) => n + triangulosDe(x.geometry), 0)).toBe(TRIANGULOS_POR_PESSOA.torcida);
    m.descartar();
  });

  it("senta, levanta e reage pela matriz de cada pessoa; quem sai de cena some sem mexer nas outras", () => {
    const pessoas = [...pessoasDosFigurantes(3, PASSARELA).values()];
    const m = new MultidaoLeve(2);
    m.vestir(0, pessoas[0]);
    m.vestir(1, pessoas[1]);
    const ator: AtorDeCena = { id: "a", x: 2, z: -1, giro: 0, anim: "sit", velocidade: 0 };
    const em = { x: 2, y: 0, z: -1, giro: 0 };
    m.posar(0, em, poseLeveDoAtor(ator, 0));
    const sentada = altura(m.matriz("tronco", 0));
    expect(escala(m.matriz("pernas", 0)).y).toBeCloseTo(escala(m.matriz("tronco", 0)).y * 0.5, 5);
    m.posar(0, em, poseLeveDoAtor({ ...ator, anim: "cheer" }, 0, 0, true));
    expect(altura(m.matriz("tronco", 0))).toBeGreaterThan(sentada + 0.3);
    // as palmas giram só os braços: o tronco fica onde estava
    const antes = m.matriz("bracos", 0).clone();
    m.posar(0, em, poseLeveDoAtor({ ...ator, gesto: "aplaudir" }, 0.2));
    expect(m.matriz("bracos", 0).equals(antes)).toBe(false);
    expect(m.visivel(0)).toBe(true);
    expect(m.visivel(1)).toBe(false);
    m.esconder(0);
    expect(escala(m.matriz("tronco", 0)).length()).toBe(0);
    m.descartar();
  });
});

function Plateia({ atores, limite }: { atores: () => AtorDeCena[]; limite: number }) {
  const prontos = useRef(new Set<string>());
  return <Elenco3D pessoas={pessoasDosFigurantes(3, PASSARELA)} atores={atores} prontos={prontos} reduzido={false} limite={limite} />;
}

describe("plateia da Passarela sem corpos inteiros (a qualidade baixa da cena)", () => {
  it("as 14 pessoas aparecem em 5 chamadas de desenho, nenhum corpo inteiro monta e a plateia aplaude e levanta", async () => {
    let lista = atoresDosFigurantes(PASSARELA);
    const r = await mount3d(<Plateia atores={() => lista} limite={0} />);
    await frames(r, 3);
    const malhas = meshes(r).map((x) => x.instance as THREE.InstancedMesh);
    expect(malhas).toHaveLength(5);
    expect(malhas.every((x) => x.isInstancedMesh)).toBe(true);
    expect((r.scene.findByProps({ name: "moldes" }).instance as THREE.Group).children).toHaveLength(0);
    const tronco = malhas.find((x) => x.name === "leve-tronco")!;
    const m = new THREE.Matrix4();
    const alturas = () => lista.map((_, i) => (tronco.getMatrixAt(i, m), altura(m)));
    const sentadas = alturas();
    // todas no lugar (nenhuma escondida) e sentadas; os fotógrafos, de pé
    expect(sentadas.filter((y) => y < -0.2).length).toBe(12);
    expect(sentadas.filter((y) => y === 0).length).toBe(2);
    lista = lista.map((a) => (a.anim === "sit" ? { ...a, anim: "cheer" as const } : a));
    await frames(r, 3);
    expect(alturas().filter((y, i) => y > sentadas[i] + 0.3).length).toBe(12);
    await r.unmount();
  });
});

describe("torcida do estádio", () => {
  it("a arquibancada inteira são cinco malhas instanciadas e reage ao gol: uns pulam, outros não", async () => {
    const pessoas = torcidaEmDegraus(1, 44, 5, ["#C6275E", "#1F7A76"]);
    let humor: HumorDaTorcida | null = null;
    const r = await mount3d(<Torcida3D pessoas={pessoas} reduzido={false} humor={() => humor} />);
    await frames(r, 2);
    const malhas = meshes(r).map((x) => x.instance as THREE.InstancedMesh);
    expect(malhas).toHaveLength(5);
    expect(malhas.reduce((n, x) => n + triangulosDe(x.geometry), 0)).toBe(triangulosDaTorcida());
    const tronco = malhas[0];
    const m = new THREE.Matrix4();
    const alturas = () => pessoas.map((_, i) => (tronco.getMatrixAt(i, m), altura(m)));
    const parada = alturas();
    parada.forEach((y, i) => expect(y).toBeCloseTo(pessoas[i].y, 4));
    humor = { reacao: "comemora", chave: "lance-3" };
    // 2 s de quadros: todos os atrasos (até 0,9 s) já passaram
    await frames(r, 130);
    const pulando = alturas().filter((y, i) => y > parada[i] + 0.01).length;
    expect(pulando).toBeGreaterThan(0);
    expect(pulando).toBeLessThan(pessoas.length);
    await r.unmount();
  });
});
