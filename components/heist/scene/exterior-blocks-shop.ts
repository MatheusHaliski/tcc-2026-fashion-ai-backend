/*
 * MET Gala Heist v2 — o térreo dos prédios: pilares e friso, a vitrine de cada loja (letreiro, caixilho, porta, vidro,
 * interior do atlas, luz e toldo), a porta de enrolar da loja fechada e a portaria residencial com marquise.
 */
import * as THREE from "three";
import { boxGeo, moldingSouth } from "./exterior-geometry";
import { flyerUV, INT, SHOP_KINDS, SHOPS, SIGN, type ShopKind } from "./exterior-citytex";
import { WALL, type Building } from "./exterior-blocks-layout";
import { iuv, quad, quadX, quadY, suv, type CityKit } from "./exterior-blocks-kit";
import { shopProps } from "./exterior-blocks-shopprops";

/* ---------- térreo: lojas, portaria e pilares ---------- */
function slots(W: number, kinds: ShopKind[]): [number, number][] {
  const edge = 0.55, gap = 0.45, n = kinds.length;
  const lobbyW = 2.6, lobbies = kinds.filter((k) => k === "lobby").length;
  const shopW = (W - edge * 2 - gap * (n - 1) - lobbyW * lobbies) / Math.max(1, n - lobbies);
  const out: [number, number][] = []; let x = edge;
  for (const k of kinds) { const w = k === "lobby" ? lobbyW : shopW; out.push([x, x + w]); x += w + gap; }
  return out;
}
export function groundFloor(kit: CityKit, M: THREE.Matrix4, b: Building, W: number, GF: number, r: () => number) {
  const wall = `wall:${b.tint ?? WALL[b.style]}`;
  const kinds = b.shops.length ? b.shops : (["closed"] as ShopKind[]);
  const sl = slots(W, kinds);
  // pilares entre as lojas e nas pontas (salientes 0,22 m), com base de granito e o friso acima do térreo
  let prev = 0;
  for (const [a, c] of sl) { kit.add(wall, boxGeo(prev, 0, -0.3, a, GF, 0.22), M); kit.add("trim:granite", boxGeo(prev - 0.02, 0, -0.3, a + 0.02, 0.5, 0.25), M); prev = c; }
  kit.add(wall, boxGeo(prev, 0, -0.3, W, GF, 0.22), M); kit.add("trim:granite", boxGeo(prev - 0.02, 0, -0.3, W + 0.02, 0.5, 0.25), M);
  kit.add("trim:stone", moldingSouth([[0, 0], [0.26, 0], [0.3, 0.06], [0.3, 0.16], [0.24, 0.22], [0, 0.24]], -0.02, W + 0.02, 0.0, GF), M);
  kinds.forEach((k, i) => { const [a, c] = sl[i]; if (k === "lobby") lobby(kit, M, a, c, GF, b.detailed); else shop(kit, M, a, c, GF, k, b.detailed, r); });
}

const SIDE_CELL: Partial<Record<ShopKind, number>> = { pharmacy: INT.sideCool, optics: INT.sideCool, gallery: INT.sideCool, jewelry: INT.sideDark, bar: INT.sideDark, bistro: INT.sideDark, closed: INT.sideDark, florist: INT.sideDark };
const FLOOR_CELL: Partial<Record<ShopKind, number>> = { pharmacy: INT.floorStone, optics: INT.floorStone, gallery: INT.floorStone, cafe: INT.floorTile, bistro: INT.floorTile, bar: INT.floorWood, fashion: INT.floorStone, jewelry: INT.floorWood, lobby: INT.floorStone };
const COOL = new Set<ShopKind>(["pharmacy", "optics", "gallery"]);
const LIGHT: Partial<Record<ShopKind, string>> = { pharmacy: "#e8f4ff", optics: "#eef4ff", gallery: "#fff6e8", jewelry: "#ffe8c0", bar: "#ff9a6a", cafe: "#ffc98a", bistro: "#ffb874", florist: "#fff0d0", closed: "#000000" };

