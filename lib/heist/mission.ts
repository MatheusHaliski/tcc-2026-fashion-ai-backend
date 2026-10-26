/*
 * MET Gala Heist v2 — a missão em objetivos e subobjetivos (o HUD mostra no canto superior esquerdo). Cada subobjetivo
 * concluído dispara uma cena de corte curta (enquadramentos de câmera + falas, faixas de cinema) e atualiza o estado da
 * missão; a do diamante é a cena longa da simulação (comemoração e seguranças entrando).
 *
 *  INFILTRAR   1 chegar à escadaria · 2 conseguir um jeito de entrar · 3 entrar no museu
 *  SALA        4 abrir um acesso à Sala das Joias · 5 chegar à Sala das Joias
 *  DIAMANTE    6 cortar a energia ou atravessar os lasers · 7 abrir a vitrine e pegar o diamante
 *  FUGA        8 sair do prédio · 9 chegar a um carro de fuga
 */
import type { Beat, SimState, Vec } from "./types";
import { DIAMOND_POS, EXITS, INTERACTS, VAULT_ENTRY } from "./level";
import { VIP_PRESTIGE, wornPrestige } from "./state";
import { dist } from "./math";

export type MissionGoal = "INFILTRATE" | "VAULT" | "DIAMOND" | "ESCAPE";
export type MissionStep = "arrive" | "credential" | "getIn" | "findRoute" | "reachVault" | "lasers" | "diamond" | "leave" | "car";
export const STEPS: { id: MissionStep; goal: MissionGoal }[] = [
  { id: "arrive", goal: "INFILTRATE" }, { id: "credential", goal: "INFILTRATE" }, { id: "getIn", goal: "INFILTRATE" },
  { id: "findRoute", goal: "VAULT" }, { id: "reachVault", goal: "VAULT" },
  { id: "lasers", goal: "DIAMOND" }, { id: "diamond", goal: "DIAMOND" },
  { id: "leave", goal: "ESCAPE" }, { id: "car", goal: "ESCAPE" },
];
const OUTSIDE = new Set(["rua", "beco"]);
const inside = (s: SimState) => !OUTSIDE.has(s.player.lastRoom);

/** O subobjetivo está cumprido? (e por qual caminho, para a fala da cena) */
export function stepDone(s: SimState, id: MissionStep): string | null {
  const p = s.player, inv = p.inv;
  switch (id) {
    case "arrive": return p.pos.z < 33.2 || inside(s) || p.lastRoom === "beco" ? "ok" : null;
    case "credential":
      if (inside(s)) return "inside";
      if (s.unlocked.includes("carpetGate")) return inv.invite ? "invite" : "vip";
      if (inv.invite) return "invite";
      if (inv.uniform || s.unlocked.includes("dockGate")) return "uniform";
      if (p.disguise === "gala" && wornPrestige(s) >= VIP_PRESTIGE) return "vip";
      return null;
    case "getIn": return inside(s) ? p.lastRoom : null;
    case "findRoute":
      if (p.lastRoom === "cofre") return "inside";
      if (inv.keys.includes("servico")) return "key";
      if (inv.keycard) return "keycard";
      if (s.unlocked.includes("service")) return "keypad";
      if (p.lastRoom === "servico" || p.lastRoom === "seguranca") return "maze";
      if (p.lastRoom === "beiral") return "ledge";
      return null;
    case "reachVault": return p.lastRoom === "cofre" ? "ok" : null;
    case "lasers": return s.fusesCut ? "fuses" : dist(p.pos, DIAMOND_POS) < 2.7 || inv.diamond ? "crossed" : null;
    case "diamond": return inv.diamond ? "ok" : null;
    case "leave": return inv.diamond && OUTSIDE.has(p.lastRoom) ? p.lastRoom : null;
    case "car": return s.phase === "WON" ? "ok" : null;
  }
}

/** Onde o marcador do objetivo aponta (bússola e marcador no mundo): o principal e as alternativas. */
export interface MissionTarget { pos: Vec; main: boolean; key: string }
export function targetsFor(s: SimState, id: MissionStep): MissionTarget[] {
  const at = (iid: string) => INTERACTS.find((i) => i.id === iid)!.pos;
  const inv = s.player.inv;
  switch (id) {
    case "arrive": return [{ pos: at("hostess"), main: true, key: "heist.poi.gate" }];
    case "credential": return [
      { pos: at("hostess"), main: inv.invite, key: "heist.poi.hostess" },
      { pos: { x: 8, z: 31.95 }, main: false, key: "heist.poi.queue" },
      { pos: at("vendorStreet"), main: !inv.invite && !inv.uniform, key: "heist.poi.vendor" },
      { pos: at("uniformTruck"), main: false, key: "heist.poi.truck" },
      { pos: at(inv.uniform ? "dockIntercom" : "fireUp"), main: inv.uniform, key: inv.uniform ? "heist.poi.dock" : "heist.poi.fireEscape" },
    ];
    case "getIn": return s.unlocked.includes("carpetGate") ? [{ pos: { x: 0, z: 23.4 }, main: true, key: "heist.poi.front" }] : s.unlocked.includes("dockGate") ? [{ pos: { x: -19, z: 23.4 }, main: true, key: "heist.poi.dock" }] : [{ pos: at("fireUp"), main: true, key: "heist.poi.fireEscape" }];
    case "findRoute": return [
      { pos: { x: -11.4, z: 10 }, main: !inv.keycard, key: "heist.poi.staffDoor" },
      { pos: at("keypadService"), main: false, key: "heist.poi.keypad" },
      { pos: VAULT_ENTRY, main: inv.keycard, key: "heist.poi.vaultDoor" },
    ];
    case "reachVault": return [{ pos: inv.keycard ? VAULT_ENTRY : { x: -17.5, z: -5.6 }, main: true, key: inv.keycard ? "heist.poi.vaultDoor" : "heist.poi.vent" }];
    case "lasers": return [{ pos: at("fuses"), main: true, key: "heist.poi.fuses" }, { pos: DIAMOND_POS, main: false, key: "heist.poi.diamond" }];
    case "diamond": return [{ pos: DIAMOND_POS, main: true, key: "heist.poi.diamond" }];
    case "leave": return [{ pos: { x: -19, z: 23.4 }, main: true, key: "heist.poi.dock" }, { pos: at("fireDown"), main: false, key: "heist.poi.fireEscape" }];
    case "car": return EXITS.map((e, k) => ({ pos: e.pos, main: k === (s.player.lastRoom === "beco" ? 1 : 0), key: "heist.poi.car" }));
  }
}

