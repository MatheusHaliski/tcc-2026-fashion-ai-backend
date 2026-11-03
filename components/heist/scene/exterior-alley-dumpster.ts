/*
 * MET Gala Heist v2 — beco (Z15): caçambas — contêiner metálico de carga frontal, desenhado na caixa de colisão.
 */
import * as THREE from "three";
import type { Prop } from "@/lib/heist/types";
import { Bag, box0, cyl0, mul, tm } from "./exterior-alley-geo";
import { type Rect01, rng } from "./exterior-alley-tex";
import { B, type Foot, L, planeUV } from "./exterior-alley-foot";
import { bagGeo } from "./exterior-alley-pieces";

/* ======================= caçambas ======================= */
/** Contêiner metálico de carga frontal (o da planta: 1,6 × 2,4 × 1,3 m): corpo com frente inclinada, nervuras, bolsos de
 * içamento, tampas de plástico (uma aberta, com sacos aparecendo), dreno, rodízios e a etiqueta da coleta. */
export function dumpster(bag: Bag, p: Prop, signs: Record<string, Rect01>, seed: number) {
  if (p.shape.type !== "box") return;
  const s = p.shape, cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2, W = s.z1 - s.z0, D = s.x1 - s.x0, r = rng(seed);
  // referencial: x local ao longo do comprimento (z do mundo), frente (+z local) virada para o beco (−x do mundo)
  const f: Foot = { cx, cz, w: W, d: D, yaw: -Math.PI / 2 };
  const green = new THREE.Color("#22503d").multiplyScalar(0.9 + r() * 0.15);
  // corpo: caixa afunilada (frente inclinada) sobre o chassi
  const body = new THREE.BoxGeometry(W - 0.06, 1.1, D - 0.1, 1, 1, 1).translate(0, 0.55, 0), pa = body.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pa.count; i++) if (pa.getZ(i) > 0 && pa.getY(i) < 0.3) pa.setZ(i, pa.getZ(i) - 0.28);   // frente inclinada embaixo
  body.computeVertexNormals();
  bag.add("paint", body, { m: L(f, 0, 0.16, -0.02), color: green });
  for (let k = 0; k < 4; k++) B(bag, "paint", f, -W / 2 + 0.25 + k * ((W - 0.5) / 3), 0.16, D / 2 - 0.08, 0.06, 1.1, 0.04, green.clone().multiplyScalar(0.85));   // nervuras
  B(bag, "paint", f, 0, 1.22, 0, W, 0.06, D, green.clone().multiplyScalar(0.8));               // borda
  for (const sx of [-1, 1]) { B(bag, "paint", f, sx * (W / 2 + 0.04), 0.7, 0, 0.1, 0.18, 0.5, "#1a1a1a"); }   // bolsos de içamento
  B(bag, "paint", f, 0, 0.1, 0, W - 0.1, 0.08, D - 0.3, "#1b1b1b");                              // chassi
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { bag.add("rubber", new THREE.CylinderGeometry(0.075, 0.075, 0.06, 12).rotateX(Math.PI / 2), { m: L(f, sx * (W / 2 - 0.25), 0.075, sz * (D / 2 - 0.35)) }); bag.add("galv", box0(), { m: L(f, sx * (W / 2 - 0.25), 0.1, sz * (D / 2 - 0.35), 0, 0.1, 0.06, 0.1) }); }
  bag.add("galv", cyl0(0.03, 0.03, 0.06, 10), { m: L(f, W / 2 - 0.2, 0.22, D / 2 - 0.29, 0, 1, 1, 1, Math.PI / 2) });     // dreno
  // tampas de plástico preto: a de trás fechada, a da frente aberta para trás (sacos à mostra)
  const lid0 = L(f, -W / 4, 1.25, -D / 2 + 0.04), lid1 = L(f, W / 4, 1.25, -D / 2 + 0.04);
  bag.add("plastic", box0(), { m: mul(lid0, tm(0, 0, D / 2 - 0.02, 0, W / 2 - 0.04, 0.05, D - 0.04)), color: "#121212" });
  bag.add("plastic", box0(), { m: mul(lid1, mul(tm(0, 0, 0, 0, 1, 1, 1, -1.9), tm(0, 0, D / 2 - 0.02, 0, W / 2 - 0.04, 0.05, D - 0.04))), color: "#151515" });
  for (let k = 0; k < 3; k++) bag.add("bag", bagGeo(seed * 3 + k, 0.55, 0.45), { m: L(f, W / 4 + (k - 1) * 0.32, 0.95, (r() - 0.5) * 0.3, r() * 6) });
  bag.add("signs", planeUV(0.5, 0.25, signs.dumpLabel), { m: L(f, -W / 4, 0.75, D / 2 - 0.045) });
}
