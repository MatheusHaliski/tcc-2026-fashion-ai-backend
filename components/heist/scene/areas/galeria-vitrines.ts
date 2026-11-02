/*
 * MET Gala Heist v2 — galeria (Z07): as vitrines de piso e de parede (campânula de vidro, caixa de luz, deck,
 * manequins com os vestidos e os acessórios). Saiu de galeria-props.ts sem mudança.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import { CYL, SPH, geo } from "../interior-batch";
import type { PropsCtx } from "../interior-props";
import { type Fr, at, bx, frame, lathe, lit, plain } from "./galeria-kit";
import { LBL } from "./galeria-copy";
import { coveTex } from "./galeria-tex";
import { auroraGown, clutch, fan, gloveStand, hat, headStand, pump, satin, tulleGown, velvetGown } from "./galeria-trajes";
import { ROOM, laca, brass, blackSteel, vidro, aresta, velvetDeck, label, anchor } from "./galeria-props-mats";

/** Campânula de vidro grosso (quatro faces e tampo) com arestas polidas: base em y0, topo em y1, w × d. */
function glassHood(c: PropsCtx, F: Fr, w: number, d: number, y0: number, y1: number, back = true) {
  const t = 0.019, gh = y1 - y0, G = vidro(), E = aresta();
  bx(c.batch, ROOM, G, F(0, y0, d / 2 - t / 2, 0, w, gh - t, t));
  if (back) bx(c.batch, ROOM, G, F(0, y0, -d / 2 + t / 2, 0, w, gh - t, t));
  for (const s of [-1, 1]) bx(c.batch, ROOM, G, F(s * (w / 2 - t / 2), y0, 0, 0, t, gh - t, d - 2 * t));
  bx(c.batch, ROOM, G, F(0, y1 - t, 0, 0, w, t, d));
  // arestas: quatro cantos verticais e o contorno do tampo
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(c.batch, ROOM, E, F(sx * (w / 2 - t / 2), y0, sz * (d / 2 - t / 2), 0, t + 0.002, gh, t + 0.002));
  for (const sz of [-1, 1]) bx(c.batch, ROOM, E, F(0, y1 - t, sz * (d / 2 - t / 2), 0, w, t + 0.002, t + 0.002));
  for (const sx of [-1, 1]) bx(c.batch, ROOM, E, F(sx * (w / 2 - t / 2), y1 - t, 0, 0, t + 0.002, t + 0.002, d));
}
/** Caixa de luz sobre a campânula: aço preto, junta de latão, difusor aceso e pontos de fibra óptica. */
function lightAttic(c: PropsCtx, F: Fr, w: number, d: number, y0: number, h: number) {
  bx(c.batch, ROOM, blackSteel(), F(0, y0, 0, 0, w + 0.012, h, d + 0.012), true);
  bx(c.batch, ROOM, brass(), F(0, y0 - 0.003, 0, 0, w + 0.016, 0.006, d + 0.016));
  c.batch.add(ROOM, lit("galeria-difusor", "#ffe9c8", 0.75), geo("galeria-planeDown", () => new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2)), F(0, y0 - 0.022, 0, 0, w - 0.22, 1, d - 0.22));
  const nx = Math.max(2, Math.round(w / 0.35)), nz = Math.max(2, Math.round(d / 0.35));
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) c.inst.add(ROOM, "galeria-fibra", SPH(6), lit("galeria-fibraLuz", "#fff6e6", 3), F(-w / 2 + (i + 0.5) * w / nx, y0 - 0.024, -d / 2 + (j + 0.5) * d / nz, 0, 0.012, 0.004, 0.012));
}

