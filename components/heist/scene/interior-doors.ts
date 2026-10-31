/*
 * MET Gala Heist v2 — as portas internas (dono: a área do vestíbulo). As folhas giram nas dobradiças conforme
 * view.current.doors (aberta = folha a ~92°, a da segurança dobra contra a parede) e cada tipo de porta é desenhado de
 * verdade (interior-doors-leaf.ts): nobres de nogueira com almofadas entalhadas (salão e galeria, 4 m), de aço com visor
 * e barra antipânico (doca, serviço, terraço da equipe, segurança), acolchoada (lounge), preta de palco com estêncil
 * (bastidores), francesa (terraço), disfarçada na parede do salão (equipe) e blindada (Sala das Joias).
 *
 * Em volta de cada vão: guarnição com perfil de cada lado, no estilo da sala daquele lado (cantaria com blocos de base,
 * nogueira com rosetas e filete dourado, batente de aço prensado, quadro de aço rebitado do cofre, ou só a fresta na porta
 * disfarçada), forro das jambas e do alto do vão, batente de encosto e a sapata da mola aérea. As ferragens que dizem como
 * cada porta abre — teclado (doca), leitor de cartão (Sala das Joias), fechadura de chave (equipe), leitor de crachá
 * (funcionários) — têm LED vermelho/verde. Também a grade do duto (removida, encostada no chão) e a janela da Sala das
 * Joias para a cornija. As portas da fachada (front, dockGate) e o portão do tapete são do cenário da rua.
 */
import * as THREE from "three";
import type { DoorDef, DoorId, RoomId } from "@/lib/heist/types";
import { BOX0, Batch, CYL0, Instances, SPH, geo, mat, mul } from "./interior-batch";
import { glow, solid, type Palette } from "./interior-mats";
import { doorHeight, doorSides, isInterior, type InteriorRoom } from "./interior-shell";
import { sceneLocale } from "./interior-copy";
import type { Quality } from "./interior-tex";
import { CLOSER_SHOE, LEAF_T, buildLeaf, closerArm, doorMats, type LeafStyle } from "./interior-doors-leaf";
import { arcPts, profileGeo } from "./areas/vestibulo-kit";
import { DOOR_COPY, type DoorCopy } from "./areas/vestibulo-copy";

type Casing = "stone" | "wood" | "steel" | "black" | "vault" | "none";
interface DoorSpec {
  style: LeafStyle; fixture?: "keypad" | "card" | "key" | "badge"; fixtureSide?: InteriorRoom | "lo" | "hi"; swingTo?: "lo" | "hi"; speed?: number;
  /** ângulo aberta (rad; ~92° por padrão; 2,75 = dobrada contra a parede) e folha única mesmo em vão largo */
  angle?: number; single?: boolean;
  /** guarnição de cada lado (sala → estilo); o que faltar usa `trim` */
  casing?: Partial<Record<RoomId, Casing>>; trim: Casing;
  closer?: boolean; stencil?: keyof Omit<DoorCopy, "tape">;
}
const SPECS: Partial<Record<DoorId, DoorSpec>> = {
  main: { style: "grand", swingTo: "lo", trim: "wood", casing: { vestibulo: "stone" }, closer: true },
  gallery: { style: "grand", swingTo: "lo", trim: "wood", closer: true },
  lounge: { style: "padded", swingTo: "hi", trim: "wood", closer: true },
  backstage: { style: "stage", swingTo: "lo", trim: "black", casing: { bastidores: "steel" }, closer: true, stencil: "backstage" },
  terrace: { style: "french", swingTo: "hi", trim: "wood", casing: { terraco: "stone" } },
  staffTerrace: { style: "steel", swingTo: "hi", trim: "steel", closer: true },
  side: { style: "steel", fixture: "badge", fixtureSide: "vestibulo", swingTo: "lo", trim: "steel", casing: { vestibulo: "stone" }, closer: true },
  stage: { style: "stage", fixture: "badge", fixtureSide: "salao", swingTo: "hi", trim: "black", casing: { bastidores: "steel" }, closer: true, stencil: "stage" },
  staff: { style: "jib", fixture: "key", fixtureSide: "salao", swingTo: "hi", trim: "steel", casing: { salao: "none" } },
  // a de serviço abre para a doca (para o labirinto fecharia o corredor de 1,5 m); a da segurança dobra contra a parede
  service: { style: "steel", fixture: "keypad", fixtureSide: "doca", swingTo: "hi", trim: "steel", closer: true },
  vault: { style: "vault", fixture: "card", fixtureSide: "galeria", swingTo: "lo", speed: 0.9, single: true, trim: "vault" },
  secDoor: { style: "steel", swingTo: "lo", angle: 2.75, trim: "steel" },
};