/* ---------- cenas de corte dos subobjetivos ---------- */
export type { Beat, Shot } from "./types";
/** Cena de cada subobjetivo cumprido (`via` diz como). Posições em metros no mundo; `player` = perto da jogadora. */
export function beatFor(s: SimState, id: MissionStep | "intro", via: string): Beat | null {
  const p = s.player, P = (dx: number, dy: number, dz: number): [number, number, number] => [p.pos.x + dx, p.y + dy, p.pos.z + dz];
  const L = (at: number, key: string, who = "player") => ({ at, who, key });
  switch (id) {
    case "intro": return {
      shots: [
        { from: [6, 9, 49], to: [2, 6.5, 41], look: [0, 4, 24], dur: 4.2, fov: 50 },
        { from: P(1.6, 1.7, -2.2), to: P(0.9, 1.65, 1.8), look: [0, 1, 26], lookTo: P(0, 1.5, -6), dur: 3.6, fov: 44 },
      ],
      lines: [L(0.4, "heist.beat.intro1"), L(3.8, "heist.beat.intro2")],
    };
    // por cima do ombro dela, da calçada para a escadaria e as portas (o tapete e a fachada no quadro)
    case "arrive": return { shots: [{ from: P(1.6, 1.5, 3.4), to: P(0.9, 1.25, 2.3), look: [0, 1.4, 27], lookTo: [0, 2.6, 25.2], dur: 3.6, fov: 46 }], lines: [L(0.3, "heist.beat.arrive")] };
    case "credential": return { shots: [{ from: P(1.1, 1.75, 1.1), to: P(0.8, 1.6, 0.9), look: P(0, 1.2, 0), dur: 2.8, fov: 38 }], lines: [L(0.2, `heist.beat.credential.${via}`)] };
    case "getIn":
      if (via === "salao" || via === "vestibulo") return { shots: [{ from: [-9.5, 6.8, 12.5], to: [-6, 6, 12.8], look: [0, 2.6, 4], lookTo: [2, 2.2, 0], dur: 4.4, fov: 52 }], lines: [L(0.4, "heist.beat.hall")] };
      return { shots: [{ from: P(-1.8, 2.4, 1.8), to: P(-1.2, 2, 1.2), look: P(0, 1.2, -4), dur: 3, fov: 50 }], lines: [L(0.3, `heist.beat.getIn.${via === "doca" ? "doca" : "terraco"}`)] };
    case "findRoute": {
      const door: Record<string, [number, number, number]> = { key: [-12.2, 1.4, 10], keycard: [-12.2, 1.4, -15], keypad: [-19, 1.4, 16.3], maze: [-17.5, 0.6, -6.2], ledge: [-19.5, 1.2, -22.3], inside: [-17.25, 1.1, -14.25] };
      const at = door[via] ?? door.key;
      return { shots: [{ from: [at[0] + 3.2, 2.2, at[2] + 2.4], to: [at[0] + 2.4, 1.9, at[2] + 1.6], look: at, dur: 3.2, fov: 46 }], lines: [L(0.3, `heist.beat.route.${via}`)] };
    }
    case "reachVault": return {
      shots: [{ from: [-13.6, 2.3, -10.4], to: [-15.3, 1.7, -12.4], look: [DIAMOND_POS.x, 1.15, DIAMOND_POS.z], dur: 4.6, fov: 40 }],
      lines: [L(0.4, "heist.beat.vault1"), L(2.6, "heist.beat.vault2")],
    };
    case "lasers": return via === "fuses"
      ? { shots: [{ from: [-13.8, 2.4, -10.8], to: [-14.6, 2.1, -11.6], look: [DIAMOND_POS.x, 1, DIAMOND_POS.z], dur: 3.2, fov: 44 }], lines: [L(0.4, "heist.beat.fuses")] }
      : { shots: [{ from: P(1.2, 1.5, 1.2), to: P(0.9, 1.4, 0.9), look: [DIAMOND_POS.x, 1.1, DIAMOND_POS.z], dur: 2.4, fov: 40 }], lines: [L(0.2, "heist.beat.crossed")] };
    case "diamond": return null;                                   // a cena longa é da simulação
    case "leave": return { shots: [{ from: P(-2.2, 2.4, -2.2), to: P(-1.6, 2.1, -1.4), look: P(0, 0.8, 6), dur: 3, fov: 52 }], lines: [L(0.3, `heist.beat.leave.${via === "beco" ? "beco" : "rua"}`)] };
    case "car": return { shots: [{ from: P(3.5, 1.6, 2.5), to: P(4.5, 2.6, 4.2), look: P(0, 1, 0), dur: 4, fov: 46 }], lines: [L(0.4, "heist.beat.car")] };
  }
}
export const beatLength = (b: Beat) => b.shots.reduce((t, x) => t + x.dur, 0);