/* ---------- vitrines ---------- */
/** Vitrine de piso (variantes 0 coluna de veludo, 1 Aurora, 2 tule carmim) e de parede (3). */
export function vitrine(p: Prop, c: PropsCtx) {
  if (p.shape.type !== "box") return;
  const s = p.shape, cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2, v = p.variant ?? 0;
  if (v === 3) return wallVitrine(c, cx, cz, s.x1 - s.x0, s.z1 - s.z0);
  const w = s.x1 - s.x0, d = s.z1 - s.z0, F = frame(cx, cz, 0), H0 = 0.42, G1 = 2.5, q = c.q;
  // plinto: rodapé preto recuado, corpo laqueado, filete de latão, porta de serviço nas costas com fechadura
  bx(c.batch, ROOM, blackSteel(), F(0, 0, 0, 0, w - 0.1, 0.07, d - 0.1));
  bx(c.batch, ROOM, laca(), F(0, 0.07, 0, 0, w, H0 - 0.082, d), true);
  bx(c.batch, ROOM, brass(), F(0, H0 - 0.012, 0, 0, w + 0.004, 0.012, d + 0.004));
  bx(c.batch, ROOM, blackSteel(), F(0, 0.11, -d / 2 - 0.0015, 0, w * 0.56, 0.26, 0.003));
  c.batch.add(ROOM, brass(), CYL(14), F(w * 0.22, 0.24, -d / 2 - 0.004, 0, 0.013, 0.006, 0.013, Math.PI / 2));
  for (let k = 0; k < 8; k++) bx(c.batch, ROOM, blackSteel(), F(-w * 0.35 + k * w * 0.1, 0.33, d / 2 + 0.0015, 0, w * 0.06, 0.012, 0.003));   // grelha de ventilação (controle de umidade)
  // deck forrado na cor da seção e o estrado redondo do manequim
  const deck = velvetDeck(`piso${v}`, v === 0 ? "#2a0d20" : v === 1 ? "#0c1328" : "#0a2219", q);
  bx(c.batch, ROOM, deck, F(0, H0, 0, 0, w - 0.03, 0.012, d - 0.03));
  c.batch.add(ROOM, deck, lathe("galeria-estrado", [[0, 0], [0.5, 0], [0.5, 0.06], [0.48, 0.075], [0, 0.075]], 40), F(0, H0 + 0.012, 0));
  c.batch.add(ROOM, brass(), geo("galeria-estradoAro", () => new THREE.TorusGeometry(0.5, 0.004, 6, 48).rotateX(Math.PI / 2)), F(0, H0 + 0.07, 0));
  glassHood(c, F, w, d, H0, G1);
  lightAttic(c, F, w, d, G1, 0.22);
  // fechadura de cilindro na aresta da frente e sensor de vibração colado no vidro (por dentro, no alto)
  c.batch.add(ROOM, plain("galeria-cromo", "#d9dadc", { metal: 1, rough: 0.12 }), CYL(12), F(w / 2 - 0.06, H0 + 0.05, d / 2 + 0.004, 0, 0.012, 0.012, 0.012, Math.PI / 2));
  bx(c.batch, ROOM, plain("galeria-plastico", "#e8e6e0", { rough: 0.5 }), F(-w / 2 + 0.06, G1 - 0.1, d / 2 - 0.026, 0, 0.035, 0.05, 0.012));
  c.inst.add(ROOM, "galeria-ledSensor", SPH(6), lit("galeria-ledVerde", "#2bff6a", 2.2), F(-w / 2 + 0.06, G1 - 0.06, d / 2 - 0.02, 0, 0.003));
  // manequim e vestido (levemente girado, como na exposição)
  const M: Fr = (x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => F(x, H0 + 0.075 + y, z, ry + (v === 1 ? 0 : v === 0 ? 0.32 : -0.32), sx, sy, sz, rx, rz);
  if (v === 1) auroraGown(c.batch, c.inst, ROOM, M, q); else if (v === 0) velvetGown(c.batch, c.inst, ROOM, M, q); else tulleGown(c.batch, c.inst, ROOM, M, q);
  label(c, F, v === 1 ? LBL.aurora : v === 0 ? LBL.velvet : LBL.tulle, w / 2 - 0.3, 0.25, d / 2 + 0.006, 0.34, -0.15);
  anchor(c, at(F, 0, 2.2, 0.1), "#fff1dc", v === 1 ? 9 : 5.5, 4.5);
}
/** Vitrine de parede (acessórios): gabinete com portas, vidro nas quatro faces, degraus forrados e as peças. */
function wallVitrine(c: PropsCtx, cx: number, cz: number, sx: number, sz: number) {
  const west = cx < 0, F = frame(cx, cz, west ? Math.PI / 2 : -Math.PI / 2), L = sz, D = sx, H0 = 0.8, G1 = 2.3, q = c.q;
  const idx = (west ? 0 : 1) + (cz > -14 ? 2 : 0);
  bx(c.batch, ROOM, blackSteel(), F(0, 0, 0, 0, L - 0.08, 0.08, D - 0.08));
  bx(c.batch, ROOM, laca(), F(0, 0.08, 0, 0, L, H0 - 0.09, D), true);
  bx(c.batch, ROOM, brass(), F(0, H0 - 0.012, 0, 0, L + 0.004, 0.012, D + 0.004));
  for (const s of [-1, 1]) {
    bx(c.batch, ROOM, blackSteel(), F(s * L / 4, 0.14, D / 2 + 0.0015, 0, L / 2 - 0.08, H0 - 0.26, 0.003));
    bx(c.batch, ROOM, brass(), F(s * 0.06, 0.42, D / 2 + 0.012, 0, 0.012, 0.16, 0.012));
  }
  const deck = velvetDeck(`parede${west ? "J" : "A"}`, west ? "#2a0d20" : "#0a2219", q);
  bx(c.batch, ROOM, deck, F(0, H0, 0, 0, L - 0.03, 0.012, D - 0.03));
  // degraus forrados (frente baixa, fundo alto)
  for (let k = 0; k < 3; k++) bx(c.batch, ROOM, deck, F(0, H0 + 0.012, -D / 2 + 0.18 + k * 0.26, 0, L - 0.08, 0.36 - k * 0.15, 0.26));
  glassHood(c, F, L, D, H0, G1);
  lightAttic(c, F, L, D, G1, 0.18);
  // fundo forrado do mesmo veludo e a luz da caixa escorrendo por ele (luz pintada: no "low" só há cinco luzes reais)
  bx(c.batch, ROOM, deck, F(0, H0 + 0.012, -D / 2 + 0.021, 0, L - 0.04, G1 - H0 - 0.03, 0.004));
  c.batch.add(ROOM, lit("galeria-vitrineFundo", "#ffd9b0", 0.3, { map: coveTex(), additive: true }), geo("galeria-planoFundo", () => new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0)), F(0, G1 - 0.02, -D / 2 + 0.026, 0, L - 0.08, G1 - H0 - 0.05, 1));
  // degraus: fundo alto, meio e frente baixa (centro em z e altura do topo)
  const y = H0 + 0.012, zT = [-0.42, -0.16, 0.1], hT = [0.36, 0.21, 0.06];
  const kid = satin("pelicaPreta", "#151517", { rough: 0.5 }), ivory = satin("pelicaMarfim", "#efe6d5", { rough: 0.45 }), wine = satin("cetimVinho", "#5a0f22", { rough: 0.35 });
  const head = (x: number, t: number, top: number, kind: number) => { headStand(c.batch, ROOM, F, x, zT[t], y + hT[t], y + hT[t] + top, q); hat(c.batch, ROOM, F, x, zT[t], y + hT[t] + top, kind, q); };
  if (idx === 0) {            // chapéus de noite
    head(-0.62, 0, 0.5, 0); head(0.05, 1, 0.55, 2); head(0.66, 2, 0.45, 1);
  } else if (idx === 1) {     // luvas e bolsas
    gloveStand(c.batch, ROOM, F, -0.55, zT[0], y + hT[0], ivory, 0.46); gloveStand(c.batch, ROOM, F, -0.38, zT[0], y + hT[0], ivory, 0.46);
    gloveStand(c.batch, ROOM, F, 0.25, zT[1], y + hT[1], kid, 0.3);
    clutch(c.batch, ROOM, F, 0.55, y + hT[1], zT[1], -0.3, wine); clutch(c.batch, ROOM, F, -0.05, y + hT[2], zT[2], 0.2, plain("galeria-bolsaDourada", "#c9a24b", { metal: 0.85, rough: 0.35 }));
  } else if (idx === 2) {     // leques e sapatos
    fan(c.batch, ROOM, F, -0.45, y + hT[0] + 0.14, zT[0], 0);
    for (const [x, t, m] of [[0.2, 1, wine], [0.62, 2, satin("cetimMarfim", "#eee3cf", { rough: 0.35 })]] as [number, number, THREE.Material][]) { pump(c.batch, ROOM, F, x - 0.05, y + hT[t], zT[t], 0.5, m); pump(c.batch, ROOM, F, x + 0.06, y + hT[t], zT[t] + 0.02, 0.4, m); }
    fan(c.batch, ROOM, F, -0.1, y + hT[2] + 0.12, zT[2], 0.4);
  } else {                    // chapéus e véus
    head(-0.5, 0, 0.48, 1); head(0.35, 1, 0.5, 0);
    clutch(c.batch, ROOM, F, -0.05, y + hT[2], zT[2], -0.2, kid);
  }
  label(c, F, LBL.wall0 + idx, L / 2 - 0.3, 0.55, D / 2 + 0.006, 0.3, -0.12);
  anchor(c, at(F, 0, 2.0, 0.2), "#fff1dc", 3, 3);
}
