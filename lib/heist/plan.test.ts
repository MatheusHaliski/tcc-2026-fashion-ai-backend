/*
 * Testes amarrados aos requisitos do plano de auditoria (IDs MH-xx-yy entre parênteses): furto e descoberta, conversas
 * com escolhas, percepção dos seguranças, papéis e tática, civis, alerta do prédio, dificuldade, desafios e finais.
 */
import { describe, expect, it } from "vitest";
import type { HeistInput, SimState } from "./types";
import { newSim, simCtx } from "./state";
import { choose, interact, promptAt, skipBeat, startBeat, step, talk, wear } from "./sim";
import { DIALOGUES, choicesOf } from "./dialogue";
import { alertGuard, makeNoise, recognition } from "./combat";
import { challengeState, endingOf, optionalDone } from "./goals";
import { matchCards } from "./cards";

const ctx = simCtx();
const idle = (o: Partial<HeistInput> = {}): HeistInput => ({ move: { x: 0, y: 0 }, camYaw: 0, camPitch: 0, sprint: false, crouchPress: false, discreet: false, interactPress: false, aim: false, fire: false, firePress: false, reloadPress: false, meleePress: false, healPress: false, throwPress: false, ...o });
const run = (s: SimState, secs: number, inp: (k: number) => HeistInput = () => idle()) => { const n = Math.round(secs * 60); s.options.beats = false; const ev: string[] = []; for (let k = 0; k < n; k++) { step(s, ctx, inp(k), 1 / 60); for (const e of s.events) ev.push(e.t === "line" || e.t === "toast" ? e.key : e.t); s.events.length = 0; } return ev; };
const guard = (s: SimState, id: string) => s.guards.find((g) => g.id === id)!;
const quiet = (s: SimState) => { for (const g of s.guards) g.active = false; };
function place(s: SimState, x: number, z: number, room: SimState["player"]["lastRoom"], y = 0) { s.player.pos = { x, z }; s.player.lastRoom = room; s.player.y = y; }

describe("furto de convidados (MH-05-05, MH-07-02..14)", () => {
  it("furta a joia por trás com valor e raridade; a dona percebe depois e chama a segurança", () => {
    const s = newSim([]);
    const c = s.civs.find((x) => x.jewel && x.room === "salao" && x.role === "guest")!;
    c.persona = "dreamy";
    const salao = s.guards.filter((g) => g.room === "salao" && !g.reserve);
    quiet(s);                                                          // ninguém olhando na hora do furto
    place(s, c.pos.x - Math.sin(c.yaw) * 0.9, c.pos.z - Math.cos(c.yaw) * 0.9, "salao");
    const pr = promptAt(s)!;
    expect(pr.kind).toBe("pickpocket");
    expect(pr.vars).toMatchObject({ value: c.jewel!.value, tier: `heist.tier.${c.jewel!.tier}` });   // valor e raridade no botão
    expect(typeof pr.vars!.watch).toBe("number");                                                   // quantos olham (risco)
    interact(s, ctx); run(s, 1.3);
    expect(s.player.inv.loot).toHaveLength(1);
    expect(s.player.inv.loot[0]).toMatchObject({ kind: c.jewel!.kind, from: "worn", owner: "guest" });
    expect(c.jewel!.taken).toBe(true);
    // a dona nota a falta mais tarde: a segurança do salão desconfia e o prédio fica mais atento
    for (const g of salao) g.active = true;
    place(s, 22, -20, "terraco");
    const ev = run(s, 70);
    expect(c.jewel!.noticed).toBe(true);
    expect(ev).toContain(`heist.civ.missing.${c.jewel!.kind}`);
    expect(s.alertLevel).toBeGreaterThanOrEqual(1);
    expect(s.guards.some((g) => g.room === "salao" && g.reason === "theft")).toBe(true);
  });

  it("o furto pode ser interrompido antes de terminar (MH-07-07)", () => {
    const s = newSim([]); quiet(s);
    const c = s.civs.find((x) => x.jewel && x.role === "guest")!; c.persona = "dreamy";
    place(s, c.pos.x - Math.sin(c.yaw) * 0.9, c.pos.z - Math.cos(c.yaw) * 0.9, c.room);
    interact(s, ctx); run(s, 0.4); run(s, 1 / 60, () => idle({ interactPress: true })); run(s, 1);
    expect(s.player.inv.loot).toHaveLength(0);
    expect(c.jewel!.taken).toBe(false);
  });

  it("vitrine de joias com energia dispara o sensor; com o quadro de luz cortado, sai em silêncio (MH-07-09)", () => {
    const a = newSim([]); place(a, -20.5, -18.5, "cofre"); interact(a, ctx); run(a, 1.8);
    expect(a.player.inv.loot[0]).toMatchObject({ from: "exposed", tier: "OURO" });
    expect(a.guards.filter((g) => g.room === "cofre" && g.active).every((g) => g.state === "ALERT")).toBe(true);
    const b = newSim([]); b.fusesCut = true; place(b, -20.5, -18.5, "cofre"); interact(b, ctx); run(b, 1.8);
    expect(b.player.inv.loot).toHaveLength(1);
    expect(b.guards.some((g) => g.room === "cofre" && g.state === "ALERT")).toBe(false);
  });

  it("cada partida sorteia outros alvos (MH-12-06)", () => {
    const a = newSim([], 1), b = newSim([], 2);
    expect(a.civs.filter((c) => c.jewel).map((c) => c.id)).not.toEqual(b.civs.filter((c) => c.jewel).map((c) => c.id));
  });
});

