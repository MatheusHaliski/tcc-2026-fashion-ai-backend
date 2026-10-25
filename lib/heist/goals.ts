/*
 * MET Gala Heist v2 — objetivos opcionais, desafios e finais (MH-11-06, MH-11-11, MH-12).
 *
 * Opcionais (sempre valem): furtar três joias, ninguém abatido, nunca detectada, ler as três pistas, entrar vestindo uma
 * peça sua (carta) e abrir três esconderijos.
 * Desafios (escolhidos antes da partida, com regras claras):
 *  - Ghost Heist: nenhum segurança pode ficar em alerta por sua causa;
 *  - Diamond Run: o diamante nas mãos em até 6 minutos;
 *  - Midnight Escape: começa na Sala das Joias com a energia cortada; fuja até um carro em até 2 minutos depois do alarme;
 *  - Social Chameleon: chegar à Sala das Joias sem disparar, nocautear ou abater ninguém, e trocando de roupa pelo caminho.
 * Final: Fantasma (nunca detectada e sem abates), Profissional (sem abates), Implacável (até quatro abates), Barulhenta.
 */
import type { ChallengeId, EndingId, OptionalId, SimState } from "./types";
import { emit } from "./state";

export const CHALLENGE_RULES: Record<ChallengeId, { limit?: number }> = { ghost: {}, diamondRun: { limit: 360 }, midnight: { limit: 120 }, chameleon: {} };
export const OPTIONALS: OptionalId[] = ["loot3", "unseen", "noKills", "clues", "ownLook", "secrets"];
const PHYSICAL_CLUES = ["posterAurora", "callsheet", "placardStars"];

export function optionalDone(s: SimState, id: OptionalId): boolean {
  switch (id) {
    case "loot3": return s.player.inv.loot.filter((l) => l.kind !== "diamante").length >= 3;
    case "unseen": return s.stats.spotted === 0;
    case "noKills": return s.stats.kills === 0;
    case "clues": return PHYSICAL_CLUES.every((c) => s.clues.includes(c));
    case "ownLook": return s.flags.includes("enteredWearing");
    case "secrets": return s.stashes.filter((x) => x.startsWith("stash")).length >= 3;
  }
}

/** Andamento do desafio: falhou (com motivo), cumprido ou em andamento (com o tempo restante, quando há). */
export function challengeState(s: SimState): { id: ChallengeId; status: "running" | "failed" | "done"; left?: number; reason?: string } | null {
  if (!s.challenge) return null;
  const id = s.challenge;
  if (s.challengeFailed) return { id, status: "failed", reason: s.challengeFailed };
  const lim = CHALLENGE_RULES[id].limit;
  if (id === "diamondRun") return s.player.inv.diamond ? { id, status: "done" } : { id, status: "running", left: Math.max(0, lim! - s.stats.time) };
  if (id === "midnight") return s.phase === "WON" ? { id, status: "done" } : { id, status: "running", left: s.alarm ? Math.max(0, lim! - (s.time - s.alarmAt)) : lim };
  if (id === "chameleon") return s.visited.includes("cofre") ? { id, status: "done" } : { id, status: "running" };
  return s.phase === "WON" ? { id, status: "done" } : { id, status: "running" };
}

/** Confere a cada passo: registra a falha (uma vez, com o motivo) e os fatos que os opcionais usam. */
export function trackGoals(s: SimState) {
  const p = s.player;
  if (!s.flags.includes("enteredWearing") && !["rua", "beco"].includes(p.lastRoom) && p.outfit.worn.length) s.flags.push("enteredWearing");
  if (!s.visited.includes("cofre") && (s.stats.shots || s.stats.takedowns || s.stats.kills) && !s.flags.includes("combatBeforeVault")) s.flags.push("combatBeforeVault");
  if (!s.challenge || s.challengeFailed) return;
  const fail = (reason: string) => { s.challengeFailed = reason; emit(s, { t: "challenge", id: s.challenge!, result: "failed", reason }); };
  switch (s.challenge) {
    case "ghost": if (s.stats.spotted > 0) fail("spotted"); break;
    case "diamondRun": if (!p.inv.diamond && s.stats.time > CHALLENGE_RULES.diamondRun.limit!) fail("time"); break;
    case "midnight": if (s.alarm && s.phase !== "WON" && s.time - s.alarmAt > CHALLENGE_RULES.midnight.limit!) fail("time"); break;
    case "chameleon":
      if (!s.visited.includes("cofre") && s.flags.includes("combatBeforeVault")) fail("combat");
      else if (p.lastRoom === "cofre" && !s.flags.includes("changed")) fail("noChange");
      break;
  }
}

export function endingOf(s: SimState): EndingId {
  if (s.stats.spotted === 0 && s.stats.kills === 0) return "fantasma";
  if (s.stats.kills === 0) return "profissional";
  if (s.stats.kills <= 4) return "implacavel";
  return "barulhenta";
}

/** Desafio da semana (MH-12-10): o calendário do universo do jogo destaca um a cada semana. */
export function weeklyChallenge(date = new Date()): ChallengeId {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1), week = Math.floor((date.getTime() - start) / (7 * 864e5));
  return (["ghost", "diamondRun", "midnight", "chameleon"] as ChallengeId[])[week % 4];
}