function shop(kit: CityKit, M: THREE.Matrix4, a: number, c: number, GF: number, kind: ShopKind, detailed: boolean, r: () => number) {
  const w = c - a, D = 3.2, OH = 3.4, s = SHOPS[kind], mid = (a + c) / 2, frame = kind === "fashion" || kind === "jewelry" || kind === "perfume" || kind === "atelier" ? "trim:bronze" : "trim:dark";
  // letreiro na faixa acima do vão (caixa de luz ou placa) e a moldura dele
  const sy0 = OH + 0.12, sy1 = GF - 0.3, sw = Math.min(w - 0.3, (sy1 - sy0) * 4.2);
  kit.add("sign", quad(mid - sw / 2, sy0, mid + sw / 2, sy1, 0.27, suv(SHOP_KINDS.indexOf(kind))), M);
  kit.add(frame, boxGeo(mid - sw / 2 - 0.05, sy0 - 0.05, 0.12, mid + sw / 2 + 0.05, sy1 + 0.05, 0.26), M);
  kit.add("wall:fascia", boxGeo(a, OH, -0.3, c, GF, 0.12), M);
  if (kind === "closed") {
    // porta de enrolar abaixada, a caixa do rolo e os cartazes colados
    kit.add("gate", boxGeo(a, 0, 0.02, c, OH, 0.06), M);
    kit.add("trim:dark", boxGeo(a, OH - 0.05, 0.02, c, OH + 0.32, 0.3), M);
    for (let k = 0; k < 9; k++) { const fw = 0.42 + r() * 0.12, fx = a + 0.3 + r() * (w - 0.6 - fw), fy = 0.7 + r() * 1.7; kit.add("poster", quad(fx, fy, fx + fw, fy + fw / 0.707, 0.065 + k * 0.0012, flyerUV(Math.floor(r() * 16))), M); }
    kit.add("trim:dark", boxGeo(mid - 0.06, 0.04, 0.06, mid + 0.06, 0.18, 0.1), M);       // cadeado
    return;
  }
  // caixilho da vitrine: rodapé, peitoril, montantes, travessa da bandeira, verga e a porta
  kit.add("trim:granite", boxGeo(a, 0, -0.26, c, 0.48, -0.08), M);
  kit.add(frame, boxGeo(a, 0.48, -0.3, c, 0.54, -0.04), M);
  kit.add(frame, boxGeo(a, OH - 0.08, -0.22, c, OH, -0.06), M);
  kit.add(frame, boxGeo(a, 2.72, -0.2, c, 2.78, -0.08), M);
  const doorW = 1.05, doorX = kind === "fashion" ? mid - doorW / 2 : (r() < 0.5 ? a + 0.25 : c - 0.25 - doorW);
  const bars = [a, a + 0.06, doorX - 0.04, doorX + doorW, c - 0.06].sort((p, q) => p - q);
  for (const x of new Set(bars)) kit.add(frame, boxGeo(Math.max(a, x), 0.48, -0.22, Math.min(c, x + 0.06), OH, -0.06), M);
  for (let x = a + 2.2; x < c - 1.2; x += 2.2) if (x < doorX - 0.5 || x > doorX + doorW + 0.5) kit.add(frame, boxGeo(x, 0.54, -0.2, x + 0.05, 2.72, -0.08), M);
  // porta de vidro: folha com quadro, puxador vertical
  kit.add(frame, boxGeo(doorX, 0, -0.2, doorX + 0.07, 2.72, -0.1), M); kit.add(frame, boxGeo(doorX + doorW - 0.07, 0, -0.2, doorX + doorW, 2.72, -0.1), M);
  kit.add(frame, boxGeo(doorX, 0, -0.2, doorX + doorW, 0.16, -0.1), M);
  kit.add("trim:brass", boxGeo(doorX + doorW - 0.2, 0.9, -0.08, doorX + doorW - 0.17, 1.6, -0.04), M);
  // vidros (vitrine, porta e bandeira), recuados
  kit.add("shopGlass", quad(a + 0.06, 0.54, c - 0.06, OH - 0.08, -0.15, [0, 0, 1, 1]), M);
  // interior: parede do fundo do ramo, laterais, teto e piso
  kit.add("shopInt", quad(a, 0, c, OH - 0.05, -D, iuv(SHOP_KINDS.indexOf(kind))), M);
  const side = SIDE_CELL[kind] ?? INT.sideWarm;
  kit.add("shopInt", quadX(a, -D, -0.25, 0, OH - 0.05, iuv(side), true), M);
  kit.add("shopInt", quadX(c, -D, -0.25, 0, OH - 0.05, iuv(side), false), M);
  kit.add("shopInt", quadY(a, c, -D, -0.25, OH - 0.05, iuv(COOL.has(kind) ? INT.ceilCool : INT.ceilWarm), false), M);
  kit.add("shopInt", quadY(a, c, -D, -0.25, 0.01, iuv(FLOOR_CELL[kind] ?? INT.floorWood), true), M);
  // luz da vitrine: âncora (luz de verdade quando perto da câmera) e a poça dela na calçada
  const col = LIGHT[kind] ?? "#ffd9a0";
  kit.anchors.push({ pos: new THREE.Vector3(mid, 2.4, 0.5).applyMatrix4(M), color: col, i: COOL.has(kind) ? 16 : 13 });
  kit.pools.push({ pos: new THREE.Vector3(mid, 0, 1.3).applyMatrix4(M), rx: w * 0.62, rz: 1.9, color: col, s: COOL.has(kind) ? 0.17 : 0.15, rot: Math.atan2(M.elements[8], M.elements[10]) });
  if (s.neon) kit.glows.push({ pos: new THREE.Vector3(mid, (sy0 + sy1) / 2, 0.5).applyMatrix4(M), size: sw * 0.9, color: s.neon });
  // toldo: lona inclinada (0,9 m para fora), sanefa e as abas, presos acima da vitrine
  if (s.awning !== undefined) {
    const y0 = OH + 0.02, y1 = OH - 0.5, out = 1.0, x0 = a + 0.05, x1 = c - 0.05;
    const cloth = new THREE.BufferGeometry(), [u0, v0, u1, v1] = suv(SIGN.cloth(s.awning));
    cloth.setAttribute("position", new THREE.Float32BufferAttribute([x0, y0, 0.25, x1, y0, 0.25, x1, y1, out, x0, y0, 0.25, x1, y1, out, x0, y1, out], 3));
    cloth.setAttribute("uv", new THREE.Float32BufferAttribute([u0, v1, u1, v1, u1, v0, u0, v1, u1, v0, u0, v0], 2)); cloth.computeVertexNormals();
    kit.add("sign", cloth, M);
    kit.add("sign", quad(x0, y1 - 0.3, x1, y1, out, suv(SIGN.valance(s.awning))), M);
    for (const x of [x0, x1]) { const cheek = new THREE.BufferGeometry(); cheek.setAttribute("position", new THREE.Float32BufferAttribute([x, y0, 0.25, x, y1, out, x, y1 - 0.3, out], 3)); const [cu0, cv0, cu1, cv1] = suv(SIGN.cloth(s.awning)); cheek.setAttribute("uv", new THREE.Float32BufferAttribute([cu0, cv1, cu1, cv0, cu1, (cv0 + cv1) / 2], 2)); cheek.computeVertexNormals(); kit.add("sign", cheek, M); }
    kit.add("trim:dark", boxGeo(x0, y0 - 0.03, 0.16, x1, y0 + 0.03, 0.28), M);
  }
  if (detailed) shopProps(kit, M, a, c, D, kind, r);
}

