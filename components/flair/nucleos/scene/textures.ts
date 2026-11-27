/**
 * Textura de cada material da sala: o desenho procedural em canvas (até 1024 px), pronto para repetir na escala real.
 * A mesma textura serve de cor e de relevo; o brilho vem da rugosidade e do metal do material.
 */
import * as THREE from "three";
import type { MaterialDesc, Textura } from "@/lib/flair/nucleos/scene/types";
import { sorteio } from "@/components/flair/nucleos/scene/texture-tools";
import { borracha, ceu, janelas, laca, ladrilho, led, metal, rede, tijolo } from "@/components/flair/nucleos/scene/textures-built";
import { amostras, asfalto, concreto, la, listras, madeira, marmore, pedra, pedraPortuguesa, reboco, tecido, veludo, type Desenho } from "@/components/flair/nucleos/scene/textures-natural";

const DESENHOS: Partial<Record<Textura, Desenho>> = {
  madeira,
  marmore,
  tijolo,
  ladrilho,
  veludo,
  metal,
  asfalto,
  concreto,
  reboco,
  pedra,
  pedraPortuguesa,
  borracha,
  laca,
  tecido,
  listras,
  la,
  janelas,
  led,
  rede,
  ceu,
  amostras,
};

/** Relevo de cada textura (0 = lisa). */
export const RELEVO: Partial<Record<Textura, number>> = {
  tijolo: 1.6,
  pedra: 1.3,
  pedraPortuguesa: 0.8,
  asfalto: 0.9,
  concreto: 0.6,
  reboco: 0.5,
  madeira: 0.4,
  veludo: 0.9,
  la: 1.2,
  tecido: 0.5,
  listras: 0.4,
  borracha: 0.4,
  ladrilho: 0.3,
  metal: 0.15,
  marmore: 0.05,
};

/** Semente estável por material: o mesmo desenho a cada montagem. */
function semente(m: MaterialDesc): number {
  let h = 7;
  for (const ch of `${m.textura}${m.cor}${m.cor2 ?? ""}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h || 1;
}

/** Textura desenhada do material; nula quando ele não tem textura ou o aparelho não tem canvas 2D. */
export function texturaDoMaterial(m: MaterialDesc): THREE.CanvasTexture | null {
  const desenho = DESENHOS[m.textura];
  if (!desenho || m.px === 0 || typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = m.px;
  canvas.height = m.px;
  const g = canvas.getContext("2d");
  if (!g) return null;
  desenho(g, m.px, m, sorteio(semente(m)));
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
