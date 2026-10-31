/*
 * MET Gala Heist v2 — casca do interior a partir da grade de 0,5 m (lib/heist/world.ts): pisos, faces internas das
 * paredes (só as que dão para piso de sala interna — a fachada de fora é do cenário da rua), batentes e vergas das
 * portas, tetos, rodapés, sancas, o topo das divisórias do labirinto (3,2 m, sob o teto de 3,6 m) e o parapeito do
 * terraço. Faces vizinhas no mesmo plano viram um quad só; cores por vértice escurecem o encontro com o chão e o canto
 * do teto, e os pisos escurecem perto das paredes (oclusão fingida, calculada na grade).
 */
import * as THREE from "three";
import { CELL, GH, GW, X0, Z0, type World } from "@/lib/heist/world";
import { INNER_WALLS, ROOMS } from "@/lib/heist/level";
import type { DoorDef, RoomId } from "@/lib/heist/types";
import { Batch, BOX0, QuadBuilder, mat } from "./interior-batch";
import { TILE, type FloorKey, type Quality, type WallKey } from "./interior-tex";
import { M, floorMat, wallMat } from "./interior-mats";
import { areaSurface } from "./areas";

export type InteriorRoom = "vestibulo" | "salao" | "galeria" | "lounge" | "terraco" | "bastidores" | "servico" | "seguranca" | "doca" | "cofre";
export const INTERIOR: InteriorRoom[] = ["vestibulo", "salao", "galeria", "lounge", "terraco", "bastidores", "servico", "seguranca", "doca", "cofre"];
export const isInterior = (r: RoomId | null | undefined): r is InteriorRoom => !!r && (INTERIOR as string[]).includes(r);

export interface RoomStyle { h: number; floor: FloorKey; wall: WallKey; ceil: "plaster" | "acoustic" | "dark" | null; base: "marble" | "wood" | "rubber" | "brass" | "black" | null; crown: boolean }
/** Pé-direito e acabamentos de cada sala (o salão tem teto próprio, com cúpulas: interior-hall.ts). */
export const STYLE: Record<InteriorRoom, RoomStyle> = {
  vestibulo: { h: 6.5, floor: "checker", wall: "limestone", ceil: "plaster", base: "marble", crown: true },
  salao: { h: 9.5, floor: "terrazzo", wall: "limestone", ceil: null, base: "marble", crown: false },
  galeria: { h: 5.5, floor: "galleryMarble", wall: "galleryPaint", ceil: "dark", base: "black", crown: false },
  lounge: { h: 4.6, floor: "parquet", wall: "damaskTeal", ceil: "dark", base: "wood", crown: true },
  bastidores: { h: 4.6, floor: "stage", wall: "blackPaint", ceil: "dark", base: null, crown: false },
  servico: { h: 3.6, floor: "concrete", wall: "drywall", ceil: "acoustic", base: "rubber", crown: false },
  seguranca: { h: 3.6, floor: "concrete", wall: "drywall", ceil: null, base: "rubber", crown: false },
  doca: { h: 6, floor: "concrete", wall: "cmu", ceil: "dark", base: null, crown: false },
  cofre: { h: 5.2, floor: "marbleBlack", wall: "damaskPlum", ceil: "dark", base: "brass", crown: true },
  terraco: { h: 7, floor: "pavers", wall: "limestone", ceil: null, base: null, crown: false },
};
/** Altura das divisórias do labirinto e do parapeito do terraço. */
export const PARTITION_H = 3.2, PARAPET_H = 1.15;

