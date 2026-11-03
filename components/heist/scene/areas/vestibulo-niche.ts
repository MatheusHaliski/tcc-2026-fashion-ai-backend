/*
 * MET Gala Heist v2 — Vestíbulo: os nichos com arco da parede sul. Moldura saliente de calcário, fundo côncavo
 * vermelho-pompeiano, filete e fecho dourados, prateleira de Carrara em consolas, luz rasante de baixo (fita escondida e
 * a mancha subindo pelo fundo) e o conteúdo: a estátua de mármore (oeste) ou a urna de Botticino com rosas (leste).
 */
import * as THREE from "three";
import { BOX0, mat, mul } from "../interior-batch";
import { statueGeometry } from "../interior-dress";
import { roseGeometry } from "../interior-hall";
import { type RoomsCtx, A, PLANE } from "./kit";
import { ROOM, archFrameGeo, lathe, profileGeo, vGeo, vGlow, vSolid, vTex, type Side, type VPalette } from "./vestibulo-kit";
import { at, wb } from "./vestibulo-walls-kit";

/** Nicho com arco: moldura saliente, fundo côncavo vermelho-pompeiano, prateleira em consola e luz rasante de baixo. */
export function niche(c: RoomsCtx, V: VPalette, w: Side, s: number, content: "statue" | "urn") {
  const r = 0.55, sill = 1.25, spring = 3.15, depth = 0.32;
  const red = vSolid("nicheRed", "#6b1e18", { rough: 0.8, env: 0.4, side: THREE.DoubleSide });
  c.batch.add(ROOM, V.stoneMold, archFrameGeo("niche", r, 0.17, spring - sill, depth, 0), mul(at(w, s, sill, 0), mat(0, 0, 0)), { cast: true });
  // fundo: meio cilindro e quarto de esfera achatados (cabem nos 32 cm da moldura), vistos por dentro
  c.batch.add(ROOM, red, vGeo("nicheApse", () => new THREE.CylinderGeometry(r, r, spring - sill, 28, 1, true, Math.PI / 2, Math.PI).scale(1, 1, depth / r).translate(0, (spring - sill) / 2, depth)), mul(at(w, s, sill, 0), mat(0, 0, 0)), { receive: true });
  c.batch.add(ROOM, red, vGeo("nicheDome", () => new THREE.SphereGeometry(r, 28, 10, Math.PI, Math.PI, 0, Math.PI / 2).scale(1, 1, depth / r).translate(0, 0, depth)), mul(at(w, s, spring, 0), mat(0, 0, 0)));
  // filete dourado no arranque do arco, fecho (aduela) e a prateleira com consola
  c.batch.add(ROOM, V.gilt, vGeo("nicheImpost", () => new THREE.TorusGeometry(r, 0.012, 6, 32, Math.PI)), mul(at(w, s, spring, depth - 0.01), mat(0, 0, 0)));
  wb(c, V.giltBright, w, s, spring + r + 0.02, depth - 0.02, 0.16, 0.22, 0.06);
  c.batch.add(ROOM, V.carrara, profileGeo("nicheSill", [[0.4, 0], [0.42, 0.03], [0.42, 0.09], [0.38, 0.12]], 1.3), at(w, s, sill - 0.12));
  for (const sx of [-0.35, 0.35]) c.batch.add(ROOM, V.stoneMold, profileGeo("nicheCorbel", [[0.02, 0], [0.12, 0.08], [0.2, 0.22], [0.3, 0.27]], 0.12), at(w, s + sx * (w === "S" || w === "W" ? -1 : 1), sill - 0.39));
  // luz rasante: fita escondida na prateleira e a mancha de luz subindo pelo fundo
  c.inst.add(ROOM, "vestibulo-nicheLed", BOX0(), vGlow("nicheLed", "#ffcf8a", 2.4), mul(at(w, s, sill + 0.005, depth - 0.06), mat(0, 0, 0, 0, 0.9, 0.01, 0.015)));
  c.batch.add(ROOM, vGlow("nicheWash", "#ffb46a", 0.7, { additive: true, map: nicheWashTexture() }), PLANE(), mul(at(w, s, sill + 1.0, 0.03), mat(0, 0, 0, 0, 1.05, 2.0, 1)));
  const p = new THREE.Vector3(0, sill + 0.6, depth + 0.25).applyMatrix4(at(w, s, 0));
  A(c, ROOM, p.x, p.y, p.z, "#ffcf9a", 1.8, 2.6);
  if (content === "statue") {
    const marble = vSolid("statueMarble", "#f0ebe2", { rough: 0.34, env: 0.9 });
    c.batch.add(ROOM, V.nero, BOX0(), mul(at(w, s, sill, 0.17), mat(0, 0, 0, 0, 0.34, 0.12, 0.26)));
    c.batch.add(ROOM, marble, statueGeometry(1), mul(at(w, s, sill + 0.12, 0.17), mat(0, 0, 0, 0.35, 0.82)), { cast: true });
  } else {
    // urna de Botticino com rosas brancas e folhagem
    c.batch.add(ROOM, V.botticino, lathe("nicheUrn", [[0, 0], [0.11, 0], [0.12, 0.03], [0.07, 0.07], [0.07, 0.12], [0.16, 0.22], [0.2, 0.36], [0.19, 0.46], [0.15, 0.52], [0.18, 0.56], [0.18, 0.58], [0, 0.58]], 28), mul(at(w, s, sill, 0.17), mat(0, 0, 0)), { cast: true });
    c.batch.add(ROOM, V.gilt, vGeo("urnBand", () => new THREE.TorusGeometry(0.2, 0.008, 6, 32).rotateX(Math.PI / 2)), mul(at(w, s, sill + 0.36, 0.17), mat(0, 0, 0)));
    const rose = roseGeometry(c.q), roseMat = vSolid("roseWhite", "#ffffff", { rough: 0.7, side: THREE.DoubleSide, env: 0.4 });
    let seed = 13; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let k = 0; k < 26; k++) {
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 0.22, y = sill + 0.6 + rnd() * 0.32 + (0.22 - rr) * 0.5;
      c.inst.add(ROOM, "vestibulo-rose", rose, roseMat, mul(at(w, s, y, 0.17), mat(Math.cos(a) * rr, 0, Math.sin(a) * rr * 0.6, a, 0.075 + rnd() * 0.02)), new THREE.Color(k % 5 ? "#f6f1e6" : "#efd9df"));
    }
    const leaf = vGeo("nicheLeaf", () => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.05, 0.12, 0, 0.26); sh.quadraticCurveTo(-0.05, 0.12, 0, 0); return new THREE.ShapeGeometry(sh, 3); });
    const lm = vSolid("leafGreen", "#2c4f2a", { rough: 0.7, side: THREE.DoubleSide, env: 0.3 });
    for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2; c.inst.add(ROOM, "vestibulo-nicheLeaf", leaf, lm, mul(at(w, s, sill + 0.55, 0.17), mat(Math.cos(a) * 0.17, 0, Math.sin(a) * 0.1, -a + Math.PI / 2, 1, 1, 1, 0.9 + (k % 3) * 0.15))); }
  }
}
function nicheWashTexture(): THREE.Texture {
  return vTex("nicheWash", 128, 256, (g, w, h) => {
    const v = g.createLinearGradient(0, h, 0, 0); v.addColorStop(0, "rgba(255,255,255,0.95)"); v.addColorStop(0.35, "rgba(255,255,255,0.45)"); v.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = v; g.fillRect(0, 0, w, h);
    const e = g.createLinearGradient(0, 0, w, 0); e.addColorStop(0, "rgba(0,0,0,1)"); e.addColorStop(0.25, "rgba(0,0,0,0)"); e.addColorStop(0.75, "rgba(0,0,0,0)"); e.addColorStop(1, "rgba(0,0,0,1)");
    g.globalCompositeOperation = "destination-out"; g.fillStyle = e; g.fillRect(0, 0, w, h); g.globalCompositeOperation = "source-over";
  }, false);
}
