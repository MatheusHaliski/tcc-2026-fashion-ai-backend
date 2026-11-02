/*
 * MET Gala Heist v2 — dados do áudio sintetizado: reverberação por sala, timbre do passo por piso, murmúrio da multidão
 * por sala, acordes e baixo da música da gala, e a resposta ao impulso sintética usada pela reverberação.
 */
import type { Floor, RoomId } from "@/lib/heist/types";

export const REVERB: Partial<Record<RoomId, { secs: number; wet: number }>> = {
  salao: { secs: 2.6, wet: 0.32 }, galeria: { secs: 2, wet: 0.28 }, vestibulo: { secs: 1.6, wet: 0.24 }, cofre: { secs: 1.4, wet: 0.22 },
  lounge: { secs: 0.9, wet: 0.14 }, bastidores: { secs: 0.8, wet: 0.12 }, servico: { secs: 0.7, wet: 0.16 }, seguranca: { secs: 0.4, wet: 0.08 },
  doca: { secs: 1.2, wet: 0.2 }, rua: { secs: 0.5, wet: 0.06 }, beco: { secs: 0.6, wet: 0.1 }, terraco: { secs: 0.3, wet: 0.04 }, beiral: { secs: 0.2, wet: 0.03 },
};
/** Timbre do passo por piso: volume, altura do estalo, se o salto estala, "toc" de madeira/metal (Hz) e arranhado. */
export const FLOOR_STEP: Record<Floor, { gain: number; pitch: number; click: boolean; knock?: number; grit?: number }> = {
  marble: { gain: 1, pitch: 1, click: true }, stone: { gain: 0.95, pitch: 0.92, click: true, grit: 0.015 },
  parquet: { gain: 0.85, pitch: 0.7, click: true, knock: 190 }, metal: { gain: 1, pitch: 1.1, click: true, knock: 540 },
  concrete: { gain: 0.8, pitch: 0.85, click: true, grit: 0.03 }, sidewalk: { gain: 0.75, pitch: 0.85, click: true, grit: 0.02 },
  asphalt: { gain: 0.7, pitch: 0.8, click: false, grit: 0.035 }, carpet: { gain: 0.4, pitch: 0.45, click: false },
};
export const CROWD: Partial<Record<RoomId, number>> = { rua: 0.7, vestibulo: 0.8, salao: 1, lounge: 0.85, galeria: 0.45, terraco: 0.3, bastidores: 0.2 };
// ii–V–I–VI em dó (Dm9, G13, Cmaj9, A7♭13), em Hz, e as fundamentais do baixo
export const CHORDS = [[146.8, 174.6, 220, 261.6, 329.6], [196, 246.9, 293.7, 349.2, 329.6], [130.8, 164.8, 196, 246.9, 293.7], [110, 138.6, 196, 220, 277.2]];
export const BASS = [[73.4, 82.4, 87.3, 98], [98, 110, 123.5, 98], [65.4, 73.4, 82.4, 87.3], [55, 61.7, 69.3, 73.4]];

/** Resposta ao impulso sintética: ruído com decaimento exponencial (estéreo, levemente diferente em cada lado). */
export function impulse(c: AudioContext, secs: number): AudioBuffer {
  const len = Math.max(1, Math.floor(c.sampleRate * secs)), buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  return buf;
}