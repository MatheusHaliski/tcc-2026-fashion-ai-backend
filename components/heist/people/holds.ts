/*
 * MET Gala Heist v2 — objetos que as pessoas seguram (pistola, faca, lanterna, câmera com flash, bandeja com taças,
 * celular, taça, tablet, diamante, violino) e o ponto de rádio dos seguranças. Geometria simples e materiais PBR,
 * compartilhados por todos os clones (cada objeto é só um Mesh/Group novo apontando para as mesmas geometrias).
 *
 * Quadro da pegada (eixos do objeto): +y ao longo dos dedos, +z para fora da palma (para onde os dedos fecham), +x do
 * indicador para o mínimo. A origem é o centro da palma. `placeInHand` põe esse quadro na mão do esqueleto a partir da
 * mão na pose "A" do arquivo (Rig.hand), então o mesmo objeto serve na mão esquerda e na direita.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Rig } from "@/lib/avatar3d/human/locomotion";
import type { Hold } from "@/lib/heist/types";
import { mesh } from "./holds-kit";
import { TRAY, geo } from "./holds-geometry";

const mats = {
  gun: new THREE.MeshStandardMaterial({ color: "#1b1c1f", roughness: 0.38, metalness: 0.75 }),
  grip: new THREE.MeshStandardMaterial({ color: "#121212", roughness: 0.8, metalness: 0.1 }),
  steel: new THREE.MeshStandardMaterial({ color: "#c9ccd2", roughness: 0.18, metalness: 1 }),
  black: new THREE.MeshStandardMaterial({ color: "#0d0d0f", roughness: 0.55, metalness: 0.2 }),
  lens: new THREE.MeshPhysicalMaterial({ color: "#0a0d14", roughness: 0.05, metalness: 0.2, clearcoat: 1 }),
  flash: new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#fffbe8", emissiveIntensity: 0, roughness: 0.3 }),
  screen: new THREE.MeshStandardMaterial({ color: "#0b1020", emissive: "#5d8cff", emissiveIntensity: 0.9, roughness: 0.25 }),
  silver: new THREE.MeshStandardMaterial({ color: "#d8d8dc", roughness: 0.22, metalness: 0.95 }),
  // vidro sem transmissão: com dezenas de taças em cena, um material transmissivo faria o three desenhar a cena
  // inteira de novo a cada quadro (passo de transmissão); aqui o brilho vem do verniz e do reflexo do ambiente
  glass: new THREE.MeshPhysicalMaterial({ color: "#f4f8ff", roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, specularIntensity: 1, envMapIntensity: 1.6, transparent: true, opacity: 0.28, depthWrite: false }),
  champagne: new THREE.MeshStandardMaterial({ color: "#f3d77a", emissive: "#3a2a05", roughness: 0.15, transparent: true, opacity: 0.85 }),
  redWine: new THREE.MeshPhysicalMaterial({ color: "#5a0814", roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.92 }),
  whiteWine: new THREE.MeshStandardMaterial({ color: "#efe3a8", emissive: "#2a2205", roughness: 0.12, transparent: true, opacity: 0.7 }),
  porcelain: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
  food: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.6, clearcoat: 0.25, clearcoatRoughness: 0.4, sheen: 0.3, sheenRoughness: 0.6 }),
  painted: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.15 }),
  silverPainted: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 1 }),
  linen: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.85, sheen: 0.6, sheenRoughness: 0.7, sheenColor: new THREE.Color("#ffffff") }),
  wood: new THREE.MeshStandardMaterial({ color: "#7a3c16", roughness: 0.45, metalness: 0.05 }),
  bow: new THREE.MeshStandardMaterial({ color: "#efe7d6", roughness: 0.6 }),
  diamond: new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0, metalness: 0, transmission: 0.6, ior: 2.42, thickness: 0.02, iridescence: 1, iridescenceIOR: 1.8, clearcoat: 1, emissive: "#9fc8ff", emissiveIntensity: 0.25, transparent: true, opacity: 0.95 }),
  beam: new THREE.MeshBasicMaterial({ color: "#fff6d8", transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  ear: new THREE.MeshStandardMaterial({ color: "#d9d4cc", roughness: 0.4 }),
  bowtie: new THREE.MeshPhysicalMaterial({ color: "#09090b", roughness: 0.38, sheen: 0.6, sheenColor: new THREE.Color("#3a3a44"), sheenRoughness: 0.5 }),
  coil: new THREE.MeshStandardMaterial({ color: "#e8e3da", roughness: 0.5, transparent: true, opacity: 0.85 }),
};

/** Garfo de sobremesa na mão (quadro da pegada): cabo entre o polegar e o indicador, dentes além dos dedos. */
export function makeFork(): THREE.Group {
  const g = new THREE.Group(); g.name = "garfo";
  g.add(mesh(geo.fork, mats.silverPainted, -0.022, 0.0, 0.016, 0.15, 0, 0.12));
  return g;
}
/** Fone de DJ preso ao osso da cabeça (`head`) ou caído no pescoço (osso Neck). */
export function makeHeadphones(onHead: boolean): THREE.Group {
  const g = new THREE.Group(); g.name = onHead ? "fone-cabeca" : "fone-pescoco";
  const m = mesh(geo.headphones, mats.painted); g.add(m);
  if (!onHead) { m.rotation.set(-1.75, 0, 0); m.position.set(0, 0.0, 0.035); }
  return g;
}
/** Touca de chef (osso Head): `fit` é a meia largura e a meia profundidade da cabeça na altura da testa e o centro. */
export function makeToque(fit: { y: number; z: number; rx: number; rz: number }): THREE.Group {
  const g = new THREE.Group(); g.name = "touca";
  const m = mesh(geo.toque, mats.linen); m.position.set(0, fit.y, fit.z); m.scale.set((fit.rx + 0.012) / 0.1, 1, (fit.rz + 0.012) / 0.1); g.add(m);
  return g;
}
/** Joias e lenço (gala): em jewelry.ts; reexportados para quem monta as pessoas e para os testes. */
export { makeEarrings, makeNecklace, makePocketSquare, type Jewel } from "./jewelry";