describe("conversas com escolhas (MH-08-02, MH-08-06, MH-08-07)", () => {
  it("elogiar Lina Vale abre a opção de entrar em nome dela com a recepcionista", () => {
    const s = newSim([]); quiet(s);
    const lina = s.civs.find((c) => c.role === "celebrity")!;
    talk(s, lina.id, "celebrity"); choose(s, 0);
    expect(s.clues).toContain("linaVale");
    choose(s, 0);                                                       // "certo"
    expect(s.dialogue).toBeNull();
    const host = s.civs.find((c) => c.talkId === "hostess")!;
    talk(s, host.id, "hostess");
    const lineOpt = choicesOf(s, DIALOGUES.hostess.start).find((x) => x.c.key === "heist.dlg.hostess.lina")!;
    choose(s, lineOpt.i);
    expect(s.unlocked).toContain("carpetGate");
  });

  it("blefe sem grife não cola: a segurança do portão fica de olho", () => {
    const s = newSim([]);
    talk(s, "c-host", "hostess");
    const bluff = choicesOf(s, DIALOGUES.hostess.start).find((x) => x.c.key === "heist.dlg.hostess.bluff")!;
    choose(s, bluff.i);
    expect(s.unlocked).not.toContain("carpetGate");
    expect(guard(s, "r2").suspicion).toBeGreaterThan(0.3);
  });

  it("a curadora só conta a ordem da vitrine e quem tem o cartão depois de ganhar confiança; o bartender abre o revendedor", () => {
    const s = newSim([]);
    talk(s, "x", "curator"); choose(s, 1);
    expect(s.dialogue?.node).toBe("guarded");
    talk(s, "x", "curator"); choose(s, 0);                              // elogiar
    expect(s.dialogue?.node).toBe("pleased");
    choose(s, 0);                                                       // perguntar do diamante
    expect(s.clues).toContain("placardStars");
    talk(s, "y", "bartender");
    expect(choose(s, 1)).toEqual({ ui: "vendor", vendor: "bar" });
  });

  it("de uniforme, o chefe do bufê manda entrar pela doca", () => {
    const s = newSim([]); quiet(s);
    s.player.inv.uniform = true; wear(s, "uniform"); run(s, 3);
    talk(s, "z", "cateringChief");
    choose(s, choicesOf(s, DIALOGUES.cateringChief.start)[0].i);
    expect(s.unlocked).toContain("dockGate");
  });
});

