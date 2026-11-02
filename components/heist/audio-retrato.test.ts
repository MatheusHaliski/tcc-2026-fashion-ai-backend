// @vitest-environment jsdom
/*
 * Retrato (caracterização) de HeistAudio: um AudioContext falso grava cada nó criado, cada ligação, parâmetro, início e
 * parada; Math.random é determinístico. O registro inteiro (música de um passo do agendador, sala, intensidade, cada
 * efeito, alarme, batimento, abaixar, passos por piso) vira contagens por tipo de nó mais um SHA-256, gravados no
 * código original. A divisão de audio.ts tem de manter o retrato idêntico.
 */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Floor, RoomId } from "@/lib/heist/types";
import { HeistAudio } from "./audio";

const log: unknown[] = [];
let ids = 0;
const r = (n: number) => Math.round(n * 1e6) / 1e6;
class Param {
  value = 0;
  constructor(private node: string, private name: string) {}
  private rec(op: string, ...a: number[]) { log.push([this.node, this.name, op, ...a.map(r)]); }
  setValueAtTime(v: number, t: number) { this.rec("set", v, t); }
  linearRampToValueAtTime(v: number, t: number) { this.rec("lin", v, t); }
  exponentialRampToValueAtTime(v: number, t: number) { this.rec("exp", v, t); }
  setTargetAtTime(v: number, t: number, k: number) { this.rec("target", v, t, k); }
  cancelScheduledValues(t: number) { this.rec("cancel", t); }
}
class Node {
  id: string;
  constructor(kind: string, params: string[]) {
    this.id = `${kind}#${ids++}`; log.push(["new", this.id]);
    const self = this as unknown as Record<string, unknown>;
    for (const p of params) {
      const param = new Param(this.id, p);
      Object.defineProperty(self, p, { get: () => param, set: (v: number) => { param.value = v; log.push([this.id, p, "value", r(v)]); } });
    }
    return new Proxy(this, { set(t, k: string, v) { if (!(k in t) && typeof v !== "object") log.push([t.id, "prop", k, typeof v === "number" ? r(v) : v]); (t as unknown as Record<string, unknown>)[k] = v; return true; } });
  }
  connect(to: Node | Param) { log.push([this.id, "connect", to instanceof Param ? `${(to as unknown as { node: string }).node}.${(to as unknown as { name: string }).name}` : to.id]); return to; }
  start(t = 0) { log.push([this.id, "start", r(t)]); }
  stop(t = 0) { log.push([this.id, "stop", r(t)]); }
}
class Buffer {
  private data: Float32Array[];
  constructor(ch: number, public length: number, public sampleRate: number) { this.data = Array.from({ length: ch }, () => new Float32Array(length)); }
  getChannelData(i: number) { return this.data[i]; }
  sum() { return this.data.map((d) => r(d.reduce((a, b) => a + b, 0))); }
}
class FakeContext {
  currentTime = 1.5; sampleRate = 8000; destination = new Node("destination", []);
  buffers: Buffer[] = [];
  createGain() { return new Node("gain", ["gain"]); }
  createOscillator() { return new Node("osc", ["frequency"]); }
  createBiquadFilter() { return new Node("filter", ["frequency", "Q"]); }
  createBufferSource() { return new Node("source", []); }
  createConvolver() { return new Node("convolver", []); }
  createStereoPanner() { return new Node("panner", ["pan"]); }
  createBuffer(ch: number, len: number, rate: number) { const b = new Buffer(ch, len, rate); this.buffers.push(b); log.push(["buffer", ch, len, rate]); return b; }
  close() { log.push(["close"]); return Promise.resolve(); }
}

const ROOMS: RoomId[] = ["rua", "beco", "vestibulo", "salao", "galeria", "lounge", "terraco", "beiral", "bastidores", "servico", "seguranca", "doca", "cofre"];
const FLOORS: Floor[] = ["marble", "carpet", "concrete", "parquet", "stone", "metal", "asphalt", "sidewalk"];
const SFX = ["shot", "shotFar", "silenced", "hit", "hurt", "empty", "reload", "heal", "detector", "laser", "locked", "door", "cloth", "trade", "buy", "solved", "mistake", "key", "glass", "throw",
  "vision", "slow", "melee", "down", "flash", "step", "objective", "detected", "ui", "nada"];

let ctx: FakeContext;
beforeEach(() => {
  log.length = 0; ids = 0;
  let seed = 12345;
  vi.spyOn(Math, "random").mockImplementation(() => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; });
  vi.useFakeTimers();
  (window as unknown as { AudioContext: unknown }).AudioContext = class { constructor() { ctx = new FakeContext(); return ctx; } };
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("retrato do áudio sintetizado (HeistAudio)", () => {
  it("mesmo grafo de nós, parâmetros e amostras para a sessão de exemplo", () => {
    const a = new HeistAudio();
    a.setListener(2, -3, 0.4);
    a.play("ui");                                            // antes de começar: nada
    a.start();
    const counts = () => { const c: Record<string, number> = {}; for (const e of log) if (Array.isArray(e) && e[0] === "new") { const k = String(e[1]).split("#")[0]; c[k] = (c[k] ?? 0) + 1; } return c; };
    vi.advanceTimersByTime(120);                             // um passo do agendador da música
    const musicNodes = counts();
    for (const room of ROOMS) { a.setRoom(room); ctx.currentTime += 0.01; }
    a.setRoom("salao");
    for (const [level, exposure] of [[0, 0], [0, 0.5], [1, 0.3], [1, 0.9], [2, 0]]) a.setIntensity(level, exposure);
    a.setMix(0.3, 0.6, false, 0.5);
    for (const id of SFX) { a.play(id); a.play(id, 0.7, { x: 5, z: 1 }); }
    a.occluded = (p) => p.x > 4;
    a.play("shot", 1, { x: 5, z: 1 }); a.play("shot", 1, { x: -5, z: 1 });
    a.alarm(true); a.alarm(true); a.alarm(false); a.alarm(false);
    a.heartbeat(10, 0); a.heartbeat(10, 0.5); a.heartbeat(10.2, 0.5); a.heartbeat(12, 0.9);
    a.duck(2.6);
    for (const kind of ["heels", "soft", "boots"] as const) for (const floor of FLOORS) a.step(kind, 0.8, { x: 1, z: 2 }, floor);
    a.step("heels", 1); a.step("soft", 0.5, undefined, "carpet");
    a.speak("olá", true, { x: 1, z: 1 });                    // sem speechSynthesis no jsdom: nada
    a.stop();
    const samples = ctx.buffers.map((b) => [b.length, b.sampleRate, ...b.sum()]);
    const sha = createHash("sha256").update(JSON.stringify({ log, samples })).digest("hex");
    expect({ musicNodes, nodes: counts(), events: log.length, buffers: ctx.buffers.length, sha }).toMatchSnapshot();
  });
});
