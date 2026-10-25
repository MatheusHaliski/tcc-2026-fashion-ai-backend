/*
 * MET Gala Heist v2 — as portas internas: folhas que giram nas dobradiças conforme view.current.doors (aberta = folha a
 * ~92°), batentes e as ferragens que dizem como cada porta abre — teclado (porta de serviço da doca), leitor de cartão
 * (Sala das Joias), fechadura de chave (porta da equipe no salão), leitor de crachá (portas de funcionários) — com LED
 * vermelho/verde. Também a grade do duto (removida, encostada no chão) e a janela da Sala das Joias que dá para a cornija.
 * As portas da fachada (front, dockGate) e o portão do tapete são do cenário da rua.
 */
import * as THREE from "three";
import type { DoorDef, DoorId } from "@/lib/heist/types";
import { BOX0, Batch, CYL0, Instances, SPH, geo, mat, mul } from "./interior-batch";
import { fabric, glass, glow, solid, type Palette } from "./interior-mats";
import { doorHeight, doorSides, isInterior, type InteriorRoom } from "./interior-shell";
import type { Quality } from "./interior-tex";

type Style = "bronzeGlass" | "walnut" | "steel" | "black" | "french" | "vault" | "hidden";
interface DoorSpec { style: Style; fixture?: "keypad" | "card" | "key" | "badge"; fixtureSide?: InteriorRoom | "lo" | "hi"; swingTo?: "lo" | "hi"; speed?: number;
  /** ângulo aberta (rad; ~92° por padrão; 2,8 = dobrada contra a parede) e folha única mesmo em vão largo */
  angle?: number; single?: boolean }
const SPECS: Partial<Record<DoorId, DoorSpec>> = {
  main: { style: "bronzeGlass", swingTo: "lo" },
  gallery: { style: "walnut", swingTo: "lo" },
  lounge: { style: "walnut", swingTo: "hi" },
  backstage: { style: "black", swingTo: "lo" },
  terrace: { style: "french", swingTo: "hi" },
  staffTerrace: { style: "steel", swingTo: "hi" },
  side: { style: "steel", fixture: "badge", fixtureSide: "vestibulo", swingTo: "lo" },
  stage: { style: "black", fixture: "badge", fixtureSide: "salao", swingTo: "hi" },
  staff: { style: "hidden", fixture: "key", fixtureSide: "salao", swingTo: "hi" },
  // a de serviço abre para a doca (para o labirinto fecharia o corredor de 1,5 m); a da segurança dobra contra a parede
  service: { style: "steel", fixture: "keypad", fixtureSide: "doca", swingTo: "hi" },
  vault: { style: "vault", fixture: "card", fixtureSide: "galeria", swingTo: "lo", speed: 0.9, single: true },
  secDoor: { style: "steel", swingTo: "lo", angle: 2.75 },
};

export interface DoorLeaf { id: DoorId; pivot: THREE.Object3D; sign: number; open: number; speed: number; room: InteriorRoom; angle: number }
export interface DoorOut { leaves: DoorLeaf[]; leds: { id: DoorId; mesh: THREE.Mesh; room: InteriorRoom }[]; group: THREE.Group }

const leafGeo = () => geo("leafBox", () => new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0.5, 0));

