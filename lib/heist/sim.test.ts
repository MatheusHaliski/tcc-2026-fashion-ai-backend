import { describe, expect, it } from "vitest";
import type { HeistCard, HeistInput, SimState } from "./types";
import { newSim, simCtx, outfitPieces, restore, snapshot } from "./state";
import { buy, choose, equip, interact, promptAt, puzzleKey, puzzlePick, puzzleRing, skipCutscene, startPuzzle, step, trade, useCard, wear, CUTSCENE_LEN, CHANGE_TIME } from "./sim";
import { DIALOGUES, choicesOf } from "./dialogue";
import { damagePlayer, downGuard, tiredness } from "./combat";
import { matchCards, offerLock, toHeistCard, guardHp, SHOT_DAMAGE, type DeckCard } from "./cards";
import { CODES, GUARDS } from "./level";
import { yawOf } from "./math";

const ctx = simCtx();
const idle = (o: Partial<HeistInput> = {}): HeistInput => ({ move: { x: 0, y: 0 }, camYaw: 0, camPitch: 0, sprint: false, crouchPress: false, discreet: false, interactPress: false, aim: false, fire: false, firePress: false, reloadPress: false, meleePress: false, healPress: false, throwPress: false, ...o });
const run = (s: SimState, secs: number, inp: (k: number) => HeistInput = () => idle()) => { const n = Math.round(secs * 60); s.options.beats = false; for (let k = 0; k < n; k++) { step(s, ctx, inp(k), 1 / 60); s.events.length = 0; } };
const guard = (s: SimState, id: string) => s.guards.find((g) => g.id === id)!;
const card = (o: Partial<DeckCard>): DeckCard => ({ id: o.id ?? "c", name: o.name ?? "Peça", category: "accessory_piece", subcategory: "clutch", rarity: "STANDARD", stats: { CLOUT: 40 }, ...o });
/** Põe a jogadora num ponto, sem ninguém desconfiado, para testar uma regra isolada. */
function place(s: SimState, x: number, z: number, room: SimState["player"]["lastRoom"]) { s.player.pos = { x, z }; s.player.lastRoom = room; s.player.y = 0; }

describe("cartas e revendedor", () => {
  it("cada peça vira o que ela é: óculos = Visão, joia = grampo, bolsa = munição, cinto = faca, roupa = vestir", () => {
    expect(toHeistCard(card({ subcategory: "sunglasses" })).use).toBe("VISION");
    expect(toHeistCard(card({ subcategory: "necklace" })).use).toBe("PICK");
    expect(toHeistCard(card({ subcategory: "crossbody_bag" })).use).toBe("AMMO");
    expect(toHeistCard(card({ subcategory: "belt" })).use).toBe("KNIFE");
    expect(toHeistCard(card({ subcategory: "scarf" })).use).toBe("BANDAGE");
    const gown = toHeistCard(card({ category: "full_body_piece", subcategory: "dress", occasions: ["formal"] }));
    expect(gown).toMatchObject({ use: "WEAR", slot: "FULL", dress: "gala" });
    expect(toHeistCard(card({ category: "shoes_piece", subcategory: "running_shoes" }))).toMatchObject({ use: "WEAR", shoes: "sneakers" });
    expect(toHeistCard(card({ rarity: "LIMITED", stats: { CLOUT: 90 }, brandName: "Casa X" })).value).toBeGreaterThan(70);
  });

  it("arma fica bloqueada quando as roupas não valem o bastante; com uma peça cara, a troca destrava a pistola", () => {
    const cheap = matchCards([card({ id: "a" }), card({ id: "b", subcategory: "belt" })]);
    const s = newSim(cheap);
    const pistol = s.offers.street.find((o) => o.item === "pistol")!;
    expect(offerLock(pistol, 0, 0, Math.max(...cheap.map((c) => c.value)))).toMatchObject({ kind: "piece", need: 55 });
    trade(s, "street", cheap.map((c) => c.id));
    expect(buy(s, "street", "pistol")).toBe(false);
    expect(buy(s, "street", "medkit")).toBe(true);
    expect(s.player.inv.medkit).toBe(1);
    const rich = newSim(matchCards([card({ id: "lux", category: "full_body_piece", subcategory: "dress", rarity: "RARE", stats: { CLOUT: 95 }, brandName: "Maison" }), card({ id: "x" }), card({ id: "y" }), card({ id: "z" })]));
    trade(rich, "street", ["lux", "x"]);                          // grife (75) + uma peça comum: 90 créditos
    expect(buy(rich, "street", "pistol")).toBe(true);
    expect(rich.player.inv.weapons).toContain("pistol");
    expect(rich.cardState.lux).toBe("TRADED");
  });

  it("bolsa recarrega munição e lenço recupera vida; deck curto ganha o kit inicial", () => {
    const s = newSim(matchCards([card({ id: "bag", subcategory: "handbag", rarity: "PREMIUM" })]));
    expect(s.cards.map((c) => c.id)).toContain("starter-scarf");
    expect(useCard(s, "bag")).toBe(true);
    expect(s.player.inv.ammo).toBe(18);
    s.player.hp = 40; useCard(s, "starter-scarf"); run(s, 1);
    expect(s.player.hp).toBe(65);
  });
});

