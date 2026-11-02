/*
 * MET Gala Heist v2 — doca (Z12): os postos de trabalho — estante de aço com a carga da produção, bancada
 * de conferência com o quadro de escalas e a guarita de controle de acesso. Saiu de doca-props.ts sem mudança.
 */
import * as THREE from "three";
import { BOX0, geo } from "../interior-batch";
import { cctvTexture, type PropsCtx } from "../interior-props";
import type { Rect } from "./doca-tex";
import { ROOM, type Foot, type DocaMats, tint, planeUV, boxUV, L, worldOf, bx, cy, decal, rand } from "./doca-mats";
import { seg } from "./doca-empilhadeira";

/** Estante de aço com a carga da produção. */
export function shelf(c: PropsCtx, M: DocaMats, A: Record<string, Rect>, f: Foot, id: string) {
  const W = f.w, D = f.d, H = 2.4, up = "#3c5269", tray = "#8f969c", r = rand(id.length * 31 + id.charCodeAt(id.length - 1));
  // montantes em cantoneira (dois perfis por canto) e sapatas
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (W / 2 - 0.025), z = sz * (D / 2 - 0.025);
    bx(c, M.paint, f, x, 0, z - sz * 0.0, 0.045, H, 0.006, up, { cast: true }); bx(c, M.paint, f, x - sx * 0.0, 0, z, 0.006, H, 0.045, up);
    bx(c, M.rubber, f, x, 0, z, 0.06, 0.012, 0.06);
  }
  // bandejas com aba dobrada na frente e atrás
  const levels = [0.1, 0.58, 1.06, 1.54, 2.02, 2.36];
  for (const y of levels) { bx(c, M.paint, f, 0, y, 0, W - 0.02, 0.02, D - 0.02, tray); for (const s of [-1, 1]) bx(c, M.paint, f, 0, y - 0.03, s * (D / 2 - 0.012), W - 0.02, 0.05, 0.012, tray); }
  // contraventamento em X atrás e a placa de carga máxima
  for (const s of [-1, 1]) bx(c, M.paint, f, 0, 1.2, -D / 2 + 0.008, Math.hypot(W, 2.2), 0.03, 0.004, up, { rz: s * Math.atan2(2.2, W) });
  decal(c, M.signs, f, "maxLoad", A.maxLoad, -W / 2 + 0.3, 2.355, D / 2 + 0.004, 0.3, 0.1);                  // pendurada na aba de cima
  // carga: caixas de papelão, caixas do bufê, organizadores de plástico, fitas, carretéis, latas, toalhas dobradas, cubas
  for (let k = 0; k < levels.length - 1; k++) {
    const y = levels[k] + 0.02, room = levels[k + 1] - levels[k] - 0.06;
    let x = -W / 2 + 0.06;
    while (x < W / 2 - 0.12) {
      const kind = r(), w = 0.22 + r() * 0.3;
      if (x + w > W / 2 - 0.05) break;
      const cx = x + w / 2, dz = (r() - 0.5) * 0.06;
      if (kind < 0.3) { const h = Math.min(room, 0.18 + r() * 0.24); c.batch.add(ROOM, M.signs, boxUV("kraftBox", A.kraftBox), L(f, cx, y, dz, (r() - 0.5) * 0.08, w - 0.02, h, D - 0.12)); }
      else if (kind < 0.48) { const h = Math.min(room, 0.22 + r() * 0.12); c.batch.add(ROOM, M.signs, boxUV("cateringBox", A.cateringBox), L(f, cx, y, dz, (r() - 0.5) * 0.06, w - 0.02, h, D - 0.14)); }
      else if (kind < 0.62) { const col = ["#2f6fb2", "#e2b322", "#3a3d41", "#c7372f"][Math.floor(r() * 4)], h = Math.min(room, 0.24); bx(c, M.plastic, f, cx, y, dz, w - 0.03, h, D - 0.1, col); bx(c, M.plastic, f, cx, y + h, dz, w - 0.01, 0.025, D - 0.08, new THREE.Color(col).multiplyScalar(0.8)); }
      else if (kind < 0.74) { for (let j = 0; j < 3; j++) cy(c, M.plastic, f, cx - w / 2 + 0.06 + j * 0.08, y, dz + (j % 2) * 0.12, 0.05, 0.05, j % 2 ? "#1a1a1a" : "#bfc3c6", { seg: 14 }); }
      else if (kind < 0.84) { cy(c, M.wood, f, cx, y, dz, 0.15, 0.025, undefined, { seg: 18 }); cy(c, M.wood, f, cx, y + 0.21, dz, 0.15, 0.025, undefined, { seg: 18 }); cy(c, M.plastic, f, cx, y + 0.025, dz, 0.11, 0.185, "#1c1c1c", { seg: 16 }); }
      else if (kind < 0.92) { for (let j = 0; j < 2; j++) cy(c, M.paint, f, cx - 0.06 + j * 0.13, y, dz, 0.085, 0.19, j ? "#c9cdd2" : "#e6e2d8", { seg: 16 }); }
      else { const n = 2 + Math.floor(r() * 3); for (let j = 0; j < n; j++) bx(c, M.matte, f, cx, y + j * 0.05, dz, w - 0.04, 0.045, D - 0.16, j % 2 ? "#efeae0" : "#e6e0d2"); }
      x += w + 0.02 + r() * 0.05;
    }
  }
  // no alto: caixas vazias guardadas e o banner da produção enrolado
  const top = levels[levels.length - 1] + 0.02;
  let tx = -W / 2 + 0.08;
  for (let k = 0; k < 3; k++) { const w = 0.3 + r() * 0.25, h = 0.2 + r() * 0.18; if (tx + w > W / 2 - 0.62) break; c.batch.add(ROOM, M.signs, boxUV("kraftBox", A.kraftBox), L(f, tx + w / 2, top, (r() - 0.5) * 0.05, (r() - 0.5) * 0.12, w - 0.02, h, D - 0.12)); tx += w + 0.04; }
  cy(c, M.matte, f, W / 2 - 0.06, top + 0.07, 0.02, 0.07, 0.5, "#24324a", { rz: Math.PI / 2, seg: 14 });
}

