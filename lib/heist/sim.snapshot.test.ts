/*
 * Retrato da simulação (sim.ts): cenários com entradas determinísticas (o sorteio é o mulberry32 do SimState; não há
 * Math.random) rodam `step` por N quadros e o estado final + a sequência de eventos são comparados por SHA-256 com o
 * valor capturado antes da divisão do arquivo em sim-*.ts. Qualquer mudança de comportamento muda o digest.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { HeistInput, SimState } from "./types";
import { newSim, simCtx, snapshot } from "./state";
import {
  buy, choose, closePuzzle, endTalk, equip, interact, laserOn, meleeTarget, promptAt, puzzleFuse, puzzleKey, puzzlePick, puzzleRing, quickHeal,
  skipBeat, skipCutscene, startBeat, startCutscene, startPuzzle, step, talk, trade, useCard, wear, CHANGE_TIME, CUTSCENE_LEN,
} from "./sim";
import * as sim from "./sim";
import { matchCards, type DeckCard } from "./cards";
import { CODES, INTERACTS, RACKS } from "./level";
import { yawOf } from "./math";

const ctx = simCtx();
const idle = (o: Partial<HeistInput> = {}): HeistInput => ({ move: { x: 0, y: 0 }, camYaw: 0, camPitch: 0, sprint: false, crouchPress: false, discreet: false, interactPress: false, aim: false, fire: false, firePress: false, reloadPress: false, meleePress: false, healPress: false, throwPress: false, ...o });
const card = (o: Partial<DeckCard>): DeckCard => ({ id: o.id ?? "c", name: o.name ?? "Peça", category: "accessory_piece", subcategory: "clutch", rarity: "STANDARD", stats: { CLOUT: 40 }, ...o });
const DECK = () => matchCards([
  card({ id: "gown", category: "full_body_piece", subcategory: "dress", occasions: ["formal"], rarity: "RARE", stats: { CLOUT: 95 }, brandName: "Maison" }),
  card({ id: "shoes", category: "shoes_piece", subcategory: "running_shoes" }), card({ id: "glasses", subcategory: "sunglasses" }), card({ id: "ring", subcategory: "ring" }),
  card({ id: "bag", subcategory: "handbag", rarity: "PREMIUM" }), card({ id: "belt", subcategory: "belt" }), card({ id: "watch", subcategory: "watch" }),
  card({ id: "scarf", subcategory: "scarf" }), card({ id: "hat", subcategory: "hat" }), card({ id: "x" }), card({ id: "y" }),
]);
const toward = (s: SimState, p: { x: number; z: number }) => yawOf({ x: p.x - s.player.pos.x, z: p.z - s.player.pos.z });

/** Acumula os eventos de cada quadro e o estado final num digest. */
class Trace {
  h = createHash("sha256"); n = 0;
  frame(s: SimState) { if (s.events.length) { this.h.update(JSON.stringify(s.events)); this.n += s.events.length; } s.events.length = 0; }
  note(v: unknown) { this.h.update(JSON.stringify(v) ?? "undefined"); }
  end(s: SimState) { this.h.update(JSON.stringify(snapshot(s))); return `${this.n}:${this.h.digest("hex")}`; }
}
function run(s: SimState, t: Trace, frames: number, inp: (k: number) => HeistInput = () => idle()) { for (let k = 0; k < frames; k++) { step(s, ctx, inp(k), 1 / 60); t.frame(s); } }
function place(s: SimState, x: number, z: number, room: SimState["player"]["lastRoom"], y = 0) { s.player.pos = { x, z }; s.player.lastRoom = room; s.player.y = y; }