describe("combate: vida implícita por sala, vida baixa e game over", () => {
  it("3 tiros derrubam um segurança da rua e 9 um da Sala das Joias", () => {
    expect(Math.ceil(guardHp(3) / SHOT_DAMAGE.pistol)).toBe(3);
    expect(Math.ceil(guardHp(9) / SHOT_DAMAGE.pistol)).toBe(9);
    for (const [id, shots, at, room] of [["r2", 3, { x: 0.6, z: 32.6 }, "rua"], ["j2", 9, { x: -17, z: -13 }, "cofre"]] as const) {
      const s = newSim([], undefined, { beats: false });
      s.player.inv.weapons.push("pistol"); s.player.inv.ammo = 40; equip(s, "pistol");
      const g = guard(s, id);
      place(s, at.x, at.z, room); s.player.y = id === "r2" ? -1.6 : 0;
      g.state = "POST"; g.blocker = true;                          // segura a posição: o teste mede só a vida
      s.civs.length = 0;                                           // ninguém na frente (quem está na linha para a bala: teste abaixo)
      let fired = 0;
      for (let k = 0; k < shots * 40 && g.state !== "DOWN"; k++) {
        const press = k % 30 === 0;
        if (press) fired++;
        const yaw = yawOf({ x: g.pos.x - s.player.pos.x, z: g.pos.z - s.player.pos.z });
        const dy = (id === "r2" ? -1.6 : 0) + 1.1 - (s.player.y + 1.45), d = Math.hypot(g.pos.x - s.player.pos.x, g.pos.z - s.player.pos.z);
        step(s, ctx, idle({ aim: true, firePress: press, camYaw: yaw, camPitch: Math.atan2(dy, d) }), 1 / 60);
        s.player.hp = 100; s.events.length = 0;
      }
      expect(g.state, id).toBe("DOWN");
      expect(fired, id).toBe(shots);
    }
  });

  it("convidado na frente para a bala e se joga no chão; o segurança não atira através de gente", () => {
    const s = newSim([], undefined, { beats: false });
    s.player.inv.weapons.push("pistol"); s.player.inv.ammo = 40; equip(s, "pistol");
    const g = guard(s, "v1");
    place(s, g.pos.x, g.pos.z + 4, "vestibulo");
    g.state = "POST"; g.blocker = true;
    const c = s.civs.find((x) => x.role === "guest")!, mid = { x: g.pos.x, z: g.pos.z + 2 };
    c.pos = { ...mid }; c.y = null;
    const yaw = yawOf({ x: g.pos.x - s.player.pos.x, z: g.pos.z - s.player.pos.z });
    step(s, ctx, idle({ aim: true, firePress: true, camYaw: yaw, camPitch: Math.atan2(1.1 - 1.45, 4) }), 1 / 60);
    expect(g.hp).toBe(g.maxHp);
    expect(c.panicUntil).toBeGreaterThan(s.time);
    expect(s.events.some((e) => e.t === "line" && e.key === "heist.civ.grazed")).toBe(true);
    // segurança em alerta, com ela à vista: enquanto alguém está na linha, ele segura o tiro e manda sair da frente
    const h = newSim([], undefined, { beats: false }), hg = guard(h, "v1");
    place(h, hg.pos.x, hg.pos.z + 4, "vestibulo");
    const hc = h.civs.find((x) => x.role === "guest")!;
    h.civs.length = 0; h.civs.push(hc);                           // só ela, o segurança e um convidado
    hg.state = "ALERT"; hg.stateT = 0; hg.blocker = true; hg.lastKnown = { ...h.player.pos };
    hg.yaw = yawOf({ x: h.player.pos.x - hg.pos.x, z: h.player.pos.z - hg.pos.z });
    let cleared = false;
    for (let k = 0; k < 120; k++) {
      hc.pos = { x: hg.pos.x, z: hg.pos.z + 2 }; hc.y = null; hc.panicUntil = 0;
      step(h, ctx, idle(), 1 / 60);
      cleared ||= h.events.some((e) => e.t === "line" && e.key === "heist.bark.clear");
      h.player.hp = 100; h.events.length = 0;
    }
    expect(hg.shots).toBe(0);
    expect(cleared).toBe(true);
    h.civs.length = 0;                                            // saiu da frente: agora ele atira
    run(h, 2, () => { h.player.hp = 100; return idle(); });
    expect(hg.shots).toBeGreaterThan(0);
  });

  it("um segundo tiro não tira do pânico quem já se encolheu (a onda de pânico só vale para quem entra agora)", () => {
    const s = newSim([], undefined, { beats: false });
    s.player.inv.weapons.push("pistol"); s.player.inv.ammo = 40; equip(s, "pistol");
    place(s, -6, 4, "salao"); for (const g of s.guards) g.active = false;
    const near = () => s.civs.filter((c) => c.role !== "paparazzo" && c.role !== "vendor" && Math.hypot(c.pos.x - s.player.pos.x, c.pos.z - s.player.pos.z) < 12);
    const panicking = (k: string) => expect(near().every((c) => c.anim === "cower" || c.anim === "flee"), k).toBe(true);
    step(s, ctx, idle({ aim: true, firePress: true }), 1 / 60);
    run(s, 2); panicking("2 s depois do primeiro tiro");
    step(s, ctx, idle({ aim: true, firePress: true }), 1 / 60); s.events.length = 0;
    for (let k = 0; k < 30; k++) { panicking(`quadro ${k} depois do segundo tiro`); step(s, ctx, idle(), 1 / 60); s.events.length = 0; }
  });

  it("com vida baixa ela anda mais devagar, não corre e apanha mais", () => {
    const fast = newSim([]), slow = newSim([]);
    slow.player.hp = 18;
    expect(tiredness(slow)).toBeGreaterThan(0.5);
    const go = idle({ move: { x: 0, y: 1 }, camYaw: Math.PI, sprint: true });
    run(fast, 1, () => go); run(slow, 1, () => go);
    expect(slow.player.speed).toBeLessThan(fast.player.speed * 0.6);
    const a = newSim([]), b = newSim([]); b.player.hp = 20; a.player.hp = 60;
    damagePlayer(a, 10, a.player.pos); damagePlayer(b, 10, b.player.pos);
    expect(60 - a.player.hp).toBe(10); expect(20 - b.player.hp).toBe(13);
  });

  it("perto de um segurança ela é reconhecida, ele atira e a vida cai; em zero, game over com ela caída", () => {
    const s = newSim([]);
    const g = guard(s, "v1");                                 // posto no detector do vestíbulo, de frente para a entrada
    place(s, g.pos.x, g.pos.z + 1.8, "vestibulo");
    run(s, 1.3);
    expect(g.state).toBe("ALERT");
    run(s, 3);
    expect(s.player.hp).toBeLessThan(100);
    s.player.hp = 5; run(s, 8);
    expect(s.phase).toBe("LOST");
    expect(s.player.mode).toBe("DOWNED");
  });

  it("caminhada discreta no meio da fila segura o reconhecimento de longe", () => {
    const s = newSim([]);
    place(s, 9.3, 32.4, "rua"); s.player.y = -1.6;
    run(s, 6, () => idle({ discreet: true }));
    expect(s.guards.every((g) => g.state !== "ALERT")).toBe(true);
  });
});

