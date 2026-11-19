/**
 * Normalização offline/fallback dos .glb da Meshy: leitura do .glb, par, giro do calçado, centro, braços abertos,
 * abertura, escala nominal, fatores de tamanho e validação do manifesto (dado não confiável do bucket).
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { analyzeGlb, armsSpread, boxOf, heelByHeight, pairCut, shoeYaw, toCanonical } from "./analyze";
import { readGlbGeometry } from "./glb-read";
import { manifestUrlOf, parseManifest } from "./manifest";
import { SLOT_RULES, isAccessoryRule, slotRuleOf } from "./slots";
import { budgetSize } from "./texture-budget";
import { hemOf, hemProfile, tuckedBySector, tuckedIndex } from "./tuck";

const positions = (g: THREE.BufferGeometry) => Float32Array.from(g.getAttribute("position").array as ArrayLike<number>);
function merge(...gs: THREE.BufferGeometry[]): Float32Array {
  return Float32Array.from(gs.flatMap((g) => Array.from(positions(g.toNonIndexed()))));
}

/** Tênis avulso de lado, como a Meshy entrega: comprimento em x, bico em −X (baixo) e cano/contraforte em +X (alto). */
const sideShoe = () => merge(new THREE.BoxGeometry(1.9, 0.4, 0.7, 240, 4, 8).translate(0, 0.2, 0), new THREE.BoxGeometry(0.5, 0.6, 0.6, 60, 6, 6).translate(0.65, 0.7, 0));
/** Par de frente (malha densa, como a da Meshy: o vão é medido pelos vértices): dois pés lado a lado, comprimento em z. */
const pairOfShoes = () => merge(new THREE.BoxGeometry(0.6, 0.4, 1.9, 12, 4, 20).translate(-0.45, 0, 0), new THREE.BoxGeometry(0.6, 0.4, 1.9, 12, 4, 20).translate(0.45, 0, 0));

/** .glb mínimo: um triângulo num nó com translação (o leitor aplica a transformação do nó). */
function tinyGlb(translation = [1, 2, 3]): ArrayBuffer {
  const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), idx = new Uint16Array([0, 1, 2, 0]);
  const bin = new Uint8Array(pos.byteLength + idx.byteLength); bin.set(new Uint8Array(pos.buffer), 0); bin.set(new Uint8Array(idx.buffer), pos.byteLength);
  const json = JSON.stringify({
    asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, translation }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" }, { bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: pos.byteLength }, { buffer: 0, byteOffset: pos.byteLength, byteLength: 6 }],
    buffers: [{ byteLength: bin.byteLength }],
  });
  const jb = new TextEncoder().encode(json.padEnd(Math.ceil(json.length / 4) * 4, " "));
  const out = new ArrayBuffer(12 + 8 + jb.length + 8 + bin.length), v = new DataView(out);
  v.setUint32(0, 0x46546c67, true); v.setUint32(4, 2, true); v.setUint32(8, out.byteLength, true);
  v.setUint32(12, jb.length, true); v.setUint32(16, 0x4e4f534a, true); new Uint8Array(out, 20).set(jb);
  v.setUint32(20 + jb.length, bin.length, true); v.setUint32(24 + jb.length, 0x004e4942, true); new Uint8Array(out, 28 + jb.length).set(bin);
  return out;
}

describe("glb-read", () => {
  it("lê posições e triângulos com a transformação do nó", () => {
    const g = readGlbGeometry(tinyGlb());
    expect(Array.from(g.position)).toEqual([1, 2, 3, 2, 2, 3, 1, 3, 3]);
    expect(Array.from(g.index)).toEqual([0, 1, 2]);
  });
  it("recusa arquivo que não é .glb ou acessor fora do buffer", () => {
    expect(() => readGlbGeometry(new ArrayBuffer(32))).toThrow("GLB_INVALIDO");
    const bad = tinyGlb(); new DataView(bad).setUint32(20 + 0, 0, true);
    expect(() => readGlbGeometry(bad)).toThrow();
  });
});

