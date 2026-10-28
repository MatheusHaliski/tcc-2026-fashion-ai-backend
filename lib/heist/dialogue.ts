/*
 * MET Gala Heist v2 — conversas com escolhas (MH-08-06, MH-08-07): a recepcionista do portão, Lina Vale (atriz fictícia na
 * calçada), Íris (curadora da exposição), Davi (bartender e revendedor por baixo do balcão) e o chefe do bufê. Cada escolha
 * tem condição (o que a jogadora tem, veste ou sabe) e consequência (porta aberta, pista, desconfiança, cobertura). Opção
 * indisponível aparece apagada com o motivo (MH-14-15). Tudo determinístico: a missão não depende de sorte.
 */
import type { DialogueId, SimState } from "./types";
import { VIP_PRESTIGE, wornPrestige } from "./state";

export interface Choice {
  key: string;
  /** escolha some quando false */
  show?: (s: SimState) => boolean;
  /** motivo (chave de tradução) para mostrar a escolha apagada; null = disponível */
  lock?: (s: SimState) => { key: string; vars?: Record<string, number> } | null;
  /** consequência; devolve o próximo nó, "vendor:<id>" para abrir o revendedor ou null para encerrar */
  go: (s: SimState) => string | null;
}
export interface DNode { who: string; line: string | ((s: SimState) => string); choices: Choice[] }

const has = (s: SimState, f: string) => s.flags.includes(f);
const flag = (s: SimState, f: string) => { if (!s.flags.includes(f)) s.flags.push(f); };
const clue = (s: SimState, c: string) => { if (!s.clues.includes(c)) s.clues.push(c); };
const LEAVE: Choice = { key: "heist.dlg.leave", go: () => null };
const OK: Choice = { key: "heist.dlg.ok", go: () => null };
/** Abre o portão do tapete e dá a pulseira (convite, grife ou Lina Vale). */
function admit(s: SimState, how: string) { if (!s.unlocked.includes("carpetGate")) s.unlocked.push("carpetGate"); s.player.inv.wristband = true; s.stats.route ||= how; }
/** Blefe que não cola: os seguranças do portão ficam de olho. */
function doubt(s: SimState, amount: number) { for (const g of s.guards) if ((g.id === "r2" || g.id === "r3") && g.state !== "DOWN") { g.suspicion = Math.min(0.95, g.suspicion + amount); g.lastKnown = { ...s.player.pos }; } }