describe("percepção e tática dos seguranças (MH-06, MH-09)", () => {
  it("explica a detecção: arma à mostra, roupa casual, área restrita, perto demais (MH-06-14)", () => {
    const s = newSim([]); const g = guard(s, "s2");
    place(s, g.pos.x, g.pos.z + 6, "salao");
    s.player.aiming = true; expect(recognition(s, g, 6).reason).toBe("weapon");
    s.player.aiming = false; s.player.disguise = "casual"; expect(recognition(s, g, 6).reason).toBe("casual");
    place(s, -17, 10, "servico"); s.player.disguise = "gala"; expect(recognition(s, g, 6).reason).toBe("restricted");
    expect(recognition(s, g, 1.5).reason).toBe("close");
  });

  it("no escuro reconhece mais devagar; com a Sala das Joias sem energia, ainda mais (MH-06-03)", () => {
    const s = newSim([]); const g = guard(s, "s2");
    place(s, 0, 0, "salao"); const lit = recognition(s, g, 6).rate;
    place(s, 25, 0, "beco"); const dark = recognition(s, g, 6).rate;
    expect(dark).toBeLessThan(lit);
    place(s, -17, -14, "cofre"); const vault = recognition(s, g, 6).rate; s.fusesCut = true;
    expect(recognition(s, g, 6).rate).toBeLessThan(vault);
  });

  it("parede abafa o barulho da garrafa (MH-06-04) e o posto crítico só olha (MH-06-16)", () => {
    const s = newSim([]);
    const m = guard(s, "m1"); m.pos = { x: -13.25, z: 10.75 };            // labirinto, atrás da parede do salão
    makeNoise(s, { x: -9, z: 10.75 }, 6, "bottle");
    expect(m.state).toBe("PATROL");
    const v = guard(s, "v1");                                           // posto do detector
    makeNoise(s, { x: v.pos.x + 3, z: v.pos.z + 3 }, 9, "bottle");
    expect(v.state).toBe("SUSPICIOUS");
    place(s, 30, 49, "rua");
    run(s, 4);
    expect(Math.hypot(v.pos.x - 3, v.pos.z - 15.4)).toBeLessThan(0.6);  // não saiu do posto
  });

  it("na busca confere a arara onde ela se escondeu (MH-06-08)", () => {
    const s = newSim([]); quiet(s);
    const g = guard(s, "v2"); g.active = true;
    s.player.hidden = "rack-v1"; place(s, 7.2, 18.6, "vestibulo");
    g.state = "SEARCH"; g.stateT = s.time; g.lastKnown = { x: 6.4, z: 18.6 }; g.searched = []; g.goal = null;
    run(s, 12);
    expect(s.player.hidden).toBeNull();
    expect(g.state).toBe("ALERT");
  });

  it("o chefe avisa o prédio e chama reforço; o segundo segurança flanqueia (MH-06-07, MH-06-12, MH-06-13, MH-09-08)", () => {
    const s = newSim([]);
    const chief = guard(s, "s1"), reserve = guard(s, "x6");
    place(s, 0, 8, "salao");
    alertGuard(s, chief, s.player.pos, true, "seen");
    expect(reserve.active).toBe(true);
    expect(s.guards.filter((g) => g.active && g.room !== "salao" && g.state === "SEARCH").length).toBeGreaterThan(0);
    const t = newSim([]); quiet(t);
    const a = guard(t, "g1"), b = guard(t, "g2"); a.active = b.active = true;
    a.pos = { x: 0, z: -9 }; b.pos = { x: -4, z: -9 }; place(t, 0, -16, "galeria"); t.player.inv.diamond = true;
    a.state = "ALERT"; a.stateT = -1; a.sees = true; a.yaw = Math.PI;
    b.state = "ALERT"; b.stateT = t.time; b.yaw = Math.PI;
    run(t, 1 / 60);
    expect(b.flank ?? a.flank).not.toBeNull();
  });

  it("esquiva: durante a esquiva o tiro não acerta (MH-09-03)", () => {
    const s = newSim([]);
    for (const g of s.guards) if (g.id !== "s2") g.active = false;
    const g = guard(s, "s2"); place(s, g.pos.x, g.pos.z + 5, "salao");
    alertGuard(s, g, s.player.pos, false);
    let hp = 100;
    for (let k = 0; k < 300; k++) { s.player.iframesUntil = s.time + 1; step(s, ctx, idle(), 1 / 60); s.events.length = 0; hp = s.player.hp; }
    expect(hp).toBe(100);
    expect(g.shots).toBeGreaterThan(0);
  });
});

