/*
 * MET Gala Heist v2 — Sala das Joias (Z08): a vigilância — postes emissores dos lasers e câmeras de
 * segurança. Saiu de cofre.ts sem mudança.
 */
import * as THREE from "three";
import { LASERS } from "@/lib/heist/level";
import { CYL, CYL0, SPH, geo, mat } from "../interior-batch";
import type { RoomsCtx } from "./kit";
import { bx, frame, lathe, lit, plain } from "./galeria-kit";
import { brassC } from "./cofre-props";
import { ROOM, H, PX, PZ } from "./cofre-planta";

/* ---------- postes emissores dos lasers (os feixes são da simulação: fx.tsx) ---------- */
export function laserPosts(c: RoomsCtx) {
  const K = plain("cofre-acoNegro", "#151618", { metal: 0.6, rough: 0.4 }), red = lit("cofre-lenteLaser", "#ff2a2a", 2.6), green = lit("cofre-ledPoste", "#2bff6a", 2.2);
  const posts = new Map<string, { x: number; z: number; aims: { dx: number; dz: number; h: number[] }[] }>();
  for (const L of LASERS) for (const [p, o] of [[L.a, L.b], [L.b, L.a]] as const) {
    const key = `${p.x},${p.z}`; let e = posts.get(key); if (!e) { e = { x: p.x, z: p.z, aims: [] }; posts.set(key, e); }
    e.aims.push({ dx: o.x - p.x, dz: o.z - p.z, h: L.height === "high" ? [1.1] : [0.35, 0.9, 1.45] });
  }
  for (const p of posts.values()) {
    c.batch.add(ROOM, brassC(), lathe("cofre-basePoste", [[0, 0], [0.11, 0], [0.11, 0.015], [0.06, 0.035], [0.05, 0.05], [0, 0.05]], 24), mat(p.x, 0, p.z));
    c.batch.add(ROOM, K, CYL0(14), mat(p.x, 0.05, p.z, 0, 0.042, 1.57, 0.042));
    c.batch.add(ROOM, brassC(), lathe("cofre-topoPoste", [[0, 0], [0.05, 0], [0.055, 0.02], [0.03, 0.05], [0.012, 0.08], [0, 0.085]], 16), mat(p.x, 1.62, p.z));
    c.inst.add(ROOM, "cofre-ledPoste", SPH(6), green, mat(p.x, 1.66, p.z + 0.03, 0, 0.007));
    for (const a of p.aims) {
      const ry = Math.atan2(a.dx, a.dz);
      for (const h of a.h) {
        const F = frame(p.x, p.z, ry);
        bx(c.batch, ROOM, K, F(0, h - 0.025, 0.04, 0, 0.05, 0.05, 0.06));
        c.inst.add(ROOM, "cofre-lenteLaser", geo("cofre-lenteLaserGeo", () => new THREE.CircleGeometry(0.014, 12)), red, F(0, h, 0.071));
      }
    }
  }
}

/* ---------- câmeras de segurança ---------- */
export function cameras(c: RoomsCtx) {
  const shell = plain("galeria-plastico", "#e8e6e0", { rough: 0.5 }), K = plain("cofre-pretoFosco", "#141416", { rough: 0.5 });
  for (const [x, z] of [[-21.82, -21.82], [-12.68, -21.82], [-12.68, -6.68], [-21.82, -6.68]] as [number, number][]) {
    const ry = Math.atan2(PX - x, PZ - z), F = frame(x, z, ry);
    bx(c.batch, ROOM, shell, F(0, 4.18, 0.02, 0, 0.12, 0.16, 0.04));                       // placa de parede
    bx(c.batch, ROOM, shell, F(0, 4.24, 0.15, 0, 0.04, 0.04, 0.22));                       // braço
    bx(c.batch, ROOM, shell, F(0, 4.12, 0.32, 0, 0.13, 0.12, 0.3, 0.22));                  // corpo (inclinado para baixo)
    bx(c.batch, ROOM, shell, F(0, 4.25, 0.34, 0, 0.17, 0.012, 0.36, 0.22));                // para-sol
    c.batch.add(ROOM, K, CYL(16), F(0, 4.11, 0.48, 0, 0.04, 0.03, 0.04, Math.PI / 2 + 0.22));
    c.inst.add(ROOM, "cofre-ledCamera", SPH(6), lit("cofre-ledVermelho", "#ff2a2a", 2.4), F(0.05, 4.2, 0.47, 0, 0.006));
  }
  // câmera de domo no caixotão sobre o duto (vigia a saída do labirinto)
  c.batch.add(ROOM, shell, CYL0(20), mat(-17.5, H - 0.08, -7.8, 0, 0.09, 0.08, 0.09));
  c.batch.add(ROOM, plain("galeria-domo", "#14161a", { rough: 0.05, env: 1.6, transparent: true, opacity: 0.88 }), geo("galeria-domoGeo", () => new THREE.SphereGeometry(0.075, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), mat(-17.5, H - 0.08, -7.8));
}
