/*
 * MET Gala Heist v2 — controles: teclado + mouse (mira com o botão direito, tiro com o esquerdo, câmera com o mouse
 * travado no jogo) e controle de PS5/DualSense no mapeamento padrão (analógicos, L2 mira, R2 atira, ✕ interage, ○ agacha,
 * □ golpe/nocaute (recarrega mirando), △ garrafa, L1 segura a roda de itens, R1 segura a caminhada discreta, direcional ↑
 * cura, ←/→ troca de arma, Options pausa). Cada quadro vira um HeistInput (bordas valem um quadro).
 */
import type { HeistInput } from "@/lib/heist/types";
import { PAD, deadzone, standardPad } from "@/lib/input/gamepad";

export interface ControlSettings { sensitivity: number; invertY: boolean; vibration: boolean }
export const DEFAULT_SETTINGS: ControlSettings = { sensitivity: 1, invertY: false, vibration: true };

export type UiEdge = "wheel-open" | "wheel-close" | "pause" | "weapon-next" | "weapon-prev" | "weapon-1" | "weapon-2" | "weapon-3" | "skip";

const KEYS_MOVE: Record<string, [number, number]> = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };

export class HeistControls {
  yaw = Math.PI; pitch = -0.12;
  settings: ControlSettings = { ...DEFAULT_SETTINGS };
  usingPad = false;
  /** o jogo trava o mouse no canvas (pointer lock); sem ele, arrastar gira a câmera */
  locked = false;
  private keys = new Set<string>();
  private pressed = new Set<string>();
  private mouse = { left: false, right: false, leftPress: false, dragging: false, lx: 0, ly: 0 };
  private padBefore = new Set<number>();
  private sprintLatch = false;
  private edges: UiEdge[] = [];
  private el: HTMLElement | null = null;
  enabled = true;
  /** roda de itens aberta: o mouse escolhe a fatia em vez de girar a câmera */
  wheelMode = false; wheelVec = { x: 0, y: 0 };

  attach(el: HTMLElement) {
    this.el = el;
    window.addEventListener("keydown", this.onKey); window.addEventListener("keyup", this.onKeyUp);
    el.addEventListener("mousedown", this.onDown); window.addEventListener("mouseup", this.onUp); window.addEventListener("mousemove", this.onMove);
    el.addEventListener("contextmenu", this.prevent); document.addEventListener("pointerlockchange", this.onLock);
    window.addEventListener("blur", this.onBlur);
  }
  detach() {
    window.removeEventListener("keydown", this.onKey); window.removeEventListener("keyup", this.onKeyUp);
    this.el?.removeEventListener("mousedown", this.onDown); window.removeEventListener("mouseup", this.onUp); window.removeEventListener("mousemove", this.onMove);
    this.el?.removeEventListener("contextmenu", this.prevent); document.removeEventListener("pointerlockchange", this.onLock);
    window.removeEventListener("blur", this.onBlur);
    if (document.pointerLockElement) document.exitPointerLock?.();
  }
  lock() { try { const r = this.el?.requestPointerLock?.() as unknown as Promise<void> | undefined; r?.catch?.(() => {}); } catch { /* sem pointer lock (app/telefone): arrastar gira */ } }
  unlock() { if (document.pointerLockElement) document.exitPointerLock?.(); }
  takeEdges(): UiEdge[] { const e = this.edges; this.edges = []; return e; }
  reset() { this.keys.clear(); this.pressed.clear(); this.mouse.left = this.mouse.right = this.mouse.leftPress = false; this.sprintLatch = false; }

