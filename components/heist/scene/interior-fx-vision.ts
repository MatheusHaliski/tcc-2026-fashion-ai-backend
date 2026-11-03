/*
 * MET Gala Heist v2 — a carta de Visão no interior (interior-fx.ts): caixas de contorno ciano nos interativos, araras,
 * vitrines e portas trancadas, acesas perto da jogadora.
 */
import * as THREE from "three";
import { DOORS, INTERACTS, RACKS, baseProps } from "@/lib/heist/level";
import type { SceneView } from "@/lib/heist/view";
import { doorHeight, isInterior } from "./interior-shell";

/* ---------- Visão: contorno ciano nos interativos ---------- */
const visionMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } },
  vertexShader: /* glsl */ `varying vec3 vP; varying vec3 vS; void main(){ vP = position; vS = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz)); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `uniform float uTime; uniform float uAlpha; varying vec3 vP; varying vec3 vS;
void main(){
  // distância (em metros) até as arestas da caixa: numa face, a menor componente é ~0 (o eixo da face) e a do meio é a
  // distância até a aresta mais próxima — as arestas brilham, as faces ganham um véu de varredura
  vec3 d = (0.5 - abs(vP)) * vS;
  float mn = min(d.x, min(d.y, d.z)), mx = max(d.x, max(d.y, d.z)), mid = d.x + d.y + d.z - mn - mx;
  float edge = 1.0 - smoothstep(0.0, 0.03, mid);
  float scan = 0.5 + 0.5 * sin((vP.y * vS.y) * 9.0 - uTime * 3.0);
  float a = (edge * 0.9 + 0.07 + 0.06 * scan) * uAlpha;
  gl_FragColor = vec4(vec3(0.25, 0.95, 1.0) * (0.6 + edge * 1.6), a);
}`,
  transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
});
export interface VisionOut { group: THREE.Group; items: { mesh: THREE.Mesh; x: number; z: number }[] }
/** Caixas de contorno: cartazes-pista, teclado, cofre, quadro de luz, pedestal, portas trancadas, armários, araras, vitrines. */
export function buildVision(): VisionOut {
  const group = new THREE.Group(); group.name = "interior-vision"; group.renderOrder = 20;
  const items: VisionOut["items"] = [];
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const put = (x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0) => {
    const m = new THREE.Mesh(unit, visionMat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.y = ry; m.renderOrder = 20; m.frustumCulled = false;
    group.add(m); items.push({ mesh: m, x, z });
  };
  const props = baseProps();
  const propBox = (kind: string, near: { x: number; z: number }, h: number, y0 = 0) => {
    let best: (typeof props)[number] | null = null, bd = 1e9;
    for (const p of props) { if (p.kind !== kind) continue; const b = p.shape.type === "box" ? { x: (p.shape.x0 + p.shape.x1) / 2, z: (p.shape.z0 + p.shape.z1) / 2 } : p.shape; const d = Math.hypot(b.x - near.x, b.z - near.z); if (d < bd) { bd = d; best = p; } }
    if (!best) return;
    const s = best.shape;
    if (s.type === "box") put((s.x0 + s.x1) / 2, y0 + h / 2, (s.z0 + s.z1) / 2, s.x1 - s.x0 + 0.06, h, s.z1 - s.z0 + 0.06);
    else put(s.x, y0 + h / 2, s.z, s.r * 2 + 0.06, h, s.r * 2 + 0.06);
  };
  for (const it of INTERACTS) {
    if (!isInterior(it.room)) continue;
    const { x, z } = it.pos;
    switch (it.kind) {
      case "inspect":
        if (it.ref === "posterAurora") put(-11.94, 1.85, 7, 0.08, 2.1, 1.48);
        else if (it.ref === "callsheet") put(15.6, 0.83, 2.06, 0.46, 0.08, 0.36);
        else put(-6.5, 0.62, -13.05, 0.72, 1.26, 0.5);
        break;
      case "keypad": put(-17.68, 1.24, 16.53, 0.18, 0.26, 0.07); break;
      case "safe": propBox("safe", it.pos, 1.0); break;
      case "fuses": put(-21.85, 1.5, 4.75, 0.3, 1.24, 1.12); break;
      case "pedestal": propBox("pedestal", { x: -17.25, z: -14.25 }, 1.56); break;
      case "uniform": put(-12.65, 0.96, 0.48, 0.32, 1.92, 1.4); break;
      case "vendor": put(20.4, 0.6, z, 1.26, 1.2, 1.6); break;
      case "jewelCase": propBox("case", it.pos, 1.75); break;
      case "coatRack": put(7.4, 1.15, 20.4, 0.7, 1.7, 1.2); break;
      case "stash": put(x, 0.32, z, 0.62, 0.64, 0.62); break;
      case "climb":
        if (it.ref === "climbCin") put(-19.5, 1.75, -22.25, 1.04, 1.74, 0.5);
        else if (it.ref === "climbT") put(19.5, 0.6, -22.25, 1.04, 1.2, 0.5);
        else if (it.ref === "fireDown") put(22.25, 0.6, -14, 0.5, 1.2, 2.04);
        break;
      default: break;
    }
  }
  for (const r of RACKS) if (isInterior(r.room)) put(r.pos.x, 0.95, r.pos.z, 1.34, 1.9, 0.64, r.yaw);
  // portas trancadas (ou que exigem algo) do lado de dentro; as abertas ao público não ganham contorno
  for (const d of DOORS) {
    if (d.lock === "open" || d.lock === "climb" || d.lock === "invite") continue;
    if (!isInterior(d.between[0]) && !isInterior(d.between[1])) continue;
    if (d.id === "front" || d.id === "dockGate") continue;
    const r = d.rect, h = doorHeight(d);
    put((r.x0 + r.x1) / 2, h / 2, (r.z0 + r.z1) / 2, r.x1 - r.x0 + 0.08, h, r.z1 - r.z0 + 0.08);
  }
  return { group, items };
}
/** Acende o contorno com a carta de Visão (só o que está a até 22 m da jogadora) e anima a varredura. */
export function updateVision(o: VisionOut, v: SceneView, t: number, dt: number) {
  const u = visionMat.uniforms; u.uTime.value = t;
  u.uAlpha.value += ((v.vision ? 1 : 0) - u.uAlpha.value) * Math.min(1, dt * 5);
  const on = u.uAlpha.value > 0.01; o.group.visible = on;
  if (!on) return;
  for (const it of o.items) it.mesh.visible = Math.hypot(it.x - v.player.x, it.z - v.player.z) < 22;
}