describe("analyze: eixo, frente, par e centro", () => {
  it("calçado avulso de lado: sem par, gira 90° e o bico (ponta baixa) vai para +Z", () => {
    const p = sideShoe();
    expect(pairCut(p)).toBeNull();
    const yaw = shoeYaw(p, false); expect(yaw).toBeCloseTo(Math.PI / 2);
    const c = toCanonical(p, [0, 0, 0], yaw), b = boxOf(c);
    expect(b.hi[2] - b.lo[2]).toBeCloseTo(1.9, 3);
    // o cano (alto) fica atrás (−Z), o bico na frente
    const tall = boxOf(c, (i) => c[i * 3 + 1] > 0.5);
    expect(tall.hi[2]).toBeLessThan(0);
    expect(heelByHeight(p)).toBeCloseTo(yaw);
  });
  it("par de frente: vão no meio, sem giro", () => {
    const p = pairOfShoes();
    const cut = pairCut(p); expect(cut).not.toBeNull(); expect(Math.abs(cut!)).toBeLessThan(0.1);
    expect(shoeYaw(p, true)).toBe(0);
  });
  it("blusa de braços abertos × blusa com a manga caída", () => {
    const torso = new THREE.BoxGeometry(0.8, 1.4, 0.3, 4, 28, 2);
    const spread = merge(torso, new THREE.BoxGeometry(1.9, 0.25, 0.3, 8, 4, 2).translate(0, 0.55, 0));
    const down = merge(torso, new THREE.BoxGeometry(0.2, 1.2, 0.3, 2, 24, 2).translate(0.55, 0, 0), new THREE.BoxGeometry(0.2, 1.2, 0.3, 2, 24, 2).translate(-0.55, 0, 0));
    expect(armsSpread(spread, boxOf(spread))).toBe(true);
    expect(armsSpread(down, boxOf(down))).toBe(false);
  });
});

describe("analyze: manifesto", () => {
  it("calçado: slot pé, osso do pé, sola, par e tamanhos do calçado como aproximação visual relativa", () => {
    const m = analyzeGlb(pairOfShoes(), SLOT_RULES.loafers, "shoes_piece", "loafers", "shoes");
    expect(m).toMatchObject({ slot: "feet", attach: "rigid", osso: "Foot", giroY: 0, estado: "veste" });
    expect(m.dicas.par).toBe(true); expect(m.dicas.sola).toBeGreaterThan(0);
    expect(m.tamanhos).toMatchObject({ grade: "shoes", convencao: "RELATIVE_VISUAL_APPROXIMATION", alegacaoDeCaimento: "NONE", medidasDoAvatarAlteradas: false });
    expect(m.tamanhos.porPasso.comprimento).toBeGreaterThan(m.tamanhos.porPasso.largura);
    expect(parseManifest(JSON.parse(JSON.stringify(m)))).toEqual(m);
  });
  it("acessório de medida nominal: escala em metros pelo maior lado; chapéu mede a abertura da copa", () => {
    const bag = new THREE.BoxGeometry(1.9, 1.2, 0.5);
    const m = analyzeGlb(positions(bag), SLOT_RULES.handbag, "accessory_piece", "handbag", null);
    expect(m.escalaNominal * 1.9).toBeCloseTo(0.34, 3);
    expect(m.tamanhos.grade).toBeNull();
    const hat = analyzeGlb(positions(new THREE.CylinderGeometry(0.9, 0.9, 1.2, 32, 12)), SLOT_RULES.beanie, "accessory_piece", "beanie", null);
    expect(hat.dicas.abertura).toBeCloseTo(1.8, 1);
    expect(hat.osso).toBe("Head");
  });
  it("roupa: fatores por região diferentes (largura ≠ comprimento ≠ manga); a calça não tem manga", () => {
    const top = analyzeGlb(positions(new THREE.BoxGeometry(1, 1.9, 0.3)), SLOT_RULES.hoodie, "upper_piece", "hoodie", "letter");
    expect(top.attach).toBe("wrap");
    const f = top.tamanhos.porPasso; expect(new Set([f.largura, f.comprimento, f.manga]).size).toBe(3);
    const pants = analyzeGlb(positions(new THREE.BoxGeometry(1, 1.9, 0.3)), SLOT_RULES.cargo_pants, "lower_piece", "cargo_pants", "numeric");
    expect(pants.tamanhos.porPasso.manga).toBe(0);
  });
  it("cinto enrolado: sem suporte, com o motivo", () => {
    const m = analyzeGlb(positions(new THREE.TorusGeometry(0.8, 0.05)), SLOT_RULES.belt, "accessory_piece", "belt", null);
    expect(m.estado).toBe("sem_suporte"); expect(m.motivo).toMatch(/enrolado/);
  });
});