  private prevent = (e: Event) => e.preventDefault();
  private onLock = () => { this.locked = document.pointerLockElement === this.el; };
  private onBlur = () => this.reset();
  private onKey = (e: KeyboardEvent) => {
    if (!this.enabled) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    this.usingPad = false;
    if (e.code === "Tab") { e.preventDefault(); if (!e.repeat) this.edges.push("wheel-open"); }
    if (e.code === "Escape" || e.code === "KeyP") { if (!e.repeat) this.edges.push("pause"); return; }
    if (e.code === "Digit1") this.edges.push("weapon-1"); if (e.code === "Digit2") this.edges.push("weapon-2"); if (e.code === "Digit3") this.edges.push("weapon-3");
    if (e.code === "Enter" && !e.repeat) this.edges.push("skip");
    if (KEYS_MOVE[e.code] || e.code === "Space") e.preventDefault();
    if (!e.repeat) this.pressed.add(e.code);
    this.keys.add(e.code);
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); if (e.code === "Tab") this.edges.push("wheel-close"); };
  private onDown = (e: MouseEvent) => {
    if (!this.enabled) return;
    this.usingPad = false;
    if (!this.locked && e.button === 0) this.lock();
    if (e.button === 0) { this.mouse.left = true; this.mouse.leftPress = this.locked; }
    if (e.button === 2) this.mouse.right = true;
    this.mouse.dragging = !this.locked; this.mouse.lx = e.clientX; this.mouse.ly = e.clientY;
  };
  private onUp = (e: MouseEvent) => { if (e.button === 0) { this.mouse.left = false; this.mouse.dragging = false; } if (e.button === 2) this.mouse.right = false; };
  private onMove = (e: MouseEvent) => {
    if (!this.enabled) return;
    let dx = 0, dy = 0;
    if (this.locked) { dx = e.movementX; dy = e.movementY; }
    else if (this.mouse.dragging) { dx = e.clientX - this.mouse.lx; dy = e.clientY - this.mouse.ly; this.mouse.lx = e.clientX; this.mouse.ly = e.clientY; }
    else return;
    if (this.wheelMode) { const v = this.wheelVec; v.x += dx; v.y += dy; const l = Math.hypot(v.x, v.y); if (l > 80) { v.x *= 80 / l; v.y *= 80 / l; } return; }
    const k = 0.0024 * this.settings.sensitivity * (this.mouse.right ? 0.6 : 1);
    this.yaw -= dx * k; this.pitch = clampPitch(this.pitch - dy * k * (this.settings.invertY ? -1 : 1));
  };

  /** Lê teclado, mouse e controle do quadro. `dt` em segundos (o analógico direito gira a câmera por velocidade). */
  frame(dt: number): HeistInput {
    const k = this.keys, pr = this.pressed;
    let mx = 0, my = 0;
    for (const code of k) { const v = KEYS_MOVE[code]; if (v) { mx += v[0]; my += v[1]; } }
    const kl = Math.hypot(mx, my); if (kl > 1) { mx /= kl; my /= kl; }
    const inp: HeistInput = {
      move: { x: mx, y: my }, camYaw: this.yaw, camPitch: this.pitch, aimYaw: this.yaw, aimPitch: this.pitch,
      sprint: k.has("ShiftLeft") || k.has("ShiftRight"), crouchPress: pr.has("KeyC") || pr.has("ControlLeft"), discreet: k.has("KeyQ"),
      interactPress: pr.has("KeyE") || pr.has("Space"), aim: this.mouse.right, fire: this.mouse.left && this.locked, firePress: this.mouse.leftPress,
      reloadPress: pr.has("KeyR"), meleePress: pr.has("KeyF"), healPress: pr.has("KeyH"), throwPress: pr.has("KeyG"),
    };
    this.mouse.leftPress = false; pr.clear();
    const pad = typeof navigator !== "undefined" && "getGamepads" in navigator ? standardPad() : null;
    if (pad) {
      const held = (i: number) => !!pad.buttons[i]?.pressed, tap = (i: number) => held(i) && !this.padBefore.has(i);
      const move = deadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0), look = deadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
      const any = move.x || move.y || look.x || look.y || pad.buttons.some((b) => b.pressed);
      if (any) this.usingPad = true;
      if (this.usingPad) {
        if (move.x || move.y) { inp.move = { x: move.x, y: -move.y }; } else if (!(mx || my)) this.sprintLatch = false;
        const aiming = held(PAD.l2);
        const rate = 2.6 * this.settings.sensitivity * (aiming ? 0.55 : 1);
        this.yaw -= look.x * rate * dt; this.pitch = clampPitch(this.pitch - look.y * rate * 0.7 * dt * (this.settings.invertY ? -1 : 1));
        inp.camYaw = inp.aimYaw = this.yaw; inp.camPitch = inp.aimPitch = this.pitch;
        if (tap(PAD.l3)) this.sprintLatch = !this.sprintLatch;
        inp.sprint ||= this.sprintLatch;
        inp.crouchPress ||= tap(PAD.circle);
        inp.discreet ||= held(PAD.r1);
        inp.interactPress ||= tap(PAD.cross);
        inp.aim ||= aiming;
        inp.fire ||= held(PAD.r2); inp.firePress ||= tap(PAD.r2);
        if (aiming) inp.reloadPress ||= tap(PAD.square); else inp.meleePress ||= tap(PAD.square);
        inp.throwPress ||= tap(PAD.triangle);
        inp.healPress ||= tap(PAD.up);
        if (tap(PAD.l1)) this.edges.push("wheel-open");
        if (!held(PAD.l1) && this.padBefore.has(PAD.l1)) this.edges.push("wheel-close");
        if (tap(PAD.options)) this.edges.push("pause");
        if (tap(PAD.right)) this.edges.push("weapon-next");
        if (tap(PAD.left)) this.edges.push("weapon-prev");
        if (tap(PAD.cross)) this.edges.push("skip");
      }
      this.padBefore = new Set(pad.buttons.map((b, i) => (b.pressed ? i : -1)).filter((i) => i >= 0));
    }
    return inp;
  }

  /** Analógico direito/esquerdo para a roda de itens (direção do pedaço escolhido), em radianos; null sem direção. */
  wheelDirection(mouseDx: number, mouseDy: number): number | null {
    const pad = typeof navigator !== "undefined" && "getGamepads" in navigator ? standardPad() : null;
    if (pad && this.usingPad) {
      const a = deadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0), b = deadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
      const v = Math.hypot(a.x, a.y) > 0.4 ? a : Math.hypot(b.x, b.y) > 0.4 ? b : null;
      return v ? Math.atan2(v.x, -v.y) : null;
    }
    return Math.hypot(mouseDx, mouseDy) > 18 ? Math.atan2(mouseDx, -mouseDy) : null;
  }

  rumble(strong: number, weak: number, ms: number) {
    if (!this.settings.vibration || !this.usingPad) return;
    const pad = standardPad() as (Gamepad & { vibrationActuator?: { playEffect?: (t: string, p: Record<string, number>) => Promise<unknown> } }) | null;
    pad?.vibrationActuator?.playEffect?.("dual-rumble", { duration: ms, strongMagnitude: strong, weakMagnitude: weak })?.catch?.(() => {});
  }
}

const clampPitch = (p: number) => Math.max(-1.05, Math.min(0.75, p));
