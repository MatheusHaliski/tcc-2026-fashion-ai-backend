import { describe, expect, it } from "vitest";
import { buildNav, findPath, lineWalkable, nearestWalkable, pathLength } from "./nav";
import { DOORS, INTERACTS, ROOMS, STAFF, buildWorld, collide, roomAt, sightClear, type PassRules } from "./world";
import { AREA_OF, CLIMB_TO, PLAYER_SPAWN } from "./level";
import type { DoorId } from "./types";

const ALL_OPEN = Object.fromEntries(DOORS.map((d) => [d.id, true])) as Record<DoorId, boolean>;
const center = (id: string) => { const r = ROOMS.find((x) => x.id === id)!.rect; return { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 }; };

describe("museu do Afterparty Heist (planta, colisão, linha de visão e navegação)", () => {
  const w = buildWorld();
  const staff = buildNav(w, "staff");

  it("tem as oito áreas do jogo e liga todas as salas pela navegação da equipe", () => {
    expect(new Set(Object.values(AREA_OF)).size).toBe(8);
    for (const r of ROOMS) {
      if (r.id === "beiral") continue;                               // o beiral só se alcança escalando (CLIMB_TO)
      const p = findPath(staff, PLAYER_SPAWN, center(r.id), 20000);
      expect(p, r.id).not.toBeNull();
      expect(pathLength(PLAYER_SPAWN, p!)).toBeLessThan(140);
    }
  });

  it("alcança cada ponto de interação, posto e rota da equipe", () => {
    for (const it of w.interacts) if (it.room !== "beiral") expect(nearestWalkable(staff, it.pos, 3), it.id).not.toBeNull();
    for (const s of STAFF) for (const p of s.post ? [s.post.pos] : s.route!) expect(findPath(staff, PLAYER_SPAWN, p, 20000), s.id).not.toBeNull();
    for (const [id, to] of Object.entries(CLIMB_TO)) {                 // cada escalada leva para o outro lado da janela
      const from = INTERACTS.find((i) => i.id === id);
      expect(from, id).toBeDefined();
      expect(roomAt(to)).not.toBe(from!.room);
    }
  });

  it("começa a jogadora livre no tapete vermelho e a segura no pórtico sem pulseira", () => {
    const rules: PassRules = { doors: { ...ALL_OPEN, main: false }, crouch: false };
    const p = { ...PLAYER_SPAWN };
    expect(collide(w, p, 0.34, "player", rules)).toBe(false);
    const q = { x: 0, z: 15.5 };
    for (let k = 0; k < 40; k++) { q.z -= 0.1; collide(w, q, 0.34, "player", rules); }
    expect(q.z).toBeGreaterThan(14.8);
    expect(roomAt({ x: 0, z: 4 })).toBe("salao");
    expect(roomAt({ x: -18, z: -14 })).toBe("conservacao");
  });

  it("não deixa atravessar móveis: a vitrine do Aurora empurra quem anda contra ela", () => {
    const rules: PassRules = { doors: ALL_OPEN, crouch: false };
    const p = { x: 0, z: -15.4 };
    for (let k = 0; k < 30; k++) { p.z -= 0.1; collide(w, p, 0.34, "player", rules); }
    expect(p.z).toBeGreaterThan(-16 + 0.3);
  });

  it("deixa passar pelo duto só agachada", () => {
    const p = { x: -17.5, z: -6.25 };
    const stand = { ...p }; collide(w, stand, 0.34, "player", { doors: ALL_OPEN, crouch: false });
    const crouch = { ...p }; collide(w, crouch, 0.34, "player", { doors: ALL_OPEN, crouch: true });
    expect(Math.hypot(stand.x - p.x, stand.z - p.z)).toBeGreaterThan(0.2);
    expect(Math.hypot(crouch.x - p.x, crouch.z - p.z)).toBeLessThan(0.05);
  });

  it("vê através de vãos e vidro, não através de paredes, colunas e móveis baixos com o alvo agachado", () => {
    expect(sightClear(w, { x: 1.6, z: 12 }, { x: 1.6, z: -12 }, { doors: ALL_OPEN })).toBe(true);       // salão → galeria pelo vão
    expect(sightClear(w, { x: 0, z: 12 }, { x: 0, z: -12 }, { doors: ALL_OPEN })).toBe(false);          // arranjo floral no meio
    expect(sightClear(w, { x: -6, z: 0 }, { x: -6, z: -12 }, { doors: ALL_OPEN })).toBe(false);         // parede entre salão e galeria
    expect(sightClear(w, { x: -9, z: 2 }, { x: -9, z: -4 }, { doors: ALL_OPEN })).toBe(false);          // coluna
    expect(sightClear(w, { x: -6.5, z: -12 }, { x: -6.5, z: -16.5 }, { doors: ALL_OPEN })).toBe(true);  // vitrine de vidro
    expect(sightClear(w, { x: -8.6, z: 2.5 }, { x: -4.4, z: 2.5 }, { doors: ALL_OPEN, crouchTarget: true })).toBe(false);
    expect(sightClear(w, { x: -8.6, z: 2.5 }, { x: -4.4, z: 2.5 }, { doors: ALL_OPEN })).toBe(true);    // de pé, a mesa não esconde
  });

  it("alisa o caminho em retas longas e contorna o palco do quarteto", () => {
    const straight = findPath(staff, { x: 9, z: -9 }, { x: 9, z: -20 })!;      // lado leste da galeria, sem móveis
    expect(straight).toHaveLength(1);
    expect(lineWalkable(staff, { x: 9, z: -9 }, straight[0])).toBe(true);
    const around = findPath(staff, { x: -10, z: 12 }, { x: -10, z: -4 })!;     // o palco do quarteto fica no meio
    expect(around.length).toBeGreaterThan(1);
    expect(lineWalkable(staff, { x: -10, z: 12 }, { x: -10, z: -4 })).toBe(false);
  });
});