describe("portas, chaves e puzzles", () => {
  it("a porta de serviço do salão só abre com a chave que o chefe Marcos carrega", () => {
    const s = newSim([]);
    place(s, -10.8, 10, "salao");
    for (const g of s.guards) g.active = false;
    run(s, 1.5, () => idle({ move: { x: 0, y: 1 }, camYaw: -Math.PI / 2 }));
    expect(s.player.pos.x).toBeGreaterThan(-12.3);
    expect(promptAt(s)?.key).toBe("heist.door.key");
    const marcos = guard(s, "s1"); marcos.active = true; marcos.pos = { x: -10.5, z: 9 };
    downGuard(s, marcos, false);
    const key = s.drops.find((d) => d.kind === "key")!;
    s.player.pos = { ...key.pos }; interact(s, ctx); run(s, 1);
    expect(s.player.inv.keys).toContain("servico");
    place(s, -10.8, 10, "salao");
    for (const g of s.guards) g.active = false;
    run(s, 2, () => idle({ move: { x: 0, y: 1 }, camYaw: -Math.PI / 2 }));
    expect(s.player.pos.x).toBeLessThan(-12.6);
    expect(s.player.lastRoom).toBe("servico");
  });

  it("o teclado da doca aceita o ano do Aurora; a joia abre sem o código", () => {
    const s = newSim(matchCards([card({ id: "ring", subcategory: "ring" })]));
    startPuzzle(s, "keypad", "service");
    for (const k of "1234") puzzleKey(s, k);
    expect(s.unlocked).not.toContain("service");
    for (const k of CODES.service) puzzleKey(s, k);
    expect(s.unlocked).toContain("service");
    const t = newSim(matchCards([card({ id: "ring", subcategory: "ring" })]));
    startPuzzle(t, "safe", "safe");
    expect(puzzlePick(t, "ring")).toBe(true);
    expect(t.player.inv.keycard).toBe(true);
  });

  it("recepcionista: sem convite barra; com o convite furtado da fila, abre o tapete e dá a pulseira", () => {
    const s = newSim([]);
    for (const g of s.guards) g.active = false;
    place(s, 0, 32.3, "rua"); s.player.y = -1.6;
    expect(interact(s, ctx)).toEqual({ ui: "dialogue" });
    const start = DIALOGUES.hostess.start;
    const show = choicesOf(s, start).find((x) => x.c.key === "heist.dlg.hostess.showInvite")!;
    expect(show.locked?.key).toBe("heist.dlg.lock.noInvite");                    // apagada, com o motivo
    choose(s, start.choices.length - 1);                                         // "deixa pra lá"
    expect(s.unlocked).not.toContain("carpetGate");
    const q = s.civs.find((c) => c.role === "queue")!;
    q.persona = "dreamy";                                           // alvo distraído (a desconfiada vira para quem chega perto)
    s.player.pos = { x: q.pos.x + 0.9, z: q.pos.z };                // atrás dela (a fila olha para o oeste)
    expect(promptAt(s)?.kind).toBe("pickpocket");
    interact(s, ctx); run(s, 1.3);
    expect(s.player.inv.invite).toBe(true);
    place(s, 0, 32.3, "rua"); interact(s, ctx); choose(s, 0);                  // "mostrar o convite"
    expect(s.unlocked).toContain("carpetGate");
    expect(s.player.inv.wristband).toBe(true);
  });
});

