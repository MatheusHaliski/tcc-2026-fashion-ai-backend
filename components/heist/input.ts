/*
 * MET Gala Heist v2 — controles: teclado + mouse (mira com o botão direito, tiro com o esquerdo, câmera com o mouse
 * travado no jogo) e controle de PS5/DualSense no mapeamento padrão. Todos os comandos vêm do remapeamento
 * (settings.ts); agachar, caminhada discreta e mira podem ser de alternar ou de segurar. Cada quadro vira um HeistInput
 * (bordas valem um quadro) e as ações de interface (roda, mapa, pausa, armas, ombro, pular cena) viram bordas próprias.
 */
import type { HeistInput } from "@/lib/heist/types";
import { deadzone, standardPad } from "@/lib/input/gamepad";
import { DEFAULT_SETTINGS, type HeistSettings, type KeyAction } from "./settings";

export type UiEdge = "wheel-open" | "wheel-close" | "pause" | "map" | "weapon-next" | "weapon-prev" | "weapon-1" | "weapon-2" | "weapon-3" | "skip" | "shoulder" | "fps" | "back";

export class HeistControls {
  yaw = Math.PI; pitch = -0.12;
  settings: HeistSettings = { ...DEFAULT_SETTINGS };
  usingPad = false;
  /** o jogo trava o mouse no canvas (pointer lock); sem ele, arrastar gira a câmera */
  locked = false;
  enabled = true;
  /** roda de itens aberta: o mouse escolhe a fatia em vez de girar a câmera */
  wheelMode = false; wheelVec = { x: 0, y: 0 };
  /** captura de tecla para o remapeamento (a próxima tecla vai para `capture`) */
  capture: ((code: string) => void) | null = null;
  private keys = new Set<string>();
  private pressed = new Set<string>();
  private mouse = { left: false, right: false, leftPress: false, dragging: false, lx: 0, ly: 0 };
  private padBefore = new Set<number>();
  private latch = { sprint: false, crouch: false, discreet: false, aim: false };
  private crouchRelease = false;
  private edges: UiEdge[] = [];
  private el: HTMLElement | null = null;

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
  reset() { this.keys.clear(); this.pressed.clear(); this.mouse.left = this.mouse.right = this.mouse.leftPress = false; this.latch = { sprint: false, crouch: false, discreet: false, aim: false }; }

  private is(action: KeyAction, code: string) { return this.settings.keys[action]?.includes(code) ?? false; }
  private held(action: KeyAction) { return (this.settings.keys[action] ?? []).some((c) => this.keys.has(c)); }
  private tapped(action: KeyAction) { return (this.settings.keys[action] ?? []).some((c) => this.pressed.has(c)); }

  private prevent = (e: Event) => e.preventDefault();
  private onLock = () => { this.locked = document.pointerLockElement === this.el; };
  private onBlur = () => this.reset();
  private onKey = (e: KeyboardEvent) => {
    if (this.capture) { e.preventDefault(); const f = this.capture; this.capture = null; f(e.code); return; }
    if (!this.enabled) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    this.usingPad = false;
    if (this.is("wheel", e.code)) { e.preventDefault(); if (!e.repeat) this.edges.push("wheel-open"); }
    if (this.is("pause", e.code)) { if (!e.repeat) this.edges.push("pause"); return; }
    if (e.code === "F3") { e.preventDefault(); if (!e.repeat) this.edges.push("fps"); return; }
    if (!e.repeat) {
      if (this.is("map", e.code)) this.edges.push("map");
      if (this.is("weapon1", e.code)) this.edges.push("weapon-1");
      if (this.is("weapon2", e.code)) this.edges.push("weapon-2");
      if (this.is("weapon3", e.code)) this.edges.push("weapon-3");
      if (this.is("skip", e.code)) this.edges.push("skip");
      if (this.is("shoulder", e.code)) this.edges.push("shoulder");
    }
    if (["forward", "back", "left", "right", "dodge"].some((a) => this.is(a as KeyAction, e.code))) e.preventDefault();
    if (!e.repeat) this.pressed.add(e.code);
    this.keys.add(e.code);
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (this.is("wheel", e.code)) this.edges.push("wheel-close");
    // agachar de segurar: soltar a tecla levanta (a simulação alterna a cada toque)
    if (this.is("crouch", e.code) && !this.settings.toggleCrouch) this.crouchRelease = true;
  };
  private onDown = (e: MouseEvent) => {
    if (!this.enabled) return;
    this.usingPad = false;
    if (!this.locked && e.button === 0) this.lock();
    if (e.button === 0) { this.mouse.left = true; this.mouse.leftPress = this.locked; }
    if (e.button === 2) { this.mouse.right = true; if (this.settings.toggleAim) this.latch.aim = !this.latch.aim; }
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
    const aiming = this.settings.toggleAim ? this.latch.aim : this.mouse.right;
    const k = 0.0024 * this.settings.sensitivity * (aiming ? 0.6 : 1);
    this.yaw -= dx * k; this.pitch = clampPitch(this.pitch - dy * k * (this.settings.invertY ? -1 : 1));
  };