/** Bancada de conferência, o quadro de escalas e o cabideiro na parede de trás. */
export function bench(c: PropsCtx, M: DocaMats, A: Record<string, Rect>, f: Foot) {
  const W = f.w, D = f.d, H = 0.9, frame = "#2f3337";
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(c, M.paint, f, sx * (W / 2 - 0.04), 0, sz * (D / 2 - 0.04), 0.05, H - 0.05, 0.05, frame, { cast: true });
  for (const sz of [-1, 1]) bx(c, M.paint, f, 0, 0.16, sz * (D / 2 - 0.04), W - 0.08, 0.04, 0.04, frame);
  bx(c, M.wood, f, 0, 0.2, 0, W - 0.1, 0.02, D - 0.1);                                                // prateleira de baixo
  bx(c, M.wood, f, 0, H - 0.05, 0, W, 0.045, D, undefined, { cast: true });                          // tampo
  bx(c, M.galv, f, 0, H - 0.055, D / 2, W, 0.05, 0.004);                                             // cantoneira da frente
  // embaixo: caixas e a lixeira de pedal
  c.batch.add(ROOM, M.signs, boxUV("kraftBox", A.kraftBox), L(f, -0.55, 0.22, 0, 0.05, 0.5, 0.32, 0.5));
  c.batch.add(ROOM, M.signs, boxUV("cateringBox", A.cateringBox), L(f, 0.05, 0.22, -0.02, -0.04, 0.42, 0.28, 0.45));
  cy(c, M.paint, f, 0.72, 0.22, 0.05, 0.14, 0.42, "#9aa0a5", { seg: 18 });
  // (lixeira de pedal: o saco preto dobrado na boca, a tampa com a dobradiça atrás e o pedal na frente)
  cy(c, M.plastic, f, 0.72, 0.62, 0.05, 0.146, 0.025, "#111", { seg: 18 }); cy(c, M.paint, f, 0.72, 0.64, 0.05, 0.145, 0.025, "#80868c", { seg: 18 });
  bx(c, M.plastic, f, 0.72, 0.62, 0.05 - 0.15, 0.07, 0.04, 0.025, "#2a2a2a"); bx(c, M.plastic, f, 0.72, 0.225, 0.05 + 0.16, 0.1, 0.02, 0.07, "#2a2a2a");
  // em cima: prancheta com a conferência, notebook aberto, impressora de etiquetas, rádio, estilete, fita, café, notas
  const y = H;
  bx(c, M.paint, f, -0.55, y, 0.12, 0.25, 0.012, 0.36, "#6b4a2a", { ry: 0.12 });
  decal(c, M.signs, f, "clipboard", A.clipboard, -0.55, y + 0.014, 0.12, 0.24, 0.35, 0.12, -Math.PI / 2);
  bx(c, M.paint, f, 0.15, y, -0.05, 0.34, 0.018, 0.24, "#2a2d31");                                  // notebook
  bx(c, M.paint, f, 0.15, y + 0.018, -0.17, 0.34, 0.22, 0.012, "#2a2d31", { rx: -0.25 });
  c.batch.add(ROOM, M.lit, planeUV("laptop", A.laptop), L(f, 0.15, y + 0.13, -0.155, 0, 0.3, 0.19, 1, -0.25));         // a planilha da conferência
  bx(c, M.plastic, f, 0.62, y, -0.1, 0.14, 0.12, 0.2, "#e8e6e0"); bx(c, M.plastic, f, 0.62, y + 0.12, -0.05, 0.12, 0.012, 0.06, "#1a1a1a");  // impressora de etiquetas
  bx(c, M.plastic, f, -0.15, y, 0.18, 0.06, 0.16, 0.035, "#141414", { ry: 0.3 }); cy(c, M.plastic, f, -0.13, y + 0.16, 0.18, 0.006, 0.14, "#141414");  // rádio
  bx(c, M.plastic, f, 0.4, y, 0.25, 0.14, 0.012, 0.025, "#f2c230", { ry: 0.6 });                   // estilete
  c.batch.add(ROOM, M.plastic, tint(geo("doca-tape", () => new THREE.TorusGeometry(0.045, 0.02, 8, 18).rotateX(Math.PI / 2)), "doca-tape", "#c9b48a"), L(f, 0.85, y + 0.02, 0.2));
  cy(c, M.plastic, f, 0.9, y, -0.15, 0.04, 0.1, "#f1eee6");                                         // copo de café
  for (let k = 0; k < 4; k++) bx(c, M.matte, f, -0.85 + k * 0.004, y + k * 0.004, -0.12, 0.21, 0.004, 0.3, k % 2 ? "#f4f1e8" : "#fff59d", { ry: 0.05 * k });
  // na parede de trás (a 1,2 m do chão): quadro de escalas com moldura de alumínio e bandeja; cabideiro com coletes
  const wz = -D / 2 - 0.035;
  bx(c, M.alu, f, 0, 1.12, wz, 1.56, 1.0, 0.02);
  decal(c, M.signs, f, "schedule", A.schedule, 0, 1.62, wz + 0.012, 1.5, 0.94);
  bx(c, M.alu, f, 0, 1.08, wz + 0.04, 1.4, 0.03, 0.06);
  for (let k = 0; k < 3; k++) cy(c, M.plastic, f, -0.2 + k * 0.08, 1.115, wz + 0.05, 0.008, 0.12, ["#1e3a8a", "#b3121e", "#111"][k], { rz: Math.PI / 2 });
  // cabideiro: tábua com ganchos e as peças penduradas (colete refletivo, jaqueta da segurança, avental do bufê)
  const hx = W / 2 + 0.75;
  bx(c, M.wood, f, hx, 1.62, wz + 0.01, 1.1, 0.12, 0.025);
  const items = ["vest", "jacket", "vest", "apron"];
  items.forEach((it, k) => {
    const x = hx - 0.42 + k * 0.28; cy(c, M.chrome, f, x, 1.68, wz + 0.05, 0.008, 0.08, undefined, { rx: Math.PI / 2 });
    for (const s of [-1, 1]) decal(c, M.signs, f, it, A[it], x + s * 0.004, 1.32, wz + 0.07 + s * 0.012, 0.3, 0.45, s * 0.25);
  });
  // capacetes no gancho da ponta
  c.batch.add(ROOM, M.plastic, tint(geo("doca-helmet", () => new THREE.SphereGeometry(0.13, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.85, 1.15)), "doca-helmet", "#f2f2ee"), L(f, hx + 0.48, 1.6, wz + 0.15));
}

