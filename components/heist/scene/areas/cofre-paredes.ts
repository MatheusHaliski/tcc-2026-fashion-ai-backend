/*
 * MET Gala Heist v2 — Sala das Joias (Z08): as paredes — lambri, pilastras, painéis de seda, friso e
 * cornija, os nichos com joias, a janela com cortinas e o luar pintado. Saiu de cofre.ts sem mudança.
 */
import * as THREE from "three";
import { CYL, geo, mat } from "../interior-batch";
import { type RoomsCtx, PLANE } from "./kit";
import { type Fr, archFill, archRing, bx, lathe, lit, moldingGeo, paint, plain, planeUp, raisedPanel, thickGlass } from "./galeria-kit";
import { jewelBust, necklace, earrings, tiara, crystalMat } from "./galeria-trajes";
import { lacquerPlum, neroMat } from "./cofre-tex";
import { brassC, goldC, steelGrey, tagGeo, tagMat, velvetBlack, velvetPlum } from "./cofre-props";
import { ROOM, type Wall, WALLS, wf, WAINSCOT, PILASTERS, BAYS, SKIRT, RAIL, CORNICE } from "./cofre-planta";

/* ---------- paredes ---------- */
export function walls(c: RoomsCtx) {
  const q = c.q, nero = neroMat(q), wal = c.P.walnut, gold = c.P.gold, lac = lacquerPlum();
  const skirt = moldingGeo("cofre-rodape", SKIRT), rail = moldingGeo("cofre-cadeira", RAIL), cornice = moldingGeo("cofre-cornija", CORNICE);
  for (const [k, w] of Object.entries(WALLS) as ["N" | "S" | "W" | "E", Wall][]) {
    const F = wf(w);
    // lambri: rodapé de mármore com filete de latão, fundo de nogueira, almofadas em relevo e a régua de cadeira
    for (const [a, b] of WAINSCOT[k]) {
      const len = b - a;
      c.batch.add(ROOM, nero, skirt, F((a + b) / 2, 0, 0, 0, len, 1, 1));
      bx(c.batch, ROOM, brassC(), F((a + b) / 2, 0.15, 0, 0, len, 0.008, 0.034));
      bx(c.batch, ROOM, wal, F((a + b) / 2, 0.158, 0, 0, len, 0.702, 0.022));
      const n = Math.max(1, Math.floor(len / 0.8)), pw = (len - 0.1 * (n + 1)) / n;
      if (pw > 0.15) for (let i = 0; i < n; i++) c.batch.add(ROOM, wal, raisedPanel(pw, 0.5, 0.02, 0.035), F(a + 0.1 + pw / 2 + i * (pw + 0.1), 0.26, 0.022));
      c.batch.add(ROOM, wal, rail, F((a + b) / 2, 0, 0, 0, len, 1, 1));
      bx(c.batch, ROOM, brassC(), F((a + b) / 2, 0.893, 0.066, 0, len, 0.008, 0.006));
    }
    // friso de laca com dois cordões dourados e a cornija
    c.batch.add(ROOM, lac, PLANE(), F(w.len / 2, 4.425, 0.004, 0, w.len, 0.35, 1));
    for (const y of [4.262, 4.588]) c.batch.add(ROOM, gold, CYL(8), F(w.len / 2, y, 0.012, 0, 0.01, w.len, 0.01, 0, Math.PI / 2));
    c.batch.add(ROOM, lac, cornice, F(w.len / 2, 0, 0, 0, w.len + 0.72, 1, 1), { cast: true });
    c.batch.add(ROOM, gold, CYL(8), F(w.len / 2, 4.745, 0.105, 0, 0.012, w.len, 0.012, 0, Math.PI / 2));
    // pilastras de nogueira com filetes dourados
    for (const x of PILASTERS[k]) {
      bx(c.batch, ROOM, wal, F(x, 0.93, 0, 0, 0.36, 3.32, 0.05), true);
      for (const e of [-1, 1]) bx(c.batch, ROOM, gold, F(x + e * 0.15, 1.0, 0.05, 0, 0.012, 3.15, 0.006));
      bx(c.batch, ROOM, wal, F(x, 4.1, 0, 0, 0.42, 0.15, 0.07));
    }
    // painéis de seda: filete dourado em retângulo
    for (const [a, b] of BAYS[k]) {
      const cx = (a + b) / 2, wd = b - a - 0.16, y0 = 1.06, y1 = 4.1;
      bx(c.batch, ROOM, gold, F(cx, y0, 0.006, 0, wd, 0.022, 0.014)); bx(c.batch, ROOM, gold, F(cx, y1 - 0.022, 0.006, 0, wd, 0.022, 0.014));
      for (const e of [-1, 1]) bx(c.batch, ROOM, gold, F(cx + e * (wd / 2 - 0.011), y0, 0.006, 0, 0.022, y1 - y0, 0.014));
    }
  }
  // porta blindada (lado da sala): só a verga e o batente do lado da fechadura (a folha abre encostando no outro)
  const E = wf(WALLS.E), B = steelGrey();
  bx(c.batch, ROOM, B, E(7.1, 2.88, 0, 0, 2.4, 0.18, 0.06)); bx(c.batch, ROOM, B, E(8.17, 0, 0, 0, 0.18, 2.88, 0.06));
}