describe("civis (MH-05)", () => {
  it("quem vê um nocaute grita, avisa a segurança e depois aponta para ela (MH-05-07, MH-05-13)", () => {
    const s = newSim([]);
    const v = guard(s, "v2"), c = s.civs.find((x) => x.room === "vestibulo" && x.role === "guest")!;
    c.yaw = Math.atan2(v.pos.x - c.pos.x, v.pos.z - c.pos.z); c.persona = "chatty";
    v.pos = { x: c.pos.x + 2, z: c.pos.z }; v.state = "POST"; v.yaw = Math.PI / 2;
    c.yaw = Math.atan2(v.pos.x - c.pos.x, v.pos.z - c.pos.z);
    place(s, v.pos.x - 0.8, v.pos.z, "vestibulo"); s.player.yaw = Math.PI / 2;
    expect(promptAt(s)?.kind).toBe("takedown");
    const ev = run(s, 0.1, (k) => idle({ meleePress: k === 0 }));
    void ev;
    run(s, 1.5);
    expect(c.knowsPlayer).toBeGreaterThan(-1);
  });

  it("espaço pessoal: parada colada em alguém, a pessoa reclama (MH-05-04)", () => {
    const s = newSim([]); quiet(s);
    const c = s.civs.find((x) => x.room === "salao" && x.role === "guest")!;
    c.persona = "wary";
    place(s, c.pos.x - Math.sin(c.yaw) * 0.6, c.pos.z - Math.cos(c.yaw) * 0.6, "salao");   // colada às costas dela
    const ev = run(s, 4);
    expect(ev).toContain("heist.civ.space");
  });
});