const SCENARIOS: Record<string, () => string> = {
  /** Da barraca até o tapete: anda, corre, agacha, discreta, esquiva, garrafa, cura e E a cada segundo; cenas curtas ligadas. */
  passeio() {
    const s = newSim(DECK()), t = new Trace();
    t.note(startBeat(s, "intro", "ok")); run(s, t, 30); skipBeat(s);
    run(s, t, 900, (k) => idle({
      move: { x: k % 240 < 180 ? 0 : 0.6, y: 1 }, camYaw: Math.PI - 0.15, sprint: k > 120 && k % 300 < 200, crouchPress: k === 400 || k === 520,
      discreet: k > 600, interactPress: k % 60 === 0, dodgePress: k === 90 || k === 95 || k === 300, throwPress: k === 100 || k === 700, healPress: k === 200 || k === 420,
    }));
    for (let k = 0; k < 20; k++) { run(s, t, 15); t.note(promptAt(s)); }
    return t.end(s);
  },
  /** Prompt em cada ponto de interação, arara e porta (o que E faria ali), sem seguranças. */
  prompts() {
    const s = newSim(DECK()), t = new Trace();
    for (const g of s.guards) g.active = false;
    for (const it of INTERACTS) { place(s, it.pos.x, it.pos.z, it.room, it.room === "rua" || it.room === "beco" ? -1.6 : 0); t.note([it.id, promptAt(s)]); }
    for (const r of RACKS) { place(s, r.pos.x + Math.sin(r.yaw) * 0.7, r.pos.z + Math.cos(r.yaw) * 0.7, r.room); t.note([r.id, promptAt(s)]); }
    for (const c of s.civs) { place(s, c.pos.x - Math.sin(c.yaw) * 0.8, c.pos.z - Math.cos(c.yaw) * 0.8, c.room); t.note([c.id, promptAt(s)]); }
    s.player.inv.diamond = true; for (const it of INTERACTS) { place(s, it.pos.x, it.pos.z, it.room); t.note([it.id, promptAt(s)]); }
    return t.end(s);
  },
  /** Tiro, recarga, faca, soco, nocaute por trás, esquiva e cura no vestíbulo e na rua. */
  combate() {
    const s = newSim(DECK(), 7, { beats: false }), t = new Trace();
    s.player.inv.weapons.push("pistol"); s.player.inv.ammo = 30; t.note(equip(s, "pistol")); t.note(equip(s, "knife"));
    const g = s.guards.find((x) => x.id === "v1")!;
    place(s, g.pos.x, g.pos.z + 4, "vestibulo"); g.state = "POST"; g.blocker = true;
    run(s, t, 420, (k) => idle({ aim: true, camYaw: toward(s, g.pos), camPitch: -0.08, firePress: k % 20 === 0, fire: k > 300, reloadPress: k === 150 || k === 160, dodgePress: k === 200, healPress: k === 250, meleePress: k === 360 }));
    t.note(meleeTarget(s)); t.note(quickHeal(s));
    s.player.inv.medkit = 1; t.note(quickHeal(s)); run(s, t, 90);
    const r3 = s.guards.find((x) => x.id === "r3")!;
    place(s, r3.pos.x - Math.sin(r3.yaw) * 0.8, r3.pos.z - Math.cos(r3.yaw) * 0.8, "rua", -1.6); s.player.yaw = toward(s, r3.pos);
    t.note(meleeTarget(s)); t.note(promptAt(s)); t.note(interact(s, ctx)); run(s, t, 100);
    useCard(s, "belt"); t.note(equip(s, "knife"));
    const r2 = s.guards.find((x) => x.id === "r2")!;
    place(s, r2.pos.x - Math.sin(r2.yaw) * 0.8, r2.pos.z - Math.cos(r2.yaw) * 0.8, "rua", -1.6); s.player.yaw = toward(s, r2.pos);
    run(s, t, 120, (k) => idle({ meleePress: k === 0 || k === 60, camYaw: s.player.yaw }));
    for (const d of s.drops) { s.player.pos = { ...d.pos }; t.note(promptAt(s)); t.note(interact(s, ctx)); run(s, t, 50); }
    t.note(equip(s, "guardPistol")); t.note(equip(s, "pistolS")); run(s, t, 120, (k) => idle({ firePress: k % 15 === 0, reloadPress: k === 70, camYaw: 1 }));
    return t.end(s);
  },
  /** Teclado (3 erros e o código), cofre pelo decodificador, quadro de luz, anéis até a vitrine abrir, a cena e a fuga. */
  puzzles() {
    const s = newSim(DECK(), 11, { beats: false }), t = new Trace();
    t.note(startPuzzle(s, "keypad", "service")); for (const k of "1234C12349999") puzzleKey(s, k); for (const k of "8888" + CODES.service) puzzleKey(s, k); t.frame(s);
    s.player.inv.decoder = 1; t.note(startPuzzle(s, "safe", "safe")); t.note(puzzlePick(s, "decoder")); t.note(puzzlePick(s, "decoder")); closePuzzle(s); t.frame(s);
    t.note(startPuzzle(s, "fuses", "fuses")); t.note(puzzlePick(s, "ring")); for (const i of [0, 4, 8, 2, 6]) puzzleFuse(s, i); t.note(s.puzzle?.lights);
    for (const i of [6, 2, 8, 4, 0]) puzzleFuse(s, i); closePuzzle(s); t.frame(s);
    t.note(startPuzzle(s, "fuses", "fuses")); t.note(puzzlePick(s, "ring")); t.note(s.puzzle?.lights);
    for (let i = 0; i < 9 && !s.puzzle?.solved; i++) if (!s.puzzle!.lights[i] || i % 2 === 0) puzzleFuse(s, i); t.note(s.puzzle); closePuzzle(s); t.frame(s);
    place(s, -16.2, -14.25, "cofre"); t.note(startPuzzle(s, "rings", "pedestal"));
    puzzleRing(s, 0, 1); puzzleRing(s, 0, 1); puzzleRing(s, 1, -1); puzzleRing(s, 1, 1); puzzleRing(s, 2, -1); t.note(s.puzzle);
    t.note(s.phase); run(s, t, Math.round((CUTSCENE_LEN + 0.5) * 60)); t.note(s.phase);
    run(s, t, 300, (k) => idle({ move: { x: 0, y: 1 }, camYaw: Math.PI / 2, sprint: k > 60, firePress: k % 30 === 0 }));
    const u = newSim(DECK(), 11, { beats: false }), tu = new Trace();
    place(u, -16.2, -14.25, "cofre"); startCutscene(u); run(u, tu, 30); skipCutscene(u); run(u, tu, 60);
    u.player.pos = { x: 25.5, z: 8.5 }; u.player.lastRoom = "beco"; run(u, tu, 5); tu.note(u.phase);
    t.note(tu.end(u));
    return t.end(s);
  },
  /** Uniforme no caminhão, interfone, esconderijos, vitrine e chapelaria, escalada, arara, conversa e furto, lasers. */
  interacoes() {
    const s = newSim(DECK(), 3, { beats: false }), t = new Trace();
    for (const g of s.guards) g.active = false;
    place(s, -22.8, 34.9, "rua", -1.6); t.note(promptAt(s)); t.note(interact(s, ctx)); run(s, t, 60);
    t.note(wear(s, "uniform")); run(s, t, Math.round(CHANGE_TIME * 60) + 5); t.note(s.player.disguise);
    place(s, -16.4, 25.1, "rua", -1.6); t.note(interact(s, ctx)); run(s, t, 10);
    for (const id of ["stashBeco", "stashMakeup", "stashMaze", "stashTerrace", "stashDock"]) { const it = INTERACTS.find((i) => i.id === id)!; place(s, it.pos.x, it.pos.z, it.room); t.note(interact(s, ctx)); run(s, t, 60); }
    for (const id of ["caseJ1", "caseJ2", "coatRack"]) { const it = INTERACTS.find((i) => i.id === id)!; place(s, it.pos.x, it.pos.z, it.room); t.note(interact(s, ctx)); run(s, t, 120); }
    s.fusesCut = true; for (const id of ["caseJ3", "caseJ4"]) { const it = INTERACTS.find((i) => i.id === id)!; place(s, it.pos.x, it.pos.z, it.room); t.note(interact(s, ctx)); run(s, t, 120); }
    place(s, -11.4, 7, "salao"); t.note(interact(s, ctx)); t.note(s.clues);
    for (const id of ["fireDown", "fireUp", "climbT", "climbTout", "climbC", "climbCin"]) { const it = INTERACTS.find((i) => i.id === id)!; place(s, it.pos.x, it.pos.z, it.room); t.note([id, interact(s, ctx)]); run(s, t, 220); t.note(s.player.pos); }
    t.note(wear(s, "shoes")); run(s, t, Math.round(CHANGE_TIME * 60) + 5); place(s, 23.6, -14, "beco", -1.6); t.note(interact(s, ctx)); run(s, t, 220); t.note(s.player.pos);
    const r = RACKS[0]; place(s, r.pos.x + Math.sin(r.yaw) * 0.7, r.pos.z + Math.cos(r.yaw) * 0.7, r.room); t.note(interact(s, ctx)); run(s, t, 30); t.note(promptAt(s)); run(s, t, 5, () => idle({ interactPress: true })); t.note(s.player.hidden);
    place(s, 0, 32.3, "rua", -1.6); t.note(interact(s, ctx)); t.note(s.dialogue); t.note(choose(s, 0)); t.note(choose(s, 1)); endTalk(s); t.note(talk(s, "c99", "curator")); t.note(choose(s, 0)); endTalk(s);
    const q = s.civs.find((c) => c.role === "queue")!; q.persona = "dreamy"; s.player.pos = { x: q.pos.x + 0.9, z: q.pos.z }; t.note(promptAt(s)); t.note(interact(s, ctx)); run(s, t, 80);
    place(s, 0, 32.3, "rua", -1.6); t.note(interact(s, ctx)); t.note(choose(s, 0)); run(s, t, 10);
    s.fusesCut = false; place(s, -17.25, -11.5, "cofre"); for (const L of ["L1", "L2", "L3", "L4", "L5"]) t.note(laserOn(s, L));
    run(s, t, 240, (k) => idle({ move: { x: 0, y: 1 }, camYaw: k < 120 ? Math.PI : 0, crouchPress: k === 60 }));
    useCard(s, "watch"); for (const L of ["L1", "L2", "L4"]) t.note(laserOn(s, L)); run(s, t, 60);
    return t.end(s);
  },
  /** As ações das telas: vestir, usar cartas, equipar, trocar e comprar. */
  telas() {
    const s = newSim(DECK(), 5, { beats: false }), t = new Trace();
    for (const g of s.guards) g.active = false;
    t.note(wear(s, "gown")); t.note(wear(s, "shoes")); run(s, t, 60, (k) => idle({ move: { x: 0, y: k > 20 ? 1 : 0 }, camYaw: 0 })); run(s, t, Math.round(CHANGE_TIME * 60) + 5);
    t.note([s.player.outfit, s.cardState, s.player.disguise, s.player.shoes]);
    t.note(wear(s, "shoes")); run(s, t, Math.round(CHANGE_TIME * 60) + 5); t.note(wear(s, "arrival")); run(s, t, Math.round(CHANGE_TIME * 60) + 5);
    for (const id of ["glasses", "watch", "bag", "belt", "hat", "hat", "scarf", "x", "ring"]) t.note([id, useCard(s, id)]);
    s.player.hp = 40; t.note(useCard(s, "scarf")); run(s, t, 70); t.note(s.player.hp);
    t.note(trade(s, "street", ["x", "y", "gown"])); t.note([sim.bestGiven(s, "street"), sim.tradable(s).map((c) => c.id)]);
    for (const item of ["pistol", "medkit", "ammo", "knife", "uniform", "invite", "bottle", "decoder"] as const) t.note([item, buy(s, "street", item)]);
    t.note(trade(s, "bar", ["glasses", "hat"])); for (const item of ["vest", "medkitXL", "pistolS", "decoder"] as const) t.note([item, buy(s, "bar", item)]);
    t.note([equip(s, "pistol"), equip(s, "hands"), equip(s, "pistolS"), equip(s, "knife"), equip(s, "guardPistol")]);
    run(s, t, 120, (k) => idle({ firePress: k % 10 === 0, camYaw: 2, reloadPress: k === 50, meleePress: k === 90 }));
    return t.end(s);
  },
};