describe("roupa, disfarce e reação", () => {
  it("vestir o uniforme: abaixa, troca no meio da animação e vira equipe; os convidados pedem bebida", () => {
    const s = newSim([]);
    for (const g of s.guards) g.active = false;
    s.player.inv.uniform = true;
    expect(wear(s, "uniform")).toBe(true);
    run(s, 0.5);
    expect(s.player.outfit.base).toBe("arrival");
    run(s, CHANGE_TIME);
    expect(s.player.outfit.base).toBe("uniform");
    expect(s.player.disguise).toBe("staff");
    expect(outfitPieces(s).map((p) => p.subcategory)).toContain("vest");
    const guest = s.civs.find((c) => c.role === "guest" && c.room === "salao")!;
    place(s, guest.pos.x + 1.2, guest.pos.z, "salao");
    const lines: string[] = [];
    for (let k = 0; k < 120; k++) { step(s, ctx, idle(), 1 / 60); for (const e of s.events) if (e.t === "line") lines.push(e.key); s.events.length = 0; }
    expect(lines).toContain("heist.civ.order");
  });

  it("vestir uma carta de vestido de grife (≥ 70) faz a recepcionista deixar entrar sem convite", () => {
    const s = newSim(matchCards([card({ id: "gown", category: "full_body_piece", subcategory: "dress", rarity: "RARE", stats: { CLOUT: 90 }, brandName: "Maison", occasions: ["formal"] })]));
    for (const g of s.guards) g.active = false;
    wear(s, "gown"); run(s, CHANGE_TIME + 0.2);
    expect(s.cardState.gown).toBe("WORN");
    expect(outfitPieces(s).some((p) => p.id === "card-gown")).toBe(true);
    place(s, 0, 32.3, "rua"); interact(s, ctx); choose(s, 1);                  // "estou com a casa de moda" (grife ≥ 70)
    expect(s.unlocked).toContain("carpetGate");
  });
});

