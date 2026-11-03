/*
 * MET Gala Heist v2 — as peças repetidas da quadra (instâncias): ar-condicionado, sacadas, caixa d'água, antena, manequim,
 * vestido, mesa, cadeira e peça de arara.
 */
import * as THREE from "three";
import { boxGeo, lathe, merge } from "./exterior-geometry";

/* ---------- peças repetidas (instâncias), em metros, no referencial local da fachada (frente para +z) ---------- */
export const PARTS = {
  /** ar-condicionado de janela: gabinete bege com grelha e o suporte */
  ac: () => merge([boxGeo(-0.32, 0, 0, 0.32, 0.4, 0.5), boxGeo(-0.3, 0.04, 0.5, 0.3, 0.36, 0.52), boxGeo(-0.26, -0.25, 0.05, -0.22, 0, 0.45), boxGeo(0.22, -0.25, 0.05, 0.26, 0, 0.45)]),
  /** grade de sacadinha (balconete) de ferro, 1,4 m */
  balconette: () => { const parts: THREE.BufferGeometry[] = [boxGeo(-0.72, 0.9, 0, 0.72, 0.94, 0.28), boxGeo(-0.72, 0, 0.24, 0.72, 0.04, 0.28), boxGeo(-0.72, 0, 0, -0.68, 0.94, 0.28), boxGeo(0.68, 0, 0, 0.72, 0.94, 0.28)]; for (let x = -0.6; x <= 0.61; x += 0.12) parts.push(boxGeo(x - 0.008, 0.04, 0.255, x + 0.008, 0.9, 0.27)); return merge(parts); },
  /** laje de sacada (2,6 m) e o guarda-corpo de vidro com perfil */
  balconySlab: () => boxGeo(-1.3, -0.16, 0, 1.3, 0, 1.2),
  balconyRail: () => merge([boxGeo(-1.3, 0, 1.16, 1.3, 1.0, 1.2), boxGeo(-1.3, 0, 0, -1.26, 1.0, 1.2), boxGeo(1.26, 0, 0, 1.3, 1.0, 1.2)]),
  railTop: () => merge([boxGeo(-1.32, 1.0, 1.14, 1.32, 1.05, 1.22), boxGeo(-1.32, 1.0, 0, -1.24, 1.05, 1.22), boxGeo(1.24, 1.0, 0, 1.32, 1.05, 1.22)]),
  /** caixa d'água de madeira com teto cônico e as pernas de aço */
  tank: () => merge([lathe([[0, 0], [1.6, 0], [1.6, 3.2], [1.66, 3.25], [0.2, 4.3], [0, 4.35]], 18)]),
  tankLegs: () => { const parts: THREE.BufferGeometry[] = []; for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; parts.push(boxGeo(Math.cos(a) * 1.3 - 0.08, -3, Math.sin(a) * 1.3 - 0.08, Math.cos(a) * 1.3 + 0.08, 0, Math.sin(a) * 1.3 + 0.08)); } parts.push(boxGeo(-1.5, -0.12, -1.5, 1.5, 0, 1.5)); return merge(parts); },
  antenna: () => merge([boxGeo(-0.04, 0, -0.04, 0.04, 9, 0.04), boxGeo(-0.6, 6, -0.02, 0.6, 6.05, 0.02), boxGeo(-0.4, 7.5, -0.02, 0.4, 7.55, 0.02)]),
  /** manequim de vitrine (busto, pescoço e cabeça lisos, na haste com base) e o vestido longo dele */
  mannequin: () => merge([lathe([[0, 0], [0.18, 0], [0.18, 0.02], [0.02, 0.04], [0.015, 0.95], [0.11, 1.0], [0.15, 1.12], [0.13, 1.3], [0.16, 1.42], [0.12, 1.5], [0.05, 1.53], [0.045, 1.6], [0.07, 1.66], [0.08, 1.74], [0.05, 1.8], [0, 1.82]], 16)]),
  gown: () => lathe([[0, 0.02], [0.52, 0.02], [0.5, 0.1], [0.38, 0.5], [0.24, 0.85], [0.14, 1.02], [0.12, 1.12], [0.15, 1.26], [0.14, 1.42], [0, 1.44]], 22),
  /** mesa de bistrô (tampo redondo de mármore, coluna e pé de ferro) e cadeira thonet */
  table: () => merge([lathe([[0, 0], [0.24, 0], [0.24, 0.03], [0.04, 0.06], [0.03, 0.72], [0.3, 0.72], [0.3, 0.75], [0, 0.75]], 18)]),
  /** peça pendurada na arara (cabide em cima, caimento até ~1 m) */
  garment: () => merge([boxGeo(-0.22, -1.0, -0.025, 0.22, -0.05, 0.025), boxGeo(-0.2, -0.06, -0.006, 0.2, 0.0, 0.006)]),
  chair: () => merge([boxGeo(-0.2, 0.44, -0.2, 0.2, 0.47, 0.2), ...[[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]].map(([x, z]) => boxGeo(x - 0.015, 0, z - 0.015, x + 0.015, 0.44, z + 0.015)), boxGeo(-0.18, 0.47, -0.2, -0.15, 0.9, -0.17), boxGeo(0.15, 0.47, -0.2, 0.18, 0.9, -0.17), boxGeo(-0.18, 0.72, -0.2, 0.18, 0.86, -0.18)]),
};
