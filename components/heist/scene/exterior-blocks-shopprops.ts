/*
 * MET Gala Heist v2 — os móveis e a mercadoria de cada ramo dentro da vitrine (só nos prédios de perto): manequins e
 * arara, balcões com tampo de vidro, mesas e cadeiras, estantes, vitrine de pães, baldes de flores e escultura.
 */
import * as THREE from "three";
import { boxGeo, lathe, merge } from "./exterior-geometry";
import { INT, type ShopKind } from "./exterior-citytex";
import { iuv, L, quad, quadY, type CityKit } from "./exterior-blocks-kit";

/** Móveis e mercadoria de cada ramo, dentro da vitrine (só nos prédios de perto). */
export function shopProps(kit: CityKit, M: THREE.Matrix4, a: number, c: number, D: number, kind: ShopKind, r: () => number) {
  const w = c - a, mid = (a + c) / 2, P = (x: number, y: number, z: number, ry = 0, s: number | [number, number, number] = 1) => M.clone().multiply(L(x, y, z, ry, s));
  const shelf = (x0: number, x1: number, z: number, h: number, cell: number, deep = 0.4) => {
    kit.add("trim:paint", boxGeo(x0, 0, z - deep, x1, h, z - deep + 0.04), M);
    for (let k = 0; k <= 4; k++) kit.add("trim:paint", boxGeo(x0, (h * k) / 4, z - deep, x1, (h * k) / 4 + 0.03, z), M);
    kit.add("shopInt", quad(x0 + 0.02, 0.05, x1 - 0.02, h - 0.03, z - 0.02, iuv(cell)), M);
  };
  switch (kind) {
    case "fashion": case "atelier": {
      const n = Math.max(2, Math.min(4, Math.floor(w / 1.6)));
      kit.add("trim:stone", boxGeo(a + 0.3, 0, -1.25, c - 0.3, 0.18, -0.4), M);                     // estrado da vitrine
      const gowns = ["#7a0c1c", "#0f3d2e", "#141418", "#c9a24a", "#e8e0d4", "#1d2a4a"];
      for (let k = 0; k < n; k++) { const x = a + ((k + 0.5) * w) / n, ry = (r() - 0.5) * 0.6; kit.put("mannequin", P(x, 0.18, -0.85, ry)); kit.put("gown", P(x, 0.18, -0.85, ry), new THREE.Color(kind === "atelier" ? "#f4efe6" : gowns[(k + Math.floor(r() * 6)) % 6])); }
      // arara cromada no fundo com as peças penduradas (cor por peça)
      if (kind === "fashion") {
        kit.add("trim:brass", merge([boxGeo(a + 0.6, 1.72, -D + 0.5, c - 0.6, 1.75, -D + 0.53), boxGeo(a + 0.6, 0, -D + 0.5, a + 0.63, 1.75, -D + 0.53), boxGeo(c - 0.63, 0, -D + 0.5, c - 0.6, 1.75, -D + 0.53)]), M);
        const cols = ["#7a0c1c", "#0f3d2e", "#141418", "#c9a24a", "#e8e0d4", "#1d2a4a", "#5a2a4a", "#b3122e"];
        for (let x = a + 0.8; x < c - 0.8; x += 0.16) kit.put("garment", P(x, 1.7, -D + 0.515, Math.PI / 2 + (r() - 0.5) * 0.25, [1, 0.75 + r() * 0.5, 1]), new THREE.Color(cols[Math.floor(r() * cols.length)]));
      }
      break;
    }
    case "jewelry": case "perfume": case "optics": {
      for (const x of [a + w * 0.28, a + w * 0.72]) {
        kit.add("trim:wood", boxGeo(x - 0.55, 0, -1.6, x + 0.55, 0.92, -1.05), M);
        kit.add("shopInt", quadY(x - 0.5, x + 0.5, -1.55, -1.1, 0.93, iuv(kind === "perfume" ? INT.bottleShelf : INT.magazines), true), M);
        kit.add("shopGlass", boxGeo(x - 0.53, 0.93, -1.58, x + 0.53, 1.18, -1.07), M);
      }
      break;
    }
    case "cafe": case "bistro": case "bar": {
      for (let k = 0; k < Math.floor(w / 1.6); k++) {
        const x = a + 0.8 + k * 1.6, z = -1.0 - (k % 2) * 0.3;
        kit.put("table", P(x, 0, z)); kit.put("chair", P(x - 0.45, 0, z, Math.PI / 2 + (r() - 0.5) * 0.4), new THREE.Color(kind === "bar" ? "#2a1a14" : "#3a2a1c")); kit.put("chair", P(x + 0.45, 0, z, -Math.PI / 2 + (r() - 0.5) * 0.4), new THREE.Color(kind === "bar" ? "#2a1a14" : "#3a2a1c"));
      }
      kit.add("trim:wood", boxGeo(a + 0.3, 0, -D + 0.3, c - 0.3, 1.05, -D + 0.9), M);                   // balcão
      kit.add("trim:stone", boxGeo(a + 0.25, 1.05, -D + 0.25, c - 0.25, 1.1, -D + 0.95), M);
      if (kind === "cafe") kit.add("trim:brass", boxGeo(mid - 0.3, 1.1, -D + 0.4, mid + 0.3, 1.5, -D + 0.8), M);   // máquina de café
      break;
    }
    case "pharmacy": case "books": case "shoes": {
      const cell = kind === "pharmacy" ? INT.pharmacyShelf : kind === "books" ? INT.bookShelf : INT.shoeShelf;
      shelf(a + 0.25, mid - 0.4, -1.4, 1.6, cell); shelf(mid + 0.4, c - 0.25, -1.4, 1.6, cell);
      if (kind === "books") { for (let k = 0; k < 6; k++) kit.add("shopInt", boxGeo(mid - 0.35 + (k % 3) * 0.24, 0.75, -0.75 - Math.floor(k / 3) * 0.3, mid - 0.15 + (k % 3) * 0.24, 0.75 + 0.06 + r() * 0.18, -0.5 - Math.floor(k / 3) * 0.3), M); kit.add("trim:wood", boxGeo(mid - 0.45, 0, -1.15, mid + 0.45, 0.75, -0.45), M); }
      break;
    }
    case "bakery": {
      kit.add("trim:wood", boxGeo(a + 0.4, 0, -1.4, c - 0.4, 0.9, -0.8), M);
      kit.add("shopInt", quadY(a + 0.45, c - 0.45, -1.35, -0.85, 0.91, iuv(INT.bread), true), M);
      kit.add("shopGlass", boxGeo(a + 0.42, 0.91, -1.38, c - 0.42, 1.25, -0.82), M);
      shelf(a + 0.3, c - 0.3, -D + 0.45, 1.9, INT.bread, 0.4);
      break;
    }
    case "florist": {
      // baldes de flores também na calçada, encostados na loja (fora da área andável)
      for (let k = 0; k < Math.floor(w / 0.5); k++) { const x = a + 0.3 + k * 0.5, z = 0.35 + (k % 2) * 0.22; kit.add("trim:galv", lathe([[0, 0], [0.15, 0], [0.18, 0.38], [0, 0.38]], 10).translate(x, 0, z), M); kit.add("shopInt", quadY(x - 0.17, x + 0.17, z - 0.17, z + 0.17, 0.42, iuv(INT.flowers), true), M); }
      shelf(a + 0.3, c - 0.3, -1.3, 1.2, INT.flowers, 0.5);
      break;
    }
    case "gallery": {
      kit.add("trim:stone", boxGeo(mid - 0.3, 0, -1.6, mid + 0.3, 1.0, -1.0), M);
      kit.add("trim:bronze", lathe([[0, 0], [0.2, 0.05], [0.12, 0.45], [0.22, 0.8], [0, 0.95]], 12).translate(mid, 1.0, -1.3), M);
      break;
    }
  }
}
