/*
 * MET Gala Heist v2 — brilhos do interior (interior-fx.ts): os giroflex do alarme (feixes que giram e halo) e o halo
 * que tremula sobre cada chama de vela.
 */
import * as THREE from "three";
import type { RoomId } from "@/lib/heist/types";
import type { SceneView } from "@/lib/heist/view";
import { isInterior, roomAtPoint, type InteriorRoom } from "./interior-shell";
import { drawnTexture } from "./interior-tex";

/* ---------- giroflex do alarme ---------- */
function beamTexture(): THREE.Texture {
  return drawnTexture("beaconBeam", 256, 64, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, 0); grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.35, "rgba(255,255,255,0.35)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.beginPath(); g.moveTo(0, h / 2 - 4); g.lineTo(w, 0); g.lineTo(w, h); g.lineTo(0, h / 2 + 4); g.closePath(); g.fill();
  }, false);
}
function haloTexture(): THREE.Texture {
  return drawnTexture("softHalo", 128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.18, "rgba(255,255,255,0.55)"); grd.addColorStop(0.5, "rgba(255,255,255,0.12)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, false);
}
export interface BeaconsOut { group: THREE.Group; spins: { pivot: THREE.Object3D; room: InteriorRoom; phase: number }[]; halo: THREE.SpriteMaterial; beam: THREE.MeshBasicMaterial }
/** Cada giroflex ganha dois feixes que giram e um halo; tudo apagado até o alarme. */
export function buildBeacons(list: { room: InteriorRoom; pos: THREE.Vector3; normal: THREE.Vector3 }[]): BeaconsOut {
  const group = new THREE.Group(); group.name = "interior-beacons"; group.visible = false;
  const beam = new THREE.MeshBasicMaterial({ map: beamTexture(), color: new THREE.Color("#ff2222").multiplyScalar(1.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const halo = new THREE.SpriteMaterial({ map: haloTexture(), color: new THREE.Color("#ff3030").multiplyScalar(2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const geo = new THREE.PlaneGeometry(2.4, 0.5).translate(1.2, 0, 0);
  const spins: BeaconsOut["spins"] = [];
  list.forEach((b, k) => {
    const pivot = new THREE.Group(); pivot.position.copy(b.pos); pivot.userData.room = b.room;
    for (const a of [0, Math.PI]) { const m = new THREE.Mesh(geo, beam); m.rotation.y = a; m.renderOrder = 4; pivot.add(m); }
    const s = new THREE.Sprite(halo); s.scale.setScalar(0.7); pivot.add(s);
    group.add(pivot); spins.push({ pivot, room: b.room, phase: k * 1.37 });
  });
  return { group, spins, halo, beam };
}
/** Material da cúpula do giroflex (instanciado em interior-rooms) — acende vermelho no alarme. */
export function updateBeacons(o: BeaconsOut, domes: readonly THREE.MeshStandardMaterial[], v: SceneView, seen: Set<RoomId>, t: number) {
  o.group.visible = v.alarm;
  for (const d of domes) { d.emissive.set(v.alarm ? "#ff1a1a" : "#000000"); d.emissiveIntensity = v.alarm ? 2.2 + Math.sin(t * 8) : 0; }
  if (!v.alarm) return;
  for (const s of o.spins) { s.pivot.visible = seen.has(s.room); s.pivot.rotation.y = t * 5.2 + s.phase; }
}

/* ---------- halo das chamas ---------- */
/** Um ponto de brilho por chama (velas dos castiçais, das mesas, lanternas), que tremula sozinho no shader. */
export function buildHalos(flames: THREE.Vector3[], q: "high" | "low"): { room: RoomId; points: THREE.Points }[] {
  const by = new Map<RoomId, THREE.Vector3[]>();
  for (const f of flames) { const r = roomAtPoint(f.x, f.z); if (!r || !isInterior(r)) continue; let l = by.get(r); if (!l) { l = []; by.set(r, l); } l.push(f); }
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uMap: { value: haloTexture() }, uScale: { value: q === "high" ? 1 : 0.8 } },
    vertexShader: /* glsl */ `attribute float aPhase; uniform float uTime; uniform float uScale; varying float vK;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vK = 0.82 + 0.12 * sin(uTime * 12.0 + aPhase) + 0.06 * sin(uTime * 27.0 + aPhase * 2.1);
  gl_PointSize = uScale * 900.0 * 0.11 * vK / max(0.2, -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform sampler2D uMap; varying float vK; void main(){ float a = texture2D(uMap, gl_PointCoord).r; gl_FragColor = vec4(vec3(1.0, 0.72, 0.38) * a * 0.9 * vK, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const out: { room: RoomId; points: THREE.Points }[] = [];
  for (const [room, list] of by) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(list.flatMap((p) => [p.x, p.y + 0.012, p.z]), 3));
    g.setAttribute("aPhase", new THREE.Float32BufferAttribute(list.map((p) => p.x * 7.1 + p.z * 3.3), 1));
    const pts = new THREE.Points(g, mat); pts.renderOrder = 5; pts.userData.room = room; pts.name = `halos-${room}`;
    out.push({ room, points: pts });
  }
  return out;
}
export function updateHalos(list: { points: THREE.Points }[], t: number) {
  const m = list[0]?.points.material as THREE.ShaderMaterial | undefined; if (m) m.uniforms.uTime.value = t;
}