export interface DoorLeaf { id: DoorId; pivot: THREE.Object3D; sign: number; open: number; speed: number; room: InteriorRoom; angle: number }
export interface DoorOut { leaves: DoorLeaf[]; leds: { id: DoorId; mesh: THREE.Mesh; room: InteriorRoom }[]; group: THREE.Group }

/* ---------- materiais das guarnições ---------- */
const cm = (key: string, color: string, o: Parameters<typeof solid>[2] = {}) => solid(`vestibulo-door-${key}`, color, o);
function casingMats(P: Palette) {
  return {
    stone: cm("casingStone", "#d6c9ad", { rough: 0.66, env: 0.6 }), plinth: P.marbleDark, walnut: P.walnut, gold: P.gold,
    steel: cm("casingSteel", "#4a525a", { metal: 0.5, rough: 0.45 }), steelLight: cm("casingSteelLight", "#868c92", { metal: 0.45, rough: 0.5 }),
    black: cm("casingBlack", "#111113", { rough: 0.6 }), vault: cm("casingVault", "#6c7177", { metal: 0.92, rough: 0.28 }), chrome: P.chrome,
    shadow: cm("casingShadow", "#050505", { rough: 1 }), rubber: cm("casingRubber", "#151515", { rough: 0.9 }),
  };
}
/** Material do forro das jambas e do alto do vão, por tipo de folha. */
function liningMat(style: LeafStyle, P: Palette) {
  const M = doorMats(P);
  return { grand: M.walnut, steel: M.steelPaintLight, padded: M.mahogany, stage: M.blackDoor, french: M.whitePaint, jib: M.steelPaintLight, vault: M.vaultDark }[style];
}

/**
 * Guarnição de um lado do vão (no referencial da face: x ao longo da parede com o vão em −W/2…W/2, y para cima, z saindo
 * da parede para a sala daquele lado).
 */
