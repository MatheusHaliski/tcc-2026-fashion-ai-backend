import { describe, expect, it } from "vitest";
import { buildNav, findPath, nearestWalkable, pathLength } from "./nav";
import { DOORS, GUARDS, INTERACTS, ROOMS, buildWorld, collide, roomAt, sightClear, type PassRules } from "./world";
import { CHECKPOINTS, CIVILIANS, CLIMB_TO, EXITS, MAZE, PLAYER_SPAWN, QUEUE_SLOTS, RACKS, floorY, mazeCell } from "./level";
import type { DoorId } from "./types";

const ALL_OPEN = Object.fromEntries(DOORS.map((d) => [d.id, true])) as Record<DoorId, boolean>;
const center = (id: string) => { const r = ROOMS.find((x) => x.id === id)!.rect; return { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 }; };

describe("Museu Vesper e a avenida (planta, colisão, linha de visão e navegação)", () => {
  const w = buildWorld();
  const staff = buildNav(w, "staff");

  it("liga a avenida a todas as salas pela navegação da equipe (menos o beiral, que só se alcança escalando)", () => {
    for (const r of ROOMS) {
      if (r.id === "beiral") continue;
      const p = findPath(staff, PLAYER_SPAWN, center(r.id), 40000);
      expect(p, r.id).not.toBeNull();
      expect(pathLength(PLAYER_SPAWN, p!)).toBeLessThan(200);
    }
  });

  it("alcança cada interação, posto, ronda e civil; cada escalada leva para o outro lado", () => {
    for (const it of w.interacts) if (it.room !== "beiral") expect(nearestWalkable(staff, it.pos, 3), it.id).not.toBeNull();
    for (const g of GUARDS) for (const p of g.post ? [g.post.pos] : g.route!) expect(findPath(staff, PLAYER_SPAWN, p, 40000), g.id).not.toBeNull();
    for (const [id, c] of Object.entries(CLIMB_TO)) {
      const from = INTERACTS.find((i) => i.id === id)!;
      expect(roomAt(c.to), id).not.toBe(from.room);
    }
    for (const c of CIVILIANS) expect(roomAt(c.pos), c.id).toBe(c.room);
    for (const e of EXITS) expect(roomAt(e.pos)).toBe(e.room);
  });

  it("o labirinto tem caminho da doca ao duto e da porta da equipe à sala de segurança, com mais de uma rota", () => {
    const fromDock = findPath(staff, mazeCell(1, 10), mazeCell(2, 0), 40000);
    expect(fromDock).not.toBeNull();
    expect(pathLength(mazeCell(1, 10), fromDock!)).toBeGreaterThan(22);                // não é reto: é labirinto
    expect(findPath(staff, mazeCell(4, 8), { x: -20, z: 5 }, 40000)).not.toBeNull();
    // fechar a porta da segurança isola a sala (só se entra por ela)
    expect(roomAt({ x: -20, z: 5 })).toBe("seguranca");
    expect(roomAt(mazeCell(3, 5))).toBe("servico");
    expect(w.grid.filter((c) => c === 0).length).toBeGreaterThan(0);
    expect(MAZE.cols * MAZE.rows).toBe(55);
  });

  it("segura a jogadora no portão do tapete sem convite e deixa os convidados da fila passarem", () => {
    const rules: PassRules = { doors: { ...ALL_OPEN, carpetGate: false }, crouch: false };
    const q = { x: 0, z: 32.4 };
    for (let k = 0; k < 30; k++) { q.z -= 0.1; collide(w, q, 0.34, "player", rules); }
    expect(q.z).toBeGreaterThan(31.4);
    const guests = buildNav(w, "guest");
    expect(findPath(guests, QUEUE_SLOTS[0], { x: 0, z: 13 }, 40000)).not.toBeNull();       // a fila entra até o salão
    expect(findPath(guests, QUEUE_SLOTS[0], center("cofre"), 40000)).toBeNull();          // e não entra na Sala das Joias
  });

  it("deixa passar pelo duto só agachada e a escadaria sobe da calçada até as portas", () => {
    const p = { x: -17.5, z: -6.25 };
    const stand = { ...p }; collide(w, stand, 0.34, "player", { doors: ALL_OPEN, crouch: false });
    const crouch = { ...p }; collide(w, crouch, 0.34, "player", { doors: ALL_OPEN, crouch: true });
    expect(Math.hypot(stand.x - p.x, stand.z - p.z)).toBeGreaterThan(0.2);
    expect(Math.hypot(crouch.x - p.x, crouch.z - p.z)).toBeLessThan(0.05);
    expect(floorY({ x: 0, z: 25 })).toBe(0);
    expect(floorY({ x: 0, z: 31 })).toBeCloseTo(-1.6);
    expect(floorY({ x: 0, z: 28 })).toBeLessThan(0);
    expect(floorY({ x: 0, z: 38 })).toBeCloseTo(-1.75);
    expect(floorY({ x: 0, z: 10 })).toBe(0);
  });

  it("vê através do cordão do tapete e de vidro, não através de paredes, carros e colunas", () => {
    expect(sightClear(w, { x: 0, z: 33.5 }, { x: 0, z: 28 }, { doors: { ...ALL_OPEN, carpetGate: false } })).toBe(true);
    expect(sightClear(w, { x: 0, z: 22 }, { x: 0, z: 26 }, { doors: { ...ALL_OPEN, front: false } })).toBe(false);
    expect(sightClear(w, { x: -6, z: 0 }, { x: -6, z: -12 }, { doors: ALL_OPEN })).toBe(false);
    expect(sightClear(w, { x: -6, z: 37 }, { x: -6, z: 32 }, { doors: ALL_OPEN })).toBe(false);      // limusine
    expect(sightClear(w, { x: -17.25, z: -12 }, { x: -17.25, z: -16.5 }, { doors: ALL_OPEN })).toBe(true); // pedestal de vidro
  });

  it("móveis próprios das áreas (fixture) ficam na sala deles e não tapam porta, interação, posto, ronda, pessoa, arara, checkpoint, fila nem saída", () => {
    const gap = (sh: (typeof w.props)[number]["shape"], p: { x: number; z: number }) => sh.type === "circle"
      ? Math.hypot(p.x - sh.x, p.z - sh.z) - sh.r
      : Math.hypot(Math.max(sh.x0 - p.x, 0, p.x - sh.x1), Math.max(sh.z0 - p.z, 0, p.z - sh.z1));
    const keep: { what: string; pos: { x: number; z: number }; r: number }[] = [
      ...w.interacts.map((i) => ({ what: `interação ${i.id}`, pos: i.pos, r: 0.6 })),
      ...GUARDS.flatMap((g) => (g.post ? [{ what: `posto ${g.id}`, pos: g.post.pos, r: 0.6 }] : (g.route ?? []).map((p, k) => ({ what: `ronda ${g.id}#${k}`, pos: p, r: 0.5 })))),
      ...CIVILIANS.map((c) => ({ what: `civil ${c.id} (${c.role})`, pos: c.pos, r: 0.3 })),
      ...RACKS.map((r) => ({ what: `arara ${r.id}`, pos: r.pos, r: 0.6 })),
      ...Object.entries(CHECKPOINTS).map(([k, c]) => ({ what: `checkpoint ${k}`, pos: c.pos, r: 0.6 })),
      ...QUEUE_SLOTS.map((p, k) => ({ what: `fila ${k}`, pos: p, r: 0.4 })),
      ...EXITS.map((e) => ({ what: `saída ${e.id}`, pos: e.pos, r: 0.8 })),
      { what: "início", pos: PLAYER_SPAWN, r: 0.8 },
    ];
    for (const p of w.props.filter((x) => x.kind === "fixture")) {
      expect(p.model, p.id).toBeTruthy();
      const R = ROOMS.find((r) => r.id === p.room)!.rect, sh = p.shape;
      const [x0, z0, x1, z1] = sh.type === "circle" ? [sh.x - sh.r, sh.z - sh.r, sh.x + sh.r, sh.z + sh.r] : [sh.x0, sh.z0, sh.x1, sh.z1];
      expect(x0 >= R.x0 - 1e-6 && z0 >= R.z0 - 1e-6 && x1 <= R.x1 + 1e-6 && z1 <= R.z1 + 1e-6, `${p.id} (${p.model}) fora da sala ${p.room}`).toBe(true);
      for (const d of DOORS) {
        const c = { x: (d.rect.x0 + d.rect.x1) / 2, z: (d.rect.z0 + d.rect.z1) / 2 }, half = Math.max(d.rect.x1 - d.rect.x0, d.rect.z1 - d.rect.z0) / 2;
        expect(gap(sh, c), `${p.id} (${p.model}) na frente da porta ${d.id}`).toBeGreaterThan(half + 0.6);
      }
      for (const k of keep) expect(gap(sh, k.pos), `${p.id} (${p.model}) em cima de ${k.what}`).toBeGreaterThan(k.r);
    }
  });
});
