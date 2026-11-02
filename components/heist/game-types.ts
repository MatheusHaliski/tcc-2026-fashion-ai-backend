/*
 * MET Gala Heist v2 — tipos e tabelas da composição do jogo (game.tsx e seus hooks): o painel aberto, a etapa da
 * partida, os nomes de rádio dos seguranças e a chave do deck (para casar a partida salva com as cartas de agora).
 */
import type { HeistCard, VendorId } from "@/lib/heist/types";
import { GUARDS } from "@/lib/heist/level";

export type Panel = { kind: "vendor"; vendor: VendorId } | { kind: "puzzle" } | { kind: "clue"; ref: string } | { kind: "deck" } | { kind: "wheel" } | { kind: "dialogue" } | { kind: "map" } | null;
export type Stage = "brief" | "play" | "pause" | "over" | "won";
export const GUARD_NAMES = Object.fromEntries(GUARDS.map((g) => [g.id, g.callsign]));
export const deckKey = (cards: HeistCard[]) => cards.map((c) => c.id).sort().join(",");