/** Portaria do prédio residencial: porta dupla de vidro com quadro de latão, número, saguão aceso e a marquise. */
function lobby(kit: CityKit, M: THREE.Matrix4, a: number, c: number, GF: number, detailed: boolean) {
  const w = c - a, mid = (a + c) / 2, OH = 3.0;
  kit.add("wall:fascia", boxGeo(a, OH, -0.3, c, GF, 0.12), M);
  kit.add("trim:brass", boxGeo(a + 0.1, 0, -0.5, a + 0.18, OH, -0.38), M); kit.add("trim:brass", boxGeo(c - 0.18, 0, -0.5, c - 0.1, OH, -0.38), M); kit.add("trim:brass", boxGeo(a + 0.1, OH - 0.1, -0.5, c - 0.1, OH, -0.38), M);
  kit.add("trim:brass", boxGeo(mid - 0.03, 0, -0.5, mid + 0.03, OH - 0.1, -0.4), M);
  kit.add("shopGlass", quad(a + 0.18, 0, c - 0.18, OH - 0.1, -0.45, [0, 0, 1, 1]), M);
  kit.add("shopInt", quad(a, 0, c, OH, -3.2, iuv(SHOP_KINDS.indexOf("lobby"))), M);                    // saguão
  kit.add("shopInt", quadX(a, -3.2, -0.5, 0, OH, iuv(INT.sideWarm), true), M); kit.add("shopInt", quadX(c, -3.2, -0.5, 0, OH, iuv(INT.sideWarm), false), M);
  kit.add("shopInt", quadY(a, c, -3.2, -0.5, OH, iuv(INT.ceilWarm), false), M); kit.add("shopInt", quadY(a, c, -3.2, -0.5, 0.01, iuv(INT.floorStone), true), M);
  // marquise verde do porteiro (balanço de 1,4 m, sem postes na calçada) com a luz embaixo
  kit.add("sign", quad(a - 0.2, OH + 0.05, c + 0.2, OH + 0.4, 1.465, suv(SIGN.valance(SHOPS.lobby.awning!))), M);
  kit.add("trim:awning", boxGeo(a - 0.2, OH + 0.4, -0.3, c + 0.2, OH + 0.5, 1.45), M);
  kit.add("trim:awning", boxGeo(a - 0.2, OH + 0.05, 1.38, c + 0.2, OH + 0.4, 1.45), M);
  kit.glows.push({ pos: new THREE.Vector3(mid, OH + 0.02, 0.8).applyMatrix4(M), size: 1.6, color: "#ffd9a0" });
  kit.anchors.push({ pos: new THREE.Vector3(mid, OH - 0.2, 0.9).applyMatrix4(M), color: "#ffd9a0", i: 12 });
  kit.pools.push({ pos: new THREE.Vector3(mid, 0, 1.0).applyMatrix4(M), rx: w * 0.8, rz: 1.6, color: "#ffd9a0", s: 0.16, rot: Math.atan2(M.elements[8], M.elements[10]) });
  void detailed;
}