/* ---------- nichos com joias (parede oeste, fundo da vista da porta; parede norte, sob a placa) ---------- */
export function niches(c: RoomsCtx) {
  const q = c.q, wal = c.P.walnut, gold = c.P.gold;
  const glow = lit("cofre-luzNicho", "#ffcfa0", 0.55, { additive: true, map: paint("cofre-manchaNicho", 128, 128, (g, w, h) => { const grd = g.createRadialGradient(w / 2, h * 0.4, 2, w / 2, h * 0.5, w / 2); grd.addColorStop(0, "rgba(255,255,255,0.9)"); grd.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = grd; g.fillRect(0, 0, w, h); }, { srgb: false }) });
  const make = (F: Fr, x: number, r: number, sp: number, d: number, key: string) => {
    c.batch.add(ROOM, wal, archRing(`cofre-nicho-${key}`, r, 0.16, sp, d, 0.012), F(x, 0, 0.0), { cast: true });
    c.batch.add(ROOM, gold, archRing(`cofre-nichoFilete-${key}`, r + 0.16, 0.03, sp, d + 0.01, 0), F(x, 0, 0.0));
    c.batch.add(ROOM, velvetPlum(q), archFill(`cofre-nicho-${key}`, r, sp), F(x, 0, 0.012));
    c.batch.add(ROOM, glow, PLANE(), F(x, sp * 0.75, 0.02, 0, r * 2.4, sp * 1.1, 1));
    c.batch.add(ROOM, thickGlass("cofre-vidro"), archFill(`cofre-nicho-${key}`, r, sp), F(x, 0, d - 0.01));
  };
  // grande nicho oeste (no eixo do pedestal): plinto de mármore com a parure — colar no busto, tiara e brincos
  const W = wf(WALLS.W);
  make(W, 7.75, 0.8, 2.4, 0.32, "oeste");
  bx(c.batch, ROOM, neroMat(q), W(7.75, 0, 0.16, 0, 1.6, 0.9, 0.3));
  bx(c.batch, ROOM, brassC(), W(7.75, 0.9, 0.16, 0, 1.62, 0.015, 0.31));
  jewelBust(c.batch, ROOM, W, 7.75, 0.915, 0.14, 1.15);
  necklace(c.inst, ROOM, W, 7.75, 1.2, 0.17, 0.085, 24, plain("cofre-esmeralda", "#1f8a5a", { rough: 0.03, env: 3, emissive: "#0a3a20", ei: 0.4 }), "cofre-colar");
  tiara(c.batch, c.inst, ROOM, W, 7.25, 1.02, 0.15, 1.1); c.batch.add(ROOM, velvetBlack(q), lathe("cofre-suporteTiara2", [[0, 0], [0.09, 0], [0.09, 0.08], [0, 0.1]], 20), W(7.25, 0.915, 0.15));
  earrings(c.batch, c.inst, ROOM, W, 8.25, 0.915, 0.16, crystalMat());
  c.batch.add(ROOM, tagMat(c), tagGeo(12), W(7.75, 2.95, 0.03, 0, 0.7, 0.175, 1));
  // nicho norte, sob a placa da coleção: uma tiara num suporte de veludo
  const N = wf(WALLS.N);
  make(N, 4.75, 0.42, 1.95, 0.24, "norte");
  bx(c.batch, ROOM, neroMat(q), N(4.75, 0, 0.12, 0, 0.84, 1.05, 0.22));
  c.batch.add(ROOM, velvetBlack(q), lathe("cofre-suporteTiara3", [[0, 0], [0.08, 0], [0.08, 0.1], [0, 0.12]], 20), N(4.75, 1.05, 0.12));
  tiara(c.batch, c.inst, ROOM, N, 4.75, 1.17, 0.12, 1.15, plain("cofre-safira", "#2a4bd8", { rough: 0.03, env: 3, emissive: "#1a2a80", ei: 0.4 }));
}

