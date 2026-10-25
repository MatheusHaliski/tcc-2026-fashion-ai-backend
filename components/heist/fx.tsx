"use client";
/*
 * MET Gala Heist v2 — efeitos de jogo na cena: feixes dos lasers da Sala das Joias (fracos a olho nu, nítidos com a
 * Visão), rastro e clarão dos tiros, itens no chão (chave, cartão, pistola, munição) brilhando, luz vermelha do alarme e a
 * Visão (silhuetas dos seguranças através das paredes, coloridas pelo estado).
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { SceneView } from "@/lib/heist/view";
import { LASERS } from "@/lib/heist/level";

const MAX_SHOTS = 12, MAX_DROPS = 12, MAX_XRAY = 40;

export function HeistFx({ view }: { view: React.MutableRefObject<SceneView> }) {
  const lasers = useRef<THREE.Mesh[]>([]);
  const shots = useRef<THREE.Mesh[]>([]);
  const flashes = useRef<THREE.PointLight[]>([]);
  const drops = useRef<THREE.Mesh[]>([]);
  const xray = useRef<THREE.Mesh[]>([]);
  const alarm = useRef<THREE.PointLight>(null);
  const laserMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ff1f3d", transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const tracerMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffe2a8", transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const dropMats = useMemo(() => ({
    key: new THREE.MeshStandardMaterial({ color: "#d9b25c", metalness: 1, roughness: 0.25, emissive: "#6b4a10", emissiveIntensity: 0.6 }),
    keycard: new THREE.MeshStandardMaterial({ color: "#e8edf5", roughness: 0.4, emissive: "#2a6cff", emissiveIntensity: 0.8 }),
    guardPistol: new THREE.MeshStandardMaterial({ color: "#1a1b1e", metalness: 0.7, roughness: 0.35, emissive: "#401010", emissiveIntensity: 0.4 }),
    ammo: new THREE.MeshStandardMaterial({ color: "#7a6233", metalness: 0.8, roughness: 0.3, emissive: "#3a2a08", emissiveIntensity: 0.5 }),
  }), []);
  const xrayMats = useMemo(() => ({
    calm: new THREE.MeshBasicMaterial({ color: "#7fd7ff", transparent: true, opacity: 0.35, depthTest: false, depthWrite: false }),
    alert: new THREE.MeshBasicMaterial({ color: "#ff3b3b", transparent: true, opacity: 0.45, depthTest: false, depthWrite: false }),
  }), []);
  const capsule = useMemo(() => new THREE.CapsuleGeometry(0.26, 1.2, 4, 10), []);
  const beam = useMemo(() => new THREE.CylinderGeometry(0.012, 0.012, 1, 6, 1, true), []);
  const dropGeo = useMemo(() => ({ key: new THREE.BoxGeometry(0.16, 0.03, 0.06), keycard: new THREE.BoxGeometry(0.09, 0.005, 0.055), guardPistol: new THREE.BoxGeometry(0.22, 0.05, 0.13), ammo: new THREE.BoxGeometry(0.1, 0.06, 0.06) }), []);

  useFrame(({ clock }) => {
    const v = view.current, t = clock.elapsedTime;
    // lasers: feixe vertical em camadas (alto = 1,1 m; cheio = 0,25 a 1,6 m)
    LASERS.forEach((L, i) => {
      const on = v.lasers[L.id] && v.lasersPowered;
      for (let k = 0; k < 3; k++) {
        const m = lasers.current[i * 3 + k]; if (!m) continue;
        const h = L.height === "high" ? 1.1 : [0.35, 0.9, 1.45][k];
        m.visible = on && (L.height === "full" || k === 0) && v.playerRoom === "cofre";
        const dx = L.b.x - L.a.x, dz = L.b.z - L.a.z, len = Math.hypot(dx, dz);
        m.position.set((L.a.x + L.b.x) / 2, h, (L.a.z + L.b.z) / 2);
        m.scale.set(v.vision ? 1.8 : 1, len, v.vision ? 1.8 : 1);
        m.rotation.set(0, 0, 0); m.rotateY(Math.atan2(dx, dz)); m.rotateX(Math.PI / 2);
      }
    });
    laserMat.opacity = view.current.vision ? 0.95 : 0.22 + 0.06 * Math.sin(t * 9);
    // tiros
    v.shots.slice(-MAX_SHOTS).forEach((sh, i) => {
      const m = shots.current[i], f = flashes.current[i]; if (!m || !f) return;
      const age = v.time - sh.at;
      const a = new THREE.Vector3(sh.from.x, sh.from.y, sh.from.z), b = new THREE.Vector3(sh.to.x, sh.to.y, sh.to.z);
      const len = a.distanceTo(b);
      m.visible = age < 0.07 && len > 0.2;
      m.position.copy(a).lerp(b, 0.5); m.scale.set(1, len, 1); m.lookAt(b); m.rotateX(Math.PI / 2);
      f.visible = age < 0.06 && !sh.silenced; f.position.copy(a); f.intensity = 18 * (1 - age / 0.06);
    });
    for (let i = Math.min(MAX_SHOTS, v.shots.length); i < MAX_SHOTS; i++) { if (shots.current[i]) shots.current[i].visible = false; if (flashes.current[i]) flashes.current[i].visible = false; }
    // itens no chão
    for (let i = 0; i < MAX_DROPS; i++) {
      const m = drops.current[i], d = v.drops[i]; if (!m) continue;
      m.visible = !!d;
      if (!d) continue;
      const kind = d.kind as keyof typeof dropMats;
      m.geometry = dropGeo[kind] ?? dropGeo.ammo; m.material = dropMats[kind] ?? dropMats.ammo;
      m.position.set(d.x, d.y + 0.05 + Math.sin(t * 3 + i) * 0.02, d.z); m.rotation.y = t * 1.2 + i;
    }
    // alarme: luz vermelha pulsando perto da jogadora
    if (alarm.current) { alarm.current.visible = v.alarm; alarm.current.position.set(v.player.x, v.player.y + 3.2, v.player.z); alarm.current.intensity = v.alarm ? 6 + 6 * Math.max(0, Math.sin(t * 6)) : 0; }
    // Visão: silhuetas por trás das paredes
    let n = 0;
    for (const a of v.actors) {
      if (n >= MAX_XRAY) break;
      if (!v.vision || a.kind !== "guard" || a.anim === "dead" || a.anim === "knockedOut") continue;
      const m = xray.current[n++]; if (!m) continue;
      m.visible = true; m.position.set(a.x, a.y + 0.9, a.z); m.material = a.hold === "pistol" ? xrayMats.alert : xrayMats.calm;
    }
    for (let i = n; i < MAX_XRAY; i++) if (xray.current[i]) xray.current[i].visible = false;
  });

  return <group>
    {LASERS.flatMap((L, i) => [0, 1, 2].map((k) => <mesh key={`${L.id}-${k}`} ref={(m) => { if (m) lasers.current[i * 3 + k] = m; }} geometry={beam} material={laserMat} visible={false} renderOrder={5} />))}
    {Array.from({ length: MAX_SHOTS }, (_, i) => <group key={i}>
      <mesh ref={(m) => { if (m) shots.current[i] = m; }} material={tracerMat} visible={false}><cylinderGeometry args={[0.008, 0.008, 1, 4, 1, true]} /></mesh>
      <pointLight ref={(l) => { if (l) flashes.current[i] = l; }} color="#ffd38a" distance={6} decay={2} visible={false} />
    </group>)}
    {Array.from({ length: MAX_DROPS }, (_, i) => <mesh key={i} ref={(m) => { if (m) drops.current[i] = m; }} visible={false} castShadow />)}
    {Array.from({ length: MAX_XRAY }, (_, i) => <mesh key={i} ref={(m) => { if (m) xray.current[i] = m; }} geometry={capsule} visible={false} renderOrder={10} />)}
    <pointLight ref={alarm} color="#ff1a1a" distance={18} decay={1.6} visible={false} />
  </group>;
}
