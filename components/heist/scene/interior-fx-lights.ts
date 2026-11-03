/*
 * MET Gala Heist v2 — luzes dinâmicas do interior (interior-fx.ts): o conjunto fixo de luzes pontuais que segue as
 * âncoras mais fortes perto da câmera, a cintilação (vela ou fluorescente com defeito) e a luz-chave com sombra.
 */
import * as THREE from "three";
import { areaKeys } from "./areas";
import type { KeyDef as AreaKeyDef } from "./areas/types";
import type { RoomId } from "@/lib/heist/types";
import { isInterior, type InteriorRoom } from "./interior-shell";
import type { LightAnchor } from "./interior-props";

/** Serviço, doca e segurança: luz fria que treme (fluorescente); nas outras, a "cintilação" é de chama de vela. */
const FLUORESCENT = new Set<RoomId>(["servico", "seguranca", "doca"]);

/* ---------- conjunto de luzes dinâmicas ---------- */
/**
 * `n` luzes pontuais sem sombra, sempre presentes (intensidade 0 quando livres). A cada quadro as âncoras das salas
 * acesas são pontuadas por intensidade / distância² até a câmera; as `n` melhores ocupam as luzes, com troca suave
 * (a que sai apaga em ~0,25 s, a que entra acende) para não piscar quando a câmera anda.
 */
export class LightPool {
  readonly group = new THREE.Group();
  private lights: THREE.PointLight[] = [];
  private slots: { a: LightAnchor | null; w: number }[] = [];
  private colors = new WeakMap<LightAnchor, THREE.Color>();
  private scored: { a: LightAnchor; s: number }[] = [];
  private first = true;
  constructor(n: number) {
    this.group.name = "interior-lights";
    for (let k = 0; k < n; k++) {
      const l = new THREE.PointLight("#ffffff", 0, 4, 2); l.castShadow = false; this.lights.push(l); this.group.add(l);
      this.slots.push({ a: null, w: 0 });
    }
  }
  /** `gain(a)` devolve o multiplicador da âncora agora (cintilação, alarme, energia cortada); 0 tira da disputa. */
  update(anchors: readonly LightAnchor[], lit: Set<RoomId>, core: Set<RoomId>, focus: THREE.Vector3, dt: number, gain: (a: LightAnchor) => number, snap = false) {
    const sc = this.scored; sc.length = 0;
    for (const a of anchors) {
      if (!lit.has(a.room)) continue;
      if (!core.has(a.room) && a.intensity < 8 && !a.alarm) continue;
      const g = gain(a); if (g <= 0) continue;
      const dx = a.x - focus.x, dy = a.y - focus.y, dz = a.z - focus.z;
      sc.push({ a, s: (a.intensity * g) / (1 + dx * dx + dy * dy + dz * dz) * (a.alarm ? 4 : 1) * (core.has(a.room) ? 1 : 0.33) });
    }
    sc.sort((p, q) => q.s - p.s);
    const want = new Set<LightAnchor>(); for (let k = 0; k < Math.min(this.slots.length, sc.length); k++) want.add(sc[k].a);
    const rate = this.first || snap ? 1e9 : dt * 4;
    const held = new Set<LightAnchor>();
    for (const s of this.slots) {
      if (!s.a) continue;
      if (want.has(s.a)) { s.w = Math.min(1, s.w + rate); held.add(s.a); } else { s.w = Math.max(0, s.w - rate); if (s.w === 0) s.a = null; }
    }
    for (const a of want) {
      if (held.has(a)) continue;
      const free = this.slots.find((s) => !s.a); if (!free) break;
      free.a = a; free.w = this.first || snap ? 1 : 0; held.add(a);
    }
    this.first = false;
    this.slots.forEach((s, k) => {
      const l = this.lights[k];
      if (!s.a) { l.intensity = 0; return; }
      const a = s.a; let c = this.colors.get(a); if (!c) { c = new THREE.Color(a.color); this.colors.set(a, c); }
      l.position.set(a.x, a.y, a.z); l.color.copy(c); l.distance = a.distance; l.intensity = a.intensity * gain(a) * s.w * LIGHT_GAIN;
    });
  }
}
/** Ganho global das âncoras (calibrado nas capturas: candela → brilho com exposição 1 e ACES). */
export const LIGHT_GAIN = 1.8;

/** Cintilação: chama (rápida e pequena) ou fluorescente com defeito (apaga e volta de vez em quando). */
export function flickerOf(a: LightAnchor, t: number): number {
  const f = a.flicker ?? 0; if (!f) return 1;
  const ph = a.x * 3.1 + a.z * 1.7;
  if (FLUORESCENT.has(a.room)) { const c = (t * 0.9 + ph) % 7; return c < 0.12 || (c > 0.3 && c < 0.38) ? 0.15 : 1; }
  return 1 - f * (0.1 + 0.08 * Math.sin(t * 11.3 + ph) + 0.06 * Math.sin(t * 23.7 + ph * 2.3) + 0.04 * Math.sin(t * 5.1 + ph * 0.7));
}