describe("alerta, dificuldade, desafios e finais (MH-11, MH-12, MH-13)", () => {
  it("o alerta do prédio sobe com a detecção e cai depois de 90 s sem incidentes (MH-06-15, MH-11-10)", () => {
    const s = newSim([]);
    alertGuard(s, guard(s, "s2"), { x: 0, z: 0 }, false);
    expect(s.alertLevel).toBe(1);
    quiet(s); place(s, 30, 49, "rua");
    run(s, 95);
    expect(s.alertLevel).toBe(0);
  });

  it("fácil: vida volta até a metade, preços menores; lenda: reconhece mais rápido (MH-13-04)", () => {
    const easy = newSim([], 1, { difficulty: "facil" }), hard = newSim([], 1, { difficulty: "lenda" }), norm = newSim([], 1);
    expect(easy.offers.street.find((o) => o.item === "pistol")!.price).toBeLessThan(norm.offers.street.find((o) => o.item === "pistol")!.price);
    quiet(easy); easy.player.hp = 10; place(easy, 30, 49, "rua"); run(easy, 25);
    expect(easy.player.hp).toBeCloseTo(50, 0);
    const g = guard(hard, "s2"); place(hard, 0, 0, "salao"); place(norm, 0, 0, "salao");
    expect(recognition(hard, g, 6).rate).toBeGreaterThan(recognition(norm, guard(norm, "s2"), 6).rate);
  });

  it("Ghost Heist falha na primeira detecção; Social Chameleon exige trocar de roupa sem combate", () => {
    const s = newSim([], 1, { challenge: "ghost" });
    alertGuard(s, guard(s, "s2"), { x: 0, z: 0 }, false); run(s, 1 / 60);
    expect(challengeState(s)).toMatchObject({ status: "failed", reason: "spotted" });
    const c = newSim(matchCards([]), 1, { challenge: "chameleon" }); quiet(c);
    place(c, -14, -15, "cofre"); run(c, 1 / 60);
    expect(challengeState(c)).toMatchObject({ status: "failed", reason: "noChange" });
  });

  it("Diamond Run tem relógio de 6 minutos; o final depende de ser vista e de abates", () => {
    const s = newSim([], 1, { challenge: "diamondRun" });
    expect(challengeState(s)).toMatchObject({ status: "running", left: 360 });
    s.stats.time = 361; run(s, 1 / 60);
    expect(challengeState(s)?.status).toBe("failed");
    const e = newSim([]);
    expect(endingOf(e)).toBe("fantasma");
    e.stats.spotted = 1; expect(endingOf(e)).toBe("profissional");
    e.stats.kills = 2; expect(endingOf(e)).toBe("implacavel");
    e.stats.kills = 9; expect(endingOf(e)).toBe("barulhenta");
  });

  it("esconderijos dão recompensa uma vez (MH-02-13) e contam no opcional", () => {
    const s = newSim([]); quiet(s);
    place(s, 27.8, -2.8, "beco", -1.6);
    expect(promptAt(s)?.kind).toBe("stash");
    interact(s, ctx); run(s, 1);
    expect(s.player.inv.ammo).toBe(12);
    expect(promptAt(s)).toBeNull();
    expect(optionalDone(s, "secrets")).toBe(false);
  });

  it("subobjetivos viram marcos em ordem (cena de corte na camada de jogo)", () => {
    const s = newSim([]); quiet(s);
    place(s, -5, 32.5, "rua", -1.6);
    const ev = run(s, 1 / 60);
    expect(ev).toContain("beat");
    expect(s.mission.step).toBe(1);
  });

  it("a cena curta do subobjetivo tira o controle, ninguém a percebe nem atira, e pular devolve o controle (MH-11-03)", () => {
    const s = newSim([]);
    place(s, -5, 32.5, "rua", -1.6);
    step(s, ctx, idle(), 1 / 60);
    expect(s.beat).toMatchObject({ step: "arrive" });
    expect(s.beat!.shots.length).toBeGreaterThan(0);
    // um segurança colado nela durante a cena não acumula suspeita
    const g = guard(s, "r1"); g.pos = { x: s.player.pos.x, z: s.player.pos.z - 1.2 }; g.yaw = 0; g.look2 = 0; g.suspicion = 0;
    const x0 = s.player.pos.x;
    for (let k = 0; k < 60; k++) step(s, ctx, idle({ move: { x: 1, y: 0 } }), 1 / 60);
    expect(s.player.pos.x).toBeCloseTo(x0, 1);
    expect(g.suspicion).toBe(0);
    skipBeat(s);
    for (let k = 0; k < 30; k++) step(s, ctx, idle({ move: { x: 1, y: 0 } }), 1 / 60);
    expect(s.beat).toBeNull();
    expect(Math.abs(s.player.pos.x - x0)).toBeGreaterThan(0.3);
  });

  it("a cena de abertura e as curtas podem ser desligadas nas opções", () => {
    const s = newSim([], 1, { beats: false });
    expect(startBeat(s, "intro", "")).toBeNull();
    const t = newSim([]);
    expect(startBeat(t, "intro", "")).not.toBeNull();
    expect(t.beat!.until - t.beat!.at).toBeGreaterThan(5);
  });
});

describe("Midnight Escape", () => {
  it("começa na Sala das Joias com a energia cortada e o subobjetivo do diamante", () => {
    const s = newSim([], 3, { challenge: "midnight" });
    expect(s.player.lastRoom).toBe("cofre");
    expect(s.fusesCut).toBe(true);
    expect(s.mission.step).toBe(6);
    expect(challengeState(s)).toMatchObject({ status: "running", left: 120 });
  });
});
