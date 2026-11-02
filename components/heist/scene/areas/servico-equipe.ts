/*
 * MET Gala Heist v2 — Labirinto de serviço: o que a equipe usa e deixa pelas paredes e cantos — porta da câmara fria,
 * cortina de tiras da cozinha, armários (o uniforme), quadro de avisos, o que ficou pelo caminho (lixeiras, cavalete,
 * caixa de ferramentas, engradados, balde), o quadro elétrico, tomadas, tubos de queda, alçapão e manchas no forro.
 * Saiu de servico.ts sem mudança (servico.ts chama na mesma ordem, com a mesma paleta e o mesmo sorteio).
 */
import * as THREE from "three";
import { BOX0, CYL, geo, mat } from "../interior-batch";
import { glow, solid } from "../interior-mats";
import { drawnTexture } from "../interior-tex";
import type { RoomsCtx } from "./kit";
import { Fr, once, rbox, sign, signOn, type MazeInfo, type SPalette } from "./servico-kit";
import { pedalBin, stripCurtain, wallClock, wetFloorSign } from "./servico-pecas";
import { H } from "./servico-quads";

const room = "servico";

/** Câmara fria, cortina da cozinha, armários da equipe e o quadro de avisos com o relógio. */
export function staffFixtures(c: RoomsCtx, S: SPalette, R: () => number) {
  /* ---------- porta da câmara fria na parede do prédio (oeste) ---------- */
  {
    const f = Fr.at(c, room, -22, 0, -3.25, Math.PI / 2);
    f.box(S.inox, 0, 0, 0.03, 1.36, 2.32, 0.06);                                  // marco de inox
    f.rbox(S.plasticWhite, 0.02, 0.06, 0.11, 1.08, 2.08, 0.12, 0.02, 0, true);    // folha isolada (PU)
    f.box(S.rubberGrey, 0.02, 0.06, 0.055, 1.12, 2.12, 0.01);
    f.box(S.inox, 0.02, 0.06, 0.172, 1.0, 0.3, 0.004);                            // chapa de chute
    for (const y of [0.35, 1.8]) { f.rbox(S.chrome, -0.52, y, 0.13, 0.08, 0.2, 0.08, 0.015); f.cylZ(S.chrome, -0.5, y + 0.1, 0.18, 0.012, 0.06, 8); }
    f.rbox(S.chrome, 0.42, 1.0, 0.18, 0.1, 0.22, 0.07, 0.015); f.box(S.chrome, 0.3, 1.08, 0.22, 0.28, 0.035, 0.03, -0.12);
    f.box(S.steelBlack, 0.0, 2.2, 0.075, 0.24, 0.1, 0.03); f.box(glow("srv-tempRed", "#ff3a2a", 2.2), 0.0, 2.225, 0.091, 0.16, 0.05, 0.002);
    signOn(c, f, "cold", 0.02, 1.62, 0.172, 0.18);
    signOn(c, f, "temp", 0.3, 1.32, 0.172, 0.14, { depth: 0.0015 });
  }
  /* ---------- cortina de tiras na entrada da cozinha, com a sanca de drywall e as placas ---------- */
  {
    const z = -0.25;
    c.batch.add(room, solid("srv-header", "#d9d6cf", { rough: 0.85 }), BOX0(), mat(-17.25, 2.45, z, 0, 1.5, H - 2.45, 0.5));
    stripCurtain(c, room, -17.25, z + 0.24, 0, 1.5, 2.45);
    sign(c, room, "kitchen", -17.25, 2.82, z + 0.251, 0, 0.2);
    sign(c, room, "hairnet", -17.98, 1.62, 0.6, Math.PI / 2, 0.36);
    sign(c, room, "noSmoking", -17.98, 1.62, 1.12, Math.PI / 2, 0.36);
  }
  /* ---------- armários da equipe (o uniforme): quatro portas com veneziana, número, cadeado; a 3 entreaberta ---------- */
  {
    const f = Fr.at(c, room, -12.5, 0, 0.48, -Math.PI / 2), lw = 0.35;
    f.box(S.paintGrey, 0, 0, 0.02, 4 * lw + 0.02, 0.08, 0.3);
    for (let i = 0; i < 4; i++) {
      const x = -1.5 * lw + i * lw, open = i === 2;
      f.box(S.paintGrey, x, 0.08, 0.16, lw - 0.006, 1.84, 0.32 - 0.02);
      const d = open ? f.sub(x - lw / 2 + 0.01, 0, 0.31, -1.1) : f.sub(x - lw / 2 + 0.01, 0, 0.31);
      d.box(S.paintGrey, lw / 2 - 0.01, 0.1, 0.0, lw - 0.016, 1.8, 0.018);
      for (let s = 0; s < 5; s++) { d.i("srv-louver", BOX0(), S.steelBlack, lw / 2 - 0.01, 1.55 + s * 0.035, 0.012, 0, lw * 0.6, 0.012, 0.004); d.i("srv-louver", BOX0(), S.steelBlack, lw / 2 - 0.01, 0.22 + s * 0.035, 0.012, 0, lw * 0.6, 0.012, 0.004); }
      d.box(S.chrome, lw - 0.06, 0.95, 0.014, 0.03, 0.12, 0.02);
      d.box(S.paper, lw / 2 - 0.01, 1.42, 0.011, 0.08, 0.04, 0.002);
      if (!open) { d.g(S.brass, geo("srv-padlock", () => new THREE.TorusGeometry(0.014, 0.003, 4, 10, Math.PI)), lw - 0.06, 1.07, 0.03); d.box(S.brass, lw - 0.06, 1.035, 0.03, 0.03, 0.035, 0.012); }
      if (open) {
        // dentro: o dólmã branco no cabide, avental e o boné da equipe na prateleira
        f.box(S.paintGrey, x, 1.62, 0.16, lw - 0.03, 0.012, 0.28);
        f.cylX(S.chrome, x, 1.55, 0.16, 0.006, lw - 0.04, 6);
        f.g(solid("srv-uniform", "#efeee8", { rough: 0.9 }), geo("srv-jacket", () => new THREE.CapsuleGeometry(0.12, 0.42, 4, 10).scale(1, 1, 0.45)), x, 1.18, 0.16);
        f.g(S.plasticBlack, rbox(0.16, 0.06, 0.2, 0.03), x, 1.63, 0.15);
      }
    }
  }
  /* ---------- quadro de avisos de cortiça ao lado dos armários e o relógio ---------- */
  {
    const f = Fr.at(c, room, -12.5, 0, 2.75, -Math.PI / 2);
    f.box(S.wood, 0, 1.15, 0.01, 0.9, 0.62, 0.02); f.box(S.cork, 0, 1.18, 0.022, 0.84, 0.56, 0.006);
    for (let i = 0; i < 7; i++) f.i("srv-note", BOX0(), solid("srv-noteMat", "#ffffff", { rough: 0.9 }), -0.32 + (i % 4) * 0.21 + (R() - 0.5) * 0.04, 1.27 + Math.floor(i / 4) * -0.22 + (R() - 0.5) * 0.04, 0.026, (R() - 0.5) * 0.12, 0.15, 0.2, 0.002, 0, 0, new THREE.Color(["#f4f2ea", "#fff3a6", "#ffd3e0", "#f4f2ea", "#cfe6ff"][i % 5]));
    signOn(c, f, "duty", 0.2, 1.38, 0.03, 0.2, { depth: 0.001 });
    wallClock(c, room, -12.52, 2.45, 2.75, -Math.PI / 2, 11, 2);
  }
}
/** O que a equipe deixou pelo caminho: lixeiras, cavalete, caixa de ferramentas, engradados e o balde. */
export function leftBehind(c: RoomsCtx, S: SPalette, R: () => number) {
  pedalBin(c, room, -15.84, 1.32, Math.PI / 2); pedalBin(c, room, -14.7, 11.3, Math.PI);
  wetFloorSign(c, room, -16.2, 0.3, 0.4);
  // caixa de ferramentas da manutenção (esconderijo do labirinto): aberta, com as ferramentas
  {
    const f = Fr.at(c, room, -21.25, 0, -5.25, 0.5);
    f.rbox(S.paintRed, 0, 0, 0, 0.48, 0.2, 0.22, 0.01);
    f.box(S.paintRed, 0, 0.2, -0.12, 0.48, 0.2, 0.012, 0, false);
    f.box(S.steelBlack, 0, 0.12, 0, 0.44, 0.06, 0.2);
    f.box(S.paintYellow, -0.1, 0.18, 0.02, 0.16, 0.025, 0.04, 0.3); f.box(S.chrome, 0.08, 0.19, -0.03, 0.2, 0.012, 0.02, -0.4); f.box(S.plasticBlue, 0.12, 0.185, 0.05, 0.14, 0.02, 0.03, 0.2);
    f.cylX(S.chrome, 0, 0.24, 0, 0.008, 0.3, 6);
    f.rbox(S.cardboard, 0.5, 0, 0.05, 0.4, 0.3, 0.3, 0.01, 0.3);
  }
  // engradados vazios empilhados no canto da ponta norte (o segurança para no meio dela)
  {
    const f = Fr.at(c, room, -12.76, 0, -5.72, Math.PI / 2);
    for (let i = 0; i < 4; i++) { f.rbox(S.plasticGreen, 0, i * 0.27, 0, 0.5, 0.26, 0.34, 0.02, (R() - 0.5) * 0.08); f.box(S.plasticBlack, 0, i * 0.27 + 0.18, 0.171, 0.14, 0.04, 0.004); }
  }
  // balde espremedor com o esfregão na ponta morta da lavagem
  {
    const f = Fr.at(c, room, -15.84, 0, 0.18, 0.3);
    f.rbox(S.plasticYellow, 0, 0.06, 0, 0.42, 0.28, 0.3, 0.04); for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.i("srv-casterS", CYL(10), S.plasticBlack, sx * 0.17, 0.03, sz * 0.11, 0, 0.03, 0.025, 0.03, 0, Math.PI / 2);
    f.box(solid("srv-mopWater", "#6d7f86", { rough: 0.05, env: 1.2 }), -0.06, 0.3, 0, 0.26, 0.004, 0.24);
    f.rbox(S.plasticGrey, 0.13, 0.32, 0, 0.14, 0.2, 0.26, 0.02);
    f.g(S.alu, CYL(8), 0.0, 0.85, -0.05, 0, 0.012, 1.25, 0.012, 0.2, 0.08);
    f.g(S.white, geo("srv-mopHead", () => new THREE.ConeGeometry(0.1, 0.22, 10, 1, true)), -0.02, 0.32, -0.04, 0, 1, 1, 1, Math.PI, 0);
  }
}
/** Quadro elétrico e eletrodutos; tomadas, interruptores, tubos de queda, alçapão e manchas de infiltração no forro. */
export function wallServices(c: RoomsCtx, S: SPalette, info: MazeInfo) {
  {
    const f = Fr.at(c, room, -20.5, 0, 10.6, -Math.PI / 2);
    f.rbox(S.paintCream, 0, 1.3, 0.06, 0.5, 0.7, 0.12, 0.01); f.box(S.paintCream, 0, 1.33, 0.122, 0.46, 0.64, 0.006); f.box(S.chrome, 0.18, 1.6, 0.13, 0.02, 0.08, 0.02);
    signOn(c, f, "highVoltage", 0, 1.86, 0.004, 0.12);
    for (const x of [-0.15, 0, 0.15]) f.cyl(S.galv, x, 2.0, 0.03, 0.013, H - 2.0, 8);
  }
  /* ---------- miudezas de prédio: tomadas e interruptores, tubos de queda, alçapão e manchas de infiltração no forro ---------- */
  {
    let n = 0;
    for (const f of info.faces) {
      if (f.room !== "servico" || f.b - f.a < 1.4 || n++ % 3) continue;
      const mid = (f.a + f.b) / 2 + 0.3, ry = f.axis === "x" ? (f.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : f.dir > 0 ? 0 : Math.PI;
      const o = Fr.at(c, room, f.axis === "x" ? f.plane : mid, 0.3, f.axis === "x" ? mid : f.plane, ry);
      o.i("srv-outlet", rbox(0.08, 0.12, 0.008, 0.004), S.plasticWhite, 0, 0, 0.004); for (const y of [0.03, 0.08]) o.i("srv-socket", CYL(10), S.plasticGrey, 0, y, 0.01, 0, 0.016, 0.004, 0.016, Math.PI / 2, 0);
    }
    for (const [x, z, ry] of [[-17.995, 0.25, Math.PI / 2], [-12.505, 8.3, -Math.PI / 2], [-18.005, 3.75, Math.PI / 2], [-14.005, 7.0, Math.PI / 2]] as [number, number, number][]) {
      const o = Fr.at(c, room, x, 1.1, z, ry); o.rbox(S.plasticWhite, 0, 0, 0.004, 0.08, 0.12, 0.008, 0.004); o.box(S.plasticGrey, 0, 0.045, 0.01, 0.025, 0.03, 0.006);
    }
    for (const [x, z] of [[-21.93, 14.07], [-12.57, 2.07]]) {
      c.batch.add(room, S.vinylGrey, CYL(14), mat(x, H / 2, z, 0, 0.05, H, 0.05));
      for (const y of [0.6, 1.6, 2.6]) c.inst.add(room, "srv-pipeClamp", geo("srv-pipeClampGeo", () => new THREE.TorusGeometry(0.055, 0.008, 5, 16).rotateX(Math.PI / 2)), S.galv, mat(x, y, z));
    }
    const hatch = Fr.at(c, room, -17.25, H, 12.75);
    hatch.box(S.alu, 0, -0.012, 0, 0.64, 0.012, 0.64); hatch.box(S.paintWhite, 0, -0.016, 0, 0.58, 0.006, 0.58); hatch.box(S.steelBlack, 0.22, -0.026, 0, 0.06, 0.012, 0.03);
    const stain = once("srv-stainMat2", () => new THREE.MeshStandardMaterial({ color: "#a08454", opacity: 0.55, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      alphaMap: drawnTexture("srv-stain", 128, 128, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); r.addColorStop(0, "rgba(255,255,255,0.35)"); r.addColorStop(0.75, "rgba(255,255,255,0.25)"); r.addColorStop(0.86, "rgba(255,255,255,0.75)"); r.addColorStop(0.9, "rgba(255,255,255,0.1)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.48, h * 0.4, 0.4, 0, Math.PI * 2); g.fill(); }, false) }));
    for (const [x, z, s] of [[-21.4, 8.6, 0.7], [-13.6, -1.9, 0.5], [-19.0, 12.6, 0.9], [-15.4, 4.4, 0.45], [-17.6, 15.3, 0.6]] as [number, number, number][]) c.batch.add(room, stain, geo("srv-stainPlane", () => new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2)), mat(x, H - 0.002, z, s * 5, s, 1, s * 0.8));
  }
}