/* ---------- luz-chave com sombra (só "high") ---------- */
type KeyDef = AreaKeyDef;
/** A fonte principal de cada sala (lustre, refletor, luminária de teto) — a única luz interna que faz sombra. */
const KEYS: Partial<Record<InteriorRoom, KeyDef[]>> = {
  vestibulo: [{ p: [0, 6.05, 19.5], aim: [0, 0, 19.2], angle: 1.0, i: 60, color: "#ffd9a8" }],
  salao: [
    { p: [-8.25, 8.9, 4.5], aim: [-6.5, 0, 4.5], angle: 0.8, i: 80, color: "#ffd29a" },
    { p: [8.25, 8.9, 4.5], aim: [6.5, 0, 4.5], angle: 0.8, i: 80, color: "#ffd29a" },
    { p: [0, 9.2, 11.6], aim: [0, 0, 10.4], angle: 0.78, i: 70, color: "#ffdcae" },
    { p: [0, 9.2, -2.6], aim: [0, 0, -1.8], angle: 0.78, i: 70, color: "#ffdcae" },
  ],
  galeria: [{ p: [-5, 5.25, -14], aim: [-5, 0, -14.5], angle: 1.0, i: 45, color: "#fff1dc" }, { p: [5, 5.25, -14], aim: [5, 0, -14.5], angle: 1.0, i: 45, color: "#fff1dc" }],
  lounge: [{ p: [17.2, 4.45, 9.3], aim: [17.2, 0, 9.3], angle: 1.05, i: 38, color: "#ffc98a" }],
  bastidores: [{ p: [17.2, 4.45, -1], aim: [17.2, 0, -1], angle: 1.05, i: 40, color: "#fff0d8" }],
  seguranca: [{ p: [-20.2, 3.45, 4.75], aim: [-20.2, 0, 4.75], angle: 1.1, i: 22, color: "#eef6ff" }],
  doca: [{ p: [-15.2, 5.8, 20.2], aim: [-15.2, 0, 20.2], angle: 1.05, i: 55, color: "#ffc27a" }],
  cofre: [{ p: [-17.25, 5.05, -14.25], aim: [-17.25, 0, -14.25], angle: 1.0, i: 95, color: "#f2f6ff" }],
};
/**
 * Um SpotLight com sombra que acompanha a sala da jogadora: a fonte da lista mais perto dela (com folga para não trocar
 * à toa). A troca apaga a atual e acende a nova; sem fonte (labirinto, terraço — lá a lua faz a sombra) fica em 0 e o
 * mapa de sombra para de ser redesenhado. O número de luzes com sombra nunca muda (nada recompila).
 */
export class KeyLight {
  readonly light: THREE.SpotLight;
  private cur: KeyDef | null = null;
  private w = 0;
  private first = true;
  private warm = 3;
  constructor(size: number) {
    const l = new THREE.SpotLight("#ffffff", 0, 0, 0.9, 0.8, 2);
    l.castShadow = true; l.shadow.mapSize.set(size, size); l.shadow.bias = -0.0005; l.shadow.normalBias = 0.04; l.shadow.radius = 5;
    l.shadow.camera.near = 0.3; l.shadow.camera.far = 26; l.name = "interior-key";
    this.light = l;
  }
  update(room: RoomId, px: number, pz: number, dt: number, gain: number) {
    const list = isInterior(room) ? areaKeys(room) ?? KEYS[room] : undefined;
    let want: KeyDef | null = null, best = 1e9;
    for (const k of list ?? []) { const d = Math.hypot(k.aim[0] - px, k.aim[2] - pz) - (k === this.cur ? 2.5 : 0); if (d < best) { best = d; want = k; } }
    const rate = this.first ? 1e9 : dt * 3.5;
    if (want !== this.cur) { this.w = Math.max(0, this.w - rate); if (this.w === 0) this.cur = want; }
    else this.w = Math.min(1, this.w + rate);
    this.first = false;
    const l = this.light, k = this.cur;
    l.shadow.autoUpdate = (!!k && this.w > 0) || this.warm-- > 0;
    if (!k) { l.intensity = 0; return; }
    l.position.set(...k.p); l.target.position.set(...k.aim); l.target.updateMatrixWorld();
    l.angle = k.angle; l.color.set(k.color); l.intensity = k.i * this.w * gain * LIGHT_GAIN;
  }
}