export const DIALOGUES: Record<DialogueId, Record<string, DNode>> = {
  hostess: {
    start: { who: "hostess", line: "heist.dlg.hostess.start", choices: [
      { key: "heist.dlg.hostess.showInvite", lock: (s) => (s.player.inv.invite ? null : { key: "heist.dlg.lock.noInvite" }), go: (s) => { admit(s, "convite"); return "welcome"; } },
      { key: "heist.dlg.hostess.vip", show: (s) => s.player.disguise === "gala", lock: (s) => (wornPrestige(s) >= VIP_PRESTIGE ? null : { key: "heist.dlg.lock.prestige", vars: { need: VIP_PRESTIGE, best: wornPrestige(s) } }), go: (s) => { admit(s, "vip"); return "vipOk"; } },
      { key: "heist.dlg.hostess.lina", show: (s) => s.clues.includes("linaVale"), go: (s) => { admit(s, "lina"); return "linaOk"; } },
      { key: "heist.dlg.hostess.bluff", show: (s) => !s.player.inv.invite, go: (s) => {
        if (s.player.disguise === "gala" && wornPrestige(s) >= 50) { admit(s, "blefe"); return "bluffOk"; }
        doubt(s, s.player.disguise === "casual" ? 0.6 : 0.4); return "bluffFail";
      } },
      LEAVE,
    ] },
    welcome: { who: "hostess", line: "heist.dlg.hostess.welcome", choices: [OK] },
    vipOk: { who: "hostess", line: "heist.dlg.hostess.vipOk", choices: [OK] },
    linaOk: { who: "hostess", line: "heist.dlg.hostess.linaOk", choices: [OK] },
    bluffOk: { who: "hostess", line: "heist.dlg.hostess.bluffOk", choices: [OK] },
    bluffFail: { who: "hostess", line: (s) => (s.player.disguise === "casual" ? "heist.dlg.hostess.casual" : "heist.dlg.hostess.bluffFail"), choices: [OK] },
  },
  celebrity: {
    start: { who: "celebrity", line: "heist.dlg.lina.start", choices: [
      { key: "heist.dlg.lina.compliment", go: (s) => { if (s.player.disguise === "casual") return "cold"; clue(s, "linaVale"); return "flattered"; } },
      { key: "heist.dlg.lina.selfie", go: (s) => { doubt(s, -0.3); flag(s, "selfie"); return "selfie"; } },
      { key: "heist.dlg.lina.diamond", go: () => "gossip" },
      LEAVE,
    ] },
    flattered: { who: "celebrity", line: "heist.dlg.lina.flattered", choices: [OK] },
    cold: { who: "celebrity", line: "heist.dlg.lina.cold", choices: [OK] },
    selfie: { who: "celebrity", line: "heist.dlg.lina.selfieDone", choices: [OK] },
    gossip: { who: "celebrity", line: "heist.dlg.lina.gossip", choices: [{ key: "heist.dlg.lina.compliment", show: (s) => !s.clues.includes("linaVale"), go: (s) => { if (s.player.disguise === "casual") return "cold"; clue(s, "linaVale"); return "flattered"; } }, LEAVE] },
  },
  curator: {
    start: { who: "curator", line: (s) => (s.player.disguise === "staff" ? "heist.dlg.iris.startStaff" : "heist.dlg.iris.start"), choices: [
      { key: "heist.dlg.iris.praise", show: (s) => !has(s, "irisTrust"), go: (s) => { flag(s, "irisTrust"); return "pleased"; } },
      { key: "heist.dlg.iris.diamond", go: (s) => { if (!has(s, "irisTrust")) return "guarded"; clue(s, "placardStars"); return "rings"; } },
      { key: "heist.dlg.iris.security", go: (s) => { if (!has(s, "irisTrust")) return "guarded"; flag(s, "keycardHint"); return "keycard"; } },
      LEAVE,
    ] },
    pleased: { who: "curator", line: "heist.dlg.iris.pleased", choices: [{ key: "heist.dlg.iris.diamond", go: (s) => { clue(s, "placardStars"); return "rings"; } }, { key: "heist.dlg.iris.security", go: (s) => { flag(s, "keycardHint"); return "keycard"; } }, LEAVE] },
    guarded: { who: "curator", line: "heist.dlg.iris.guarded", choices: [OK] },
    rings: { who: "curator", line: "heist.dlg.iris.rings", choices: [{ key: "heist.dlg.iris.security", go: (s) => { flag(s, "keycardHint"); return "keycard"; } }, LEAVE] },
    keycard: { who: "curator", line: "heist.dlg.iris.keycard", choices: [LEAVE] },
  },
  bartender: {
    start: { who: "bartender", line: "heist.dlg.davi.start", choices: [
      { key: "heist.dlg.davi.drink", go: (s) => { s.lineAt.drinkUntil = s.time + 90; return "cheers"; } },
      { key: "heist.dlg.davi.trade", go: () => "vendor:bar" },
      { key: "heist.dlg.davi.rumor", go: (s) => { flag(s, "keyHint"); flag(s, "fusesHint"); return "rumor"; } },
      LEAVE,
    ] },
    cheers: { who: "bartender", line: "heist.dlg.davi.cheers", choices: [OK] },
    rumor: { who: "bartender", line: "heist.dlg.davi.rumorLine", choices: [{ key: "heist.dlg.davi.trade", go: () => "vendor:bar" }, LEAVE] },
  },
  cateringChief: {
    start: { who: "cateringChief", line: (s) => (s.player.disguise === "staff" ? "heist.dlg.chef.startStaff" : "heist.dlg.chef.start"), choices: [
      { key: "heist.dlg.chef.newbie", show: (s) => s.player.disguise === "staff", go: (s) => { if (!s.unlocked.includes("dockGate")) s.unlocked.push("dockGate"); s.stats.route ||= "doca"; return "go"; } },
      { key: "heist.dlg.chef.help", show: (s) => s.player.disguise !== "staff", go: () => "noUniform" },
      LEAVE,
    ] },
    go: { who: "cateringChief", line: "heist.dlg.chef.go", choices: [OK] },
    noUniform: { who: "cateringChief", line: "heist.dlg.chef.noUniform", choices: [OK] },
  },
};

export const nodeLine = (s: SimState, n: DNode) => (typeof n.line === "function" ? n.line(s) : n.line);
/** Escolhas visíveis do nó (com o motivo de bloqueio das apagadas). */
export function choicesOf(s: SimState, n: DNode): { c: Choice; i: number; locked: { key: string; vars?: Record<string, number> } | null }[] {
  return n.choices.map((c, i) => ({ c, i, locked: c.lock ? c.lock(s) : null })).filter((x) => !x.c.show || x.c.show(s));
}