function casing(batch: Batch, inst: Instances, room: string, kind: Casing, W: number, H: number, at: THREE.Matrix4, C: ReturnType<typeof casingMats>) {
  const add = (m: THREE.Material, g: THREE.BufferGeometry, M: THREE.Matrix4) => batch.add(room, m, g, mul(at, M), { cast: true });
  const box = (m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) => add(m, BOX0(), mat(x, y, z, 0, sx, sy, sz));
  switch (kind) {
    case "none": {
      // porta disfarçada: só a fresta escura em volta da folha
      for (const x of [-W / 2, W / 2]) box(C.shadow, x, 0, 0.002, 0.008, H, 0.004);
      box(C.shadow, 0, H - 0.004, 0.002, W + 0.008, 0.008, 0.004);
      return;
    }
    case "steel": case "black": {
      const m = kind === "steel" ? C.steel : C.black, fw = kind === "steel" ? 0.06 : 0.1;
      for (const s of [-1, 1]) { box(m, s * (W / 2 + fw / 2), 0, 0.011, fw, H + fw, 0.022); box(m, s * (W / 2 + fw - 0.01), 0, 0.03, 0.02, H + fw, 0.018); }
      box(m, 0, H, 0.011, W + 2 * fw, fw, 0.022); box(m, 0, H + fw - 0.02, 0.03, W + 2 * fw, 0.02, 0.018);
      return;
    }
    case "vault": {
      // quadro de aço rebitado (o batente do cofre) e, do lado público, o arco de pedra por fora
      const fw = 0.2;
      for (const s of [-1, 1]) box(C.vault, s * (W / 2 + fw / 2), 0, 0.03, fw, H + fw, 0.06);
      box(C.vault, 0, H, 0.03, W + 2 * fw, fw, 0.06);
      for (let k = 0; k < 9; k++) for (const s of [-1, 1]) inst.add(room, "vestibulo-door-rivet", SPH(6), C.chrome, mul(at, mat(s * (W / 2 + fw / 2), 0.2 + k * (H - 0.2) / 8, 0.062, 0, 0.016)));
      for (let k = 0; k < 7; k++) inst.add(room, "vestibulo-door-rivet", SPH(6), C.chrome, mul(at, mat(-W / 2 - 0.05 + k * (W + 0.1) / 6, H + fw / 2, 0.062, 0, 0.016)));
      for (let k = 0; k < 6; k++) box(C.chrome, W / 2 + 0.02, 0.32 + k * (H - 0.7) / 5, 0.0, 0.03, 0.09, 0.01);
      const sw = 0.32;
      for (const s of [-1, 1]) box(C.stone, s * (W / 2 + fw + sw / 2), 0, 0.015, sw, H + fw + sw, 0.03);
      box(C.stone, 0, H + fw, 0.015, W + 2 * (fw + sw), sw, 0.03);
      return;
    }
    case "stone": case "wood": {
      // arquitrave com perfil (jambas giradas para correr na vertical), blocos de base e, na madeira, rosetas nos cantos
      const stone = kind === "stone", fw = stone ? 0.26 : 0.16, m = stone ? C.stone : C.walnut;
      const prof: [number, number][] = stone ? [[0.03, 0], [0.03, 0.07], [0.05, 0.09], [0.05, 0.17], ...arcPts(0.05, 0.17, 0.085, 0.23, true, 3), [0.085, 0.26]] : [[0.02, 0], [0.03, 0.02], [0.03, 0.1], ...arcPts(0.03, 0.1, 0.05, 0.14, true, 3), [0.05, 0.16]];
      const pb = stone ? 0.3 : 0.2, top = H + fw;
      for (const s of [-1, 1]) {
        add(m, profileGeo(`door-${kind}-jamb-${(H - pb).toFixed(3)}`, prof, H - pb), mat(s * W / 2, pb + (H - pb) / 2, 0, 0, 1, 1, 1, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2));
        box(stone ? C.plinth : C.walnut, s * (W / 2 + fw / 2), 0, stone ? 0.055 : 0.04, fw + 0.02, pb, stone ? 0.11 : 0.08);
        if (!stone) { box(C.walnut, s * (W / 2 + fw / 2), H, 0.03, fw + 0.01, fw, 0.06); inst.add(room, "vestibulo-door-rosette", geo("vestibulo-door-rosetteGeo", () => new THREE.SphereGeometry(0.045, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2)), C.gold, mul(at, mat(s * (W / 2 + fw / 2), H + fw / 2, 0.06))); }
      }
      add(m, profileGeo(`door-${kind}-head-${(W + (stone ? 2 * fw + 0.12 : 0)).toFixed(3)}`, prof, stone ? W + 2 * fw + 0.12 : W), mat(0, H, 0));
      if (!stone) box(C.gold, 0, H + fw * 0.45, 0.033, W, 0.012, 0.01);
      if (stone && H < 3.9) {
        // frontão reto sobre as portas de pedra mais baixas: friso e cornija
        box(C.stone, 0, top, 0.04, W + 2 * fw + 0.12, 0.18, 0.08);
        add(C.stone, profileGeo(`door-cornice-${(W + 2 * fw + 0.3).toFixed(3)}`, [[0.08, 0], ...arcPts(0.08, 0, 0.16, 0.08, false, 3), [0.2, 0.1], [0.2, 0.15], [0.1, 0.17]], W + 2 * fw + 0.3), mat(0, top + 0.18, 0));
      }
      return;
    }
  }
}

