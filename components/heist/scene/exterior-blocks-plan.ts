/*
 * MET Gala Heist v2 — o plano da quadra: quem fica onde (a quadra em frente ao museu desenhada loja por loja, as fileiras
 * sorteadas ao longo da avenida, as laterais dos prédios de esquina e as fileiras das ruas transversais).
 */
import * as THREE from "three";
import { SIDEWALK_Y } from "@/lib/heist/level";
import type { ShopKind } from "./exterior-citytex";
import { prng } from "./exterior-tex-core";
import { CITY_X, CROSS, CROSS_Z1, FAR_LINE, NEAR_LINE, type Building, type Style } from "./exterior-blocks-layout";

/* ---------- a quadra: quem fica onde ---------- */
export interface CityPlan { buildings: Building[]; sides: { origin: THREE.Vector3; theta: number; width: number; b: Building; detailed: boolean }[] }
const far = (x0: number, x1: number, o: Omit<Building, "origin" | "theta" | "width">): Building => ({ origin: new THREE.Vector3(x1, SIDEWALK_Y, FAR_LINE), theta: Math.PI, width: x1 - x0, ...o });
const near = (x0: number, x1: number, o: Omit<Building, "origin" | "theta" | "width">): Building => ({ origin: new THREE.Vector3(x0, SIDEWALK_Y, NEAR_LINE), theta: 0, width: x1 - x0, ...o });
/** Lojas da quadra na ordem de oeste para leste (a fachada de lá corre de leste para oeste no referencial local). */
const westToEast = (k: ShopKind[]) => [...k].reverse();

export function cityPlan(): CityPlan {
  const B: Building[] = [];
  // quadra em frente ao museu (x −31…44): desenhada loja por loja (é a que a jogadora vê de perto)
  B.push(far(-31, -17, { depth: 20, floors: 11, style: "prewar", shops: westToEast(["bistro", "lobby", "florist"]), detailed: true, seed: 11 }));
  B.push(far(-17, -6, { depth: 18, floors: 7, style: "brick", shops: westToEast(["pharmacy", "bakery"]), detailed: true, seed: 12 }));
  B.push(far(-6, 4, { depth: 18, floors: 6, style: "loft", shops: ["fashion"], detailed: true, seed: 13 }));
  B.push(far(4, 16, { depth: 20, floors: 15, style: "deco", shops: westToEast(["jewelry", "lobby", "perfume"]), detailed: true, seed: 14, crown: true }));
  B.push(far(16, 27, { depth: 18, floors: 9, style: "prewar", shops: westToEast(["closed", "cafe"]), detailed: true, seed: 15, tint: "brickDark" }));
  B.push(far(27, 44, { depth: 22, floors: 23, style: "modern", shops: westToEast(["books", "optics", "gallery"]), detailed: true, seed: 16 }));
  // lado do museu, depois do beco (o de tijolo é o mesmo volume do beco: fachada sul na avenida) e para oeste da ala
  B.push(near(30, 46, { depth: 58.5, floors: 5, style: "brick", shops: ["bar", "shoes"], detailed: true, seed: 21 }));
  const r = prng(77);
  const styles: Style[] = ["prewar", "brick", "deco", "loft", "modern", "prewar", "brick"];
  const shopsPool: ShopKind[][] = [["cafe", "lobby", "shoes"], ["pharmacy", "books"], ["bistro", "florist"], ["optics", "lobby", "bakery"], ["bar", "closed"], ["perfume", "gallery"], ["jewelry", "cafe"], ["atelier", "lobby", "shoes"]];
  const run = (x0: number, x1: number, side: "far" | "near", detailUntil: number, seed: number) => {
    const rr = prng(seed);
    for (let x = x0; x < x1 - 4;) {
      const w = Math.min(x1 - x, 11 + Math.floor(rr() * 12)), st = styles[Math.floor(rr() * styles.length)], fl = st === "modern" ? 14 + Math.floor(rr() * 14) : st === "deco" ? 10 + Math.floor(rr() * 10) : 5 + Math.floor(rr() * 8);
      const detailed = Math.abs(x + w / 2) < detailUntil;
      const o = { depth: side === "near" ? 34 : 24, floors: fl, style: st, shops: shopsPool[Math.floor(rr() * shopsPool.length)], detailed, seed: seed * 100 + Math.round(x), crown: st === "deco" && rr() < 0.5 } as Omit<Building, "origin" | "theta" | "width">;
      B.push(side === "far" ? far(x, x + w, { ...o, shops: westToEast(o.shops) }) : near(x, x + w, o));
      x += w + (rr() < 0.15 ? 0.6 : 0);
    }
  };
  void r;
  run(-CITY_X, CROSS[0].walk0, "far", 70, 31); run(CROSS[1].walk1, CITY_X, "far", 70, 32);
  run(46, CITY_X, "near", 75, 33); run(-CITY_X, -60, "near", 75, 34);
  // ruas transversais: as fachadas laterais dos prédios de esquina e a fileira que segue para o sul
  const sides: CityPlan["sides"] = [];
  const a1 = B[0], a6 = B[5];
  a1.insetR = 0.3; a6.insetL = 0.3;                         // (lado de lá: o x local cresce para o oeste)
  sides.push({ origin: new THREE.Vector3(CROSS[0].walk1, SIDEWALK_Y, FAR_LINE), theta: -Math.PI / 2, width: a1.depth, b: a1, detailed: true });
  sides.push({ origin: new THREE.Vector3(CROSS[1].walk0, SIDEWALK_Y, FAR_LINE + a6.depth), theta: Math.PI / 2, width: a6.depth, b: a6, detailed: true });
  const bW = B.find((b) => b.origin.x === CROSS[0].walk0 && b.theta === Math.PI), bE = B.find((b) => b.theta === Math.PI && Math.abs(b.origin.x - b.width - CROSS[1].walk1) < 0.01);
  if (bW) bW.insetL = 0.3;
  if (bE) bE.insetR = 0.3;
  if (bW) sides.push({ origin: new THREE.Vector3(CROSS[0].walk0, SIDEWALK_Y, FAR_LINE + bW.depth), theta: Math.PI / 2, width: bW.depth, b: bW, detailed: false });
  if (bE) sides.push({ origin: new THREE.Vector3(CROSS[1].walk1, SIDEWALK_Y, FAR_LINE), theta: -Math.PI / 2, width: bE.depth, b: bE, detailed: false });
  // fileiras das transversais (fachadas viradas para a rua, de z ≈ 72 até CROSS_Z1)
  const rr = prng(91);
  for (const cs of CROSS) for (const [x, th] of [[cs.walk0, Math.PI / 2], [cs.walk1, -Math.PI / 2]] as const) {
    for (let z = FAR_LINE + 21; z < CROSS_Z1;) {
      const w = 12 + Math.floor(rr() * 12), st = styles[Math.floor(rr() * styles.length)];
      const o: Building = { origin: th > 0 ? new THREE.Vector3(x, SIDEWALK_Y, z + w) : new THREE.Vector3(x, SIDEWALK_Y, z), theta: th, width: w, depth: 16, floors: st === "modern" ? 12 + Math.floor(rr() * 12) : 5 + Math.floor(rr() * 8), style: st, shops: shopsPool[Math.floor(rr() * shopsPool.length)], detailed: false, seed: Math.round(z * 10 + x) };
      B.push(o); z += w + 0.3;
    }
  }
  return { buildings: B, sides };
}