/** Guarita de controle de acesso: chapa em baixo, vidro em cima, porta lateral, balcão do passa-documentos e o interior. */
export function booth(c: PropsCtx, M: DocaMats, A: Record<string, Rect>, f: Foot) {
  const W = f.w, D = f.d, H = 2.6, sill = 1.0, top = 2.3, white = "#e9e8e2", frame = "#4a5058";
  // a frente (+z local) dá para a doca; o fundo (−z) encosta na parede. Base e telhado
  bx(c, M.matte, f, 0, 0, 0, W, 0.1, D, "#6a6f74");
  bx(c, M.paint, f, 0, top, 0, W + 0.16, 0.08, D + 0.12, frame, { cast: true });
  bx(c, M.paint, f, 0, top + 0.08, 0, W + 0.06, 0.18, D + 0.02, white);
  decal(c, M.signs, f, "booth", A.booth, 0, top + 0.17, D / 2 + 0.015, W - 0.1, 0.16);
  // montantes nos cantos
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(c, M.paint, f, sx * (W / 2 - 0.03), 0.1, sz * (D / 2 - 0.03), 0.06, top - 0.1, 0.06, frame, { cast: true });
  // painéis de baixo (frente e lateral direita) e de cima com vidro; a lateral esquerda tem a porta
  const glassPanel = (x: number, z: number, ry: number, w: number) => {
    bx(c, M.paint, f, x, 0.1, z, w, sill - 0.1, 0.04, white, { ry, cast: true });
    bx(c, M.paint, f, x, sill, z, w, 0.04, 0.06, frame, { ry });
    c.batch.add(ROOM, M.glass, BOX0(), L(f, x, sill + 0.04, z, ry, w - 0.02, top - sill - 0.06, 0.008));
  };
  glassPanel(0, D / 2 - 0.03, 0, W - 0.1);
  glassPanel(W / 2 - 0.03, 0, Math.PI / 2, D - 0.1);
  // passa-documentos: caixilho de correr aberto na frente e o balcãozinho
  bx(c, M.paint, f, 0.22, sill + 0.04, D / 2 - 0.01, 0.5, 0.36, 0.03, frame);
  c.batch.add(ROOM, M.glass, BOX0(), L(f, -0.1, sill + 0.06, D / 2 + 0.005, 0, 0.46, 0.34, 0.008));
  bx(c, M.wood, f, 0.1, sill - 0.02, D / 2 - 0.12, 0.8, 0.03, 0.2);
  // lateral esquerda (−x local): porta com vidro em cima, maçaneta
  bx(c, M.paint, f, -W / 2 + 0.03, 0.1, D / 2 - 0.35, 0.04, top - 0.1, 0.6, white, { cast: true });
  bx(c, M.paint, f, -W / 2 + 0.03, 0.1, -D / 2 + 0.12, 0.04, top - 0.1, 0.2, white);
  bx(c, M.paint, f, -W / 2 + 0.03, 0.1, -0.2, 0.04, 0.95, 0.75, "#d9d8d2");
  c.batch.add(ROOM, M.glass, BOX0(), L(f, -W / 2 + 0.03, 1.1, -0.2, 0, 0.008, 1.1, 0.7));
  bx(c, M.paint, f, -W / 2 + 0.03, 0.1, -0.2, 0.05, 2.15, 0.04, frame); bx(c, M.paint, f, -W / 2 + 0.03, 2.2, -0.2, 0.05, 0.05, 0.75, frame);
  cy(c, M.chrome, f, -W / 2 - 0.01, 1.0, 0.08, 0.01, 0.12, undefined, { rx: Math.PI / 2 });
  // fundo (contra a parede da doca): chapa
  bx(c, M.paint, f, 0, 0.1, -D / 2 + 0.02, W - 0.06, top - 0.1, 0.03, white);
  // dentro: mesa em L, cadeira, monitor do circuito, livro de registro, rádio no carregador, ventilador, calendário
  bx(c, M.wood, f, 0.05, 0.72, D / 2 - 0.42, W - 0.24, 0.035, 0.5); bx(c, M.wood, f, W / 2 - 0.32, 0.72, -0.05, 0.45, 0.035, D - 0.5);
  for (const [x, z] of [[-W / 2 + 0.2, D / 2 - 0.2], [W / 2 - 0.15, -D / 2 + 0.25]]) bx(c, M.paint, f, x, 0.1, z, 0.04, 0.62, 0.04, frame);
  bx(c, M.paint, f, 0.3, 0.755, D / 2 - 0.55, 0.42, 0.28, 0.04, "#151515", { ry: Math.PI });
  const scr = new THREE.Mesh(geo("plane", () => new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: cctvTexture(20), color: new THREE.Color(1.25, 1.25, 1.25) }));
  scr.matrixAutoUpdate = false; scr.matrix.copy(L(f, 0.3, 0.9, D / 2 - 0.575, Math.PI, 0.38, 0.24, 1)); scr.userData.room = ROOM; c.group.add(scr); c.animated.push({ kind: "cctv", mesh: scr, room: ROOM });
  bx(c, M.paint, f, -0.25, 0.755, D / 2 - 0.4, 0.32, 0.03, 0.24, "#1d2a4a", { ry: 0.1 });          // livro de registro
  bx(c, M.plastic, f, 0.55, 0.755, -0.3, 0.1, 0.06, 0.12, "#1a1a1a"); bx(c, M.plastic, f, 0.55, 0.815, -0.3, 0.05, 0.16, 0.03, "#111");
  cy(c, M.paint, f, -0.2, 0.1, -0.1, 0.22, 0.04, "#202020", { seg: 18 }); cy(c, M.paint, f, -0.2, 0.14, -0.1, 0.025, 0.36, "#202020");
  bx(c, M.matte, f, -0.2, 0.5, -0.1, 0.42, 0.06, 0.42, "#26303c"); bx(c, M.matte, f, -0.2, 0.56, -0.3, 0.4, 0.42, 0.06, "#26303c", { rx: -0.12 });
  cy(c, M.plastic, f, -W / 2 + 0.25, 0.755, -D / 2 + 0.25, 0.06, 0.03, "#e8e8e4"); c.batch.add(ROOM, M.plastic, tint(geo("doca-fan", () => new THREE.TorusGeometry(0.11, 0.008, 4, 18)), "doca-fan", "#e8e8e4"), L(f, -W / 2 + 0.25, 0.92, -D / 2 + 0.27));
  // luz de teto da guarita (calha com tubo) e o ponto de luz
  bx(c, M.paint, f, 0, top - 0.05, 0, 0.7, 0.04, 0.1, "#e9e8e2"); c.batch.add(ROOM, M.led, BOX0(), L(f, 0, top - 0.065, 0, 0, 0.62, 0.02, 0.05));
  const lp = worldOf(f, 0, top - 0.25, 0); c.anchors.push({ x: lp.x, y: lp.y, z: lp.z, color: "#eef6ff", intensity: 2.6, distance: 3.2, room: ROOM, flicker: 0 });
}