/** Ferragem ao lado da porta, na sala `room`: teclado, leitor de cartão, fechadura ou leitor de crachá, com LED. */
function fixture(kind: NonNullable<DoorSpec["fixture"]>, at: THREE.Matrix4, P: Palette, batch: Batch, room: string, out: THREE.Group): THREE.Mesh {
  const face = room === "vestibulo" || room === "salao" || room === "galeria" ? P.brass : P.darkSteel;
  if (kind === "key") {
    batch.add(room, P.brass, geo("escutcheon", () => new THREE.CylinderGeometry(0.035, 0.035, 0.01, 18).rotateX(Math.PI / 2)), mul(at, mat(0, 1.05, 0.006)));
    batch.add(room, P.black, BOX0(), mul(at, mat(0, 1.03, 0.012, 0, 0.008, 0.035, 0.004)));
  } else {
    const keypad = kind === "keypad";
    batch.add(room, face, BOX0(), mul(at, mat(0, 1.12, 0.008, 0, keypad ? 0.15 : 0.12, keypad ? 0.23 : 0.19, 0.016)));
    batch.add(room, P.darkSteel, BOX0(), mul(at, mat(0, 1.15, 0.02, 0, keypad ? 0.12 : 0.09, keypad ? 0.17 : 0.13, 0.04)));
    if (keypad) for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) batch.add(room, solid("keyCap", "#c9cdd2", { metal: 0.6, rough: 0.35 }), BOX0(), mul(at, mat(-0.03 + k * 0.03, 1.18 + r * 0.03, 0.042, 0, 0.022, 0.02, 0.006)));
    else { batch.add(room, P.black, BOX0(), mul(at, mat(0, 1.2, 0.041, 0, 0.06, 0.035, 0.004))); batch.add(room, glow("vestibulo-door-readerGlow", "#5ab0ff", 1.2), BOX0(), mul(at, mat(0, 1.17, 0.041, 0, 0.05, 0.004, 0.003))); }
  }
  const led = new THREE.Mesh(SPH(6), new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff2a2a").multiplyScalar(2.2) }));
  led.matrixAutoUpdate = false; led.matrix.copy(mul(at, mat(0.045, kind === "key" ? 1.15 : 1.3, 0.045, 0, 0.009))); out.add(led);
  return led;
}

