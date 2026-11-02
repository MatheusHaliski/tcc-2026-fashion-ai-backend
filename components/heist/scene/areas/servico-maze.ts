/*
 * MET Gala Heist v2 — o labirinto de serviço lido da grade de 0,5 m do mundo (lib/heist/world.ts, só leitura): faces
 * de parede que dão para o piso, quinas salientes e vãos de piso (para rodapés, para-choques, cantoneiras, azulejos e o
 * forro a 3,2 m), as zonas de acabamento da copa por célula e a célula do labirinto de um ponto.
 * Saiu de servico-kit.ts sem mudança (servico-kit.ts continua reexportando tudo).
 */
import { CELL, GH, GW, X0, Z0, buildWorld } from "@/lib/heist/world";
import { MAZE, ROOMS } from "@/lib/heist/level";

/* ======================= o labirinto lido da grade ======================= */
export type MazeRoom = "servico" | "seguranca";
/** Face de parede que dá para o piso: plano x = const (axis "x", vai de z a até b) ou z = const (axis "z", vai de x a até b);
 * `dir` = para onde a face olha; `outer` = parede do prédio (3,6 m), senão divisória (3,2 m). */
export interface WFace { axis: "x" | "z"; plane: number; dir: 1 | -1; a: number; b: number; room: MazeRoom; outer: boolean }
/** Quina saliente (canto vivo de parede entre dois lados de piso): vértice e o quadrante do piso (sx, sz). */
export interface WCorner { x: number; z: number; sx: number; sz: number; room: MazeRoom }
export interface FloorRect { x0: number; z0: number; x1: number; z1: number; room: MazeRoom; zone: string }
export interface MazeInfo { faces: WFace[]; corners: WCorner[]; floors: FloorRect[] }
/** Célula do labirinto (coluna, linha) de um ponto. */
export const mazeCellOf = (x: number, z: number): [number, number] => [Math.max(0, Math.min(MAZE.cols - 1, Math.floor((x - MAZE.x0) / MAZE.cell))), Math.max(0, Math.min(MAZE.rows - 1, Math.floor((z - MAZE.z0) / MAZE.cell)))];
/** Zonas de acabamento da copa (azulejo, cerâmica e forro de PVC) por célula do labirinto. */
export const COPA_ZONES: Record<string, [number, number][]> = {
  cozinha: [[0, 0], [1, 0], [0, 1], [0, 2], [1, 1], [1, 2], [2, 1], [2, 2], [0, 3], [1, 3]],
  montagem: [[3, 6], [4, 6]], bar: [[3, 8]], lavagem: [[3, 3]],
};
export function zoneOf(x: number, z: number): string {
  const [c, r] = mazeCellOf(x, z);
  for (const [k, cells] of Object.entries(COPA_ZONES)) if (cells.some(([a, b]) => a === c && b === r)) return k;
  return "corredor";
}
let mazeCache: MazeInfo | null = null;
export function mazeInfo(): MazeInfo {
  if (mazeCache) return mazeCache;
  const w = buildWorld(), idx = (i: number, j: number) => j * GW + i;
  const sec = ROOMS.find((r) => r.id === "seguranca")!.rect, srv = ROOMS.find((r) => r.id === "servico")!.rect;
  const cx = (i: number) => X0 + (i + 0.5) * CELL, cz = (j: number) => Z0 + (j + 0.5) * CELL;
  const inR = (r: { x0: number; z0: number; x1: number; z1: number }, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
  const floorRoom = (i: number, j: number): MazeRoom | null => {
    if (i < 0 || j < 0 || i >= GW || j >= GH || w.grid[idx(i, j)] !== 1) return null;
    const x = cx(i), z = cz(j); return inR(sec, x, z) ? "seguranca" : inR(srv, x, z) ? "servico" : null;
  };
  const isWall = (i: number, j: number) => i >= 0 && j >= 0 && i < GW && j < GH && w.grid[idx(i, j)] === 0;
  const i0 = Math.round((srv.x0 - X0) / CELL) - 1, i1 = Math.round((srv.x1 - X0) / CELL), j0 = Math.round((srv.z0 - Z0) / CELL) - 1, j1 = Math.round((srv.z1 - Z0) / CELL);
  // faces: por célula de piso e lado com parede; depois junta as vizinhas no mesmo plano
  const runs = new Map<string, { f: Omit<WFace, "a" | "b">; iv: [number, number][] }>();
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const room = floorRoom(i, j); if (!room) continue;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (!isWall(i + di, j + dj)) continue;
      const nx = cx(i + di), nz = cz(j + dj), outer = !inR(srv, nx, nz) || nx < srv.x0 || nx > srv.x1 || nz < srv.z0 || nz > srv.z1;
      const axis = di !== 0 ? "x" : "z", plane = axis === "x" ? X0 + (i + (di > 0 ? 1 : 0)) * CELL : Z0 + (j + (dj > 0 ? 1 : 0)) * CELL;
      const dir = (axis === "x" ? -di : -dj) as 1 | -1, a = axis === "x" ? Z0 + j * CELL : X0 + i * CELL;
      const key = `${axis}|${plane.toFixed(3)}|${dir}|${room}|${outer}`;
      let e = runs.get(key); if (!e) { e = { f: { axis, plane, dir, room, outer }, iv: [] }; runs.set(key, e); } e.iv.push([a, a + CELL]);
    }
  }
  const faces: WFace[] = [];
  for (const { f, iv } of runs.values()) {
    iv.sort((p, q) => p[0] - q[0]);
    let cur: [number, number] | null = null;
    for (const s of iv) { if (cur && Math.abs(cur[1] - s[0]) < 1e-6) cur[1] = s[1]; else { if (cur) faces.push({ ...f, a: cur[0], b: cur[1] }); cur = [s[0], s[1]]; } }
    if (cur) faces.push({ ...f, a: cur[0], b: cur[1] });
  }
  // quinas salientes: célula de parede com piso dos dois lados perpendiculares e na diagonal
  const corners: WCorner[] = [];
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    if (!isWall(i, j)) continue;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const a = floorRoom(i + sx, j), b = floorRoom(i, j + sz), d = floorRoom(i + sx, j + sz);
      if (a && b && d && a === b && b === d) corners.push({ x: X0 + (i + (sx > 0 ? 1 : 0)) * CELL, z: Z0 + (j + (sz > 0 ? 1 : 0)) * CELL, sx, sz, room: a });
    }
  }
  // vãos de piso (para o forro): faixas por linha da grade, por sala e zona, juntadas na vertical
  const floors: FloorRect[] = [];
  let open: FloorRect[] = [];
  for (let j = j0; j <= j1; j++) {
    const row: FloorRect[] = [];
    let s: FloorRect | null = null;
    for (let i = i0; i <= i1 + 1; i++) {
      const room = i <= i1 ? floorRoom(i, j) : null, zone = room === "servico" ? zoneOf(cx(i), cz(j)) : room ?? "";
      if (s && (room !== s.room || zone !== s.zone)) { row.push(s); s = null; }
      if (room && !s) s = { x0: X0 + i * CELL, x1: X0 + (i + 1) * CELL, z0: Z0 + j * CELL, z1: Z0 + (j + 1) * CELL, room, zone };
      else if (room && s) s.x1 = X0 + (i + 1) * CELL;
    }
    const next: FloorRect[] = [];
    for (const r of row) {
      const k = open.findIndex((o) => Math.abs(o.x0 - r.x0) < 1e-6 && Math.abs(o.x1 - r.x1) < 1e-6 && o.room === r.room && o.zone === r.zone && Math.abs(o.z1 - r.z0) < 1e-6);
      if (k >= 0) { const o = open.splice(k, 1)[0]; o.z1 = r.z1; next.push(o); } else next.push(r);
    }
    floors.push(...open); open = next;
  }
  floors.push(...open);
  mazeCache = { faces, corners, floors };
  return mazeCache;
}