  /** Lê teclado, mouse e controle do quadro. `dt` em segundos (o analógico direito gira a câmera por velocidade). */
  frame(dt: number): HeistInput {
    const st = this.settings;
    let mx = Number(this.held("right")) - Number(this.held("left")), my = Number(this.held("forward")) - Number(this.held("back"));
    const kl = Math.hypot(mx, my); if (kl > 1) { mx /= kl; my /= kl; }
    // agachar, discreta e mira podem ser de segurar ou de alternar
    if (this.tapped("discreet") && st.toggleDiscreet) this.latch.discreet = !this.latch.discreet;
    const inp: HeistInput = {
      move: { x: mx, y: my }, camYaw: this.yaw, camPitch: this.pitch, aimYaw: this.yaw, aimPitch: this.pitch,
      sprint: this.held("sprint"), crouchPress: this.tapped("crouch") || this.crouchRelease, discreet: st.toggleDiscreet ? this.latch.discreet : this.held("discreet"),
      interactPress: this.tapped("interact"), aim: st.toggleAim ? this.latch.aim : this.mouse.right, fire: this.mouse.left && this.locked, firePress: this.mouse.leftPress,
      reloadPress: this.tapped("reload"), meleePress: this.tapped("melee"), healPress: this.tapped("heal"), throwPress: this.tapped("throw"), dodgePress: this.tapped("dodge"),
    };
    this.mouse.leftPress = false; this.pressed.clear(); this.crouchRelease = false;
    const pad = typeof navigator !== "undefined" && "getGamepads" in navigator ? standardPad() : null;
    if (pad) {
      const P = st.pad;
      const held = (i: number) => !!pad.buttons[i]?.pressed, tap = (i: number) => held(i) && !this.padBefore.has(i);
      const move = deadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0), look = deadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
      const any = move.x || move.y || look.x || look.y || pad.buttons.some((b) => b.pressed);
      if (any) this.usingPad = true;
      if (this.usingPad) {
        if (move.x || move.y) inp.move = { x: move.x, y: -move.y }; else if (!(mx || my)) this.latch.sprint = false;
        if (st.toggleAim && tap(P.aim)) this.latch.aim = !this.latch.aim;
        const aiming = st.toggleAim ? this.latch.aim : held(P.aim);
        const rate = 2.6 * st.sensitivity * (aiming ? 0.55 : 1);
        if (!this.wheelMode) { this.yaw -= look.x * rate * dt; this.pitch = clampPitch(this.pitch - look.y * rate * 0.7 * dt * (st.invertY ? -1 : 1)); }
        inp.camYaw = inp.aimYaw = this.yaw; inp.camPitch = inp.aimPitch = this.pitch;
        if (tap(P.sprint)) this.latch.sprint = !this.latch.sprint;
        inp.sprint ||= this.latch.sprint;
        inp.crouchPress ||= tap(P.crouch) || (!st.toggleCrouch && !held(P.crouch) && this.padBefore.has(P.crouch));
        if (st.toggleDiscreet && tap(P.discreet)) this.latch.discreet = !this.latch.discreet;
        inp.discreet ||= st.toggleDiscreet ? this.latch.discreet : held(P.discreet);
        inp.interactPress ||= tap(P.interact);
        inp.aim ||= aiming;
        inp.fire ||= held(P.fire); inp.firePress ||= tap(P.fire);
        if (aiming) inp.reloadPress ||= tap(P.melee); else inp.meleePress ||= tap(P.melee);
        inp.throwPress ||= tap(P.throw);
        inp.healPress ||= tap(P.heal);
        inp.dodgePress ||= tap(P.dodge);
        if (tap(P.wheel)) this.edges.push("wheel-open");
        if (!held(P.wheel) && this.padBefore.has(P.wheel)) this.edges.push("wheel-close");
        if (tap(P.pause)) this.edges.push("pause");
        if (tap(P.map)) this.edges.push("map");
        if (tap(P.weaponNext)) this.edges.push("weapon-next");
        if (tap(P.weaponPrev)) this.edges.push("weapon-prev");
        if (tap(P.shoulder)) this.edges.push("shoulder");
        if (tap(P.interact)) this.edges.push("skip");
        if (tap(P.dodge)) this.edges.push("back");
      }
      this.padBefore = new Set(pad.buttons.map((b, i) => (b.pressed ? i : -1)).filter((i) => i >= 0));
    }
    return inp;
  }

  /** Direção escolhida na roda de itens (analógico ou mouse), em radianos; null sem direção. */
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