/** Capturado no código original (lib/heist/sim.ts com 824 linhas), antes da extração. */
const EXPECTED: Record<string, string> = {
  passeio: "17:dd47b54f1065b60b3cecf39b103457ba519152b2702447d5b0fa9e274e2ca53c",
  prompts: "0:f0679df7e63941ea1b51f082f0884fd17769804f6b129dd24c9b2bec5e091af1",
  combate: "91:897c0cd879e460fae19d19d831b1750b4d718cd00ff77a77c397641a3fa7e5f3",
  puzzles: "63:1b507fb5db34fb481547c3b899e83292773d4e471b05671e4c734622b437aeab",
  interacoes: "60:a70fd8ee1c21e12a5c9f91030dfb7d62e19be65a6868a620ecdd61ed58bf574b",
  telas: "18:fd26cc01f78253c34eb304b5bbf6e6ad88cebca9d3ddd1426eb2cb8776a49335",
};

describe("retrato da simulação (sim.ts)", () => {
  it("as exportações de sim.ts não mudam", () => {
    expect(Object.keys(sim).sort()).toEqual([
      "CHANGE_SWAP", "CHANGE_TIME", "CUTSCENE_LEN", "MAX_HP", "bestGiven", "buy", "choose", "closePuzzle", "endTalk", "equip", "interact", "laserOn", "meleeTarget", "promptAt",
      "puzzleFuse", "puzzleKey", "puzzlePick", "puzzleRing", "quickHeal", "skipBeat", "skipCutscene", "startBeat", "startCutscene", "startPuzzle", "step", "talk",
      "tradable", "trade", "useCard", "wear", "writeView",
    ]);
  });
  for (const [name, f] of Object.entries(SCENARIOS)) it(`cenário ${name}: estado final e eventos idênticos`, () => {
    const got = f();
    if (got !== EXPECTED[name]) console.log(`${name}: "${got}"`);
    expect(got).toBe(EXPECTED[name]);
  });
});
