/*
 * MET Gala Heist v2 — o que o interior faz a cada quadro, sem React: quais salas aparecem (a da jogadora, a da câmera e as
 * vizinhas por portas abertas), o conjunto fixo de luzes pontuais que segue as âncoras mais fortes perto da câmera (o
 * número de luzes nunca muda, então os shaders não recompilam), o clima de reflexo de cada sala (cópias dos materiais
 * com o PMREM daquele clima), o reflexo planar dos pisos polidos (uma passada espelhada em y = 0, só no "high"), o
 * contorno ciano da Visão nos interativos, os giroflex do alarme, o halo das velas, as portas e as telas.
 *
 * Este arquivo cuida das salas visíveis, das portas e das telas; cada efeito tem o seu módulo ao lado: clima e sondas
 * de reflexo (interior-fx-env), luzes dinâmicas e luz-chave (interior-fx-lights), reflexo planar (interior-fx-mirror),
 * Visão (interior-fx-vision), giroflex e halos das chamas (interior-fx-glow).
 */
import * as THREE from "three";
import { DOORS } from "@/lib/heist/level";
import type { DoorId, RoomId } from "@/lib/heist/types";
import type { SceneView } from "@/lib/heist/view";
import type { InteriorRoom } from "./interior-shell";
import type { DoorOut } from "./interior-doors";
import { cctvTexture } from "./interior-props";

export { MOOD, PROBE_AT, applyRoomEnv, captureProbes, roomMaterial } from "./interior-fx-env";
export { KeyLight, LIGHT_GAIN, LightPool, flickerOf } from "./interior-fx-lights";
export { FloorMirror } from "./interior-fx-mirror";
export { buildVision, updateVision, type VisionOut } from "./interior-fx-vision";
export { buildBeacons, buildHalos, updateBeacons, updateHalos, type BeaconsOut } from "./interior-fx-glow";

/* ---------- salas visíveis ---------- */
/** Ligações entre salas pelas portas; janelas e a escada de incêndio são vãos (sempre "abertos" para o olhar). */
const LINKS = DOORS.map((d) => ({ id: d.id, a: d.between[0], b: d.between[1], always: d.lock === "climb" }));
/**
 * Salas desenhadas neste quadro: a da jogadora e a da câmera, mais duas camadas de vizinhas por portas abertas (do
 * vestíbulo se vê o salão e, pelo vão alinhado, a galeria). `lit` guarda só a primeira camada: as luzes dinâmicas vêm
 * dela (as das vizinhas pesam um terço: uma vela junto da parede do salão não acende o corredor do outro lado); as salas
 * mais distantes aparecem com o ambiente e os emissivos.
 */
export function roomsInView(v: SceneView, camRoom: RoomId | null, seen: Set<RoomId>, lit: Set<RoomId>, core: Set<RoomId>) {
  seen.clear(); lit.clear(); core.clear();
  const seeds: RoomId[] = [v.playerRoom]; if (camRoom && camRoom !== v.playerRoom) seeds.push(camRoom);
  for (const s of seeds) { seen.add(s); lit.add(s); core.add(s); }
  let frontier = seeds.slice();
  for (let depth = 0; depth < 2 && frontier.length; depth++) {
    const next: RoomId[] = [];
    for (const r of frontier) for (const l of LINKS) {
      if (!l.always && !v.doors[l.id]) continue;
      const other = l.a === r ? l.b : l.b === r ? l.a : null;
      if (!other || seen.has(other)) continue;
      seen.add(other); next.push(other); if (depth === 0) lit.add(other);
    }
    frontier = next;
  }
}

/* ---------- portas ---------- */
const LED_RED = new THREE.Color("#ff2a2a").multiplyScalar(2.2), LED_GREEN = new THREE.Color("#2bff6a").multiplyScalar(2.2);
/** Folhas giram até ~92° quando a porta está aberta na simulação; LED verde aberta, vermelho fechada. */
export function updateDoors(d: DoorOut, doors: Record<DoorId, boolean>, dt: number, snap = false) {
  for (const l of d.leaves) {
    const target = doors[l.id] ? 1 : 0;
    l.open = snap ? target : l.open + Math.sign(target - l.open) * Math.min(Math.abs(target - l.open), dt * l.speed * 0.6);
    const e = l.open * l.open * (3 - 2 * l.open);
    l.pivot.rotation.y = l.sign * e * l.angle;
  }
  for (const led of d.leds) (led.mesh.material as THREE.MeshBasicMaterial).color.copy(doors[led.id] ? LED_GREEN : LED_RED);
}

/* ---------- telas, vapor e o diamante ---------- */
export type Animated = { kind: "screen" | "cctv" | "steam" | "diamond" | "glint"; mesh: THREE.Object3D; room: InteriorRoom };
const CCTV_CYCLE = [0, 1, 2, 3, 4, 5, 10, 11, 12];
export function updateAnimated(list: Animated[], v: SceneView, t: number) {
  let cctv = 0;
  for (const a of list) {
    switch (a.kind) {
      case "screen": { const m = (a.mesh as THREE.Mesh).material as THREE.MeshBasicMaterial; m.color.setScalar(1.35 + 0.22 * Math.sin(t * 0.7)); break; }
      case "cctv": {
        // as câmeras trocam de imagem a cada ~5 s (cada monitor fora de fase); sem energia na Sala das Joias, chuvisco escuro
        const m = (a.mesh as THREE.Mesh).material as THREE.MeshBasicMaterial;
        const k = CCTV_CYCLE[(Math.floor(t / 5 + cctv * 0.37) + cctv * 2) % CCTV_CYCLE.length]; cctv++;
        const tex = cctvTexture(k); if (m.map !== tex) { m.map = tex; m.needsUpdate = true; }
        const dim = !v.lasersPowered && cctv % 3 === 0 ? 0.12 : 1;
        m.color.setScalar((1.2 + 0.05 * Math.sin(t * 31 + cctv)) * dim);
        break;
      }
      case "steam": { a.mesh.scale.set(1 + 0.15 * Math.sin(t * 1.7), 1 + 0.25 * Math.sin(t * 1.1), 1 + 0.15 * Math.cos(t * 1.9)); a.mesh.updateMatrix(); break; }
      case "diamond": { a.mesh.visible = v.diamondOnPedestal; a.mesh.rotation.y = t * 0.35; break; }
      case "glint": { a.mesh.visible = v.diamondOnPedestal; const s = 0.18 + 0.12 * Math.max(0, Math.sin(t * 2.3)) ** 8; a.mesh.scale.setScalar(s); break; }
    }
  }
}