/** Monta a folha (no referencial: dobradiça em x = 0, folha para +x, altura em y, espessura em z). */
function leafMesh(style: Style, w: number, h: number, P: Palette, q: Quality): THREE.Group {
  const g = new THREE.Group(), t = style === "vault" ? 0.22 : 0.06;
  const add = (m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, geom: THREE.BufferGeometry = leafGeo()) => { const me = new THREE.Mesh(geom, m); me.position.set(x, y, z); me.scale.set(sx, sy, sz); me.castShadow = true; g.add(me); return me; };
  switch (style) {
    case "bronzeGlass": case "french": {
      const frame = style === "french" ? solid("frenchWhite", "#ece8de", { rough: 0.5 }) : solid("bronze", "#5a3f22", { metal: 0.9, rough: 0.35 });
      const fw = 0.09;
      add(frame, 0, 0, -t / 2, fw, h, t); add(frame, w - fw, 0, -t / 2, fw, h, t); add(frame, 0, 0, -t / 2, w, 0.22, t); add(frame, 0, h - fw, -t / 2, w, fw, t);
      add(frame, 0, h * 0.42, -t / 2, w, 0.05, t);
      add(glass("doorGlass", { opacity: 0.22, tint: "#dbe8ea" }), fw, 0.22, -0.01, w - 2 * fw, h - 0.22 - fw, 0.02);
      add(P.brass, w - 0.18, h * 0.38, t / 2, 0.03, 0.5, 0.04);
      break;
    }
    case "walnut": case "hidden": {
      const wood = style === "hidden" ? P.limestone : P.walnut;
      add(wood, 0, 0, -t / 2, w, h, t);
      // almofadas com moldura dourada (ou o painel de pedra disfarçado na parede do salão, só com a fresta e a fechadura)
      if (style === "walnut") for (const [y, hh] of [[0.25, h * 0.38], [h * 0.48, h * 0.42]] as [number, number][]) for (const s of [1, -1]) {
        add(P.gold, 0.14, y, s * (t / 2 + 0.004), w - 0.28, 0.02, 0.008); add(P.gold, 0.14, y + hh, s * (t / 2 + 0.004), w - 0.28, 0.02, 0.008);
        add(P.gold, 0.14, y, s * (t / 2 + 0.004), 0.02, hh, 0.008); add(P.gold, w - 0.16, y, s * (t / 2 + 0.004), 0.02, hh, 0.008);
      }
      add(P.brass, w - 0.14, h * 0.45, t / 2 + 0.01, 0.025, 0.28, 0.03); add(P.brass, w - 0.14, h * 0.45, -t / 2 - 0.04, 0.025, 0.28, 0.03);
      break;
    }
    case "steel": {
      add(solid("doorSteel", "#5d636a", { metal: 0.6, rough: 0.45 }), 0, 0, -t / 2, w, h, t);
      add(P.steel, 0.05, 0.02, t / 2, w - 0.1, 0.25, 0.006);                   // chapa de chute
      add(glass("wireGlass", { opacity: 0.35, tint: "#c9d2d6" }), w * 0.3, h * 0.6, t / 2 + 0.002, w * 0.4, 0.5, 0.004);
      add(P.darkSteel, w - 0.2, h * 0.42, t / 2, 0.05, 0.05, 0.12);
      break;
    }
    case "black": {
      add(solid("doorBlack", "#141416", { rough: 0.5 }), 0, 0, -t / 2, w, h, t);
      const port = new THREE.Mesh(geo("porthole", () => new THREE.CylinderGeometry(0.17, 0.17, t + 0.02, 24).rotateX(Math.PI / 2)), glass("porthole", { opacity: 0.3, tint: "#9fb4c0" }));
      port.position.set(w / 2, h * 0.68, 0); g.add(port);
      add(P.chrome, 0.06, h * 0.45, t / 2, w - 0.12, 0.04, 0.03);
      break;
    }
    case "vault": {
      const steel = solid("vaultSteel", "#8b9096", { metal: 0.95, rough: 0.22 });
      add(steel, 0, 0, -t / 2, w, h, t);
      add(solid("vaultInset", "#6c7177", { metal: 0.9, rough: 0.3 }), 0.12, 0.15, t / 2, w - 0.24, h - 0.3, 0.02);
      for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(CYL0(14), P.chrome); b.scale.set(0.035, 0.18, 0.035); b.rotation.z = Math.PI / 2; b.position.set(w - 0.02, 0.4 + k * (h - 0.8) / 3, 0); g.add(b); }
      const wheel = new THREE.Mesh(geo("vaultWheel", () => new THREE.TorusGeometry(0.2, 0.025, 8, 28)), P.chrome); wheel.position.set(w * 0.55, h * 0.48, t / 2 + 0.06); g.add(wheel);
      for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(BOX0(), P.chrome); s.scale.set(0.42, 0.025, 0.02); s.rotation.z = (k / 3) * Math.PI; s.position.set(w * 0.55, h * 0.48, t / 2 + 0.06); g.add(s); }
      break;
    }
  }
  void fabric; void q;
  return g;
}