/** Altura livre de cada porta (vão). O duto é baixo; janelas e escadas de incêndio do terraço são vãos no parapeito. */
export function doorHeight(d: DoorDef): number {
  switch (d.id) {
    case "main": case "gallery": return 4;
    case "vent": return 0.8;
    case "vault": return 2.8;
    case "windowC": return 2.6;
    case "front": return 4.2;
    case "dockGate": return 4.2;
    default: return 2.6;
  }
}
/** Sala de cada lado da porta (por amostra a 0,3 m do vão), na ordem do eixo da espessura. */
export function doorSides(d: DoorDef): { along: "x" | "z"; lo: RoomId | null; hi: RoomId | null; c: number; w0: number; w1: number; t0: number; t1: number } {
  const r = d.rect, alongX = r.x1 - r.x0 > r.z1 - r.z0;
  if (alongX) return { along: "x", lo: roomAtPoint((r.x0 + r.x1) / 2, r.z0 - 0.3), hi: roomAtPoint((r.x0 + r.x1) / 2, r.z1 + 0.3), c: (r.x0 + r.x1) / 2, w0: r.x0, w1: r.x1, t0: r.z0, t1: r.z1 };
  return { along: "z", lo: roomAtPoint(r.x0 - 0.3, (r.z0 + r.z1) / 2), hi: roomAtPoint(r.x1 + 0.3, (r.z0 + r.z1) / 2), c: (r.z0 + r.z1) / 2, w0: r.z0, w1: r.z1, t0: r.x0, t1: r.x1 };
}
export function roomAtPoint(x: number, z: number): RoomId | null {
  for (const r of ROOMS) if (x >= r.rect.x0 && x <= r.rect.x1 && z >= r.rect.z0 && z <= r.rect.z1) return r.id;
  return null;
}

const idx = (i: number, j: number) => j * GW + i;
const cx = (i: number) => X0 + (i + 0.5) * CELL, cz = (j: number) => Z0 + (j + 0.5) * CELL;

/** Sala de cada célula de piso (null = parede, porta ou fora). */
function cellRooms(w: World): (RoomId | null)[] {
  const out: (RoomId | null)[] = new Array(GW * GH).fill(null);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) if (w.grid[idx(i, j)] === 1) out[idx(i, j)] = roomAtPoint(cx(i), cz(j));
  return out;
}
/** Células de parede do labirinto (divisórias baixas). */
function innerWallMask(): Uint8Array {
  const m = new Uint8Array(GW * GH);
  for (const r of INNER_WALLS) {
    const i0 = Math.floor((r.x0 - X0) / CELL + 1e-6), i1 = Math.ceil((r.x1 - X0) / CELL - 1e-6) - 1, j0 = Math.floor((r.z0 - Z0) / CELL + 1e-6), j1 = Math.ceil((r.z1 - Z0) / CELL - 1e-6) - 1;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (i >= 0 && j >= 0 && i < GW && j < GH) m[idx(i, j)] = 1;
  }
  return m;
}
/** Distância (em células) até a parede mais próxima — oclusão fingida no piso. */
function wallDistance(w: World): Float32Array {
  const d = new Float32Array(GW * GH).fill(99); const q: number[] = [];
  for (let k = 0; k < GW * GH; k++) if (w.grid[k] === 0) { d[k] = 0; q.push(k); }
  for (let h = 0; h < q.length; h++) {
    const k = q[h], i = k % GW, j = (k - i) / GW;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
      const nk = idx(ni, nj); if (d[nk] > d[k] + 1) { d[nk] = d[k] + 1; q.push(nk); }
    }
  }
  return d;
}

export interface ShellInfo { cellRoom: (RoomId | null)[]; inner: Uint8Array; parapet: Uint8Array }

/** Paredes do terraço que dão para fora (norte e leste): parapeito baixo com balaústres, não parede de 7 m. */
function parapetMask(w: World, cellRoom: (RoomId | null)[]): Uint8Array {
  const m = new Uint8Array(GW * GH);
  for (let j = 1; j < GH - 1; j++) for (let i = 1; i < GW - 1; i++) {
    const k = idx(i, j); if (w.grid[k] === 1) continue;
    if (w.grid[k] === 2) { const d = w.doors[w.doorAt[k]]; if (d.id !== "windowT" && d.id !== "fireEscape") continue; }
    let terr = false, other = false;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const r = cellRoom[idx(i + di, j + dj)]; if (r === "terraco") terr = true; else if (isInterior(r)) other = true;
    }
    if (terr && !other) m[k] = 1;
  }
  return m;
}

/**
 * Monta a casca: chama `batch.add` por sala e material. Devolve as máscaras usadas (o terraço e o labirinto desenham
 * detalhes por cima delas).
 */
