"use client";
/*
 * MET Gala Heist v2 — avenida: placas do público e do restrito, cartazes dos fãs nas grades e o hidrante.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { floorY, SIDEWALK_Y } from "@/lib/heist/level";
import { boxGeo, lathe, merge, place } from "./exterior-geometry";
import type { ExteriorMaterials } from "./exterior-materials";
import { fanSignTex, prng, SIGNAGE, signTex } from "./exterior-textures";

/** Placas que separam o público do restrito: convite no portão, imprensa nas arquibancadas, entrada de serviço, fila. */
export function Signage({ m }: { m: ExteriorMaterials }) {
  const mats = useMemo(() => {
    const mk = (tex: THREE.Texture, glow = 0) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, emissive: glow ? new THREE.Color("#ffffff") : new THREE.Color("#000000"), emissiveMap: glow ? tex : null, emissiveIntensity: glow });
    return {
      invite: mk(signTex("invite", [SIGNAGE.invite, SIGNAGE.gala], { w: 640, h: 256, bg: "#0d0b09", ink: "#e2c27e", font: "serif", border: "#b8913f" }), 0.25),
      press: mk(signTex("press", [SIGNAGE.press], { w: 1024, h: 128, bg: "#101010", ink: "#f2f2f2", font: "sans" })),
      restricted: mk(signTex("restricted", [SIGNAGE.restricted], { w: 1024, h: 128, bg: "#8d1220", ink: "#ffffff", font: "sans" })),
      service: mk(signTex("service", [`${SIGNAGE.serviceArrow}  ${SIGNAGE.service}`, SIGNAGE.staffOnly], { w: 640, h: 256, bg: "#f2c230", ink: "#111111", font: "sans" }), 0.08),
      queue: mk(signTex("queue", [SIGNAGE.queue, SIGNAGE.invite], { w: 640, h: 256, bg: "#0d0b09", ink: "#e2c27e", font: "serif", border: "#b8913f" }), 0.25),
      closed: mk(signTex("closed", [SIGNAGE.closed], { w: 512, h: 128, bg: "#ffffff", ink: "#c1121f", font: "sans", border: "#c1121f" })),
    };
  }, []);
  const data = useMemo(() => {
    const brass: THREE.BufferGeometry[] = [], faces = new Map<string, THREE.BufferGeometry[]>();
    const face = (k: string, g: THREE.BufferGeometry) => (faces.get(k) ?? faces.set(k, []).get(k)!).push(g);
    const plane = (w: number, h: number, M: THREE.Matrix4) => new THREE.PlaneGeometry(w, h).applyMatrix4(M);
    // pedestal de latão com a placa (convite no portão, fim da fila)
    const stand = (x: number, z: number, rot: number, k: string, w = 0.6, h = 0.24) => {
      const y = floorY({ x, z }), M = new THREE.Matrix4().makeRotationY(rot).setPosition(x, y, z);
      brass.push(new THREE.CylinderGeometry(0.018, 0.018, 1.0, 8).translate(0, 0.5, 0).applyMatrix4(M), new THREE.CylinderGeometry(0.16, 0.18, 0.02, 18).translate(0, 0.01, 0).applyMatrix4(M), boxGeo(-(w + 0.04) / 2, 1.0 - 0.02, -0.018, (w + 0.04) / 2, 1.0 + h + 0.02, -0.006).applyMatrix4(M));
      face(k, plane(w, h, M.clone().multiply(new THREE.Matrix4().makeTranslation(0, 1.0 + h / 2, 0))));
    };
    stand(-1.95, 31.25, 0, "invite"); stand(1.95, 31.25, 0, "invite"); stand(15.0, 32.7, 0, "queue");
    for (const x of [-9, 9]) face("press", plane(4.6, 0.58, new THREE.Matrix4().setPosition(x, SIDEWALK_Y + 0.62, 31.02)));
    face("restricted", plane(3.6, 0.45, new THREE.Matrix4().makeRotationY(-Math.PI / 2).setPosition(-12.02, SIDEWALK_Y + 0.42, 27.8)));
    face("restricted", plane(3.6, 0.45, new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(12.02, SIDEWALK_Y + 0.42, 27.8)));
    face("service", plane(0.8, 0.32, new THREE.Matrix4().setPosition(-15.6, SIDEWALK_Y + 2.0, 25.22)));
    for (const x of [-30.75, 30.75]) for (const z of [37.9, 30, 46]) face("closed", plane(1.8, 0.45, new THREE.Matrix4().makeRotationY(x < 0 ? -Math.PI / 2 : Math.PI / 2).setPosition(x + (x < 0 ? -0.04 : 0.04), floorY({ x: Math.sign(x) * 29.9, z }) + 0.85, z)));
    const pole = new THREE.CylinderGeometry(0.03, 0.03, 2.2, 8).translate(-15.6, SIDEWALK_Y + 1.1, 25.2);
    return { brass: merge(brass), pole, faces: [...faces.entries()].map(([k, l]) => ({ k, geo: merge(l) })) };
  }, []);
  return (
    <group>
      <mesh geometry={data.brass} material={m.brass} />
      <mesh geometry={data.pole} material={m.galvanized} />
      {data.faces.map(({ k, geo }) => <mesh key={k} geometry={geo} material={mats[k as keyof typeof mats]} />)}
    </group>
  );
}