/* ---------- janela para a cornija: cortinas de veludo presas, sanefa de laca com galão dourado ---------- */
export function windowDrapes(c: RoomsCtx) {
  const N = wf(WALLS.N), vel = velvetPlum(c.q);
  const drape = geo("cofre-cortina", () => {
    const w = 0.62, h = 2.45, g = new THREE.PlaneGeometry(w, h, 28, 10), p = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i) + h / 2, t = y / h, tie = Math.exp(-((y - 0.45) ** 2) / 0.04);
      const pinch = 1 - 0.55 * tie;                                    // franzido na braçadeira (a 0,45 m da barra)
      p.setXYZ(i, x * pinch, y, 0.045 * Math.sin(x * 26) * (0.7 + 0.3 * (1 - t)) + 0.05 + 0.04 * tie);
    }
    g.computeVertexNormals(); return g;
  });
  for (const [x, s] of [[1.62, -1], [3.38, 1]] as [number, number][]) {
    c.batch.add(ROOM, vel, drape, N(x, 0.95, 0.02, 0, 1, 1, 1), { cast: true });
    c.batch.add(ROOM, goldC(), geo("cofre-bracadeira", () => new THREE.TorusGeometry(0.1, 0.012, 6, 20).rotateX(Math.PI / 2).scale(1, 1, 0.5)), N(x + s * 0.02, 1.4, 0.1));
    c.inst.add(ROOM, "cofre-borla", geo("cofre-borlaGeo", () => new THREE.ConeGeometry(0.03, 0.12, 10).translate(0, -0.06, 0)), goldC(), N(x + s * 0.12, 1.35, 0.12));
  }
  bx(c.batch, ROOM, lacquerPlum(), N(2.5, 3.38, 0.0, 0, 2.6, 0.32, 0.2), true);
  bx(c.batch, ROOM, goldC(), N(2.5, 3.38, 0.2, 0, 2.6, 0.03, 0.008)); bx(c.batch, ROOM, goldC(), N(2.5, 3.66, 0.2, 0, 2.6, 0.03, 0.008));
}
/**
 * Luar pela janela da cornija (luz pintada, que continua quando cortam o quadro de luz): o vidro clareia atrás das
 * grades e as quatro vidraças de cima se desenham no piso com a sombra das grades (a 45°, as de baixo batem na
 * vitrine baixa sob a janela). Marca no escuro a rota de fuga.
 */
export function moonlight(c: RoomsCtx) {
  const glow = lit("cofre-luarVidro", "#9db4ff", 0.24, { additive: true, map: paint("cofre-luarVidroTex", 64, 128, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(1, "rgba(255,255,255,0.45)");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, { srgb: false }) });
  c.batch.add(ROOM, glow, PLANE(), wf(WALLS.N)(2.5, 1.75, -0.2, 0, 1.0, 1.7, 1));
  const pool = lit("cofre-luarPiso", "#a9bdff", 0.2, { additive: true, map: paint("cofre-luarPisoTex", 160, 128, (g, w, h) => {
    g.filter = "blur(4px)"; g.fillStyle = "#fff";
    const mx = 16, mz = 14, bar = 4, pw = (w - 2 * mx - 3 * bar) / 4;
    for (let i = 0; i < 4; i++) g.fillRect(mx + i * (pw + bar), mz, pw, h - 2 * mz);
  }, { srgb: false }) });
  c.batch.add(ROOM, pool, planeUp(), mat(-19.5, 0.006, -19.83, 0, 1.15, 1, 0.95));
}