/** Ferragem ao lado da porta, na sala `room`: teclado, leitor de cartão, fechadura ou leitor de crachá, com LED. */
function fixture(kind: NonNullable<DoorSpec["fixture"]>, at: THREE.Matrix4, P: Palette, batch: Batch, room: string, out: THREE.Group): THREE.Mesh {
  if (kind === "key") {
    batch.add(room, P.brass, geo("escutcheon", () => new THREE.CylinderGeometry(0.035, 0.035, 0.01, 18).rotateX(Math.PI / 2)), mul(at, mat(0, 1.05, 0.006)));
    batch.add(room, P.black, BOX0(), mul(at, mat(0, 1.03, 0.012, 0, 0.008, 0.035, 0.004)));
  } else {
    const keypad = kind === "keypad";
    batch.add(room, P.darkSteel, BOX0(), mul(at, mat(0, 1.15, 0.02, 0, keypad ? 0.12 : 0.09, keypad ? 0.17 : 0.13, 0.04)));
    if (keypad) for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) batch.add(room, solid("keyCap", "#c9cdd2", { metal: 0.6, rough: 0.35 }), BOX0(), mul(at, mat(-0.03 + k * 0.03, 1.18 + r * 0.03, 0.042, 0, 0.022, 0.02, 0.006)));
    else batch.add(room, P.black, BOX0(), mul(at, mat(0, 1.2, 0.041, 0, 0.06, 0.035, 0.004)));
  }
  const led = new THREE.Mesh(SPH(6), new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff2a2a").multiplyScalar(2.2) }));
  led.matrixAutoUpdate = false; led.matrix.copy(mul(at, mat(0.045, kind === "key" ? 1.15 : 1.3, 0.045, 0, 0.009))); out.add(led);
  return led;
}

export function buildDoors(doors: DoorDef[], P: Palette, q: Quality, batch: Batch, inst: Instances): DoorOut {
  const group = new THREE.Group(); group.name = "interior-doors";
  const leaves: DoorLeaf[] = [], leds: DoorOut["leds"] = [];
  for (const d of doors) {
    const spec = SPECS[d.id], s = doorSides(d);
    const room = (isInterior(s.lo) ? s.lo : isInterior(s.hi) ? s.hi : null) as InteriorRoom | null;
    if (!room) continue;
    if (d.id === "vent") { vent(d, P, batch, inst); continue; }
    if (d.id === "windowC") { jewelWindow(d, P, batch); continue; }
    if (!spec) continue;
    const H = doorHeight(d), W = s.w1 - s.w0, alongX = s.along === "x", mid = (s.t0 + s.t1) / 2;
    const double = W >= 1.6 && !spec.single, n = double ? 2 : 1, lw = W / n - 0.01;
    // batente dourado/escuro dos dois lados
    const trim = spec.style === "steel" || spec.style === "black" ? P.darkSteel : spec.style === "vault" ? P.chrome : P.gold;
    // (cada lado no lote da sala daquele lado: o batente continua lá quando a sala vizinha está escondida)
    for (const [side, sr] of [[s.t0, s.lo], [s.t1, s.hi]] as const) {
      const at = (along: number, y: number, sx: number, sy: number) => alongX ? mat(along, y, side, 0, sx, sy, 0.05) : mat(side, y, along, 0, 0.05, sy, sx);
      const r = isInterior(sr) ? sr : room, tr = r === "servico" || r === "doca" || r === "seguranca" ? P.darkSteel : trim;
      batch.add(r, tr, BOX0(), at(s.w0 - 0.04, 0, 0.08, H + 0.08)); batch.add(r, tr, BOX0(), at(s.w1 + 0.04, 0, 0.08, H + 0.08));
      batch.add(r, tr, BOX0(), at((s.w0 + s.w1) / 2, H, W + 0.16, 0.08));
    }
    const swing = (spec.swingTo ?? "lo") === "lo" ? -1 : 1;                     // −1: abre para o lado de menor coordenada
    for (let k = 0; k < n; k++) {
      // dobradiça na borda do vão; a folha cresce para o centro
      const hingeAlong = k === 0 ? s.w0 + 0.005 : s.w1 - 0.005, dirAlong = k === 0 ? 1 : -1;
      const pivot = new THREE.Group();
      if (alongX) { pivot.position.set(hingeAlong, 0, mid); pivot.rotation.y = dirAlong > 0 ? 0 : Math.PI; }
      else { pivot.position.set(mid, 0, hingeAlong); pivot.rotation.y = dirAlong > 0 ? -Math.PI / 2 : Math.PI / 2; }
      const base = pivot.rotation.y;
      const leaf = leafMesh(spec.style, lw, H - 0.01, P, q);
      const holder = new THREE.Group(); holder.add(leaf); pivot.add(holder);
      group.add(pivot);
      // o sentido do giro que leva a folha para o lado `swing` (em coordenada perpendicular ao vão)
      const test = (sign: number) => { const a = base + sign * 1.2, fx = Math.cos(a), fz = -Math.sin(a); return alongX ? fz : fx; };
      const sign = Math.sign(test(1)) === swing ? 1 : -1;
      leaves.push({ id: d.id, pivot: holder, sign, open: 0, speed: spec.speed ?? 2.6, room, angle: spec.angle ?? 1.6 });
    }
    if (spec.fixture) {
      const fr = spec.fixtureSide === "lo" ? s.lo : spec.fixtureSide === "hi" ? s.hi : spec.fixtureSide;
      const onLo = fr === s.lo, face = onLo ? s.t0 : s.t1, ry = alongX ? (onLo ? Math.PI : 0) : (onLo ? -Math.PI / 2 : Math.PI / 2);
      const along = s.w1 + 0.32;
      const at = alongX ? mat(along, 0, face, ry) : mat(face, 0, along, ry);
      const led = fixture(spec.fixture, at, P, batch, (fr as InteriorRoom) ?? room, group);
      leds.push({ id: d.id, mesh: led, room: (fr as InteriorRoom) ?? room });
    }
  }
  return { leaves, leds, group };
}