describe("diamante, cena e fuga", () => {
  it("abre a vitrine, a cena roda, os seguranças entram e a fuga começa com saídas trancadas e bloqueadores", () => {
    const s = newSim([]);
    place(s, -16.2, -14.25, "cofre");
    for (const g of s.guards) g.active = false;
    startPuzzle(s, "rings", "pedestal");
    for (let r = 0; r < 3; r++) for (let k = 0; k < CODES.rings[r]; k++) puzzleRing(s, r, 1);
    expect(s.phase).toBe("CUTSCENE");
    expect(s.player.inv.diamond).toBe(true);
    run(s, CUTSCENE_LEN + 0.1);
    expect(s.phase).toBe("ESCAPE");
    expect(s.lockdown).toBe(true);
    const blockers = GUARDS.filter((g) => g.blocker).map((g) => guard(s, g.id));
    expect(blockers.length).toBeGreaterThanOrEqual(4);
    expect(blockers.every((g) => g.active && g.state === "ALERT")).toBe(true);
    expect(guard(s, "x1").active).toBe(true);
  });

  it("pular a cena também arma o alarme; o checkpoint volta com vida mínima", () => {
    const s = newSim([]);
    place(s, -16.2, -14.25, "cofre");
    startPuzzle(s, "rings", "pedestal");
    for (let r = 0; r < 3; r++) for (let k = 0; k < CODES.rings[r]; k++) puzzleRing(s, r, 1);
    skipCutscene(s);
    expect(s.phase).toBe("ESCAPE"); expect(s.alarm).toBe(true);
    const snap = snapshot(s);
    s.player.hp = 0; s.phase = "LOST";
    const back = restore(snap);
    expect(back.phase).toBe("ESCAPE"); expect(back.player.hp).toBeGreaterThanOrEqual(60);
  });

  it("é determinística: as mesmas entradas dão o mesmo estado", () => {
    const go = (k: number) => idle({ move: { x: Math.sin(k / 40), y: 1 }, camYaw: Math.PI, sprint: k % 200 < 90 });
    const a = newSim([] as HeistCard[]), b = newSim([] as HeistCard[]);
    run(a, 12, go); run(b, 12, go);
    expect(a.player.pos).toEqual(b.player.pos);
    expect(a.civs.map((c) => c.pos)).toEqual(b.civs.map((c) => c.pos));
  });
});