/** Botões do dólmã (duas fileiras), nos pontos dados no quadro do osso onde vão presos; a frente do botão em +z. */
export function makeChefButtons(points: THREE.Vector3[]): THREE.Mesh {
  const g = mergeGeometries(points.map((p) => geo.chefButton.clone().translate(p.x, p.y, p.z)), false) ?? new THREE.BufferGeometry();
  const m = mesh(g, mats.linen); m.name = "botoes-dolma"; return m;
}

/** Monta o objeto no quadro da pegada. Lanterna e flash trazem `userData.light` (ponto de luz, ligado pelo pool da cena). */
export function makeHold(kind: Exclude<Hold, null>): THREE.Group {
  const g = new THREE.Group(); g.name = `segura-${kind}`;
  switch (kind) {
    case "pistol": {
      // empunhadura atravessando a palma (x), ferrolho por cima do lado do indicador (−x) apontando para os dedos (+y)
      g.add(mesh(geo.gripB, mats.grip, 0.005, 0, 0.03));
      g.add(mesh(geo.slide, mats.gun, -0.062, 0.07, 0.03));
      g.add(mesh(geo.guard, mats.gun, -0.035, 0.03, 0.03));
      const muzzle = mesh(geo.barrel, mats.black, -0.062, 0.168, 0.03); g.add(muzzle);
      const tip = new THREE.Object3D(); tip.position.set(-0.062, 0.18, 0.03); tip.name = "boca"; g.add(tip); g.userData.muzzle = tip;
      break;
    }
    case "knife": {
      g.add(mesh(geo.handle, mats.black, 0, 0, 0.026));
      g.add(mesh(geo.blade, mats.steel, -0.14, 0, 0.026));          // lâmina saindo do lado do polegar
      break;
    }
    case "flashlight": {
      g.add(mesh(geo.torch, mats.black, -0.02, 0.06, 0.028));
      g.add(mesh(geo.torchHead, mats.silver, -0.02, 0.16, 0.028));
      const lens = mesh(new THREE.CircleGeometry(0.02, 16), new THREE.MeshBasicMaterial({ color: "#fffbe0" }), -0.02, 0.181, 0.028, -Math.PI / 2); g.add(lens);
      const beam = mesh(geo.beam, mats.beam, -0.02, 0.18, 0.028); beam.rotation.set(0, 0, 0); beam.renderOrder = 2; g.add(beam);
      const aim = new THREE.Object3D(); aim.position.set(-0.02, 3, 0.028); g.add(aim);
      g.userData.lightAt = { x: -0.02, y: 0.18, z: 0.028 }; g.userData.target = aim;
      break;
    }
    case "camera": {
      // corpo à frente da palma (+z), lente para o lado do indicador (−x), flash no alto (+y)
      g.add(mesh(geo.camBody, mats.black, 0, 0.02, 0.08));
      const lens = mesh(geo.camLens, mats.black, -0.075, 0.02, 0.08, 0, 0, Math.PI / 2); g.add(lens);
      g.add(mesh(new THREE.CircleGeometry(0.028, 18), mats.lens, -0.121, 0.02, 0.08, 0, -Math.PI / 2, 0));
      g.add(mesh(geo.camFlash, mats.black, 0, 0.085, 0.08));
      const face = mesh(geo.flashFace, mats.flash.clone(), -0.03, 0.09, 0.08, 0, 0, Math.PI / 2); g.add(face);
      g.userData.flash = face;
      break;
    }
    case "phone": g.add(mesh(geo.phone, mats.black, 0, 0.02, 0.022)); g.add(mesh(geo.phoneScreen, mats.screen, 0, 0.02, 0.0265)); break;
    case "tablet": g.add(mesh(geo.tablet, mats.black, 0, 0.04, 0.02)); g.add(mesh(geo.tabletScreen, mats.screen, 0, 0.04, 0.0245)); break;
    case "glass": {
      // taça em pé: o eixo da taça vai do mínimo para o indicador (−x)
      const f = mesh(geo.flute, mats.glass, 0.03, 0.035, 0.045, 0, 0, Math.PI / 2); g.add(f);
      const c = mesh(geo.wine, mats.champagne, 0.03, 0.035, 0.045, 0, 0, Math.PI / 2); g.add(c);
      break;
    }
    case "tray": {
      // bandeja de prata na palma virada para cima: três flûtes de espumante, uma taça de tinto, uma de branco e o
      // guardanapo dobrado; cada material numa geometria só (seis chamadas de desenho por bandeja)
      g.add(mesh(geo.tray, mats.silver, 0, 0.03, 0.03, Math.PI / 2, 0, 0));
      g.add(mesh(TRAY.glass, mats.glass), mesh(TRAY.champagne, mats.champagne), mesh(TRAY.red, mats.redWine), mesh(TRAY.white, mats.whiteWine), mesh(TRAY.napkin, mats.linen));
      break;
    }
    case "plate": {
      // prato de sobremesa na palma virada para cima, com a fatia de bolo (o garfo vai na outra mão: makeFork)
      g.add(mesh(geo.plate, mats.porcelain, 0.004, 0.035, 0.002), mesh(geo.cake, mats.food, 0.004, 0.035, 0.002));
      break;
    }
    case "headphones": {
      // na mão, só quando não está na cabeça (quem chama prende o fone à cabeça com makeHeadphones)
      g.add(mesh(geo.headphones, mats.painted, 0, 0.02, 0.06, 0, 0, Math.PI / 2));
      break;
    }
    case "diamond": {
      const d = mesh(geo.gem, mats.diamond, 0, 0.075, 0.03); d.scale.set(1, 0.7, 1); g.add(d);
      g.userData.sparkle = d;
      break;
    }
    case "violin": {
      // arco na mão direita (o violino vai preso à cabeça: makeViolin)
      g.add(mesh(geo.bowStick, mats.wood, 0.0, 0.0, 0.026, 0, 0, Math.PI / 2));
      g.add(mesh(new THREE.BoxGeometry(0.7, 0.006, 0.001), mats.bow, 0.0, -0.012, 0.026));
      break;
    }
  }
  return g;
}

