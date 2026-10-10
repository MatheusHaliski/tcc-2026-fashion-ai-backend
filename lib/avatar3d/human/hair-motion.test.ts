import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { parseBodyAsset, type BodyMeta } from "./asset";
import { compose, fitBody } from "./compose";
import { buildHuman } from "./three-human";
import { applyIdle, applyRestPose, glance, weightShift } from "./pose";
import { HAIR_MOTION_VERTEX, HairSpring, baseHairS, hairMotionUniforms, patchHairMotion, windVector } from "./hair-motion";
import { strandMaterial } from "./hair-strands";

const dir = new URL("../../../public/avatar3d/body/", import.meta.url);
const meta = JSON.parse(readFileSync(new URL("fai-body-v1.json", dir), "utf-8")) as BodyMeta;
const bin = readFileSync(new URL("fai-body-v1.bin", dir));
const asset = parseBodyAsset(meta, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength));

describe("movimento do cabelo (HAIR-MOTION)", () => {
  it("mola do atraso: parada não desloca; a cabeça anda e as pontas ficam para trás, depois voltam sem ficar balançando", () => {
    const s = new HairSpring(); const a = new THREE.Vector3(0, 1.5, 0);
    for (let i = 0; i < 30; i++) s.step(1 / 60, a);
    expect(s.lag.length()).toBeLessThan(1e-6);
    a.x += 0.03; s.step(1 / 60, a);
    expect(s.lag.x).toBeLessThan(-0.02);                                       // ficou para trás (−x)
    let over = 0; for (let i = 0; i < 180; i++) { s.step(1 / 60, a); over = Math.max(over, s.lag.x); }
    expect(Math.abs(s.lag.x)).toBeLessThan(0.002);                             // 3 s depois, voltou
    expect(over).toBeLessThan(0.03 * 0.35);                                    // passa um pouco, não oscila
    a.x += 0.5; s.step(1 / 60, a); expect(s.lag.length()).toBeLessThanOrEqual(0.045 + 1e-9);   // limitado
    s.step(1, a); expect(s.lag.length()).toBe(0);                               // quadro travado (aba em segundo plano): recomeça
  });

  it("vento: força em metros na ponta (até 3 cm), joga o cabelo para trás; zero sem vento", () => {
    expect(windVector(1).length()).toBeCloseTo(0.03, 6); expect(windVector(0.5).length()).toBeCloseTo(0.015, 6);
    expect(windVector(3).length()).toBeCloseTo(0.03, 6); expect(windVector(0).length()).toBe(0);
    expect(windVector(1).z).toBeLessThan(0);
  });

  it("distância da raiz na base: zero no crânio, cresce abaixo da orelha (com o trecho do crânio)", () => {
    const pos = new Float32Array([0, 1.6, 0, 0, 1.5, 0, 0, 1.3, 0]); const s = baseHairS(pos, 3, 1.5);
    expect(s[0]).toBe(0); expect(s[1]).toBeCloseTo(0.11, 6); expect(s[2]).toBeCloseTo(0.31, 6);
  });

  it("o trecho do shader entra depois do skinning e mantém o brilho de fio do material (onBeforeCompile encadeado)", () => {
    const m = strandMaterial("#33241a"); const u = hairMotionUniforms(); patchHairMotion(m, u); patchHairMotion(m, u);   // idempotente
    const shader = { uniforms: {} as Record<string, unknown>, vertexShader: "void main(){\n#include <skinning_vertex>\n}", fragmentShader: "#include <lights_fragment_end>" };
    m.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
    expect(shader.vertexShader).toContain("attribute float hairS"); expect(shader.vertexShader).toContain("hairLag");
    expect(shader.vertexShader.match(/#include <skinning_vertex>/g)?.length).toBe(1);
    expect(shader.fragmentShader).toContain("Kajiya") ;                         // não perdeu o brilho de fio
    expect(shader.uniforms.hairWind).toBe(u.hairWind); expect(m.customProgramCacheKey()).toContain("fai-hair-motion");
    expect(HAIR_MOTION_VERTEX).toContain("if ( into < 0.0 ) hd -= into * hn");  // nunca para dentro da cabeça
  });
});

describe("movimento natural do corpo (HAIR-MOTION)", () => {
  const c = compose(asset, fitBody(asset, { sex: "FEMININO" }).z, null, 1.66);
  const h = buildHuman(asset, c, { skin: "#c99a6e" }); const st = applyRestPose(h);
  const world = (n: string) => { h.root.updateMatrixWorld(true); return new THREE.Vector3().setFromMatrixPosition(h.bone(n).matrixWorld); };

  it("troca de apoio com pausa (fica numa perna) e olhada para o lado de 5–10°, de vez em quando", () => {
    const ws = Array.from({ length: 2700 }, (_, i) => weightShift(i / 100));
    expect(Math.max(...ws)).toBeGreaterThan(0.95); expect(Math.min(...ws)).toBeLessThan(-0.95);
    expect(ws.filter((w) => Math.abs(w) > 0.8).length / ws.length).toBeGreaterThan(0.45);   // passa tempo apoiada
    const g = Array.from({ length: 2100 }, (_, i) => glance(i / 100));
    const peak = Math.max(...g.map((x) => Math.abs(x.yaw))); expect(peak).toBeGreaterThanOrEqual(5); expect(peak).toBeLessThanOrEqual(10);
    expect(g.filter((x) => x.on === 0).length / g.length).toBeGreaterThan(0.4);  // não fica olhando para o lado o tempo todo
  });

  it("os pés ficam no chão e no lugar enquanto o quadril troca de apoio (deslize < 1,5 cm, sem afundar)", () => {
    applyIdle(h, st, 0, 0); const l0 = world("LeftFoot"), r0 = world("RightFoot");
    let slide = 0, sink = 0;
    for (let t = 0; t < 27; t += 0.25) {
      applyIdle(h, st, t, 1); const l = world("LeftFoot"), r = world("RightFoot");
      slide = Math.max(slide, Math.hypot(l.x - l0.x, l.z - l0.z), Math.hypot(r.x - r0.x, r.z - r0.z));
      sink = Math.max(sink, l0.y - l.y, r0.y - r.y);
    }
    expect(slide).toBeLessThan(0.015); expect(sink).toBeLessThan(0.01);
    applyIdle(h, st, 5, 0); expect(world("LeftFoot").distanceTo(l0)).toBeLessThan(1e-6);   // reduzir movimento: estátua
  });
});