export function buildDoors(doors: DoorDef[], P: Palette, q: Quality, batch: Batch, inst: Instances): DoorOut {
  const group = new THREE.Group(); group.name = "interior-doors";
  const leaves: DoorLeaf[] = [], leds: DoorOut["leds"] = [], C = casingMats(P), loc = sceneLocale();
  for (const d of doors) {
    const spec = SPECS[d.id], s = doorSides(d);
    const room = (isInterior(s.lo) ? s.lo : isInterior(s.hi) ? s.hi : null) as InteriorRoom | null;
    if (!room) continue;
    if (d.id === "vent") { vent(d, P, batch, inst); continue; }
    if (d.id === "windowC") { jewelWindow(d, P, batch); continue; }
    if (!spec) continue;
    const H = doorHeight(d), W = s.w1 - s.w0, alongX = s.along === "x", mid = (s.t0 + s.t1) / 2, cAlong = (s.w0 + s.w1) / 2;
    const double = W >= 1.6 && !spec.single, n = double ? 2 : 1, lw = W / n - 0.02, t = LEAF_T[spec.style];
    const swing = (spec.swingTo ?? "lo") === "lo" ? -1 : 1;                     // −1: abre para o lado de menor coordenada
    const swingRoom = swing < 0 ? s.lo : s.hi;
    /* guarnição de cada lado, no lote da sala daquele lado (continua lá quando a sala vizinha está escondida) */
    for (const [face, sr, normal] of [[s.t0, s.lo, -1], [s.t1, s.hi, 1]] as const) {
      if (!isInterior(sr)) continue;
      const ry = alongX ? (normal < 0 ? Math.PI : 0) : (normal < 0 ? -Math.PI / 2 : Math.PI / 2);
      const at = alongX ? mat(cAlong, 0, face, ry) : mat(face, 0, cAlong, ry);
      casing(batch, inst, sr, spec.casing?.[sr] ?? spec.trim, W, H, at, C);
    }
    /* forro das jambas e do alto do vão (a casca não fecha o teto do vão) e o batente de encosto do lado oposto ao giro */
    const lin = liningMat(spec.style, P), th = s.t1 - s.t0, stopAt = mid - swing * (t / 2 + 0.008);
    const wb = (along0: number, y0: number, t0: number, a1: number, y1: number, t1: number, m: THREE.Material, r: string) => {
      const ca = (along0 + a1) / 2, ct = (t0 + t1) / 2, sa = Math.abs(a1 - along0), st = Math.abs(t1 - t0);
      batch.add(r, m, BOX0(), alongX ? mat(ca, y0, ct, 0, sa, y1 - y0, st) : mat(ct, y0, ca, 0, st, y1 - y0, sa));
    };
    wb(s.w0, 0, s.t0, s.w0 + 0.012, H, s.t1, lin, room); wb(s.w1 - 0.012, 0, s.t0, s.w1, H, s.t1, lin, room);
    wb(s.w0, H, s.t0, s.w1, H + 0.02, s.t1, lin, room);
    if (spec.style !== "vault" && spec.style !== "jib") {
      const sm = spec.style === "steel" ? C.rubber : lin;
      wb(s.w0 + 0.012, 0, stopAt - 0.008, s.w0 + 0.03, H, stopAt + 0.008, sm, room); wb(s.w1 - 0.03, 0, stopAt - 0.008, s.w1 - 0.012, H, stopAt + 0.008, sm, room);
      wb(s.w0, H - 0.018, stopAt - 0.008, s.w1, H, stopAt + 0.008, sm, room);
    }
    void th;
    /* folhas */
    for (let k = 0; k < n; k++) {
      // dobradiça na borda do vão (depois do forro); a folha cresce para o centro
      const hingeAlong = k === 0 ? s.w0 + 0.014 : s.w1 - 0.014, dirAlong = k === 0 ? 1 : -1;
      const pivot = new THREE.Group();
      if (alongX) { pivot.position.set(hingeAlong, 0, mid); pivot.rotation.y = dirAlong > 0 ? 0 : Math.PI; }
      else { pivot.position.set(mid, 0, hingeAlong); pivot.rotation.y = dirAlong > 0 ? -Math.PI / 2 : Math.PI / 2; }
      const base = pivot.rotation.y;
      // para onde olha a frente (+z) da folha e qual lado é o de puxar (o lado para onde ela abre)
      const front: RoomId | null = alongX ? (k === 0 ? s.hi : s.lo) : (k === 0 ? s.lo : s.hi), back: RoomId | null = front === s.lo ? s.hi : s.lo;
      const pull: 1 | -1 = front === swingRoom ? 1 : -1;
      const leaf = buildLeaf({ style: spec.style, w: lw, h: H - 0.01, pull, front, back, stencil: spec.stencil && DOOR_COPY[loc][spec.stencil], tape: spec.stencil && DOOR_COPY[loc].tape, closer: spec.closer, wallUv: spec.style === "jib" ? { origin: hingeAlong, dir: dirAlong } : undefined }, P, q);
      const holder = new THREE.Group(); holder.add(leaf); pivot.add(holder);
      if (spec.closer) {
        // mola aérea em braço paralelo, do lado de empurrar (oposto ao giro); a sapata pende do forro do vão
        const side = -pull, metal = spec.style === "grand" || spec.style === "padded" ? P.brass : spec.style === "stage" ? C.black : C.steelLight;
        holder.add(closerArm(H - 0.01, t, side, holder, metal));
        const shoe = new THREE.Vector3(CLOSER_SHOE[0], H - 0.15, side * Math.max(CLOSER_SHOE[1], t / 2 + 0.09)).applyMatrix4(new THREE.Matrix4().compose(pivot.position, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), base), new THREE.Vector3(1, 1, 1)));
        const pushRoom = swing < 0 ? s.hi : s.lo, sr = isInterior(pushRoom) ? pushRoom : room;
        batch.add(sr, metal, BOX0(), mat(shoe.x, shoe.y, shoe.z, base, 0.07, H - shoe.y, 0.03));
      }
      group.add(pivot);
      // o sentido do giro que leva a folha para o lado `swing` (em coordenada perpendicular ao vão)
      const test = (sign: number) => { const a = base + sign * 1.2, fx = Math.cos(a), fz = -Math.sin(a); return alongX ? fz : fx; };
      const sign = Math.sign(test(1)) === swing ? 1 : -1;
      leaves.push({ id: d.id, pivot: holder, sign, open: 0, speed: spec.speed ?? 2.6, room, angle: spec.angle ?? 1.6 });
    }
    if (spec.fixture) {
      const fr = spec.fixtureSide === "lo" ? s.lo : spec.fixtureSide === "hi" ? s.hi : spec.fixtureSide;
      const onLo = fr === s.lo, face = onLo ? s.t0 : s.t1, ry = alongX ? (onLo ? Math.PI : 0) : (onLo ? -Math.PI / 2 : Math.PI / 2);
      // a ferragem fica além da guarnição (a de pedra é mais larga)
      const cas = spec.casing?.[fr as RoomId] ?? spec.trim, along = s.w1 + (cas === "stone" ? 0.48 : cas === "vault" ? 0.68 : 0.32);
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
    for (const x of [x0 - 0.03, x1 + 0.03]) for (const y of [0.1, H - 0.05]) inst.add(room, "vestibulo-door-ventScrew", CYL0(8), P.chrome, mat(x, y, side + (side === s.t0 ? -0.022 : 0.022), 0, 0.008, 0.006, 0.008, Math.PI / 2));
  }
  // o fundo do duto (escuro) e a grade solta encostada na parede do lado do serviço, com os parafusos no chão
  batch.add("servico", solid("vestibulo-door-ventDark", "#060606", { rough: 1 }), BOX0(), mat((x0 + x1) / 2, 0, (s.t0 + s.t1) / 2, 0, x1 - x0, 0.01, s.t1 - s.t0));
  batch.add("servico", P.darkSteel, BOX0(), mat((x0 + x1) / 2, 0, s.t1 + 0.35, 0.4, x1 - x0, 0.03, H, 1.2));
  for (let k = 0; k < 7; k++) inst.add("servico", "ventSlat", BOX0(), P.steel, mat((x0 + x1) / 2 + 0.02, 0.05 + k * 0.1, s.t1 + 0.33, 0.4, x1 - x0 - 0.1, 0.012, 0.03, 1.2));
  for (let k = 0; k < 4; k++) inst.add("servico", "vestibulo-door-ventScrewLoose", CYL0(8), P.chrome, mat((x0 + x1) / 2 - 0.3 + k * 0.13, 0, s.t1 + 0.75 + (k % 2) * 0.06, k, 0.008, 0.02, 0.008, Math.PI / 2));
}
/** Janela da Sala das Joias para a cornija (escalar para fora): caixilho de latão, vidro escuro e barras de segurança. */
function jewelWindow(d: DoorDef, P: Palette, batch: Batch) {
  const s = doorSides(d), x0 = s.w0, x1 = s.w1, face = s.t1, y0 = 0.9, y1 = 2.6;
  batch.add("cofre", P.windowNight, BOX0(), mat((x0 + x1) / 2, y0, (s.t0 + s.t1) / 2, 0, x1 - x0, y1 - y0, 0.04));
  for (const [x, y, sx, sy] of [[(x0 + x1) / 2, y0 - 0.04, x1 - x0 + 0.16, 0.08], [(x0 + x1) / 2, y1, x1 - x0 + 0.16, 0.08], [x0 - 0.04, y0, 0.08, y1 - y0], [x1 + 0.04, y0, 0.08, y1 - y0], [(x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, 0.04]] as [number, number, number, number][]) batch.add("cofre", P.brass, BOX0(), mat(x, y, face, 0, sx, sy, 0.06));
  for (let k = 1; k < 4; k++) batch.add("cofre", P.darkSteel, CYL0(8), mat(x0 + k * (x1 - x0) / 4, y0, face + 0.06, 0, 0.012, y1 - y0, 0.012));
  // peitoril de pedra e o trinco
  batch.add("cofre", P.stone, BOX0(), mat((x0 + x1) / 2, y0 - 0.12, face + 0.08, 0, x1 - x0 + 0.3, 0.06, 0.2));
  batch.add("cofre", P.brass, BOX0(), mat((x0 + x1) / 2 + 0.05, (y0 + y1) / 2 + 0.06, face + 0.07, 0, 0.03, 0.1, 0.02));
}