describe("manifest: validação do dado do bucket", () => {
  const good = () => JSON.parse(JSON.stringify(analyzeGlb(sideShoe(), SLOT_RULES.running_shoes, "shoes_piece", "running_shoes", "shoes")));
  it("recusa versão desconhecida, osso inventado, número fora da faixa e tamanho sem fatores", () => {
    expect(parseManifest(good())).not.toBeNull();
    expect(parseManifest({ ...good(), versao: 2 })).toBeNull();
    expect(parseManifest({ ...good(), osso: "constructor" })).toBeNull();
    expect(parseManifest({ ...good(), escalaNominal: 1e9 })).toBeNull();
    expect(parseManifest({ ...good(), giroY: Number.NaN })).toBeNull();
    expect(parseManifest({ ...good(), tamanhos: { ...good().tamanhos, porPasso: { largura: 0.5, comprimento: 0, manga: 0 } } })).toBeNull();
    expect(parseManifest(null)).toBeNull(); expect(parseManifest("x")).toBeNull();
  });
  it("a convenção de tamanho é fixada pelo leitor, não pelo arquivo", () => {
    const m = parseManifest({ ...good(), tamanhos: { ...good().tamanhos, alegacaoDeCaimento: "EXACT", medidasDoAvatarAlteradas: true } })!;
    expect(m.tamanhos.alegacaoDeCaimento).toBe("NONE"); expect(m.tamanhos.medidasDoAvatarAlteradas).toBe(false);
  });
  it("URL do manifesto ao lado do .glb", () => {
    expect(manifestUrlOf("/media/catalog/model3d/a/modelo-web.glb?v=2")).toBe("/media/catalog/model3d/a/modelo-web.fit.json");
    expect(manifestUrlOf("/media/x.png")).toBeNull();
  });
});

describe("slots e orçamento", () => {
  it("regra por subcategoria, e pela categoria quando a subcategoria é nova", () => {
    expect(slotRuleOf("accessory_piece", "Sunglasses")?.slot).toBe("eyes");
    expect(slotRuleOf("shoes_piece", "mule_nova")?.slot).toBe("feet");
    expect(slotRuleOf("accessory_piece", "anel")).toBeNull();
    expect(isAccessoryRule(slotRuleOf(null, "cap"))).toBe(true);
    expect(isAccessoryRule(slotRuleOf(null, "hoodie"))).toBe(false);
  });
  it("textura de 2048 px vai para 1024 mantendo a proporção; 1024 fica", () => {
    expect(budgetSize(2048, 1024)).toEqual({ width: 1024, height: 512 });
    expect(budgetSize(1024, 1024)).toEqual({ width: 1024, height: 1024 });
  });
});

describe("calça debaixo da peça de cima", () => {
  it("some só o triângulo inteiro acima da barra (com margem); a barra é a do tronco, não a da manga", () => {
    const y = [1.0, 1.0, 1.0, 0.9, 0.9, 0.5];
    expect(Array.from(tuckedIndex([0, 1, 2, 2, 3, 4, 3, 4, 5], y, 0.8)!)).toEqual([3, 4, 5]);
    expect(tuckedIndex([3, 4, 5], y, 0.8)).toBeNull();
    expect(hemOf([0.9, 0.7, 0.4], [0, 0, 1])).toBe(0.7);
  });
  it("barra torta: a saia some só no setor em que a peça de cima a cobre; onde a blusa é curta, ela fica", () => {
    // peça de cima: barra a 0,5 do lado +x e a 0,9 do lado −x (posições xyz; tudo tronco)
    const top = [0.2, 1.2, 0.01, 0.2, 0.5, 0.01, -0.2, 1.2, 0.01, -0.2, 0.9, 0.01];
    const profile = hemProfile(top, [0, 0, 0, 0])!;
    // peça de baixo: um triângulo a 0,8 de cada lado
    const low = [0.2, 0.8, 0.01, 0.21, 0.8, 0.01, 0.2, 0.81, 0.01, -0.2, 0.8, 0.01, -0.21, 0.8, 0.01, -0.2, 0.81, 0.01];
    expect(Array.from(tuckedBySector([0, 1, 2, 3, 4, 5], low, profile)!)).toEqual([3, 4, 5]);
    expect(hemProfile(top, [1, 1, 1, 1])).toBeNull();
  });
});