/** Duto entre o labirinto e a Sala das Joias: moldura, venezianas e a grade solta encostada no chão do lado do serviço. */
function vent(d: DoorDef, P: Palette, batch: Batch, inst: Instances) {
  const s = doorSides(d), H = 0.8, x0 = s.w0, x1 = s.w1;
  for (const [side, room] of [[s.t0, "cofre"], [s.t1, "servico"]] as [number, string][]) {
    batch.add(room, P.steel, BOX0(), mat((x0 + x1) / 2, H, side, 0, x1 - x0 + 0.12, 0.06, 0.04));
    for (const x of [x0 - 0.03, x1 + 0.03]) batch.add(room, P.steel, BOX0(), mat(x, 0, side, 0, 0.06, H + 0.06, 0.04));
  }
  batch.add(room0(), P.darkSteel, BOX0(), mat((x0 + x1) / 2, 0, s.t1 + 0.35, 0.4, x1 - x0, 0.03, H, 1.2));
  for (let k = 0; k < 7; k++) inst.add("servico", "ventSlat", BOX0(), P.steel, mat((x0 + x1) / 2 + 0.02, 0.05 + k * 0.1, s.t1 + 0.33, 0.4, x1 - x0 - 0.1, 0.012, 0.03, 1.2));
  function room0() { return "servico"; }
}
/** Janela da Sala das Joias para a cornija (escalar para fora): caixilho de latão, vidro escuro e barras de segurança. */
function jewelWindow(d: DoorDef, P: Palette, batch: Batch) {
  const s = doorSides(d), x0 = s.w0, x1 = s.w1, face = s.t1, y0 = 0.9, y1 = 2.6;
  batch.add("cofre", P.windowNight, BOX0(), mat((x0 + x1) / 2, y0, (s.t0 + s.t1) / 2, 0, x1 - x0, y1 - y0, 0.04));
  for (const [x, y, sx, sy] of [[(x0 + x1) / 2, y0 - 0.04, x1 - x0 + 0.16, 0.08], [(x0 + x1) / 2, y1, x1 - x0 + 0.16, 0.08], [x0 - 0.04, y0, 0.08, y1 - y0], [x1 + 0.04, y0, 0.08, y1 - y0], [(x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, 0.04]] as [number, number, number, number][]) batch.add("cofre", P.brass, BOX0(), mat(x, y, face, 0, sx, sy, 0.06));
  for (let k = 1; k < 4; k++) batch.add("cofre", P.darkSteel, CYL0(8), mat(x0 + k * (x1 - x0) / 4, y0, face + 0.06, 0, 0.012, y1 - y0, 0.012));
  void glow;
}