export function buildShell(w: World, q: Quality, batch: Batch): ShellInfo {
  const P = M(q);
  const cellRoom = cellRooms(w), inner = innerWallMask(), parapet = parapetMask(w, cellRoom), dist = wallDistance(w);

  /* ---------- pisos (retângulo de cada sala, quads de 1 m com oclusão nos cantos) ---------- */
  const floors = new Map<string, QuadBuilder>();
  const fb = (room: string, key: string) => { const k = `${room}|${key}`; let b = floors.get(k); if (!b) { b = new QuadBuilder(); floors.set(k, b); } return b; };
  const aoAt = (x: number, z: number) => {
    // menor distância entre as 4 células em volta do vértice
    const i = Math.round((x - X0) / CELL), j = Math.round((z - Z0) / CELL);
    let d = 99; for (const [di, dj] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < GW && jj < GH) d = Math.min(d, dist[idx(ii, jj)]); }
    const t = Math.min(1, Math.max(0, (d - 0.5) / 2.5)); return 0.58 + 0.42 * t * t * (3 - 2 * t);
  };
  for (const r of ROOMS) {
    if (!isInterior(r.id) || r.id === "seguranca") continue;                 // a sala de segurança fica dentro do serviço
    const st = STYLE[r.id], [tu, tv] = areaSurface(r.id)?.floorTile ?? TILE[st.floor], b = fb(r.id, st.floor), R = r.rect;
    const xs: number[] = [], zs: number[] = [];
    for (let x = R.x0; x < R.x1 - 1e-6; x += 1) xs.push(x); xs.push(R.x1);
    for (let z = R.z0; z < R.z1 - 1e-6; z += 1) zs.push(z); zs.push(R.z1);
    for (let a = 0; a < xs.length - 1; a++) for (let c = 0; c < zs.length - 1; c++) {
      const x0 = xs[a], x1 = xs[a + 1], z0 = zs[c], z1 = zs[c + 1];
      b.quad([[x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0]], [0, 1, 0], [[x0 / tu, -z1 / tv], [x1 / tu, -z1 / tv], [x1 / tu, -z0 / tv], [x0 / tu, -z0 / tv]],
        [aoAt(x0, z1), aoAt(x1, z1), aoAt(x1, z0), aoAt(x0, z0)]);
    }
  }
  // soleiras: piso das células de porta com o piso da sala de um dos lados
  for (const d of w.doors) {
    const s = doorSides(d), room = isInterior(s.lo) ? s.lo : isInterior(s.hi) ? s.hi : null; if (!room) continue;
    const st = STYLE[room], [tu, tv] = areaSurface(room)?.floorTile ?? TILE[st.floor], b = fb(room, st.floor), R = d.rect;
    b.quad([[R.x0, 0, R.z1], [R.x1, 0, R.z1], [R.x1, 0, R.z0], [R.x0, 0, R.z0]], [0, 1, 0], [[R.x0 / tu, -R.z1 / tv], [R.x1 / tu, -R.z1 / tv], [R.x1 / tu, -R.z0 / tv], [R.x0 / tu, -R.z0 / tv]], [0.8, 0.8, 0.8, 0.8]);
  }
  for (const [k, b] of floors) {
    const [room, key] = k.split("|"), o = areaSurface(room as InteriorRoom);
    // piso próprio da área: nome "floor-<sala>" e a força do reflexo no próprio material (prepareInterior)
    const m = o?.floor ? o.floor(q) : floorMat(key as FloorKey, q);
    if (o?.floor) { m.name = `floor-${room}`; m.userData.mirror = o.floorMirror ?? null; }
    batch.add(room, m, b.geometry(), undefined, { receive: true });
  }

  /* ---------- paredes ---------- */
  // faces por plano: chave = sala|material|eixo|plano|sentido|y0|y1 → intervalos ao longo do eixo
  type Run = { room: InteriorRoom; mat: WallKey; axis: "x" | "z"; plane: number; dir: 1 | -1; y0: number; y1: number; kind: "wall" | "jamb" | "low" };
  const runs = new Map<string, { run: Run; iv: [number, number][] }>();
  const addFace = (run: Run, a: number, b: number) => {
    const k = `${run.room}|${run.mat}|${run.axis}|${run.plane.toFixed(3)}|${run.dir}|${run.y0}|${run.y1}|${run.kind}`;
    let e = runs.get(k); if (!e) { e = { run, iv: [] }; runs.set(k, e); } e.iv.push([a, b]);
  };
  const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const k = idx(i, j), c = w.grid[k]; if (c === 0) continue;
    let room: InteriorRoom | null = null, H = 0, kind: Run["kind"] = "wall";
    if (c === 1) { const r = cellRoom[k]; if (!isInterior(r)) continue; room = r; H = STYLE[r].h; }
    else {
      const d = w.doors[w.doorAt[k]], s = doorSides(d); const r = isInterior(s.lo) ? s.lo : isInterior(s.hi) ? s.hi : null; if (!r) continue;
      room = r; kind = "jamb"; H = parapet[k] ? 0 : doorHeight(d);
      if (H === 0) continue;                                                   // vão do parapeito: sem batente alto
    }
    for (const [di, dj] of DIRS) {
      const ni = i + di, nj = j + dj, out = ni < 0 || nj < 0 || ni >= GW || nj >= GH;
      const nk = out ? -1 : idx(ni, nj);
      if (!out && w.grid[nk] !== 0) continue;
      let h = H, kk: Run["kind"] = kind;
      if (!out && inner[nk] && c === 1) { h = PARTITION_H; kk = "low"; }
      if (!out && parapet[nk] && c === 1) { h = PARAPET_H; kk = "low"; }
      const axis: "x" | "z" = di !== 0 ? "x" : "z";
      const plane = axis === "x" ? X0 + (i + (di > 0 ? 1 : 0)) * CELL : Z0 + (j + (dj > 0 ? 1 : 0)) * CELL;
      const dir = (axis === "x" ? -di : -dj) as 1 | -1;                        // a face olha para dentro da célula de piso
      const a = axis === "x" ? Z0 + j * CELL : X0 + i * CELL;
      addFace({ room: room!, mat: STYLE[room!].wall, axis, plane, dir, y0: 0, y1: h, kind: kk }, a, a + CELL);
    }
  }
  // vergas (parede acima do vão), dos dois lados internos, e o forro do vão
  for (const d of w.doors) {
    const s = doorSides(d), dh = doorHeight(d);
    const lowGap = d.id === "windowT" || d.id === "fireEscape"; if (lowGap) continue;
    for (const [side, plane, dir] of [[s.lo, s.t0, -1], [s.hi, s.t1, 1]] as const) {
      if (!isInterior(side)) continue;
      const top = d.id === "secDoor" ? PARTITION_H : STYLE[side].h; if (top > dh) addFace({ room: side, mat: STYLE[side].wall, axis: s.along === "x" ? "z" : "x", plane, dir: dir as 1 | -1, y0: dh, y1: top, kind: "wall" }, s.w0, s.w1);
      if (d.id === "windowC") addFace({ room: side, mat: STYLE[side].wall, axis: s.along === "x" ? "z" : "x", plane, dir: dir as 1 | -1, y0: 0, y1: 0.9, kind: "wall" }, s.w0, s.w1);
    }
  }
  const walls = new Map<string, QuadBuilder>();
  const wb = (room: string, key: string) => { const k = `${room}|${key}`; let b = walls.get(k); if (!b) { b = new QuadBuilder(); walls.set(k, b); } return b; };
  const trims: { room: InteriorRoom; axis: "x" | "z"; plane: number; dir: number; a: number; b: number; y1: number }[] = [];
  for (const { run, iv } of runs.values()) {
    iv.sort((p, q2) => p[0] - q2[0]);
    const merged: [number, number][] = [];
    for (const [a, b] of iv) { const last = merged[merged.length - 1]; if (last && Math.abs(last[1] - a) < 1e-6) last[1] = b; else merged.push([a, b]); }
    const [tu, tv] = areaSurface(run.room)?.wallTile ?? TILE[run.mat], b = wb(run.room, run.mat);
    for (const [a, c] of merged) {
      // faixas: rodapé escuro, corpo, canto do teto
      const ys = run.y1 - run.y0 > 1.2 ? [run.y0, run.y0 + 0.3, run.y1 - 0.45, run.y1] : [run.y0, run.y1];
      const shade = (y: number) => y <= run.y0 + 1e-6 && run.y0 === 0 ? 0.6 : y >= run.y1 - 1e-6 && run.kind === "wall" ? 0.8 : 1;
      for (let s = 0; s < ys.length - 1; s++) {
        const y0 = ys[s], y1 = ys[s + 1], c0 = shade(y0), c1 = shade(y1);
        if (run.axis === "x") {
          const x = run.plane, n = [run.dir, 0, 0];
          const p = run.dir > 0 ? [[x, y0, c], [x, y0, a], [x, y1, a], [x, y1, c]] : [[x, y0, a], [x, y0, c], [x, y1, c], [x, y1, a]];
          b.quad(p, n, p.map((v) => [v[2] / tu, v[1] / tv]), [c0, c0, c1, c1]);
        } else {
          const z = run.plane, n = [0, 0, run.dir];
          const p = run.dir > 0 ? [[a, y0, z], [c, y0, z], [c, y1, z], [a, y1, z]] : [[c, y0, z], [a, y0, z], [a, y1, z], [c, y1, z]];
          b.quad(p, n, p.map((v) => [v[0] / tu, v[1] / tv]), [c0, c0, c1, c1]);
        }
      }
      if (run.kind !== "jamb" && run.y0 === 0) trims.push({ room: run.room, axis: run.axis, plane: run.plane, dir: run.dir, a, b: c, y1: run.y1 });
    }
  }
  for (const [k, b] of walls) { const [room, key] = k.split("|"), o = areaSurface(room as InteriorRoom); batch.add(room, o?.wall ? o.wall(q) : wallMat(key as WallKey, q), b.geometry(), undefined, { cast: true }); }

  /* ---------- rodapés e sancas ---------- */
  const baseMat = { marble: P.marbleDark, wood: P.mahogany, rubber: P.rubber, brass: P.brass, black: P.black } as const;
  for (const t of trims) {
    if (areaSurface(t.room)?.trims === false) continue;                       // a área desenha as próprias molduras
    const st = STYLE[t.room], len = t.b - t.a, mid = (t.a + t.b) / 2;
    const place = (y: number, h: number, depth: number, m: THREE.Material) => {
      const off = t.dir * depth / 2;
      const M4 = t.axis === "x" ? mat(t.plane + off, y, mid, 0, depth, h, len) : mat(mid, y, t.plane + off, 0, len, h, depth);
      batch.add(t.room, m, BOX0(), M4);
    };
    if (st.base && t.y1 >= 2) place(0, st.base === "rubber" ? 0.1 : 0.18, st.base === "rubber" ? 0.012 : 0.022, baseMat[st.base]);
    if (st.crown && t.y1 >= STYLE[t.room].h - 1e-6) { place(t.y1 - 0.22, 0.22, 0.12, P.plasterPlain); place(t.y1 - 0.3, 0.06, 0.06, t.room === "cofre" || t.room === "lounge" ? P.gold : P.plasterPlain); }
    if (t.room === "lounge" && t.y1 >= 2) place(1.1, 0.06, 0.035, P.mahogany);                     // capitel do lambri
  }

  /* ---------- tetos ---------- */
  for (const r of ROOMS) {
    if (!isInterior(r.id)) continue; const st = STYLE[r.id], o = areaSurface(r.id); if (!st.ceil || o?.ceil === null) continue;
    const R = r.rect, h = st.h, m = o?.ceil ? o.ceil(q) : st.ceil === "plaster" ? P.plaster : st.ceil === "acoustic" ? P.acoustic : P.ceilDark;
    const b = new QuadBuilder(), [tu, tv] = st.ceil === "acoustic" ? TILE.acoustic : TILE.plaster;
    b.quad([[R.x0, h, R.z0], [R.x1, h, R.z0], [R.x1, h, R.z1], [R.x0, h, R.z1]], [0, -1, 0], [[R.x0 / tu, R.z0 / tv], [R.x1 / tu, R.z0 / tv], [R.x1 / tu, R.z1 / tv], [R.x0 / tu, R.z1 / tv]], [0.85, 0.85, 0.85, 0.85]);
    batch.add(r.id, m, b.geometry(), undefined, { cast: true });
  }

  /* ---------- topo das divisórias do labirinto e do parapeito ---------- */
  const top = new QuadBuilder();
  for (const r of INNER_WALLS) top.quad([[r.x0, PARTITION_H, r.z1], [r.x1, PARTITION_H, r.z1], [r.x1, PARTITION_H, r.z0], [r.x0, PARTITION_H, r.z0]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], [0.7, 0.7, 0.7, 0.7]);
  batch.add("servico", wallMat("drywall", q), top.geometry());
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) if (parapet[idx(i, j)] && w.grid[idx(i, j)] === 0) {
    batch.add("terraco", P.stone, BOX0(), mat(cx(i), PARAPET_H - 0.02, cz(j), 0, CELL + 0.02, 0.12, CELL + 0.02));      // capeamento
  }
  return { cellRoom, inner, parapet };
}