/** Violino apoiado entre o ombro esquerdo e o queixo (preso ao osso Head, com o quadro do modelo). */
export function makeViolin(): THREE.Group {
  const g = new THREE.Group(); g.name = "violino";
  const body = mesh(geo.violin, mats.wood, 0, 0, 0); body.scale.setScalar(0.95); g.add(body);
  const neck = mesh(geo.neck, mats.black, 0, 0.27, 0.02); g.add(neck);
  // corpo deitado apontando para a esquerda-frente da pessoa, debaixo do queixo
  g.rotation.set(-Math.PI / 2 + 0.35, 0, -Math.PI / 2 - 0.55);
  g.position.set(0.06, -0.1, 0.06);
  return g;
}
/** Ponto de rádio: fone no ouvido direito e o fio enrolado descendo para a gola. Preso ao osso Head. */
export function makeEarpiece(): THREE.Group {
  const g = new THREE.Group(); g.name = "ponto";
  g.add(mesh(geo.earBud, mats.ear, -0.072, 0.035, 0.0));
  const c = mesh(geo.earCoil, mats.coil, -0.07, -0.03, -0.025, 0.2, 0, 0); c.scale.set(1, 6, 1); g.add(c);
  return g;
}

/** Gravata-borboleta: duas asas e o nó, centrada na origem (frente = +z). Quem chama prende ao osso do pescoço. */
export function makeBowTie(): THREE.Group {
  const g = new THREE.Group(); g.name = "gravata-borboleta";
  const right = mesh(geo.bowWing, mats.bowtie); const left = mesh(geo.bowWing, mats.bowtie); left.rotation.y = Math.PI;
  g.add(right, left, mesh(geo.bowKnot, mats.bowtie, 0, 0, 0.003));
  return g;
}

const F = new THREE.Vector3(), N = new THREE.Vector3(), S = new THREE.Vector3(), M = new THREE.Matrix4();
/** Põe o objeto (quadro da pegada) na mão `side` (0 esquerda, 1 direita) do esqueleto. */
export function placeInHand(rig: Rig, side: 0 | 1, obj: THREE.Object3D) {
  F.copy(rig.hand.f[side]); N.copy(rig.hand.n[side]); S.crossVectors(F, N);
  M.makeBasis(S, F, N); obj.quaternion.setFromRotationMatrix(M);
  obj.position.copy(F).multiplyScalar(rig.dim.palm * 0.62).addScaledVector(N, 0.012);
  const hand = rig.bones[rig.k[side ? "RightHand" : "LeftHand"]]; hand.add(obj);
}
/** Mão usada por cada objeto (bandeja, taça, diamante e tablet na esquerda; o resto na direita). */
export const HOLD_SIDE: Record<Exclude<Hold, null>, 0 | 1> = { pistol: 1, knife: 1, flashlight: 1, camera: 1, phone: 1, tablet: 0, glass: 0, tray: 0, diamond: 0, violin: 1, plate: 0, headphones: 1 };