/** Cartazes dos fãs presos nas grades (os fãs, de verdade, são do HeistPeople): o lado pintado virado para o tapete e o
 * verso de papelão liso para a calçada (nada de letra espelhada). Um lote por desenho e um para os versos. */
export function FanSigns() {
  const data = useMemo(() => {
    const r = prng(4), fronts = new Map<number, THREE.BufferGeometry[]>(), backs: THREE.BufferGeometry[] = [];
    let k = 0;
    for (let x = -23; x < 29; x += 3.4 + r() * 3, k++) {
      const tilt = (r() - 0.5) * 0.25, m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, Math.PI, tilt)).setPosition(x, SIDEWALK_Y + 0.72, 43.1);
      const f = new THREE.PlaneGeometry(0.56, 0.35).applyMatrix4(m), b = new THREE.PlaneGeometry(0.56, 0.35); b.rotateY(Math.PI); b.applyMatrix4(m);
      const d = k % SIGNAGE.fans.length; (fronts.get(d) ?? fronts.set(d, []).get(d)!).push(f); backs.push(b);
    }
    return { fronts: [...fronts.entries()].map(([d, l]) => ({ d, geo: merge(l) })), back: merge(backs) };
  }, []);
  const back = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c9b896", roughness: 0.95 }), []);
  return (
    <group>
      {data.fronts.map(({ d, geo }) => <mesh key={d} geometry={geo}><meshStandardMaterial map={fanSignTex(d)} roughness={0.85} /></mesh>)}
      <mesh geometry={data.back} material={back} />
    </group>
  );
}

/** Hidrante de ferro fundido (vermelho escuro, tampas de latão). */
export function Hydrant({ m, x, z }: { m: ExteriorMaterials; x: number; z: number }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#6d1414", roughness: 0.55, metalness: 0.35 }), []);
  const geo = useMemo(() => merge([lathe([[0, 0], [0.2, 0], [0.2, 0.06], [0.14, 0.09], [0.13, 0.55], [0.15, 0.58], [0.15, 0.64], [0.1, 0.72], [0.04, 0.78], [0, 0.8]], 16), place(new THREE.CylinderGeometry(0.06, 0.06, 0.38, 10).rotateZ(Math.PI / 2), 0, 0.45, 0)]), []);
  return (
    <group position={[x, SIDEWALK_Y, z]}>
      <mesh geometry={geo} material={mat} castShadow />
      {[-1, 1].map((s) => <mesh key={s} position={[s * 0.2, 0.45, 0]} rotation={[0, 0, Math.PI / 2]} material={m.brass}><cylinderGeometry args={[0.055, 0.055, 0.04, 10]} /></mesh>)}
    </group>
  );
}
